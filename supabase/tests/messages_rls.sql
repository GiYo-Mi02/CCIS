BEGIN;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('role', 'authenticated', 'sub', gen_random_uuid())::text,
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
    WHERE false;

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
