-- Return only the fields required by the registration scanner.
CREATE OR REPLACE FUNCTION public.lookup_attendance_profile(p_identifier TEXT)
RETURNS TABLE (
  id UUID,
  student_number TEXT,
  full_name TEXT,
  program TEXT,
  section TEXT,
  status TEXT,
  banned BOOLEAN,
  attendance_qr_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.lookup_attendance_profile(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_attendance_profile(TEXT) TO authenticated;
