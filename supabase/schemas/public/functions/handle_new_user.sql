create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
DECLARE v_is_admin BOOLEAN;
BEGIN
  IF NOT internal.is_allowed_identity(NEW.email) THEN
    RAISE EXCEPTION 'INSTITUTIONAL_EMAIL_REQUIRED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.account_deletion_tombstones WHERE user_id = NEW.id) THEN
    RAISE EXCEPTION 'ACCOUNT_DELETED';
  END IF;
  v_is_admin := internal.is_admin_bypass_email(NEW.email);
  INSERT INTO public.profiles (
    id, email, full_name, avatar_url, role, status, profile_complete,
    subscribe_announcements_events, email_subscription_decided
  ) VALUES (
    NEW.id, lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    CASE WHEN v_is_admin THEN 'devcom_head' ELSE 'student' END,
    CASE WHEN v_is_admin THEN 'approved' ELSE 'pending' END,
    v_is_admin, false, false
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

grant execute on function "public"."handle_new_user"() to "postgres", "service_role";

revoke all on function "public"."handle_new_user"() from public;
