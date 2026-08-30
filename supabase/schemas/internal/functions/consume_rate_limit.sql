create or replace function internal.consume_rate_limit (
  p_operation      text,
  p_subject        text,
  p_limit          integer,
  p_window_seconds integer
)
  returns integer
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
DECLARE
  v_row internal.rate_limits%ROWTYPE;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_retry_after INTEGER := 0;
BEGIN
  IF NULLIF(btrim(p_operation), '') IS NULL
     OR NULLIF(btrim(p_subject), '') IS NULL
     OR p_limit < 1
     OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid rate-limit configuration';
  END IF;

  INSERT INTO internal.rate_limits AS limits (
    operation, subject, window_started_at, request_count, updated_at
  ) VALUES (
    p_operation, p_subject, v_now, 1, v_now
  )
  ON CONFLICT (operation, subject) DO UPDATE
  SET
    window_started_at = CASE
      WHEN limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now THEN v_now
      ELSE limits.window_started_at
    END,
    request_count = CASE
      WHEN limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now THEN 1
      ELSE limits.request_count + 1
    END,
    updated_at = v_now
  RETURNING * INTO v_row;

  IF v_row.request_count > p_limit THEN
    v_retry_after := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (
        v_row.window_started_at + make_interval(secs => p_window_seconds) - v_now
      )))::INTEGER
    );
  END IF;

  RETURN v_retry_after;
END;
$function$;

grant execute on function "internal"."consume_rate_limit"(text, text, integer, integer) to "postgres", "service_role";

revoke all on function "internal"."consume_rate_limit"(text, text, integer, integer) from public;
