-- ============================================================
-- SUPABASE STANDARDS AUDIT: transactional outbox and idempotent delivery
-- Findings 1, 2, 7, 8, 9, 12, 18
-- ============================================================

CREATE TABLE IF NOT EXISTS internal.email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('announcement_published', 'event_created')),
  source_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'expanded', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error_code TEXT,
  UNIQUE (event_type, source_id)
);

REVOKE ALL ON internal.email_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON internal.email_outbox TO service_role;

-- Trigger functions now write one bounded outbox row. Recipient fan-out is
-- performed by the worker outside the announcement/event write transaction.
CREATE OR REPLACE FUNCTION public.queue_announcement_emails_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'published')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published') THEN
    INSERT INTO internal.email_outbox (event_type, source_id)
    VALUES ('announcement_published', NEW.id)
    ON CONFLICT (event_type, source_id) DO NOTHING;
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
BEGIN
  INSERT INTO internal.email_outbox (event_type, source_id)
  VALUES ('event_created', NEW.id)
  ON CONFLICT (event_type, source_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_queue_announcement_email ON public.announcements;
CREATE TRIGGER trigger_queue_announcement_email
AFTER INSERT OR UPDATE OF status ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.queue_announcement_emails_fn();

DROP TRIGGER IF EXISTS trigger_queue_event_email ON public.events;
CREATE TRIGGER trigger_queue_event_email
AFTER INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.queue_event_emails_fn();

REVOKE ALL ON FUNCTION public.queue_announcement_emails_fn() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_event_emails_fn() FROM PUBLIC, anon, authenticated;

-- Ticket emails are queued transactionally by register_for_event(). Retire any
-- manually installed legacy trigger/function that could create duplicates.
DROP TRIGGER IF EXISTS trigger_queue_ticket_email ON public.event_registrations;
DROP FUNCTION IF EXISTS public.queue_ticket_email_fn();

CREATE OR REPLACE FUNCTION public.expand_email_outbox(p_limit INTEGER DEFAULT 25)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item internal.email_outbox%ROWTYPE;
  v_announcement public.announcements%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_html TEXT;
  v_expanded INTEGER := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Invalid outbox expansion limit';
  END IF;

  FOR v_item IN
    SELECT *
    FROM internal.email_outbox
    WHERE status IN ('pending', 'failed') AND attempts < 5
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  LOOP
    UPDATE internal.email_outbox
    SET status = 'processing', attempts = attempts + 1, error_code = NULL
    WHERE id = v_item.id;

    BEGIN
      IF v_item.event_type = 'announcement_published' THEN
        SELECT * INTO STRICT v_announcement
        FROM public.announcements
        WHERE id = v_item.source_id AND status = 'published';

        v_html := '<!doctype html><html><body style="font-family:Arial,sans-serif;background:#FAF7EA;color:#123524;padding:40px 20px">' ||
          '<main style="max-width:550px;background:#fff;border:1px solid rgba(18,53,36,.22);border-radius:20px;padding:30px;margin:auto">' ||
          '<p style="color:#FFBC00;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:bold">Latest Update</p>' ||
          '<h1>CCIS Announcement</h1><p><strong>' || public.html_escape(upper(v_announcement.category)) || '</strong></p>' ||
          '<h2>' || public.html_escape(v_announcement.title) || '</h2>' ||
          '<p style="white-space:pre-wrap">' || public.html_escape(v_announcement.content) || '</p></main>' ||
          '<p style="text-align:center;font-size:11px;color:#5E6E64">Manage notification preferences in your CCIS Portal account.</p></body></html>';

        INSERT INTO public.email_queue (
          profile_id, recipient_email, email_type, subject, html_body, logical_key, provider_idempotency_key
        )
        SELECT
          profiles.id,
          profiles.email,
          'announcement',
          '[Announcement] ' || v_announcement.title,
          v_html,
          'announcement:' || v_announcement.id::TEXT || ':' || profiles.id::TEXT,
          'announcement-' || v_announcement.id::TEXT || '-' || profiles.id::TEXT
        FROM public.profiles AS profiles
        WHERE profiles.subscribe_announcements_events
          AND profiles.status = 'approved'
          AND NOT profiles.banned
          AND profiles.email IS NOT NULL
        ON CONFLICT (logical_key) WHERE logical_key IS NOT NULL DO NOTHING;
      ELSE
        SELECT * INTO STRICT v_event
        FROM public.events
        WHERE id = v_item.source_id;

        v_html := '<!doctype html><html><body style="font-family:Arial,sans-serif;background:#FAF7EA;color:#123524;padding:40px 20px">' ||
          '<main style="max-width:550px;background:#fff;border:1px solid rgba(18,53,36,.22);border-radius:20px;padding:30px;margin:auto">' ||
          '<p style="color:#FFBC00;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:bold">New Event</p>' ||
          '<h1>' || public.html_escape(v_event.title) || '</h1>' ||
          '<p><strong>Date:</strong> ' || public.html_escape(v_event.event_date::TEXT) || '</p>' ||
          '<p><strong>Time:</strong> ' || public.html_escape(COALESCE(v_event.event_time::TEXT, 'TBA')) || '</p>' ||
          '<p><strong>Venue:</strong> ' || public.html_escape(COALESCE(v_event.location, 'TBA')) || '</p>' ||
          '<p style="white-space:pre-wrap">' || public.html_escape(COALESCE(v_event.description, '')) || '</p></main>' ||
          '<p style="text-align:center;font-size:11px;color:#5E6E64">Manage notification preferences in your CCIS Portal account.</p></body></html>';

        INSERT INTO public.email_queue (
          profile_id, recipient_email, email_type, subject, html_body, logical_key, provider_idempotency_key
        )
        SELECT
          profiles.id,
          profiles.email,
          'event',
          '[New Event] ' || v_event.title,
          v_html,
          'event:' || v_event.id::TEXT || ':' || profiles.id::TEXT,
          'event-' || v_event.id::TEXT || '-' || profiles.id::TEXT
        FROM public.profiles AS profiles
        WHERE profiles.subscribe_announcements_events
          AND profiles.status = 'approved'
          AND NOT profiles.banned
          AND profiles.email IS NOT NULL
        ON CONFLICT (logical_key) WHERE logical_key IS NOT NULL DO NOTHING;
      END IF;

      UPDATE internal.email_outbox
      SET status = 'expanded', processed_at = now(), error_code = NULL
      WHERE id = v_item.id;
      v_expanded := v_expanded + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE internal.email_outbox
      SET status = 'failed', error_code = SQLSTATE
      WHERE id = v_item.id;
    END;
  END LOOP;

  RETURN v_expanded;
END;
$$;

REVOKE ALL ON FUNCTION public.expand_email_outbox(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expand_email_outbox(INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.dequeue_emails(p_limit INTEGER, p_worker_id TEXT)
RETURNS SETOF public.email_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Invalid dequeue limit';
  END IF;
  IF NULLIF(btrim(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'Worker ID is required';
  END IF;

  UPDATE public.email_queue
  SET
    status = CASE
      WHEN delivery_state IN ('provider_accepted', 'delivery_unknown') OR sent_at IS NOT NULL THEN 'delivery_unknown'
      WHEN attempts >= 3 THEN 'dead_letter'
      ELSE 'failed'
    END,
    delivery_state = CASE
      WHEN delivery_state IN ('provider_accepted', 'delivery_unknown') OR sent_at IS NOT NULL THEN 'delivery_unknown'
      ELSE delivery_state
    END,
    error_message = CASE
      WHEN delivery_state IN ('provider_accepted', 'delivery_unknown') OR sent_at IS NOT NULL THEN 'Delivery outcome requires reconciliation.'
      ELSE COALESCE(error_message || ' ', '') || 'Processing lease expired.'
    END,
    scheduled_for = CASE WHEN attempts < 3 THEN now() ELSE scheduled_for END,
    lease_expires_at = NULL,
    lease_worker_id = NULL,
    dead_lettered_at = CASE WHEN attempts >= 3 THEN now() ELSE dead_lettered_at END
  WHERE status = 'processing'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at <= now();

  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.email_queue
    WHERE (status = 'pending' OR (status = 'failed' AND attempts < 3))
      AND scheduled_for <= now()
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.email_queue AS queue
  SET
    status = 'processing',
    delivery_state = 'sending',
    attempts = queue.attempts + 1,
    lease_expires_at = now() + interval '10 minutes',
    lease_worker_id = p_worker_id,
    provider_idempotency_key = COALESCE(queue.provider_idempotency_key, 'queue-' || queue.id::TEXT),
    error_message = NULL
  FROM candidates
  WHERE queue.id = candidates.id
  RETURNING queue.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_email_delivery(
  p_email_id UUID,
  p_worker_id TEXT,
  p_provider_message_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.email_queue
  SET status = 'sent',
      delivery_state = 'provider_accepted',
      provider_message_id = NULLIF(btrim(p_provider_message_id), ''),
      sent_at = now(),
      processed_at = now(),
      lease_expires_at = NULL,
      lease_worker_id = NULL,
      error_message = NULL
  WHERE id = p_email_id
    AND status = 'processing'
    AND lease_worker_id = p_worker_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_email_delivery(
  p_email_id UUID,
  p_worker_id TEXT,
  p_error_code TEXT,
  p_delivery_unknown BOOLEAN DEFAULT false
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.email_queue
  SET
    status = CASE
      WHEN p_delivery_unknown THEN 'delivery_unknown'
      WHEN attempts >= 3 THEN 'dead_letter'
      ELSE 'failed'
    END,
    delivery_state = CASE WHEN p_delivery_unknown THEN 'delivery_unknown' ELSE 'failed' END,
    error_message = left(COALESCE(NULLIF(p_error_code, ''), 'PROVIDER_ERROR'), 120),
    scheduled_for = CASE
      WHEN NOT p_delivery_unknown AND attempts < 3 THEN now() + make_interval(secs => LEAST(3600, 30 * (2 ^ attempts)::INTEGER))
      ELSE scheduled_for
    END,
    dead_lettered_at = CASE WHEN NOT p_delivery_unknown AND attempts >= 3 THEN now() ELSE dead_lettered_at END,
    lease_expires_at = NULL,
    lease_worker_id = NULL
  WHERE id = p_email_id
    AND status = 'processing'
    AND lease_worker_id = p_worker_id;
  RETURN FOUND;
END;
$$;

DROP FUNCTION IF EXISTS public.dequeue_emails(INTEGER);
REVOKE ALL ON FUNCTION public.dequeue_emails(INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_email_delivery(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_email_delivery(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dequeue_emails(INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_email_delivery(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_email_delivery(UUID, TEXT, TEXT, BOOLEAN) TO service_role;
