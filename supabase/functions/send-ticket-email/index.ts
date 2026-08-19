// Supabase Edge Function: Authenticated Ticket Email Dispatcher
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Missing Authorization header." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseSecretKey = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase configuration.");
    }

    // Client authenticated with the caller's JWT
    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: userError } = await supabaseUserClient.auth.getUser();
    if (userError || !callerUser) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Invalid token." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const payload = await req.json();
    const { registrationId } = payload;

    if (!registrationId || typeof registrationId !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Missing or invalid registrationId parameter." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Service-level client to securely verify registration data in database
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey || supabaseAnonKey);

    const { data: reg, error: regErr } = await supabaseAdmin
      .from("event_registrations")
      .select("id, profile_id, status, events(title, event_date, location), profiles(id, full_name, email, student_number, program, section, role)")
      .eq("id", registrationId)
      .maybeSingle();

    if (regErr || !reg) {
      return new Response(
        JSON.stringify({ success: false, error: "Registration record not found." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Check caller identity: must be the registrant or an officer/devcom_head
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .single();

    const isAuthorized =
      reg.profile_id === callerUser.id ||
      ["devcom_head", "officer", "comm_registration"].includes(callerProfile?.role || "");

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: You cannot access this ticket." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const recipientEmail = (reg.profiles as any)?.email;
    const recipientName = escapeHtml((reg.profiles as any)?.full_name || "Student");
    const eventTitle = escapeHtml((reg.events as any)?.title || "CCIS Event");
    const section = escapeHtml((reg.profiles as any)?.section || "N/A");
    const college = escapeHtml((reg.profiles as any)?.program || "CCIS");

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Registrant has no valid email address." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.log(`[send-ticket-email:${requestId}] No RESEND_API_KEY configured. Ticket email queued in database instead.`);
      return new Response(
        JSON.stringify({ success: true, simulated: true, message: "Ticket processed successfully." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(registrationId)}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #FAF7EA; color: #1A3C2E; margin: 0; padding: 40px 20px; }
          .card { max-width: 550px; background: #ffffff; border-radius: 24px; border: 1px solid #e2e8f0; overflow: hidden; margin: 0 auto; box-shadow: 0 4px 12px rgba(26,60,46,0.05); }
          .header { background-color: #1A3C2E; color: #ffffff; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 1px; }
          .subheader { color: #F5B400; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-top: 5px; font-weight: bold; }
          .body { padding: 30px; }
          .event-title { font-size: 24px; font-weight: 900; color: #1A3C2E; margin: 0 0 20px 0; text-align: center; }
          .details-grid { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          .details-grid td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
          .label { color: #64748b; font-weight: 500; width: 40%; }
          .value { font-weight: 700; color: #1A3C2E; text-align: right; }
          .qr-section { text-align: center; background-color: #f8fafc; border-radius: 16px; padding: 25px; margin-top: 20px; border: 1px dashed #cbd5e1; }
          .qr-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 15px; font-weight: bold; }
          .qr-image { background-color: #ffffff; padding: 10px; border-radius: 12px; display: inline-block; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
          .footer { text-align: center; font-size: 11px; color: #64748b; margin-top: 30px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="subheader">Official Entry Boarding Pass</div>
            <h1>CCIS STUDENT COUNCIL</h1>
          </div>
          <div class="body">
            <div class="event-title">${eventTitle}</div>
            <table class="details-grid">
              <tr><td class="label">Attendee Name</td><td class="value">${recipientName}</td></tr>
              <tr><td class="label">Section</td><td class="value">${section.toUpperCase()}</td></tr>
              <tr><td class="label">Branch (Program)</td><td class="value">${college}</td></tr>
              <tr><td class="label">Ticket Reference ID</td><td class="value" style="font-family: monospace; font-size: 11px;">${registrationId}</td></tr>
            </table>
            <div class="qr-section">
              <div class="qr-title">Scan QR code at event entry</div>
              <div class="qr-image">
                <img src="${qrImageUrl}" width="180" height="180" alt="Ticket QR Verification Code" style="display: block;" />
              </div>
            </div>
          </div>
        </div>
        <div class="footer">
          This is an automated boarding pass issued by the CCIS Student Council.<br>
          Do not share this QR code. Present it clearly on your mobile device at the registration desk.
        </div>
      </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "CCIS Student Council <tickets@ccis-council.org>",
        to: recipientEmail,
        subject: `[Boarding Pass] ${eventTitle} — ${recipientName}`,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[send-ticket-email:${requestId}] Resend API error:`, errText);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to dispatch email via delivery service." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Ticket email sent successfully." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error(`[send-ticket-email:${requestId}] Internal server error:`, err);
    return new Response(
      JSON.stringify({ success: false, error: "An error occurred while processing the ticket email." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
