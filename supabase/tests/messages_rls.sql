BEGIN;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'messages-test@umak.edu.ph', '', now(),
  '{}'::JSONB, '{"full_name":"Messages Test"}'::JSONB, now(), now()
);

UPDATE public.profiles
SET status = 'approved', profile_complete = true
WHERE id = '10000000-0000-0000-0000-000000000001';

INSERT INTO public.conversations (id, profile_id)
VALUES (
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001'
);

INSERT INTO public.messages (
  id, conversation_id, sender_id, student_id, sender_role, content
) VALUES (
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'student', 'original protected content'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', '10000000-0000-0000-0000-000000000001'
  )::text,
  true
);

DO $protected_update$
DECLARE
  v_rows INTEGER;
BEGIN
  BEGIN
    UPDATE public.messages
    SET content = 'unauthorized content',
        sender_id = gen_random_uuid(),
        sender_role = 'admin',
        conversation_id = gen_random_uuid()
    WHERE id = '10000000-0000-0000-0000-000000000003';

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 0 THEN
      RAISE EXCEPTION 'direct protected-column message UPDATE was allowed';
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$protected_update$;

RESET ROLE;

DO $messages_rls$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND cmd = 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'messages has a direct UPDATE policy';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.mark_conversation_messages_read_by_student(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated users cannot execute the student read RPC';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.mark_messages_read_by_admin(uuid[])',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated users cannot execute the admin read RPC';
  END IF;
END;
$messages_rls$;

ROLLBACK;
