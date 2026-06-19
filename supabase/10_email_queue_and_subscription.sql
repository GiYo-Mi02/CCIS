-- ============================================================
-- CCIS PLATFORM BACKEND: EMAIL QUEUE & SUBSCRIPTION PREFERENCES
-- ============================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- to create the email queue, add preference settings, and set up
-- automated triggers for ticketing, announcements, and events.

-- 1. ADD PREFERENCE COLUMNS TO PROFILES TABLE
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscribe_announcements_events BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_subscription_decided BOOLEAN NOT NULL DEFAULT false;

-- 2. CREATE EMAIL QUEUE TABLE
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  email_type TEXT NOT NULL CHECK (email_type IN ('ticket', 'announcement', 'event')),
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS) on email_queue
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Allow devcom_head and service_role (implicit) to perform actions on the queue
DROP POLICY IF EXISTS email_queue_admin_all ON public.email_queue;
CREATE POLICY email_queue_admin_all ON public.email_queue
  FOR ALL USING (public.get_user_role() IN ('devcom_head'));

-- 3. CREATE HTML ESCAPE HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.html_escape(text_to_escape TEXT)
RETURNS TEXT AS $$
BEGIN
  IF text_to_escape IS NULL THEN
    RETURN '';
  END IF;
  RETURN replace(replace(replace(replace(replace(text_to_escape,
    '&', '&amp;'),
    '<', '&lt;'),
    '>', '&gt;'),
    '"', '&quot;'),
    '''', '&#39;');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. CREATE QUEUE PROCESSING FUNCTION (FOR UPDATE SKIP LOCKED)
-- This safely checks out pending/retrying emails for processing in Deno
CREATE OR REPLACE FUNCTION public.dequeue_emails(p_limit INTEGER)
RETURNS SETOF public.email_queue AS $$
BEGIN
  RETURN QUERY
  UPDATE public.email_queue
  SET status = 'processing',
      attempts = attempts + 1
  WHERE id IN (
    SELECT id
    FROM public.email_queue
    WHERE (status = 'pending' OR (status = 'failed' AND attempts < 3))
      AND scheduled_for <= now()
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. TRIGGER FOR TICKETING RECEIPT EMAIL
-- Automatically queues the boarding pass ticket to the attendee
CREATE OR REPLACE FUNCTION public.queue_ticket_email_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
  v_name TEXT;
  v_section TEXT;
  v_program TEXT;
  v_event_title TEXT;
  v_qr_url TEXT;
  v_html TEXT;
BEGIN
  -- Get user profile details
  SELECT email, COALESCE(full_name, 'Student'), COALESCE(section, '—'), COALESCE(program, 'CCIS')
  INTO v_email, v_name, v_section, v_program
  FROM public.profiles
  WHERE id = NEW.profile_id;

  -- Get event details
  SELECT title
  INTO v_event_title
  FROM public.events
  WHERE id = NEW.event_id;

  -- Build boarding pass and queue
  IF v_email IS NOT NULL AND v_event_title IS NOT NULL THEN
    v_qr_url := 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' || NEW.id;

    v_html := '<!DOCTYPE html>
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
      <div class="event-title">' || public.html_escape(v_event_title) || '</div>
      
      <table class="details-grid">
        <tr>
          <td class="label">Attendee Name</td>
          <td class="value">' || public.html_escape(v_name) || '</td>
        </tr>
        <tr>
          <td class="label">Section</td>
          <td class="value">' || public.html_escape(UPPER(v_section)) || '</td>
        </tr>
        <tr>
          <td class="label">Branch (Program)</td>
          <td class="value">' || public.html_escape(v_program) || '</td>
        </tr>
        <tr>
          <td class="label">Ticket Reference ID</td>
          <td class="value" style="font-family: monospace; font-size: 11px;">' || NEW.id || '</td>
        </tr>
      </table>

      <div class="qr-section">
        <div class="qr-title">Scan QR code at event entry</div>
        <div class="qr-image">
          <img src="' || v_qr_url || '" width="180" height="180" alt="Ticket QR Verification Code" style="display: block;" />
        </div>
      </div>
    </div>
  </div>
  <div class="footer">
    This is an automated boarding pass issued by the CCIS Student Council.<br>
    Do not share this QR code. Present it clearly on your mobile device at the registration desk.
  </div>
</body>
</html>';

    INSERT INTO public.email_queue (recipient_email, email_type, subject, html_body)
    VALUES (
      v_email,
      'ticket',
      '[Boarding Pass] ' || v_event_title || ' — ' || v_name,
      v_html
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_queue_ticket_email ON public.event_registrations;
CREATE TRIGGER trigger_queue_ticket_email
AFTER INSERT ON public.event_registrations
FOR EACH ROW
EXECUTE FUNCTION public.queue_ticket_email_fn();

-- 6. TRIGGER FOR ANNOUNCEMENT EMAIL
-- Queues emails to subscribed users when an announcement is published
CREATE OR REPLACE FUNCTION public.queue_announcement_emails_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_user RECORD;
  v_html TEXT;
BEGIN
  -- Only queue when status transitions to published
  IF (TG_OP = 'INSERT' AND NEW.status = 'published') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'published' AND OLD.status != 'published') THEN
     
     FOR v_user IN 
       SELECT email, COALESCE(full_name, 'Student') as full_name
       FROM public.profiles 
       WHERE subscribe_announcements_events = true AND banned = false AND email IS NOT NULL
     LOOP
       v_html := '<!DOCTYPE html>
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
    .ann-title {
      font-size: 22px;
      font-weight: 900;
      color: #1A3C2E;
      margin: 0 0 15px 0;
    }
    .category-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #1A3C2E;
      background-color: #F5B400;
      padding: 4px 8px;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    .content {
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      white-space: pre-wrap;
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
      <div class="subheader">Latest Update</div>
      <h1>CCIS ANNOUNCEMENT</h1>
    </div>
    <div class="body">
      <div class="category-badge">' || public.html_escape(UPPER(NEW.category)) || '</div>
      <h2 class="ann-title">' || public.html_escape(NEW.title) || '</h2>
      <div class="content">' || public.html_escape(NEW.content) || '</div>
    </div>
  </div>
  <div class="footer">
    You are receiving this because you subscribed to email notifications from the CCIS Student Portal.<br>
    To unsubscribe, please update your account settings in the portal.
  </div>
</body>
</html>';

       INSERT INTO public.email_queue (recipient_email, email_type, subject, html_body)
       VALUES (
         v_user.email,
         'announcement',
         '[Announcement] ' || NEW.title,
         v_html
       );
     END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_queue_announcement_email ON public.announcements;
CREATE TRIGGER trigger_queue_announcement_email
AFTER INSERT OR UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.queue_announcement_emails_fn();

-- 7. TRIGGER FOR EVENT CREATION EMAIL
-- Queues emails to subscribed users when a new event is registered
CREATE OR REPLACE FUNCTION public.queue_event_emails_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_user RECORD;
  v_html TEXT;
BEGIN
  FOR v_user IN 
    SELECT email, COALESCE(full_name, 'Student') as full_name
    FROM public.profiles 
    WHERE subscribe_announcements_events = true AND banned = false AND email IS NOT NULL
  LOOP
    v_html := '<!DOCTYPE html>
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
      font-size: 22px;
      font-weight: 900;
      color: #1A3C2E;
      margin: 0 0 15px 0;
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
    .description {
      font-size: 13px;
      line-height: 1.6;
      color: #334155;
      margin-top: 20px;
      white-space: pre-wrap;
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
      <div class="subheader">New Event Invitation</div>
      <h1>CCIS EVENT CENTER</h1>
    </div>
    <div class="body">
      <h2 class="event-title">' || public.html_escape(NEW.title) || '</h2>
      
      <table class="details-grid">
        <tr>
          <td class="label">Date</td>
          <td class="value">' || public.html_escape(NEW.event_date::TEXT) || '</td>
        </tr>
        <tr>
          <td class="label">Time</td>
          <td class="value">' || public.html_escape(COALESCE(NEW.event_time::TEXT, 'TBA')) || '</td>
        </tr>
        <tr>
          <td class="label">Venue</td>
          <td class="value">' || public.html_escape(COALESCE(NEW.location, 'TBA')) || '</td>
        </tr>
      </table>

      <div class="description">' || public.html_escape(COALESCE(NEW.description, 'No description provided.')) || '</div>
    </div>
  </div>
  <div class="footer">
    You are receiving this because you subscribed to email notifications from the CCIS Student Portal.<br>
    To unsubscribe, please update your account settings in the portal.
  </div>
</body>
</html>';

    INSERT INTO public.email_queue (recipient_email, email_type, subject, html_body)
    VALUES (
      v_user.email,
      'event',
      '[New Event] ' || NEW.title,
      v_html
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_queue_event_email ON public.events;
CREATE TRIGGER trigger_queue_event_email
AFTER INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.queue_event_emails_fn();
