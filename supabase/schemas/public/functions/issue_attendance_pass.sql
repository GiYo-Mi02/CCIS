create or replace function public.issue_attendance_pass (
  p_rotate boolean default false
)
  returns table (
    attendance_qr_code         text,
    attendance_qr_generated_at timestamp with time zone
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
DECLARE v_profile public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM internal.enforce_rate_limit('attendance_pass', auth.uid()::TEXT, 5, 86400);
  SELECT * INTO STRICT v_profile FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF v_profile.status <> 'approved' THEN RAISE EXCEPTION 'APPROVED_PROFILE_REQUIRED'; END IF;
  IF v_profile.banned AND (v_profile.banned_until IS NULL OR v_profile.banned_until > now()) THEN
    RAISE EXCEPTION 'ACCOUNT_BANNED';
  END IF;

  IF v_profile.attendance_qr_code IS NULL OR p_rotate THEN
    UPDATE public.profiles
    SET attendance_qr_code = 'CCIS-PASS-' || gen_random_uuid()::TEXT,
        attendance_qr_generated_at = now(),
        updated_at = now()
    WHERE id = auth.uid()
    RETURNING profiles.attendance_qr_code, profiles.attendance_qr_generated_at
    INTO attendance_qr_code, attendance_qr_generated_at;
  ELSE
    attendance_qr_code := v_profile.attendance_qr_code;
    attendance_qr_generated_at := v_profile.attendance_qr_generated_at;
  END IF;
  RETURN NEXT;
END;
$function$;

grant execute on function "public"."issue_attendance_pass"(boolean) to "authenticated", "postgres", "service_role";

revoke all on function "public"."issue_attendance_pass"(boolean) from public;
