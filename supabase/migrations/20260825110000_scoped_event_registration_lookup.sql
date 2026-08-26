CREATE OR REPLACE FUNCTION public.lookup_event_registration(p_registration_id UUID)
RETURNS TABLE (
  id UUID,
  status TEXT,
  attended_at TIMESTAMPTZ,
  attendance_origin TEXT,
  event_title TEXT,
  full_name TEXT,
  student_number TEXT,
  program TEXT,
  section TEXT
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
  SELECT r.id, r.status, r.attended_at, r.attendance_origin,
         e.title, p.full_name, p.student_number, p.program, p.section
  FROM public.event_registrations AS r
  JOIN public.events AS e ON e.id = r.event_id
  JOIN public.profiles AS p ON p.id = r.profile_id
  WHERE r.id = p_registration_id;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_event_registration(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_event_registration(UUID) TO authenticated;
