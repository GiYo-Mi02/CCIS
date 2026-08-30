create or replace function public.fail_email_delivery (
  p_email_id         uuid,
  p_worker_id        text,
  p_error_code       text,
  p_delivery_unknown boolean default false
)
  returns boolean
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
BEGIN
  UPDATE public.email_queue
  SET
    status = CASE
      WHEN p_delivery_unknown THEN 'delivery_unknown'
      WHEN attempts >= 3 THEN 'dead_letter'
      ELSE 'failed'
    END,
    delivery_state = CASE WHEN p_delivery_unknown THEN 'delivery_unknown' ELSE 'failed' END,
    error_message = left(COALESCE(NULLIF(p_error_code, ''), 'PROVIDER_ERROR'), 120),
    scheduled_for = CASE
      WHEN NOT p_delivery_unknown AND attempts < 3 THEN now() + make_interval(secs => LEAST(3600, 30 * (2 ^ attempts)::INTEGER))
      ELSE scheduled_for
    END,
    dead_lettered_at = CASE WHEN NOT p_delivery_unknown AND attempts >= 3 THEN now() ELSE dead_lettered_at END,
    lease_expires_at = NULL,
    lease_worker_id = NULL
  WHERE id = p_email_id
    AND status = 'processing'
    AND lease_worker_id = p_worker_id;
  RETURN FOUND;
END;
$function$;

grant execute on function "public"."fail_email_delivery"(uuid, text, text, boolean) to "postgres", "service_role";

revoke all on function "public"."fail_email_delivery"(uuid, text, text, boolean) from public;
