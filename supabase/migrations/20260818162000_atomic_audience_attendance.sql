BEGIN;

CREATE OR REPLACE FUNCTION public.check_in_audience(
  p_event_id UUID,
  p_attendance_token TEXT
)
RETURNS TABLE (
  registration_id UUID,
  profile_id UUID,
  was_already_attended BOOLEAN,
  attended_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_exists BOOLEAN;
  v_profile_id UUID;
  v_registration public.event_registrations%ROWTYPE;
BEGIN
  IF COALESCE(public.get_user_role(), '') NOT IN ('devcom_head', 'comm_registration') THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  IF NULLIF(trim(p_attendance_token), '') IS NULL THEN
    RAISE EXCEPTION 'ATTENDANCE_TOKEN_REQUIRED';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.events WHERE id = p_event_id
  ) INTO v_event_exists;
  IF NOT v_event_exists THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE attendance_qr_code = trim(p_attendance_token)
    AND status = 'approved'
    AND COALESCE(banned, false) = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUDIENCE_PROFILE_NOT_FOUND';
  END IF;

  PERFORM 1
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  SELECT * INTO v_registration
  FROM public.event_registrations
  WHERE event_id = p_event_id
    AND profile_id = v_profile_id
  FOR UPDATE;

  IF FOUND AND v_registration.status = 'attended' THEN
    RETURN QUERY SELECT v_registration.id, v_profile_id, true, v_registration.registered_at;
    RETURN;
  END IF;

  IF FOUND THEN
    UPDATE public.event_registrations
    SET status = 'attended'
    WHERE id = v_registration.id
    RETURNING * INTO v_registration;
  ELSE
    INSERT INTO public.event_registrations (event_id, profile_id, status, registered_at)
    VALUES (p_event_id, v_profile_id, 'attended', now())
    RETURNING * INTO v_registration;
  END IF;

  RETURN QUERY SELECT v_registration.id, v_profile_id, false, v_registration.registered_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_in_audience(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_audience(UUID, TEXT) TO authenticated;

COMMIT;
