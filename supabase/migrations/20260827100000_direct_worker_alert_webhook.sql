CREATE TABLE internal.email_worker_alert_notifications (
  alert_key TEXT PRIMARY KEY,
  request_id BIGINT,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION internal.notify_email_worker_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_webhook_url TEXT;
  v_alert RECORD;
  v_request_id BIGINT;
  v_notified INTEGER := 0;
BEGIN
  v_webhook_url := internal.get_vault_secret('email_worker_alert_webhook_url');
  IF NULLIF(btrim(v_webhook_url), '') IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_alert IN
    SELECT
      alert_type,
      source_id,
      error_code,
      http_status,
      detected_at,
      alert_type || ':' || date_trunc('hour', detected_at)::TEXT AS alert_key
    FROM internal.email_worker_alerts
  LOOP
    INSERT INTO internal.email_worker_alert_notifications (alert_key)
    VALUES (v_alert.alert_key)
    ON CONFLICT (alert_key) DO NOTHING;

    IF FOUND THEN
      SELECT net.http_post(
        url := v_webhook_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'alert_type', v_alert.alert_type,
          'source_id', v_alert.source_id,
          'error_code', v_alert.error_code,
          'http_status', v_alert.http_status,
          'detected_at', v_alert.detected_at
        ),
        timeout_milliseconds := 10000
      ) INTO v_request_id;

      UPDATE internal.email_worker_alert_notifications
      SET request_id = v_request_id
      WHERE alert_key = v_alert.alert_key;
      v_notified := v_notified + 1;
    END IF;
  END LOOP;

  RETURN v_notified;
END;
$$;

REVOKE ALL ON internal.email_worker_alert_notifications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION internal.notify_email_worker_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION internal.notify_email_worker_alerts() TO service_role;

DO $$
DECLARE v_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'ccis-email-worker' LIMIT 1;
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
  PERFORM cron.schedule(
    'ccis-email-worker',
    '* * * * *',
    'SELECT internal.reconcile_email_worker_invocations(); SELECT internal.notify_email_worker_alerts(); SELECT internal.enqueue_email_worker_alerts(); SELECT internal.invoke_email_worker();'
  );
END;
$$;
