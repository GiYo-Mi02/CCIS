-- Every approved student must have a database-backed universal attendance
-- credential. This backfills accounts approved before server-issued passes
-- were introduced and keeps the invariant true for future approvals.
UPDATE public.profiles
SET attendance_qr_code = 'CCIS-PASS-' || gen_random_uuid()::TEXT,
    attendance_qr_generated_at = COALESCE(attendance_qr_generated_at, now()),
    updated_at = now()
WHERE role = 'student'
  AND status = 'approved'
  AND attendance_qr_code IS NULL;

CREATE OR REPLACE FUNCTION public.ensure_approved_student_attendance_pass()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.role = 'student'
     AND NEW.status = 'approved'
     AND NEW.attendance_qr_code IS NULL THEN
    NEW.attendance_qr_code := 'CCIS-PASS-' || gen_random_uuid()::TEXT;
    NEW.attendance_qr_generated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_approved_student_attendance_pass ON public.profiles;
CREATE TRIGGER ensure_approved_student_attendance_pass
BEFORE INSERT OR UPDATE OF status, role, attendance_qr_code ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_approved_student_attendance_pass();

REVOKE ALL ON FUNCTION public.ensure_approved_student_attendance_pass() FROM PUBLIC, anon, authenticated;

-- Keep attendance records visible in Admin Registration while preserving
-- whether the student registered before arriving or was admitted as a walk-in.
ALTER TABLE public.event_registrations
ADD COLUMN attendance_origin TEXT NOT NULL DEFAULT 'registered';

ALTER TABLE public.event_registrations
ADD CONSTRAINT event_registrations_attendance_origin_check
CHECK (attendance_origin IN ('registered', 'walk_in'));

REVOKE ALL ON FUNCTION public.check_in_audience(UUID, TEXT) FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.check_in_audience(UUID, TEXT);

CREATE FUNCTION public.check_in_audience(p_event_id UUID, p_attendance_token TEXT)
RETURNS TABLE (
  registration_id UUID,
  profile_id UUID,
  was_already_attended BOOLEAN,
  attended_at TIMESTAMPTZ,
  is_event_registrant BOOLEAN,
  attendance_origin TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id UUID;
  v_registration public.event_registrations%ROWTYPE;
  v_was_registered BOOLEAN := false;
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'comm_registration') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  PERFORM internal.enforce_rate_limit('attendance_scan', auth.uid()::TEXT, 180, 60);
  IF NULLIF(btrim(p_attendance_token), '') IS NULL THEN
    RAISE EXCEPTION 'ATTENDANCE_TOKEN_REQUIRED';
  END IF;

  PERFORM 1 FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EVENT_NOT_FOUND'; END IF;

  SELECT id INTO STRICT v_profile_id
  FROM public.profiles
  WHERE attendance_qr_code = btrim(p_attendance_token)
    AND status = 'approved'
    AND NOT banned;

  SELECT * INTO v_registration
  FROM public.event_registrations
  WHERE event_id = p_event_id
    AND event_registrations.profile_id = v_profile_id
  FOR UPDATE;

  v_was_registered := FOUND AND v_registration.attendance_origin = 'registered';

  IF FOUND AND v_registration.status = 'attended' THEN
    RETURN QUERY SELECT
      v_registration.id,
      v_profile_id,
      true,
      COALESCE(v_registration.attended_at, v_registration.registered_at),
      v_was_registered,
      v_registration.attendance_origin;
    RETURN;
  END IF;

  IF FOUND THEN
    UPDATE public.event_registrations
    SET status = 'attended', attended_at = now()
    WHERE id = v_registration.id
    RETURNING * INTO v_registration;
  ELSE
    INSERT INTO public.event_registrations (
      event_id, profile_id, status, registered_at, attended_at, attendance_origin
    ) VALUES (
      p_event_id, v_profile_id, 'attended', now(), now(), 'walk_in'
    ) RETURNING * INTO v_registration;
  END IF;

  RETURN QUERY SELECT
    v_registration.id,
    v_profile_id,
    false,
    v_registration.attended_at,
    v_was_registered,
    v_registration.attendance_origin;
END;
$$;

REVOKE ALL ON FUNCTION public.check_in_audience(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_audience(UUID, TEXT) TO authenticated;
