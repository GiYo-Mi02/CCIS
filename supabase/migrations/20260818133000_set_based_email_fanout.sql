-- Replace per-recipient trigger loops with set-based queue inserts.

CREATE OR REPLACE FUNCTION public.queue_announcement_emails_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_html TEXT;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'published') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'published' AND OLD.status != 'published') THEN
    v_html := '<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;background:#FAF7EA;color:#1A3C2E;padding:40px 20px">
<main style="max-width:550px;background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:30px;margin:auto">
<p style="color:#F5B400;font-size:10px;text-transform:uppercase;letter-spacing:2px;font-weight:bold">Latest Update</p>
<h1>CCIS ANNOUNCEMENT</h1>
<p><strong>' || public.html_escape(UPPER(NEW.category)) || '</strong></p>
<h2>' || public.html_escape(NEW.title) || '</h2>
<p style="white-space:pre-wrap;color:#334155">' || public.html_escape(NEW.content) || '</p>
</main><p style="text-align:center;font-size:11px;color:#64748b">You are receiving this because you subscribed to email notifications from the CCIS Student Portal.<br>To unsubscribe, please update your account settings in the portal.</p>
</body></html>';

    INSERT INTO public.email_queue (recipient_email, email_type, subject, html_body)
    SELECT email, 'announcement', '[Announcement] ' || NEW.title, v_html
    FROM public.profiles
    WHERE subscribe_announcements_events = true
      AND banned = false
      AND email IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_event_emails_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_html TEXT;
BEGIN
  v_html := '<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;background:#FAF7EA;color:#1A3C2E;padding:40px 20px">
<main style="max-width:550px;background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:30px;margin:auto">
<p style="color:#F5B400;font-size:10px;text-transform:uppercase;letter-spacing:2px;font-weight:bold">New Event Invitation</p>
<h1>CCIS EVENT CENTER</h1>
<h2>' || public.html_escape(NEW.title) || '</h2>
<p><strong>Date:</strong> ' || public.html_escape(NEW.event_date::TEXT) || '</p>
<p><strong>Time:</strong> ' || public.html_escape(COALESCE(NEW.event_time::TEXT, 'TBA')) || '</p>
<p><strong>Venue:</strong> ' || public.html_escape(COALESCE(NEW.location, 'TBA')) || '</p>
<p style="white-space:pre-wrap;color:#334155">' || public.html_escape(COALESCE(NEW.description, 'No description provided.')) || '</p>
</main><p style="text-align:center;font-size:11px;color:#64748b">You are receiving this because you subscribed to email notifications from the CCIS Student Portal.<br>To unsubscribe, please update your account settings in the portal.</p>
</body></html>';

  INSERT INTO public.email_queue (recipient_email, email_type, subject, html_body)
  SELECT email, 'event', '[New Event] ' || NEW.title, v_html
  FROM public.profiles
  WHERE subscribe_announcements_events = true
    AND banned = false
    AND email IS NOT NULL;

  RETURN NEW;
END;
$$;
