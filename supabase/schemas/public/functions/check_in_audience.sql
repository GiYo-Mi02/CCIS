create or replace function public.check_in_audience (
  p_event_id         uuid,
  p_attendance_token text
)
  returns table (
    registration_id      uuid,
    profile_id           uuid,
    was_already_attended boolean,
    attended_at          timestamp with time zone,
    is_event_registrant  boolean,
    attendance_origin    text
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
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
$function$;

grant execute on function "public"."check_in_audience"(uuid, text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."check_in_audience"(uuid, text) from public;
