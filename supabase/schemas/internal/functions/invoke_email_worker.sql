create or replace function internal.invoke_email_worker()
  returns bigint
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
DECLARE
  v_url TEXT;
  v_secret TEXT;
  v_request_id BIGINT;
BEGIN
  v_url := internal.get_vault_secret('email_worker_url');
  v_secret := internal.get_vault_secret('email_worker_secret');

  IF NULLIF(btrim(v_url), '') IS NULL OR NULLIF(btrim(v_secret), '') IS NULL THEN
    INSERT INTO internal.email_worker_invocations (status, error_code)
    VALUES ('configuration_error', 'WORKER_SECRET_OR_URL_MISSING');
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Queue-Worker-Secret', v_secret
    ),
    body := '{"source":"pg_cron"}'::jsonb,
    timeout_milliseconds := 10000
  ) INTO v_request_id;

  INSERT INTO internal.email_worker_invocations (request_id, status)
  VALUES (v_request_id, 'requested');
  RETURN v_request_id;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO internal.email_worker_invocations (status, error_code)
  VALUES ('invocation_error', SQLSTATE);
  RETURN NULL;
END;
$function$;

grant execute on function "internal"."invoke_email_worker"() to "postgres", "service_role";

revoke all on function "internal"."invoke_email_worker"() from public;
