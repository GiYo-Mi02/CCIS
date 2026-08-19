// Supabase Edge Function: Automated SMTP Email Queue Processor
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import nodemailer from "npm:nodemailer@^9.0.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseSecretKey = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseSecretKey) {
      throw new Error("Missing database environment credentials.");
    }

    // Authenticate invocation: must be an admin user or called with service role / secret key
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Missing Authorization header." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    let isAuthorized = token === supabaseSecretKey;

    if (!isAuthorized && supabaseAnonKey) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await authClient.auth.getUser();
      if (user) {
        const adminCheck = createClient(supabaseUrl, supabaseSecretKey);
        const { data: profile } = await adminCheck
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile && ["devcom_head", "officer", "comm_registration"].includes(profile.role)) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: Administrative access required." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Read SMTP Credentials strictly from secure Supabase Secrets / Environment Variables
    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || `"CCIS Student Council" <${smtpUser}>`;

    if (!smtpUser || !smtpPass) {
      throw new Error("Missing SMTP credentials in Edge Function Secrets.");
    }

    const supabase = createClient(supabaseUrl, supabaseSecretKey);
    const workerId = `edge-${requestId}`;

    // Initialize Nodemailer Transporter via SMTP
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Dequeue up to 10 pending emails at a time
    const batchSize = 10;
    const { data: dequeuedItems, error: dequeueError } = await supabase.rpc(
      "dequeue_emails",
      { p_limit: batchSize, p_worker_id: workerId }
    );

    if (dequeueError) {
      console.error(`[process-email-queue:${requestId}] Dequeue error:`, dequeueError.message);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to dequeue emails." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const results = [];

    if (dequeuedItems && dequeuedItems.length > 0) {
      console.log(`[process-email-queue:${requestId}] Processing batch of ${dequeuedItems.length} queued emails...`);

      for (const item of dequeuedItems) {
        try {
          const mailOptions = {
            from: smtpFrom,
            to: item.recipient_email,
            subject: item.subject,
            html: item.html_body,
          };

          const info = await transporter.sendMail(mailOptions);
          console.log(`[process-email-queue:${requestId}] Email item ${item.id} dispatched successfully.`);

          // Update status to sent
          const { error: updateError } = await supabase
            .from("email_queue")
            .update({
              status: "sent",
              processed_at: new Date().toISOString(),
              error_message: null,
              lease_expires_at: null,
              lease_worker_id: null
            })
            .eq("id", item.id)
            .eq("status", "processing")
            .eq("lease_worker_id", workerId);

          if (updateError) {
            console.error(`[process-email-queue:${requestId}] Failed to update status for item ${item.id}:`, updateError.message);
          }

          results.push({ id: item.id, status: "sent" });
        } catch (itemErr: any) {
          const errMsg = itemErr.message || String(itemErr);
          console.error(`[process-email-queue:${requestId}] SMTP sending error for item ${item.id}:`, errMsg);

          const exhausted = item.attempts >= 3;
          const failureUpdate: Record<string, string | null> = {
            status: exhausted ? "dead_letter" : "failed",
            error_message: "SMTP delivery failed",
            lease_expires_at: null,
            lease_worker_id: null,
            dead_lettered_at: exhausted ? new Date().toISOString() : null
          };
          if (!exhausted) {
            failureUpdate.scheduled_for = new Date(Date.now() + 60_000 * item.attempts).toISOString();
          }

          await supabase
            .from("email_queue")
            .update(failureUpdate)
            .eq("id", item.id)
            .eq("status", "processing")
            .eq("lease_worker_id", workerId);

          results.push({ id: item.id, status: exhausted ? "dead_letter" : "failed" });
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length, 
        results 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (err: any) {
    console.error(`[process-email-queue:${requestId}] Fatal error:`, err.message || err);
    return new Response(
      JSON.stringify({ success: false, error: "An internal server error occurred while processing queue." }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
