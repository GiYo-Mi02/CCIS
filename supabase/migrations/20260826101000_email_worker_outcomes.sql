ALTER TABLE internal.email_worker_invocations
  DROP CONSTRAINT IF EXISTS email_worker_invocations_status_check,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS http_status INTEGER,
  ADD CONSTRAINT email_worker_invocations_status_check
  CHECK (status IN ('requested', 'configuration_error', 'invocation_error', 'succeeded', 'failed', 'timed_out'));

CREATE OR REPLACE FUNCTION internal.reconcile_email_worker_invocations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reconciled INTEGER;
  v_stale INTEGER;
BEGIN
  WITH responses AS (
    SELECT id, status_code, timed_out, created
    FROM net._http_response
  ), reconciled AS (
    UPDATE internal.email_worker_invocations AS invocation
    SET
      status = CASE
        WHEN responses.timed_out THEN 'timed_out'
        WHEN responses.status_code BETWEEN 200 AND 299 THEN 'succeeded'
        ELSE 'failed'
      END,
      completed_at = responses.created,
      http_status = responses.status_code,
      error_code = CASE
        WHEN responses.timed_out THEN 'HTTP_TIMEOUT'
        WHEN responses.status_code BETWEEN 200 AND 299 THEN NULL
        ELSE 'HTTP_' || COALESCE(responses.status_code::TEXT, 'ERROR')
      END
    FROM responses
    WHERE invocation.status = 'requested'
      AND invocation.request_id = responses.id
    RETURNING invocation.id
  )
  SELECT count(*) INTO v_reconciled FROM reconciled;

  UPDATE internal.email_worker_invocations
  SET status = 'timed_out',
      completed_at = now(),
      error_code = 'HTTP_RESPONSE_MISSING'
  WHERE status = 'requested'
    AND requested_at < now() - interval '15 minutes';

  GET DIAGNOSTICS v_stale = ROW_COUNT;
  RETURN v_reconciled + v_stale;
END;
$$;

CREATE OR REPLACE FUNCTION internal.invoke_email_worker()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
  v_request_id BIGINT;
BEGIN
  PERFORM internal.reconcile_email_worker_invocations();

  v_url := internal.get_vault_secret('email_worker_url');
  v_secret := internal.get_vault_secret('email_worker_secret');

  IF NULLIF(btrim(v_url), '') IS NULL OR NULLIF(btrim(v_secret), '') IS NULL THEN
    INSERT INTO internal.email_worker_invocations (status, error_code)
    VALUES ('configuration_error', 'WORKER_SECRET_OR_URL_MISSING');
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Queue-Worker-Secret', v_secret
    ),
    body := '{"source":"pg_cron"}'::jsonb,
    timeout_milliseconds := 10000
  ) INTO v_request_id;

  INSERT INTO internal.email_worker_invocations (request_id, status)
  VALUES (v_request_id, 'requested');
  RETURN v_request_id;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO internal.email_worker_invocations (status, error_code)
  VALUES ('invocation_error', SQLSTATE);
  RETURN NULL;
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
  HAVING min(created_at) < now() - interval '15 minutes';

REVOKE ALL ON FUNCTION internal.reconcile_email_worker_invocations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION internal.reconcile_email_worker_invocations() TO service_role;
REVOKE ALL ON internal.email_worker_alerts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON internal.email_worker_alerts TO service_role;
