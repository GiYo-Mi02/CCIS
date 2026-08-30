create or replace function public.sync_profile_role_to_auth()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$function$;

grant execute on function "public"."sync_profile_role_to_auth"() to "postgres", "service_role";

revoke all on function "public"."sync_profile_role_to_auth"() from public;
