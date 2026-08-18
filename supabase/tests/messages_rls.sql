BEGIN;

SELECT p.id AS test_student_id, m.id AS test_message_id
FROM public.profiles AS p
JOIN public.conversations AS c ON c.profile_id = p.id
JOIN public.messages AS m ON m.conversation_id = c.id
WHERE p.role = 'student'
LIMIT 1 \gset

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('role', 'authenticated', 'sub', :'test_student_id')::text,
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
    WHERE id = :'test_message_id';

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
