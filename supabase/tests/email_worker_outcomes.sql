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
INSERT INTO internal.email_outbox (event_type, source_id, status, attempts, error_code)
VALUES ('event_created', gen_random_uuid(), 'failed', 5, 'P0001');

SELECT internal.reconcile_email_worker_invocations();
SELECT internal.enqueue_email_worker_alerts();

DO $email_worker_outcomes$
DECLARE v_outbox_id UUID;
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

  IF NOT EXISTS (
    SELECT 1 FROM internal.email_outbox
    WHERE status = 'dead_letter' AND dead_lettered_at IS NOT NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM internal.email_worker_alerts
    WHERE alert_type = 'outbox_dead_letter' AND error_code = 'P0001'
  ) THEN
    RAISE EXCEPTION 'exhausted outbox expansion is not dead-lettered and alerted';
  END IF;

  SELECT id INTO v_outbox_id
  FROM internal.email_outbox
  WHERE status = 'dead_letter' AND error_code = 'P0001';
  IF NOT internal.replay_email_outbox(v_outbox_id) THEN
    RAISE EXCEPTION 'dead-lettered outbox rows cannot be replayed';
  END IF;
  IF internal.replay_email_outbox(v_outbox_id) THEN
    RAISE EXCEPTION 'outbox replay is not idempotent';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM internal.email_outbox
    WHERE id = v_outbox_id AND status = 'pending' AND attempts = 0
  ) THEN
    RAISE EXCEPTION 'dead-lettered outbox rows cannot be replayed idempotently';
  END IF;
END;
$email_worker_outcomes$;

ROLLBACK;
