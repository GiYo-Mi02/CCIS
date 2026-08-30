create or replace function public.queue_event_emails_fn()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
BEGIN
  INSERT INTO internal.email_outbox (event_type, source_id)
  VALUES ('event_created', NEW.id)
  ON CONFLICT (event_type, source_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

grant execute on function "public"."queue_event_emails_fn"() to "postgres", "service_role";

revoke all on function "public"."queue_event_emails_fn"() from public;
