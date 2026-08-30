create or replace function public.lookup_event_registration (
  p_registration_id uuid
)
  returns table (
    id                uuid,
    status            text,
    attended_at       timestamp with time zone,
    attendance_origin text,
    event_title       text,
    full_name         text,
    student_number    text,
    program           text,
    section           text
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'comm_registration') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  SELECT r.id, r.status, r.attended_at, r.attendance_origin,
         e.title, p.full_name, p.student_number, p.program, p.section
  FROM public.event_registrations AS r
  JOIN public.events AS e ON e.id = r.event_id
  JOIN public.profiles AS p ON p.id = r.profile_id
  WHERE r.id = p_registration_id;
END;
$function$;

grant execute on function "public"."lookup_event_registration"(uuid) to "authenticated", "postgres", "service_role";

revoke all on function "public"."lookup_event_registration"(uuid) from public;
