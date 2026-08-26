import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";
import { resolveSupabasePublishableKey, resolveSupabaseSecretKey } from "../_shared/supabase-keys.js";

const MAX_BODY_BYTES = 512;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROUTE_RE = /^\/[A-Za-z0-9/_-]{0,200}$/;
const RELEASE_RE = /^[A-Za-z0-9._-]{1,100}$/;

const json = (status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

async function readErrorEvent(req: Request) {
  const contentType = req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new Error("UNSUPPORTED_MEDIA_TYPE");
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
  const body = JSON.parse(raw) as { referenceId?: unknown; route?: unknown; release?: unknown };
  if (!body || Array.isArray(body) || typeof body !== "object"
    || typeof body.referenceId !== "string" || !UUID_RE.test(body.referenceId)
    || typeof body.route !== "string" || !ROUTE_RE.test(body.route)
    || typeof body.release !== "string" || !RELEASE_RE.test(body.release)) {
    throw new Error("INVALID_EVENT");
  }
  return body as { referenceId: string; route: string; release: string };
}

async function requestSubject(req: Request) {
  const source = req.headers.get("cf-connecting-ip")
    || req.headers.get("x-forwarded-for")?.split(",", 1)[0]
    || req.headers.get("x-real-ip")
    || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" }, { ...corsHeaders, Allow: "POST" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = resolveSupabasePublishableKey((name) => Deno.env.get(name));
  const secretKey = resolveSupabaseSecretKey((name) => Deno.env.get(name));
  if (!supabaseUrl || !publishableKey || !secretKey || req.headers.get("apikey") !== publishableKey) {
    return json(401, { error: "UNAUTHORIZED" }, corsHeaders);
  }

  let event: { referenceId: string; route: string; release: string };
  try {
    event = await readErrorEvent(req);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_REQUEST";
    const status = code === "PAYLOAD_TOO_LARGE" ? 413 : code === "UNSUPPORTED_MEDIA_TYPE" ? 415 : 400;
    return json(status, { error: code }, corsHeaders);
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: retryAfter, error: rateError } = await admin.rpc("consume_edge_rate_limit", {
    p_operation: "client_error_event",
    p_subject: await requestSubject(req),
    p_limit: 8,
    p_window_seconds: 60,
  });
  if (rateError) return json(500, { error: "RATE_LIMIT_CHECK_FAILED" }, corsHeaders);
  if (Number(retryAfter) > 0) {
    return json(429, { error: "RATE_LIMITED" }, { ...corsHeaders, "Retry-After": String(retryAfter) });
  }

  const { error } = await admin.rpc("record_client_error_event", {
    p_reference_id: event.referenceId,
    p_route: event.route,
    p_release: event.release,
  });
  if (error) return json(500, { error: "RECORDING_FAILED" }, corsHeaders);
  return json(202, { recorded: true }, corsHeaders);
});
