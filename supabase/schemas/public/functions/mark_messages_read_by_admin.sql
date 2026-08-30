create or replace function public.mark_messages_read_by_admin (
  p_message_ids uuid[]
)
  returns integer
  language plpgsql
  security definer
  set search_path to 'public'
  AS $function$
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
$function$;

grant execute on function "public"."mark_messages_read_by_admin"(uuid[]) to "authenticated", "postgres", "service_role";

revoke all on function "public"."mark_messages_read_by_admin"(uuid[]) from public;
