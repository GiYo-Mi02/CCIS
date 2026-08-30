create or replace function public.queue_announcement_emails_fn()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'published')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published') THEN
    INSERT INTO internal.email_outbox (event_type, source_id)
    VALUES ('announcement_published', NEW.id)
    ON CONFLICT (event_type, source_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

grant execute on function "public"."queue_announcement_emails_fn"() to "postgres", "service_role";

revoke all on function "public"."queue_announcement_emails_fn"() from public;
