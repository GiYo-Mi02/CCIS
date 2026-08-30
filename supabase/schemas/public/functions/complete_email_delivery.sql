create or replace function public.complete_email_delivery (
  p_email_id            uuid,
  p_worker_id           text,
  p_provider_message_id text
)
  returns boolean
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
BEGIN
  UPDATE public.email_queue
  SET status = 'sent',
      delivery_state = 'provider_accepted',
      provider_message_id = NULLIF(btrim(p_provider_message_id), ''),
      sent_at = now(),
      processed_at = now(),
      lease_expires_at = NULL,
      lease_worker_id = NULL,
      error_message = NULL
  WHERE id = p_email_id
    AND status = 'processing'
    AND lease_worker_id = p_worker_id;
  RETURN FOUND;
END;
$function$;

grant execute on function "public"."complete_email_delivery"(uuid, text, text) to "postgres", "service_role";

revoke all on function "public"."complete_email_delivery"(uuid, text, text) from public;
