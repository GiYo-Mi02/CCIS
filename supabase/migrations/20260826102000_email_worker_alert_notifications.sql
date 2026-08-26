CREATE OR REPLACE FUNCTION internal.enqueue_email_worker_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_queued INTEGER;
BEGIN
  INSERT INTO public.email_queue (
    recipient_email,
    email_type,
    subject,
    html_body,
    logical_key,
    provider_idempotency_key
  )
  SELECT
    'devcommgio2006@gmail.com',
    'system_alert',
    '[CCIS SC] Email worker alert: ' || public.html_escape(alert.alert_type),
    '<!doctype html><html><body><h1>Email worker alert</h1><p><strong>Type:</strong> ' ||
      public.html_escape(alert.alert_type) || '</p><p><strong>Code:</strong> ' ||
      public.html_escape(alert.error_code) || '</p><p><strong>Detected:</strong> ' ||
      public.html_escape(alert.detected_at::TEXT) || '</p></body></html>',
    'email-worker-alert:' || alert.alert_type || ':' ||
      COALESCE(alert.source_id, date_trunc('hour', alert.detected_at)::TEXT),
    'email-worker-alert-' || alert.alert_type || '-' ||
      COALESCE(alert.source_id, date_trunc('hour', alert.detected_at)::TEXT)
  FROM internal.email_worker_alerts AS alert
  ON CONFLICT (logical_key) WHERE logical_key IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_queued = ROW_COUNT;
  RETURN v_queued;
END;
$$;

REVOKE ALL ON FUNCTION internal.enqueue_email_worker_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION internal.enqueue_email_worker_alerts() TO service_role;

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
    'SELECT internal.reconcile_email_worker_invocations(); SELECT internal.enqueue_email_worker_alerts(); SELECT internal.invoke_email_worker();'
  );
END;
$$;
