create or replace function public.record_privacy_consent()
  returns timestamp with time zone
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
DECLARE v_recorded_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.profiles
  SET privacy_agreed_at = COALESCE(privacy_agreed_at, now()), updated_at = now()
  WHERE id = auth.uid()
  RETURNING privacy_agreed_at INTO v_recorded_at;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  RETURN v_recorded_at;
END;
$function$;

grant execute on function "public"."record_privacy_consent"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."record_privacy_consent"() from public;
