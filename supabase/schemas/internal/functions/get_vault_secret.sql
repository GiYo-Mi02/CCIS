create or replace function internal.get_vault_secret (
  p_name text
)
  returns text
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = p_name
  ORDER BY created_at DESC
  LIMIT 1;
$function$;

grant execute on function "internal"."get_vault_secret"(text) to "postgres", "service_role";

revoke all on function "internal"."get_vault_secret"(text) from public;
