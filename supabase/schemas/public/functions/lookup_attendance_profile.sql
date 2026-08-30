create or replace function public.lookup_attendance_profile (
  p_identifier text
)
  returns table (
    id                 uuid,
    student_number     text,
    full_name          text,
    program            text,
    section            text,
    status             text,
    banned             boolean,
    attendance_qr_code text
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
  SELECT p.id, p.student_number, p.full_name, p.program, p.section,
    p.status, p.banned, p.attendance_qr_code
  FROM public.profiles AS p
  WHERE p.attendance_qr_code = NULLIF(btrim(p_identifier), '')
     OR p.id::TEXT = NULLIF(btrim(p_identifier), '')
     OR p.student_number = NULLIF(btrim(p_identifier), '');
END;
$function$;

grant execute on function "public"."lookup_attendance_profile"(text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."lookup_attendance_profile"(text) from public;
