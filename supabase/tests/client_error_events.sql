\set ON_ERROR_STOP on

BEGIN;

SELECT public.record_client_error_event(
  '11111111-1111-4111-8111-111111111111',
  '/account',
  'local'
);

DO $client_error_events$
DECLARE v_rejected BOOLEAN := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM internal.client_error_events
    WHERE reference_id = '11111111-1111-4111-8111-111111111111'
      AND route = '/account' AND release = 'local'
  ) THEN
    RAISE EXCEPTION 'redacted client error event was not recorded';
  END IF;

  BEGIN
    PERFORM public.record_client_error_event(
      '22222222-2222-4222-8222-222222222222',
      '/account?token=secret',
      'local'
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'client error event accepted an unsafe route';
  END IF;
END;
$client_error_events$;

ROLLBACK;
