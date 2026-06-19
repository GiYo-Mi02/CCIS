import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import nodemailer from 'nodemailer';

// Read env variables from .env.local
let env = {};
try {
  if (fs.existsSync('.env.local')) {
    const envFile = fs.readFileSync('.env.local', 'utf-8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        env[match[1]] = (match[2] || '').replace(/['"]/g, '').trim();
      }
    });
  }
} catch (err) {
  console.error('[Email Worker] Failed to parse .env.local:', err.message);
}

const supabaseUrl = env['VITE_SUPABASE_URL'] || process.env.VITE_SUPABASE_URL;
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'] || process.env.VITE_SUPABASE_ANON_KEY;

// SMTP configuration
const smtpHost = env['SMTP_HOST'] || 'smtp.gmail.com';
const smtpPort = parseInt(env['SMTP_PORT'] || '587');
const smtpUser = env['SMTP_USER'] || 'devcommgio2006@gmail.com';
const smtpPass = env['SMTP_PASS'] || 'hfksiwmxnhttvoii';
const smtpFrom = env['SMTP_FROM'] || '"CCIS Student Council" <devcommgio2006@gmail.com>';

if (!supabaseUrl || !supabaseKey) {
  console.error('[Email Worker] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY credentials.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('[Email Worker] Starting background email queue worker...');

// Initialize Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465, // true for 465, false for 587 or other ports
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

console.log(`[Email Worker] SMTP transporter configured for ${smtpUser} via ${smtpHost}:${smtpPort}`);

async function processQueue() {
  try {
    const { data: dequeuedItems, error: dequeueError } = await supabase.rpc(
      'dequeue_emails',
      { p_limit: 5 }
    );

    if (dequeueError) {
      console.error('[Email Worker] Error dequeuing emails:', dequeueError.message);
      return;
    }

    if (dequeuedItems && dequeuedItems.length > 0) {
      console.log(`[Email Worker] Processing batch of ${dequeuedItems.length} queued email(s)...`);

      for (const item of dequeuedItems) {
        try {
          console.log(`[Email Worker] Dispatching ${item.email_type} email to ${item.recipient_email}...`);
          
          const mailOptions = {
            from: smtpFrom,
            to: item.recipient_email,
            subject: item.subject,
            html: item.html_body,
          };

          const info = await transporter.sendMail(mailOptions);
          
          console.log(`[Email Worker] Email sent successfully via SMTP. MessageId: ${info.messageId}`);

          const { error: updateError } = await supabase
            .from('email_queue')
            .update({
              status: 'sent',
              processed_at: new Date().toISOString(),
              error_message: null
            })
            .eq('id', item.id);

          if (updateError) {
            console.error(`[Email Worker] Failed to update status for ${item.id}:`, updateError.message);
          }
        } catch (itemErr) {
          const errMsg = itemErr.message || String(itemErr);
          console.error(`[Email Worker] Error processing item ${item.id}:`, errMsg);

          const { error: updateError } = await supabase
            .from('email_queue')
            .update({
              status: 'failed',
              error_message: errMsg
            })
            .eq('id', item.id);
            
          if (updateError) {
            console.error(`[Email Worker] Failed to mark item ${item.id} as failed:`, updateError.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Email Worker] Queue loop execution error:', err.message || err);
  }
}

// Poll database queue every 5 seconds
setInterval(processQueue, 5000);
// Run immediately on startup
processQueue();
