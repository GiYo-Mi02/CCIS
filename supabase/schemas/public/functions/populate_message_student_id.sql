create or replace function public.populate_message_student_id()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
BEGIN
  SELECT profile_id INTO NEW.student_id
  FROM public.conversations
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;

grant execute on function "public"."populate_message_student_id"() to public, "anon", "authenticated", "postgres", "service_role";
