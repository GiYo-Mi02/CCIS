create or replace function public.get_dashboard_unread_counts()
  returns table (
    conversation_id uuid,
    unread_count    bigint
  )
  language plpgsql
  security definer
  set search_path to 'public'
  AS $function$
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
$function$;

grant execute on function "public"."get_dashboard_unread_counts"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_dashboard_unread_counts"() from public;
