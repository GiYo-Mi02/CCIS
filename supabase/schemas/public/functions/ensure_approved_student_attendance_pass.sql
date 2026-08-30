create or replace function public.ensure_approved_student_attendance_pass()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
BEGIN
  IF NEW.role = 'student'
     AND NEW.status = 'approved'
     AND NEW.attendance_qr_code IS NULL THEN
    NEW.attendance_qr_code := 'CCIS-PASS-' || gen_random_uuid()::TEXT;
    NEW.attendance_qr_generated_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

grant execute on function "public"."ensure_approved_student_attendance_pass"() to "postgres", "service_role";

revoke all on function "public"."ensure_approved_student_attendance_pass"() from public;
