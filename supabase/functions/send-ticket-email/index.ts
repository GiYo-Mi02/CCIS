import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";
import { resolveSupabasePublishableKey, resolveSupabaseSecretKey } from "../_shared/supabase-keys.js";

const MAX_BODY_BYTES = 2_048;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function readRegistrationId(req: Request): Promise<string> {
  const contentType = req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new Error("UNSUPPORTED_MEDIA_TYPE");
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
  const body = JSON.parse(raw) as { registrationId?: unknown };
  if (typeof body.registrationId !== "string" || !UUID_RE.test(body.registrationId)) {
    throw new Error("INVALID_REGISTRATION_ID");
  }
  return body.registrationId;
}

serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const corsOrigin = Deno.env.get("APP_ORIGIN") || "*";
  const corsHeaders = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "METHOD_NOT_ALLOWED" }, { ...corsHeaders, Allow: "POST" });

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json(401, { success: false, error: "UNAUTHORIZED" }, corsHeaders);
  }

  let registrationId: string;
  try {
    registrationId = await readRegistrationId(req);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_REQUEST";
    const status = code === "PAYLOAD_TOO_LARGE" ? 413 : code === "UNSUPPORTED_MEDIA_TYPE" ? 415 : 400;
    return json(status, { success: false, error: code }, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = resolveSupabasePublishableKey((name) => Deno.env.get(name));
  const serviceRoleKey = resolveSupabaseSecretKey((name) => Deno.env.get(name));
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error(`[ticket-email:${requestId}] configuration_error`);
    return json(503, { success: false, error: "SERVICE_NOT_CONFIGURED" }, corsHeaders);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await callerClient.auth.getUser();
  if (authError || !authData.user) return json(401, { success: false, error: "UNAUTHORIZED" }, corsHeaders);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: retryAfter, error: rateError } = await admin.rpc("consume_edge_rate_limit", {
    p_operation: "ticket_email",
    p_subject: authData.user.id,
    p_limit: 3,
    p_window_seconds: 3600,
  });
  if (rateError) return json(500, { success: false, error: "RATE_LIMIT_CHECK_FAILED" }, corsHeaders);
  if (Number(retryAfter) > 0) {
    return json(429, { success: false, error: "RATE_LIMITED" }, {
      ...corsHeaders,
      "Retry-After": String(retryAfter),
    });
  }

  const { data: registration, error: registrationError } = await admin
    .from("event_registrations")
    .select("id, profile_id, status, events(title), profiles(full_name, email, program, section)")
    .eq("id", registrationId)
    .maybeSingle();
  if (registrationError || !registration) return json(404, { success: false, error: "REGISTRATION_NOT_FOUND" }, corsHeaders);

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  const isStaff = ["devcom_head", "comm_registration"].includes(callerProfile?.role || "");
  if (registration.profile_id !== authData.user.id && !isStaff) {
    return json(403, { success: false, error: "FORBIDDEN" }, corsHeaders);
  }

  const profile = registration.profiles as unknown as {
    full_name?: string; email?: string; program?: string; section?: string;
  } | null;
  const event = registration.events as unknown as { title?: string } | null;
  if (!profile?.email) return json(400, { success: false, error: "RECIPIENT_EMAIL_MISSING" }, corsHeaders);

  const logicalKey = `ticket:${registration.id}`;
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#FAF7EA;color:#123524;padding:32px">
    <main style="max-width:560px;margin:auto;background:#fff;border:1px solid rgba(18,53,36,.22);border-radius:20px;padding:28px">
      <p style="color:#FFBC00;font-weight:bold;text-transform:uppercase;letter-spacing:2px">Official participant pass</p>
      <h1>${escapeHtml(event?.title || "CCIS Event")}</h1>
      <p><strong>Heron:</strong> ${escapeHtml(profile.full_name || "Student")}<br>
      <strong>Program / section:</strong> ${escapeHtml(profile.program || "CCIS")} / ${escapeHtml(profile.section || "N/A")}<br>
      <strong>Ticket reference:</strong> <code>${registration.id}</code></p>
      <p>Open your CCIS Portal account to display the scannable ticket. Do not share this reference.</p>
    </main></body></html>`;

  const { error: insertError } = await admin.from("email_queue").insert({
    profile_id: registration.profile_id,
    recipient_email: profile.email,
    email_type: "ticket",
    subject: `[CCIS SC] Participant pass — ${event?.title || "CCIS Event"}`,
    html_body: html,
    logical_key: logicalKey,
    provider_idempotency_key: `ticket-${registration.id}`,
  });

  if (insertError && insertError.code !== "23505") {
    console.error(`[ticket-email:${requestId}] queue_failed code=${insertError.code || "UNKNOWN"}`);
    return json(500, { success: false, error: "QUEUE_FAILED" }, corsHeaders);
  }

  const { data: queued } = await admin
    .from("email_queue")
    .select("id, status, created_at")
    .eq("logical_key", logicalKey)
    .single();

  console.log(`[ticket-email:${requestId}] registration=${registration.id} state=${queued?.status || "queued"}`);
  return json(200, {
    success: true,
    queued: !insertError,
    status: queued?.status || "pending",
    queueId: queued?.id,
  }, corsHeaders);
});
