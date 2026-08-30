create or replace function public.ensure_conversation()
  returns public.conversations
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
DECLARE
  v_row public.conversations;
BEGIN
  -- Attempt an insert; if the row already exists, do nothing
  INSERT INTO public.conversations (profile_id)
  VALUES (auth.uid())
  ON CONFLICT (profile_id) DO NOTHING;

  -- Always return the (existing or newly created) conversation row
  SELECT * INTO v_row
  FROM public.conversations
  WHERE profile_id = auth.uid();

  RETURN v_row;
END;
$function$;

grant execute on function "public"."ensure_conversation"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."ensure_conversation"() from public;
