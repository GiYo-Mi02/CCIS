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
const supabaseKey = env['SUPABASE_SECRET_KEY'] || process.env.SUPABASE_SECRET_KEY;

// SMTP configuration
const smtpHost = env['SMTP_HOST'] || process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(env['SMTP_PORT'] || process.env.SMTP_PORT || '587');
const smtpUser = env['SMTP_USER'] || process.env.SMTP_USER;
const smtpPass = env['SMTP_PASS'] || process.env.SMTP_PASS;
const smtpFrom = env['SMTP_FROM'] || process.env.SMTP_FROM || `"CCIS Student Council" <${smtpUser || ''}>`;

if (!supabaseUrl || !supabaseKey) {
  console.error('[Email Worker] Missing VITE_SUPABASE_URL or SUPABASE_SECRET_KEY credentials.');
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

let permissionDeniedLogged = false;
const workerId = `local-${process.pid}-${crypto.randomUUID()}`;

async function processQueue() {
  try {
    const { data: dequeuedItems, error: dequeueError } = await supabase.rpc(
      'dequeue_emails',
      { p_limit: 5, p_worker_id: workerId }
    );

    if (dequeueError) {
      if (dequeueError.message && dequeueError.message.toLowerCase().includes('permission denied')) {
        if (!permissionDeniedLogged) {
          console.warn('\n⚠️  [Email Worker] Permission denied for function public.dequeue_emails(integer, text).');
          console.warn('👉 FIX: Apply the email queue lease migration and grant EXECUTE to service_role only.\n');
          permissionDeniedLogged = true;
        }
      } else {
        console.error('[Email Worker] Error dequeuing emails:', dequeueError.message);
      }
      return;
    }

    permissionDeniedLogged = false;

    if (dequeuedItems && dequeuedItems.length > 0) {
      console.log(`[Email Worker] Processing batch of ${dequeuedItems.length} queued email(s)...`);

      for (const item of dequeuedItems) {
        try {
          const maskedEmail = (item.recipient_email || '').replace(/(?<=^.{2}).*(?=@)/, '***');
          console.log(`[Email Worker] Dispatching item ${item.id} (${item.email_type}) to ${maskedEmail}...`);
          
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
              error_message: null,
              lease_expires_at: null,
              lease_worker_id: null
            })
            .eq('id', item.id)
            .eq('status', 'processing')
            .eq('lease_worker_id', workerId);

          if (updateError) {
            console.error(`[Email Worker] Failed to update status for ${item.id}:`, updateError.message);
          }
        } catch (itemErr) {
          const errMsg = itemErr.message || String(itemErr);
          console.error(`[Email Worker] Error processing item ${item.id}:`, errMsg);

          const exhausted = item.attempts >= 3;
          const failureUpdate = {
            status: exhausted ? 'dead_letter' : 'failed',
            error_message: errMsg,
            lease_expires_at: null,
            lease_worker_id: null,
            dead_lettered_at: exhausted ? new Date().toISOString() : null
          };
          if (!exhausted) {
            failureUpdate.scheduled_for = new Date(Date.now() + 60_000 * item.attempts).toISOString();
          }

          const { error: updateError } = await supabase
            .from('email_queue')
            .update(failureUpdate)
            .eq('id', item.id)
            .eq('status', 'processing')
            .eq('lease_worker_id', workerId);
            
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
