CREATE OR REPLACE FUNCTION public.mark_messages_read_by_admin(
  p_message_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'officer') THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  UPDATE public.messages
  SET read_by_admin = true
  WHERE id = ANY(p_message_ids)
    AND sender_role = 'student'
    AND read_by_admin = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

CREATE TABLE internal.client_error_events (
  reference_id UUID PRIMARY KEY,
  route TEXT NOT NULL CHECK (route ~ '^/[A-Za-z0-9/_-]{0,200}$'),
  release TEXT NOT NULL CHECK (release ~ '^[A-Za-z0-9._-]{1,100}$'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.record_client_error_event(
  p_reference_id UUID,
  p_route TEXT,
  p_release TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_reference_id IS NULL
     OR p_route !~ '^/[A-Za-z0-9/_-]{0,200}$'
     OR p_release !~ '^[A-Za-z0-9._-]{1,100}$' THEN
    RAISE EXCEPTION 'Invalid client error event';
  END IF;

  INSERT INTO internal.client_error_events (reference_id, route, release)
  VALUES (p_reference_id, p_route, p_release)
  ON CONFLICT (reference_id) DO NOTHING;
END;
$$;

REVOKE ALL ON internal.client_error_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_client_error_event(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_client_error_event(UUID, TEXT, TEXT) TO service_role;

ALTER TABLE internal.email_outbox
  ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;

ALTER TABLE internal.email_outbox
  DROP CONSTRAINT IF EXISTS email_outbox_status_check,
  ADD CONSTRAINT email_outbox_status_check
  CHECK (status IN ('pending', 'processing', 'expanded', 'failed', 'dead_letter'));

UPDATE internal.email_outbox
SET status = 'dead_letter', dead_lettered_at = COALESCE(dead_lettered_at, now())
WHERE status = 'failed' AND attempts >= 5;

CREATE OR REPLACE FUNCTION internal.dead_letter_exhausted_email_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'failed' AND NEW.attempts >= 5 THEN
    NEW.status := 'dead_letter';
    NEW.dead_lettered_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dead_letter_exhausted_email_outbox ON internal.email_outbox;
CREATE TRIGGER dead_letter_exhausted_email_outbox
BEFORE INSERT OR UPDATE ON internal.email_outbox
FOR EACH ROW EXECUTE FUNCTION internal.dead_letter_exhausted_email_outbox();

CREATE OR REPLACE FUNCTION internal.replay_email_outbox(p_outbox_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE internal.email_outbox
  SET status = 'pending', attempts = 0, processed_at = NULL,
      error_code = NULL, dead_lettered_at = NULL
  WHERE id = p_outbox_id AND status = 'dead_letter';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE VIEW internal.email_worker_alerts
WITH (security_invoker = true)
AS
  SELECT
    'worker_invocation'::TEXT AS alert_type,
    id::TEXT AS source_id,
    error_code,
    http_status,
    requested_at AS detected_at
  FROM internal.email_worker_invocations
  WHERE status IN ('configuration_error', 'invocation_error', 'failed', 'timed_out')
  UNION ALL
  SELECT
    'queue_stale',
    NULL,
    'OLDEST_PENDING_EMAIL_OVER_15_MINUTES',
    NULL,
    min(created_at)
  FROM public.email_queue
  WHERE status IN ('pending', 'failed')
    AND scheduled_for <= now()
  HAVING min(created_at) < now() - interval '15 minutes'
  UNION ALL
  SELECT
    'outbox_dead_letter',
    id::TEXT,
    error_code,
    NULL,
    dead_lettered_at
  FROM internal.email_outbox
  WHERE status = 'dead_letter';

REVOKE ALL ON FUNCTION internal.dead_letter_exhausted_email_outbox() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION internal.replay_email_outbox(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION internal.replay_email_outbox(UUID) TO service_role;
REVOKE ALL ON internal.email_worker_alerts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON internal.email_worker_alerts TO service_role;
