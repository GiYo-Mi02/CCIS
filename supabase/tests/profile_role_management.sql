\set ON_ERROR_STOP on

BEGIN;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'role-head-test@umak.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'role-officer-test@umak.edu.ph', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'role-registration-test@umak.edu.ph', '', now(), '{}', '{}', now(), now());

UPDATE public.profiles SET role = 'devcom_head', status = 'approved' WHERE id = '30000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET role = 'officer', status = 'approved' WHERE id = '30000000-0000-0000-0000-000000000002';
UPDATE public.profiles SET role = 'comm_registration', status = 'approved' WHERE id = '30000000-0000-0000-0000-000000000003';

DO $$
DECLARE
  v_result JSONB;
BEGIN
  SET LOCAL ROLE authenticated;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'role', 'authenticated', 'sub', '30000000-0000-0000-0000-000000000001'
  )::TEXT, true);
  v_result := public.admin_update_profile_role(
    '30000000-0000-0000-0000-000000000002', 'comm_content', 'Content Coordinator'
  );
  IF v_result->>'role' <> 'comm_content'
     OR v_result->>'position' <> 'Content Coordinator' THEN
    RAISE EXCEPTION 'DevCom Head role update did not return the updated role';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'role', 'authenticated', 'sub', '30000000-0000-0000-0000-000000000002'
  )::TEXT, true);
  BEGIN
    PERFORM public.admin_update_profile_role(
      '30000000-0000-0000-0000-000000000003', 'devcom_head', 'Escalated'
    );
    RAISE EXCEPTION 'Officer role could invoke profile role management';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'FORBIDDEN' THEN RAISE; END IF;
  END;
  UPDATE public.profiles SET role = 'devcom_head' WHERE id = '30000000-0000-0000-0000-000000000003';

  PERFORM set_config('request.jwt.claims', json_build_object(
    'role', 'authenticated', 'sub', '30000000-0000-0000-0000-000000000003'
  )::TEXT, true);
  BEGIN
    PERFORM public.admin_update_profile_role(
      '30000000-0000-0000-0000-000000000002', 'devcom_head', 'Escalated'
    );
    RAISE EXCEPTION 'Registration role could invoke profile role management';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'FORBIDDEN' THEN RAISE; END IF;
  END;
  UPDATE public.profiles SET role = 'devcom_head' WHERE id = '30000000-0000-0000-0000-000000000002';
END;
$$;

SELECT role, position INTO TEMP TABLE role_management_result
FROM public.profiles
WHERE id = '30000000-0000-0000-0000-000000000002';

DO $$
BEGIN
  IF (SELECT role FROM role_management_result) <> 'comm_content'
     OR (SELECT position FROM role_management_result) <> 'Content Coordinator' THEN
    RAISE EXCEPTION 'Unauthorized role attempt changed the target profile';
  END IF;
END;
$$;

ROLLBACK;
