BEGIN;

DROP POLICY IF EXISTS messages_update_policy ON public.messages;
DROP POLICY IF EXISTS messages_student_update ON public.messages;
DROP POLICY IF EXISTS messages_admin_update ON public.messages;

CREATE OR REPLACE FUNCTION public.mark_conversation_messages_read_by_student(
  p_conversation_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.messages
  SET read_by_student = true
  WHERE conversation_id = p_conversation_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations
      WHERE conversations.id = p_conversation_id
        AND conversations.profile_id = auth.uid()
    )
    AND sender_role = 'admin'
    AND read_by_student = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_messages_read_by_admin(
  p_message_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
  v_role TEXT;
BEGIN
  v_role := public.get_user_role();
  IF COALESCE(v_role, '') NOT IN ('devcom_head', 'officer')
     AND auth.jwt() ->> 'email' <> 'ggiojoshua2006@gmail.com' THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  UPDATE public.messages
  SET read_by_admin = true
  WHERE id = ANY(p_message_ids)
    AND sender_role = 'student'
    AND read_by_admin = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_conversation_messages_read_by_student(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_messages_read_by_admin(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_messages_read_by_student(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_read_by_admin(UUID[]) TO authenticated;

COMMIT;
