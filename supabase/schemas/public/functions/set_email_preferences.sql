create or replace function public.set_email_preferences (
  p_subscribe boolean
)
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.profiles
  SET subscribe_announcements_events = COALESCE(p_subscribe, false),
      email_subscription_decided = true,
      updated_at = now()
  WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
END;
$function$;

grant execute on function "public"."set_email_preferences"(boolean) to "authenticated", "postgres", "service_role";

revoke all on function "public"."set_email_preferences"(boolean) from public;
