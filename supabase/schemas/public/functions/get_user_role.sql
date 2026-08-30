create or replace function public.get_user_role()
  returns text
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$function$;

grant execute on function "public"."get_user_role"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_user_role"() from public;
