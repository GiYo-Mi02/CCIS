create or replace function public.html_escape (
  text_to_escape text
)
  returns text
  language sql
  immutable
  strict
  set search_path to ''
  AS $function$
  SELECT replace(replace(replace(replace(replace(text_to_escape,
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$function$;

grant execute on function "public"."html_escape"(text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."html_escape"(text) from public;
