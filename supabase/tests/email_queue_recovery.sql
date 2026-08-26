BEGIN;

INSERT INTO public.email_queue (
  id, recipient_email, email_type, subject, html_body, status,
  delivery_state, attempts, lease_expires_at, lease_worker_id
) VALUES (
  '30000000-0000-0000-0000-000000000001',
  'delivery-reconcile@example.invalid',
  'event', 'Reconciliation test', '<p>test</p>', 'processing',
  'sending', 1, NULL, NULL
);

SET LOCAL ROLE service_role;
SELECT count(*) FROM public.dequeue_emails(1, 'release-test-worker');
RESET ROLE;

DO $queue_recovery$
DECLARE
  v_status TEXT;
  v_delivery_state TEXT;
BEGIN
  SELECT status, delivery_state
  INTO v_status, v_delivery_state
  FROM public.email_queue
  WHERE id = '30000000-0000-0000-0000-000000000001';

  IF v_status <> 'delivery_unknown' OR v_delivery_state <> 'delivery_unknown' THEN
    RAISE EXCEPTION 'legacy no-lease row was not quarantined: status=%, delivery_state=%',
      v_status, v_delivery_state;
  END IF;
END;
$queue_recovery$;

ROLLBACK;
