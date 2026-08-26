\set ON_ERROR_STOP on

BEGIN;

INSERT INTO internal.email_worker_invocations (request_id, status)
VALUES (-900001, 'requested');
INSERT INTO net._http_response (id, status_code, timed_out)
VALUES (-900001, 503, false);
INSERT INTO public.email_queue (
  recipient_email, email_type, subject, html_body, status, scheduled_for, created_at
) VALUES (
  'stale-queue-test@umak.edu.ph', 'system_alert', 'Stale queue fixture', '<p>fixture</p>',
  'pending', now() - interval '16 minutes', now() - interval '16 minutes'
);

SELECT internal.reconcile_email_worker_invocations();
SELECT internal.enqueue_email_worker_alerts();

DO $email_worker_outcomes$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM internal.email_worker_invocations
    WHERE request_id = -900001
      AND status = 'failed'
      AND http_status = 503
      AND error_code = 'HTTP_503'
  ) THEN
    RAISE EXCEPTION 'HTTP failures are not reconciled to a terminal invocation status';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.email_queue
    WHERE logical_key LIKE 'email-worker-alert:worker_invocation:%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.email_queue
    WHERE logical_key LIKE 'email-worker-alert:queue_stale:%'
  ) THEN
    RAISE EXCEPTION 'email worker alerts are not actively enqueued';
  END IF;
END;
$email_worker_outcomes$;

ROLLBACK;
