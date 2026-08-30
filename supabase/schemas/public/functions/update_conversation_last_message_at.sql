create or replace function public.update_conversation_last_message_at()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;

grant execute on function "public"."update_conversation_last_message_at"() to public, "anon", "authenticated", "postgres", "service_role";
