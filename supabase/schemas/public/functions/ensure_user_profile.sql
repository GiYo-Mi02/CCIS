create or replace function public.ensure_user_profile()
  returns public.profiles
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
DECLARE
  v_user auth.users%ROWTYPE;
  v_profile public.profiles;
  v_is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF FOUND THEN RETURN v_profile; END IF;
  SELECT * INTO STRICT v_user FROM auth.users WHERE id = auth.uid();
  IF NOT internal.is_allowed_identity(v_user.email) THEN RAISE EXCEPTION 'INSTITUTIONAL_EMAIL_REQUIRED'; END IF;
  IF EXISTS (SELECT 1 FROM public.account_deletion_tombstones WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'ACCOUNT_DELETED';
  END IF;
  v_is_admin := internal.is_admin_bypass_email(v_user.email);
  INSERT INTO public.profiles (
    id, email, full_name, avatar_url, role, status, profile_complete,
    subscribe_announcements_events, email_subscription_decided
  ) VALUES (
    v_user.id, lower(v_user.email),
    COALESCE(v_user.raw_user_meta_data->>'full_name', v_user.raw_user_meta_data->>'name', ''),
    COALESCE(v_user.raw_user_meta_data->>'avatar_url', v_user.raw_user_meta_data->>'picture'),
    CASE WHEN v_is_admin THEN 'devcom_head' ELSE 'student' END,
    CASE WHEN v_is_admin THEN 'approved' ELSE 'pending' END,
    v_is_admin, false, false
  ) RETURNING * INTO v_profile;
  RETURN v_profile;
END;
$function$;

grant execute on function "public"."ensure_user_profile"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."ensure_user_profile"() from public;
