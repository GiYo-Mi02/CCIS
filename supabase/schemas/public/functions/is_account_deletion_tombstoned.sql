create or replace function public.is_account_deletion_tombstoned()
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
  AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_deletion_tombstones
    WHERE user_id = auth.uid()
  );
$function$;

grant execute on function "public"."is_account_deletion_tombstoned"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."is_account_deletion_tombstoned"() from public;
