create or replace function internal.is_admin_bypass_email (
  p_email text
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM internal.admin_bypass_emails AS allowed
    WHERE allowed.email = lower(COALESCE(p_email, ''))
  );
$function$;

grant execute on function "internal"."is_admin_bypass_email"(text) to "postgres", "service_role";

revoke all on function "internal"."is_admin_bypass_email"(text) from public;
