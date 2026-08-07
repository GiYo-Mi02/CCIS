// @ts-nocheck
// Supabase Edge Function: Automated SMTP Email Queue Processor
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import nodemailer from "npm:nodemailer@^6.9.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Read SMTP Credentials strictly from secure Supabase Secrets / Environment Variables
    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || `"CCIS Student Council" <${smtpUser}>`;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing database environment credentials.");
    }

    if (!smtpUser || !smtpPass) {
      throw new Error("Missing SMTP credentials. Please set SMTP_USER and SMTP_PASS in Supabase Edge Function Secrets.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      { p_limit: batchSize }
    );

    if (dequeueError) {
      throw new Error(`Failed to dequeue emails: ${dequeueError.message}`);
    }

    const results = [];

    if (dequeuedItems && dequeuedItems.length > 0) {
      console.log(`[SMTP Cloud Worker] Processing batch of ${dequeuedItems.length} queued emails...`);

      for (const item of dequeuedItems) {
        try {
          const mailOptions = {
            from: smtpFrom,
            to: item.recipient_email,
            subject: item.subject,
            html: item.html_body,
          };

          const info = await transporter.sendMail(mailOptions);
          console.log(`[SMTP Cloud Worker] Email sent via SMTP to ${item.recipient_email}. MessageId: ${info.messageId}`);

          // Update status to sent
          const { error: updateError } = await supabase
            .from("email_queue")
            .update({
              status: "sent",
              processed_at: new Date().toISOString(),
              error_message: null
            })
            .eq("id", item.id);

          if (updateError) {
            console.error(`Failed to update status for item ${item.id}:`, updateError.message);
          }

          results.push({ id: item.id, status: "sent", messageId: info.messageId });
        } catch (itemErr: any) {
          const errMsg = itemErr.message || String(itemErr);
          console.error(`SMTP sending error for item ${item.id}:`, errMsg);

          const { error: updateError } = await supabase
            .from("email_queue")
            .update({
              status: "failed",
              error_message: errMsg
            })
            .eq("id", item.id);

          if (updateError) {
            console.error(`Failed to update status for item ${item.id}:`, updateError.message);
          }
          results.push({ id: item.id, status: "failed", error: errMsg });
        }
      }
    } else {
      console.log("[SMTP Cloud Worker] No pending emails in queue.");
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
    console.error("Fatal SMTP queue processing error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || err }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
