// @ts-nocheck
// Follow Supabase Edge Functions standard imports for Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing database environment credentials.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If Resend API key is missing, we simulate sending (useful for dev/test)
    const isSimulation = !resendApiKey;
    if (isSimulation) {
      console.warn("RESEND_API_KEY is not configured. Simulating email dispatch.");
    }

    // Dequeue up to 10 emails at a time
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
      console.log(`Processing batch of ${dequeuedItems.length} queued emails.`);

      for (const item of dequeuedItems) {
        try {
          if (isSimulation) {
            // Update email queue status to sent (simulated)
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

            results.push({ id: item.id, status: "sent", simulated: true });
          } else {
            // Real email dispatch using Resend REST API
            const fromEmail = "CCIS Student Council <onboarding@resend.dev>";
            const response = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({
                from: fromEmail,
                to: item.recipient_email,
                subject: item.subject,
                html: item.html_body,
              }),
            });

            const resData = await response.json();

            if (response.ok) {
              // Successfully sent
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
              results.push({ id: item.id, status: "sent", resendId: resData.id });
            } else {
              // Resend rejected the email
              const errorMsg = resData.message || JSON.stringify(resData);
              console.error(`Resend failed for item ${item.id}:`, errorMsg);

              const { error: updateError } = await supabase
                .from("email_queue")
                .update({
                  status: "failed",
                  error_message: errorMsg
                })
                .eq("id", item.id);

              if (updateError) {
                console.error(`Failed to update status for item ${item.id}:`, updateError.message);
              }
              results.push({ id: item.id, status: "failed", error: errorMsg });
            }
          }
        } catch (itemErr: any) {
          const errMsg = itemErr.message || String(itemErr);
          console.error(`Error processing email queue item ${item.id}:`, errMsg);

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
      console.log("No pending emails in queue.");
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
    console.error("Fatal queue processing error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || err }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
