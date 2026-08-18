// Follow Supabase Edge Functions standard imports for Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  registrationId: string;
  email: string;
  name: string;
  section: string;
  college: string;
  eventTitle: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: EmailPayload = await req.json();
    const { registrationId, email, name, section, college, eventTitle } = payload;

    if (!registrationId || !email || !name) {
      throw new Error("Missing required fields: registrationId, email, or name.");
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.warn("RESEND_API_KEY environment variable is not configured. Simulating email dispatch.");
      // Graceful success response for simulation/development environment
      return new Response(
        JSON.stringify({ 
          success: true, 
          simulated: true, 
          message: `Email simulation successful to ${email}. Register key to enable real delivery.` 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        }
      );
    }

    // Embed QR code server link for QR server
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${registrationId}`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #FAF7EA;
            color: #1A3C2E;
            margin: 0;
            padding: 40px 20px;
          }
          .card {
            max-width: 550px;
            background: #ffffff;
            border-radius: 24px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
            margin: 0 auto;
            box-shadow: 0 4px 12px rgba(26,60,46,0.05);
          }
          .header {
            background-color: #1A3C2E;
            color: #ffffff;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 900;
            letter-spacing: 1px;
          }
          .subheader {
            color: #F5B400;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-top: 5px;
            font-weight: bold;
          }
          .body {
            padding: 30px;
          }
          .event-title {
            font-size: 24px;
            font-weight: 900;
            color: #1A3C2E;
            margin: 0 0 20px 0;
            text-align: center;
          }
          .details-grid {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          .details-grid td {
            padding: 10px 0;
            border-bottom: 1px solid #f1f5f9;
            font-size: 13px;
          }
          .label {
            color: #64748b;
            font-weight: 500;
            width: 40%;
          }
          .value {
            font-weight: 700;
            color: #1A3C2E;
            text-align: right;
          }
          .qr-section {
            text-align: center;
            background-color: #f8fafc;
            border-radius: 16px;
            padding: 25px;
            margin-top: 20px;
            border: 1px dashed #cbd5e1;
          }
          .qr-title {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #64748b;
            margin-bottom: 15px;
            font-weight: bold;
          }
          .qr-image {
            background-color: #ffffff;
            padding: 10px;
            border-radius: 12px;
            display: inline-block;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          .footer {
            text-align: center;
            font-size: 11px;
            color: #64748b;
            margin-top: 30px;
            line-height: 1.5;
          }
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
              <tr>
                <td class="label">Attendee Name</td>
                <td class="value">${name}</td>
              </tr>
              <tr>
                <td class="label">Section</td>
                <td class="value">${section.toUpperCase()}</td>
              </tr>
              <tr>
                <td class="label">Branch (Program)</td>
                <td class="value">${college}</td>
              </tr>
              <tr>
                <td class="label">Ticket Reference ID</td>
                <td class="value" style="font-family: monospace; font-size: 11px;">${registrationId}</td>
              </tr>
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

    // Send email using Resend REST API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "CCIS Student Council <onboarding@resend.dev>", // Sandbox testing sender
        to: email,
        subject: `[Boarding Pass] ${eventTitle} — ${name}`,
        html: htmlBody,
      }),
    });

    const resData = await response.json();
    if (!response.ok) {
      throw new Error(`Resend email delivery failed: ${JSON.stringify(resData)}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Ticket email sent successfully.", data: resData }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (err: any) {
    console.error("Error sending email function:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || err }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
