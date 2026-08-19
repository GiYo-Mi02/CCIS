BEGIN;

CREATE OR REPLACE FUNCTION public.get_dashboard_unread_counts()
RETURNS TABLE (conversation_id UUID, unread_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'officer') THEN
    RAISE EXCEPTION 'Only message administrators can view unread counts';
  END IF;

  RETURN QUERY
  SELECT m.conversation_id, count(*)::BIGINT
  FROM public.messages AS m
  WHERE NOT m.read_by_admin
    AND m.sender_role = 'student'
  GROUP BY m.conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_unread_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_dashboard_unread_counts() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_unread_counts() TO authenticated;

COMMIT;
