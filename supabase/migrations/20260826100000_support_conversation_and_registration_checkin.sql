CREATE OR REPLACE FUNCTION public.ensure_conversation()
RETURNS public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_conversation public.conversations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  INSERT INTO public.conversations (profile_id)
  VALUES (auth.uid())
  ON CONFLICT (profile_id) DO NOTHING;

  SELECT * INTO STRICT v_conversation
  FROM public.conversations
  WHERE profile_id = auth.uid();

  RETURN v_conversation;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_conversation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_conversation() TO authenticated;

CREATE OR REPLACE FUNCTION public.check_in_event_registration(p_registration_id UUID)
RETURNS TABLE (
  id UUID,
  status TEXT,
  attended_at TIMESTAMPTZ,
  attendance_origin TEXT,
  event_title TEXT,
  full_name TEXT,
  student_number TEXT,
  program TEXT,
  section TEXT,
  was_already_attended BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_registration public.event_registrations%ROWTYPE;
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'comm_registration') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM internal.enforce_rate_limit('attendance_scan', auth.uid()::TEXT, 180, 60);

  SELECT * INTO v_registration
  FROM public.event_registrations
  WHERE event_registrations.id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REGISTRATION_NOT_FOUND';
  END IF;

  IF v_registration.status = 'attended' THEN
    RETURN QUERY
    SELECT
      v_registration.id,
      v_registration.status,
      v_registration.attended_at,
      v_registration.attendance_origin,
      events.title,
      profiles.full_name,
      profiles.student_number,
      profiles.program,
      profiles.section,
      true
    FROM public.events
    JOIN public.profiles ON profiles.id = v_registration.profile_id
    WHERE events.id = v_registration.event_id;
    RETURN;
  END IF;

  UPDATE public.event_registrations
  SET status = 'attended', attended_at = now()
  WHERE event_registrations.id = v_registration.id
  RETURNING * INTO v_registration;

  RETURN QUERY
  SELECT
    v_registration.id,
    v_registration.status,
    v_registration.attended_at,
    v_registration.attendance_origin,
    events.title,
    profiles.full_name,
    profiles.student_number,
    profiles.program,
    profiles.section,
    false
  FROM public.events
  JOIN public.profiles ON profiles.id = v_registration.profile_id
  WHERE events.id = v_registration.event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.check_in_event_registration(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_event_registration(UUID) TO authenticated;
