create or replace function internal.is_allowed_identity (
  p_email text
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  SELECT
    lower(COALESCE(p_email, '')) LIKE '%@umak.edu.ph'
    OR EXISTS (
      SELECT 1
      FROM internal.admin_bypass_emails AS allowed
      WHERE allowed.email = lower(COALESCE(p_email, ''))
    );
$function$;

grant execute on function "internal"."is_allowed_identity"(text) to "postgres", "service_role";

revoke all on function "internal"."is_allowed_identity"(text) from public;
