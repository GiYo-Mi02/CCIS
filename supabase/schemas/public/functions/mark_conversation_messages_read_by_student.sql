create or replace function public.mark_conversation_messages_read_by_student (
  p_conversation_id uuid
)
  returns integer
  language plpgsql
  security definer
  set search_path to 'public'
  AS $function$
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
$function$;

grant execute on function "public"."mark_conversation_messages_read_by_student"(uuid) to "authenticated", "postgres", "service_role";

revoke all on function "public"."mark_conversation_messages_read_by_student"(uuid) from public;
