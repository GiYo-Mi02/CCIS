BEGIN;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'registration-test@umak.edu.ph', '', now(),
    '{}'::JSONB, '{"full_name":"Registration Coordinator"}'::JSONB, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'pending-student-test@umak.edu.ph', '', now(),
    '{}'::JSONB, '{"full_name":"Pending Student"}'::JSONB, now(), now()
  );

UPDATE public.profiles
SET role = 'comm_registration', status = 'approved', profile_complete = true
WHERE id = '20000000-0000-0000-0000-000000000001';

UPDATE public.profiles
SET status = 'pending',
    profile_complete = true,
    student_number = 'K12345678',
    contact_number = '09170000000',
    attendance_qr_code = 'CCIS-PASS-20000000-0000-0000-0000-000000000002'
WHERE id = '20000000-0000-0000-0000-000000000002';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', '20000000-0000-0000-0000-000000000001'
  )::TEXT,
  true
);

DO $least_privilege$
DECLARE
  v_count INTEGER;
  v_result JSONB;
  v_row JSONB;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.profiles
  WHERE id = '20000000-0000-0000-0000-000000000002';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'registration role can select a full student profile row';
  END IF;

  v_result := public.list_pending_verifications(NULL, 10, 0);
  IF (v_result->>'total')::INTEGER <> 1 THEN
    RAISE EXCEPTION 'scoped verification RPC did not return the pending student';
  END IF;

  v_row := v_result->'rows'->0;
  IF v_row ? 'attendance_qr_code'
     OR v_row ? 'last_ip'
     OR v_row ? 'banned'
     OR v_row ? 'subscribe_announcements_events' THEN
    RAISE EXCEPTION 'scoped verification RPC exposed an unrelated private field';
  END IF;

  BEGIN
    PERFORM public.search_users('Pending', 10);
    RAISE EXCEPTION 'registration role can search users for officer creation';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'FORBIDDEN' THEN
        RAISE;
      END IF;
  END;
END;
$least_privilege$;

ROLLBACK;
