BEGIN;

DO $attendance_contract$
DECLARE
  v_definition TEXT;
BEGIN
  IF NOT has_function_privilege(
    'authenticated',
    'public.check_in_audience(uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated users cannot execute the attendance RPC';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.check_in_audience(uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anonymous users can execute the attendance RPC';
  END IF;

  SELECT pg_get_functiondef(oid)
  INTO v_definition
  FROM pg_proc
  WHERE oid = 'public.check_in_audience(uuid,text)'::regprocedure;

  IF v_definition NOT LIKE '%attendance_qr_code%'
     OR v_definition NOT LIKE '%profile_id%'
     OR v_definition NOT LIKE '%FOR UPDATE%'
     OR v_definition NOT LIKE '%attendance_origin%'
     OR v_definition NOT LIKE '%is_event_registrant%' THEN
    RAISE EXCEPTION 'attendance RPC does not validate the token and lock its writes';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_registrations'
      AND column_name = 'attendance_origin'
  ) THEN
    RAISE EXCEPTION 'event registration attendance origin is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'ensure_approved_student_attendance_pass'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'approved student attendance-pass trigger is missing';
  END IF;
END;
$attendance_contract$;

ROLLBACK;
