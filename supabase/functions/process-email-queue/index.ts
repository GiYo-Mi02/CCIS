import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

const JSON_HEADERS = { "Content-Type": "application/json" };
const MAX_BODY_BYTES = 1_024;
const BATCH_SIZE = 10;
const PROVIDER_TIMEOUT_MS = 10_000;

type QueueItem = {
  id: string;
  recipient_email: string;
  subject: string;
  html_body: string;
  provider_idempotency_key: string;
};

const json = (status: number, body: Record<string, unknown>, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });

async function timingSafeEquals(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const size = Math.max(leftBytes.length, rightBytes.length, 1);
  const leftPadded = new Uint8Array(size);
  const rightPadded = new Uint8Array(size);
  leftPadded.set(leftBytes);
  rightPadded.set(rightBytes);
  const key = await crypto.subtle.importKey(
    "raw",
    leftPadded,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const leftMac = new Uint8Array(await crypto.subtle.sign("HMAC", key, leftPadded));
  const rightMac = new Uint8Array(await crypto.subtle.sign("HMAC", key, rightPadded));
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < leftMac.length; index += 1) {
    difference |= leftMac[index] ^ rightMac[index];
  }
  return difference === 0;
}

async function readBoundedJson(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new Error("UNSUPPORTED_MEDIA_TYPE");
  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
  if (!raw.trim()) return {};
  const value = JSON.parse(raw);
  if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("INVALID_JSON");
  return value as Record<string, unknown>;
}

serve(async (req: Request) => {
  const requestId = crypto.randomUUID();

  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json(405, { success: false, error: "METHOD_NOT_ALLOWED" }, { Allow: "POST" });

  try {
    await readBoundedJson(req);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_REQUEST";
    const status = code === "PAYLOAD_TOO_LARGE" ? 413 : code === "UNSUPPORTED_MEDIA_TYPE" ? 415 : 400;
    return json(status, { success: false, error: code });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const workerSecret = Deno.env.get("EMAIL_WORKER_SECRET");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("EMAIL_FROM") || "CCIS Student Council <notifications@ccis-council.org>";

  if (!supabaseUrl || !serviceRoleKey || !workerSecret || !resendApiKey) {
    console.error(`[email-worker:${requestId}] configuration_error`);
    return json(503, { success: false, error: "WORKER_NOT_CONFIGURED" });
  }

  const presentedSecret = req.headers.get("x-queue-worker-secret") || "";
  if (!presentedSecret || !(await timingSafeEquals(presentedSecret, workerSecret))) {
    console.warn(`[email-worker:${requestId}] authentication_rejected`);
    return json(401, { success: false, error: "UNAUTHORIZED" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: retryAfter, error: rateError } = await admin.rpc("consume_edge_rate_limit", {
    p_operation: "process_email_queue",
    p_subject: "global",
    p_limit: 12,
    p_window_seconds: 60,
  });
  if (rateError) {
    console.error(`[email-worker:${requestId}] rate_limit_check_failed code=${rateError.code || "UNKNOWN"}`);
    return json(500, { success: false, error: "RATE_LIMIT_CHECK_FAILED" });
  }
  if (Number(retryAfter) > 0) {
    return json(429, { success: false, error: "RATE_LIMITED" }, { "Retry-After": String(retryAfter) });
  }

  const { error: outboxError } = await admin.rpc("expand_email_outbox", { p_limit: 25 });
  if (outboxError) {
    console.error(`[email-worker:${requestId}] outbox_expansion_failed code=${outboxError.code || "UNKNOWN"}`);
    return json(500, { success: false, error: "OUTBOX_EXPANSION_FAILED" });
  }

  const workerId = `edge-${requestId}`;
  const { data, error: dequeueError } = await admin.rpc("dequeue_emails", {
    p_limit: BATCH_SIZE,
    p_worker_id: workerId,
  });
  if (dequeueError) {
    console.error(`[email-worker:${requestId}] dequeue_failed code=${dequeueError.code || "UNKNOWN"}`);
    return json(500, { success: false, error: "DEQUEUE_FAILED" });
  }

  const results: Array<{ id: string; status: string }> = [];
  for (const item of (data || []) as QueueItem[]) {
    try {
      const providerResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": item.provider_idempotency_key || `queue-${item.id}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [item.recipient_email],
          subject: item.subject,
          html: item.html_body,
        }),
      });

      if (!providerResponse.ok) {
        const providerCode = `PROVIDER_HTTP_${providerResponse.status}`;
        await admin.rpc("fail_email_delivery", {
          p_email_id: item.id,
          p_worker_id: workerId,
          p_error_code: providerCode,
          p_delivery_unknown: false,
        });
        console.warn(`[email-worker:${requestId}] item=${item.id} failed code=${providerCode}`);
        results.push({ id: item.id, status: "failed" });
        continue;
      }

      const providerBody = await providerResponse.json().catch(() => ({})) as { id?: string };
      const { data: completed, error: completeError } = await admin.rpc("complete_email_delivery", {
        p_email_id: item.id,
        p_worker_id: workerId,
        p_provider_message_id: providerBody.id || "",
      });
      if (completeError || completed !== true) {
        console.error(`[email-worker:${requestId}] item=${item.id} completion_write_failed`);
        results.push({ id: item.id, status: "completion_unknown" });
        continue;
      }

      console.log(`[email-worker:${requestId}] item=${item.id} sent`);
      results.push({ id: item.id, status: "sent" });
    } catch (error) {
      const errorCode = error instanceof DOMException && error.name === "TimeoutError"
        ? "PROVIDER_TIMEOUT"
        : "PROVIDER_NETWORK_ERROR";
      await admin.rpc("fail_email_delivery", {
        p_email_id: item.id,
        p_worker_id: workerId,
        p_error_code: errorCode,
        p_delivery_unknown: true,
      });
      console.warn(`[email-worker:${requestId}] item=${item.id} outcome_unknown code=${errorCode}`);
      results.push({ id: item.id, status: "delivery_unknown" });
    }
  }

  return json(200, { success: true, processed: results.length, results });
});
