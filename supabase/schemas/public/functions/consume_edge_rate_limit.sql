create or replace function public.consume_edge_rate_limit (
  p_operation      text,
  p_subject        text,
  p_limit          integer,
  p_window_seconds integer
)
  returns integer
  language sql
  security definer
  set search_path to ''
  AS $function$
  SELECT internal.consume_rate_limit(p_operation, p_subject, p_limit, p_window_seconds);
$function$;

grant execute on function "public"."consume_edge_rate_limit"(text, text, integer, integer) to "postgres", "service_role";

revoke all on function "public"."consume_edge_rate_limit"(text, text, integer, integer) from public;
