create or replace function public.register_for_event (
  p_event_id   uuid,
  p_profile_id uuid
)
  returns public.event_registrations
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
DECLARE
  v_event public.events%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_registration public.event_registrations%ROWTYPE;
  v_count INTEGER;
  v_html TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_profile_id IS DISTINCT FROM auth.uid()
     AND public.get_user_role() NOT IN ('devcom_head', 'comm_registration')
     AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED_REGISTRATION';
  END IF;
  PERFORM internal.enforce_rate_limit('event_registration', auth.uid()::TEXT, 10, 60);

  SELECT * INTO STRICT v_profile FROM public.profiles WHERE id = p_profile_id;
  IF NOT internal.is_allowed_identity(v_profile.email) THEN RAISE EXCEPTION 'INSTITUTIONAL_EMAIL_REQUIRED'; END IF;
  IF v_profile.status <> 'approved' THEN RAISE EXCEPTION 'APPROVED_PROFILE_REQUIRED'; END IF;
  IF v_profile.banned AND (v_profile.banned_until IS NULL OR v_profile.banned_until > now()) THEN RAISE EXCEPTION 'ACCOUNT_BANNED'; END IF;

  SELECT * INTO STRICT v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT v_event.registration_required THEN RAISE EXCEPTION 'EVENT_DOES_NOT_REQUIRE_REGISTRATION'; END IF;
  IF v_event.event_date < current_date THEN RAISE EXCEPTION 'EVENT_REGISTRATION_CLOSED'; END IF;

  SELECT * INTO v_registration
  FROM public.event_registrations
  WHERE event_id = p_event_id AND profile_id = p_profile_id
  FOR UPDATE;

  IF FOUND AND v_registration.status <> 'cancelled' THEN RETURN v_registration; END IF;
  SELECT count(*) INTO v_count FROM public.event_registrations
  WHERE event_id = p_event_id AND status <> 'cancelled';
  IF v_event.registration_cap IS NOT NULL AND v_count >= v_event.registration_cap THEN RAISE EXCEPTION 'EVENT_FULL'; END IF;

  IF v_registration.id IS NOT NULL THEN
    UPDATE public.event_registrations
    SET status = 'confirmed', registered_at = now(), attended_at = NULL
    WHERE id = v_registration.id RETURNING * INTO v_registration;
  ELSE
    INSERT INTO public.event_registrations (event_id, profile_id, status, registered_at)
    VALUES (p_event_id, p_profile_id, 'confirmed', now())
    ON CONFLICT (event_id, profile_id) DO UPDATE
      SET status = CASE WHEN event_registrations.status = 'cancelled' THEN 'confirmed' ELSE event_registrations.status END,
          registered_at = CASE WHEN event_registrations.status = 'cancelled' THEN now() ELSE event_registrations.registered_at END
    RETURNING * INTO v_registration;
  END IF;

  v_html := '<!doctype html><html><body style="font-family:Arial,sans-serif;background:#FAF7EA;color:#123524;padding:32px">' ||
    '<main style="max-width:560px;margin:auto;background:#fff;border:1px solid rgba(18,53,36,.22);border-radius:20px;padding:28px">' ||
    '<h1>Participant registration confirmed</h1><h2>' || public.html_escape(v_event.title) || '</h2>' ||
    '<p><strong>Heron:</strong> ' || public.html_escape(COALESCE(v_profile.full_name, 'Student')) || '<br>' ||
    '<strong>Ticket reference:</strong> <code>' || v_registration.id::TEXT || '</code></p>' ||
    '<p>Open your CCIS Portal account to display the scannable ticket. Do not share your ticket reference.</p></main></body></html>';
  INSERT INTO public.email_queue (profile_id, recipient_email, email_type, subject, html_body, logical_key, provider_idempotency_key)
  VALUES (
    v_profile.id, v_profile.email, 'ticket', '[CCIS SC] Participant pass — ' || v_event.title,
    v_html, 'ticket:' || v_registration.id::TEXT, 'ticket-' || v_registration.id::TEXT
  ) ON CONFLICT (logical_key) WHERE logical_key IS NOT NULL DO NOTHING;
  RETURN v_registration;
END;
$function$;

grant execute on function "public"."register_for_event"(uuid, uuid) to "authenticated", "postgres", "service_role";

revoke all on function "public"."register_for_event"(uuid, uuid) from public;
