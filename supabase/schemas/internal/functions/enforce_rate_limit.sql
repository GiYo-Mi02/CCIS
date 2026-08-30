create or replace function internal.enforce_rate_limit (
  p_operation      text,
  p_subject        text,
  p_limit          integer,
  p_window_seconds integer
)
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
DECLARE
  v_retry_after INTEGER;
BEGIN
  v_retry_after := internal.consume_rate_limit(
    p_operation, p_subject, p_limit, p_window_seconds
  );
  IF v_retry_after > 0 THEN
    PERFORM set_config('response.status', '429', true);
    PERFORM set_config(
      'response.headers',
      json_build_array(json_build_object('Retry-After', v_retry_after::TEXT))::TEXT,
      true
    );
    RAISE EXCEPTION 'RATE_LIMITED:retry_after=%', v_retry_after;
  END IF;
END;
$function$;

grant execute on function "internal"."enforce_rate_limit"(text, text, integer, integer) to "postgres";

revoke all on function "internal"."enforce_rate_limit"(text, text, integer, integer) from public;
