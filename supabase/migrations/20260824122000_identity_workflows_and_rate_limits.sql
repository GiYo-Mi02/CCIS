-- ============================================================
-- SUPABASE STANDARDS AUDIT: identity, workflow ownership, and rate limits
-- Findings 4, 5, 6, 9, 17
-- ============================================================

CREATE OR REPLACE FUNCTION internal.enforce_rate_limit(
  p_operation TEXT,
  p_subject TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_retry_after INTEGER;
BEGIN
  v_retry_after := internal.consume_rate_limit(
    p_operation, p_subject, p_limit, p_window_seconds
  );
  IF v_retry_after > 0 THEN
    PERFORM set_config('response.status', '429', true);
    PERFORM set_config(
      'response.headers',
      json_build_array(json_build_object('Retry-After', v_retry_after::TEXT))::TEXT,
      true
    );
    RAISE EXCEPTION 'RATE_LIMITED:retry_after=%', v_retry_after;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION internal.enqueue_verification_emails(
  p_profile_id UUID,
  p_submission_key TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_student_html TEXT;
  v_admin_html TEXT;
  v_inserted INTEGER := 0;
BEGIN
  SELECT * INTO STRICT v_profile
  FROM public.profiles
  WHERE id = p_profile_id;

  IF v_profile.status <> 'pending'
     OR NOT v_profile.profile_complete
     OR v_profile.submitted_at IS NULL THEN
    RAISE EXCEPTION 'Profile is not in a submittable verification state';
  END IF;

  v_student_html := '<!doctype html><html><body style="font-family:Arial,sans-serif;background:#FAF7EA;color:#123524;padding:32px">' ||
    '<main style="max-width:600px;margin:auto;background:#fff;border:1px solid rgba(18,53,36,.22);border-radius:20px;padding:28px">' ||
    '<h1>Profile submitted</h1><p>Hello <strong>' || public.html_escape(COALESCE(v_profile.full_name, 'Student')) || '</strong>,</p>' ||
    '<p>Your CCIS profile is pending Student Council verification.</p>' ||
    '<p><strong>Student number:</strong> ' || public.html_escape(COALESCE(v_profile.student_number, 'N/A')) || '<br>' ||
    '<strong>Program / section:</strong> ' || public.html_escape(COALESCE(v_profile.program, 'CCIS')) || ' / ' || public.html_escape(COALESCE(v_profile.section, 'N/A')) || '</p>' ||
    '</main></body></html>';

  v_admin_html := '<!doctype html><html><body style="font-family:Arial,sans-serif;background:#FAF7EA;color:#123524;padding:32px">' ||
    '<main style="max-width:600px;margin:auto;background:#fff;border:1px solid rgba(18,53,36,.22);border-radius:20px;padding:28px">' ||
    '<h1>Verification review required</h1><p><strong>Name:</strong> ' || public.html_escape(COALESCE(v_profile.full_name, 'Student')) || '<br>' ||
    '<strong>Email:</strong> ' || public.html_escape(v_profile.email) || '<br>' ||
    '<strong>Student number:</strong> ' || public.html_escape(COALESCE(v_profile.student_number, 'N/A')) || '<br>' ||
    '<strong>Program / section:</strong> ' || public.html_escape(COALESCE(v_profile.program, 'CCIS')) || ' / ' || public.html_escape(COALESCE(v_profile.section, 'N/A')) || '</p>' ||
    '<p>Open the Admin Verification Desk to review this submission.</p></main></body></html>';

  INSERT INTO public.email_queue (
    profile_id, recipient_email, email_type, subject, html_body, logical_key, provider_idempotency_key
  ) VALUES (
    v_profile.id,
    v_profile.email,
    'verification_student',
    '[CCIS SC] Profile submitted — pending verification',
    v_student_html,
    'verification-student:' || p_submission_key,
    'verification-student-' || p_submission_key
  )
  ON CONFLICT (logical_key) WHERE logical_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  INSERT INTO public.email_queue (
    profile_id, recipient_email, email_type, subject, html_body, logical_key, provider_idempotency_key
  ) VALUES (
    v_profile.id,
    'devcommgio2006@gmail.com',
    'verification_admin',
    '[CCIS SC] Verification review: ' || COALESCE(v_profile.full_name, 'Student'),
    v_admin_html,
    'verification-admin:' || p_submission_key,
    'verification-admin-' || p_submission_key
  )
  ON CONFLICT (logical_key) WHERE logical_key IS NOT NULL DO NOTHING;
  v_inserted := v_inserted + CASE WHEN FOUND THEN 1 ELSE 0 END;

  RETURN v_inserted;
END;
$$;

-- Direct student INSERT/UPDATE is retired. Profiles are provisioned by the
-- auth trigger and changed through narrowly-scoped RPCs below.
DROP TRIGGER IF EXISTS prevent_profile_admin_field_changes ON public.profiles;
DROP TRIGGER IF EXISTS trg_enforce_profile_update_security ON public.profiles;
DROP FUNCTION IF EXISTS public.prevent_profile_admin_field_changes();
DROP FUNCTION IF EXISTS public.enforce_profile_update_security();

DROP FUNCTION IF EXISTS public.update_student_profile(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, BOOLEAN, TEXT, TIMESTAMPTZ, TEXT, BOOLEAN
);
DROP FUNCTION IF EXISTS public.update_student_profile(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, BOOLEAN, TEXT, TIMESTAMPTZ, TEXT, BOOLEAN,
  BOOLEAN, BOOLEAN
);

CREATE OR REPLACE FUNCTION public.update_student_profile(
  p_full_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_student_number TEXT DEFAULT NULL,
  p_year_level SMALLINT DEFAULT NULL,
  p_program TEXT DEFAULT NULL,
  p_section TEXT DEFAULT NULL,
  p_contact_number TEXT DEFAULT NULL,
  p_clear_avatar_url BOOLEAN DEFAULT false,
  p_clear_contact_number BOOLEAN DEFAULT false
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM internal.enforce_rate_limit('profile_update', auth.uid()::TEXT, 20, 3600);

  UPDATE public.profiles
  SET
    full_name = COALESCE(NULLIF(btrim(p_full_name), ''), full_name),
    avatar_url = CASE WHEN p_clear_avatar_url THEN NULL ELSE COALESCE(p_avatar_url, avatar_url) END,
    student_number = COALESCE(NULLIF(btrim(p_student_number), ''), student_number),
    year_level = COALESCE(p_year_level, year_level),
    program = COALESCE(NULLIF(btrim(p_program), ''), program),
    section = COALESCE(NULLIF(btrim(p_section), ''), section),
    contact_number = CASE WHEN p_clear_contact_number THEN NULL ELSE COALESCE(p_contact_number, contact_number) END,
    updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_privacy_consent()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_recorded_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.profiles
  SET privacy_agreed_at = COALESCE(privacy_agreed_at, now()), updated_at = now()
  WHERE id = auth.uid()
  RETURNING privacy_agreed_at INTO v_recorded_at;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  RETURN v_recorded_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_email_preferences(p_subscribe BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.profiles
  SET subscribe_announcements_events = COALESCE(p_subscribe, false),
      email_subscription_decided = true,
      updated_at = now()
  WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_profile_for_verification(
  p_student_number TEXT,
  p_year_level SMALLINT,
  p_program TEXT,
  p_section TEXT,
  p_contact_number TEXT DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles;
  v_submission_key TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM internal.enforce_rate_limit('verification_submit', auth.uid()::TEXT, 3, 3600);

  SELECT * INTO STRICT v_profile FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF v_profile.status = 'pending'
     AND v_profile.profile_complete
     AND v_profile.submitted_at IS NOT NULL THEN
    RETURN v_profile;
  END IF;
  IF NOT internal.is_allowed_identity(v_profile.email) THEN RAISE EXCEPTION 'INSTITUTIONAL_EMAIL_REQUIRED'; END IF;
  IF v_profile.privacy_agreed_at IS NULL THEN RAISE EXCEPTION 'PRIVACY_CONSENT_REQUIRED'; END IF;
  IF v_profile.banned AND (v_profile.banned_until IS NULL OR v_profile.banned_until > now()) THEN
    RAISE EXCEPTION 'ACCOUNT_BANNED';
  END IF;
  IF NULLIF(btrim(p_student_number), '') IS NULL
     OR p_year_level IS NULL OR p_year_level < 1 OR p_year_level > 6
     OR NULLIF(btrim(p_program), '') IS NULL
     OR NULLIF(btrim(p_section), '') IS NULL THEN
    RAISE EXCEPTION 'INCOMPLETE_PROFILE';
  END IF;

  UPDATE public.profiles
  SET student_number = btrim(p_student_number),
      year_level = p_year_level,
      program = btrim(p_program),
      section = btrim(p_section),
      contact_number = NULLIF(btrim(p_contact_number), ''),
      status = 'pending',
      profile_complete = true,
      submitted_at = now(),
      approved_at = NULL,
      approved_by = NULL,
      rejection_reason = NULL,
      updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;

  v_submission_key := v_profile.id::TEXT || ':' || floor(extract(epoch FROM v_profile.submitted_at))::BIGINT::TEXT;
  PERFORM internal.enqueue_verification_emails(v_profile.id, v_submission_key);
  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.resubmit_for_verification()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles;
  v_submission_key TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM internal.enforce_rate_limit('verification_resubmit', auth.uid()::TEXT, 2, 3600);
  SELECT * INTO STRICT v_profile FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF v_profile.status <> 'rejected' THEN RAISE EXCEPTION 'RESUBMIT_NOT_ALLOWED'; END IF;
  IF NOT internal.is_allowed_identity(v_profile.email) THEN RAISE EXCEPTION 'INSTITUTIONAL_EMAIL_REQUIRED'; END IF;
  IF v_profile.student_number IS NULL OR v_profile.program IS NULL OR v_profile.section IS NULL THEN
    RAISE EXCEPTION 'INCOMPLETE_PROFILE';
  END IF;

  UPDATE public.profiles
  SET status = 'pending', submitted_at = now(), rejection_reason = NULL,
      profile_complete = true, updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;
  v_submission_key := v_profile.id::TEXT || ':' || floor(extract(epoch FROM v_profile.submitted_at))::BIGINT::TEXT;
  PERFORM internal.enqueue_verification_emails(v_profile.id, v_submission_key);
  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_attendance_pass(p_rotate BOOLEAN DEFAULT false)
RETURNS TABLE (attendance_qr_code TEXT, attendance_qr_generated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- Profile creation rejects external identities at the trusted database edge.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_is_admin BOOLEAN;
BEGIN
  IF NOT internal.is_allowed_identity(NEW.email) THEN
    RAISE EXCEPTION 'INSTITUTIONAL_EMAIL_REQUIRED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.account_deletion_tombstones WHERE user_id = NEW.id) THEN
    RAISE EXCEPTION 'ACCOUNT_DELETED';
  END IF;
  v_is_admin := internal.is_admin_bypass_email(NEW.email);
  INSERT INTO public.profiles (
    id, email, full_name, avatar_url, role, status, profile_complete,
    subscribe_announcements_events, email_subscription_decided
  ) VALUES (
    NEW.id, lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    CASE WHEN v_is_admin THEN 'devcom_head' ELSE 'student' END,
    CASE WHEN v_is_admin THEN 'approved' ELSE 'pending' END,
    v_is_admin, false, false
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_profile public.profiles;
  v_is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF FOUND THEN RETURN v_profile; END IF;
  SELECT * INTO STRICT v_user FROM auth.users WHERE id = auth.uid();
  IF NOT internal.is_allowed_identity(v_user.email) THEN RAISE EXCEPTION 'INSTITUTIONAL_EMAIL_REQUIRED'; END IF;
  IF EXISTS (SELECT 1 FROM public.account_deletion_tombstones WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'ACCOUNT_DELETED';
  END IF;
  v_is_admin := internal.is_admin_bypass_email(v_user.email);
  INSERT INTO public.profiles (
    id, email, full_name, avatar_url, role, status, profile_complete,
    subscribe_announcements_events, email_subscription_decided
  ) VALUES (
    v_user.id, lower(v_user.email),
    COALESCE(v_user.raw_user_meta_data->>'full_name', v_user.raw_user_meta_data->>'name', ''),
    COALESCE(v_user.raw_user_meta_data->>'avatar_url', v_user.raw_user_meta_data->>'picture'),
    CASE WHEN v_is_admin THEN 'devcom_head' ELSE 'student' END,
    CASE WHEN v_is_admin THEN 'approved' ELSE 'pending' END,
    v_is_admin, false, false
  ) RETURNING * INTO v_profile;
  RETURN v_profile;
END;
$$;

-- The old user-callable mail-queue endpoint is intentionally removed. Email
-- queueing occurs only as part of server-owned state transitions.
DROP FUNCTION IF EXISTS public.queue_verification_emails();

CREATE OR REPLACE FUNCTION public.admin_approve_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_target public.profiles%ROWTYPE; v_key TEXT; v_rows INTEGER;
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'officer') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  PERFORM internal.enforce_rate_limit('verification_admin', auth.uid()::TEXT, 60, 3600);
  SELECT * INTO STRICT v_target FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_target.status = 'approved' THEN
    RETURN jsonb_build_object('approved', true, 'email_queued', false, 'already_approved', true);
  END IF;
  UPDATE public.profiles
  SET status = 'approved', approved_at = now(), approved_by = auth.uid(),
      rejection_reason = NULL, profile_complete = true, updated_at = now()
  WHERE id = p_user_id;
  v_key := 'verification-approved:' || p_user_id::TEXT || ':' || floor(extract(epoch FROM now()))::BIGINT::TEXT;
  INSERT INTO public.email_queue (profile_id, recipient_email, email_type, subject, html_body, logical_key, provider_idempotency_key)
  VALUES (
    p_user_id, v_target.email, 'verification_approved', '[CCIS SC] Account approved',
    '<p>Hello <strong>' || public.html_escape(COALESCE(v_target.full_name, 'Student')) || '</strong>, your CCIS Portal profile has been approved.</p>',
    v_key, replace(v_key, ':', '-')
  ) ON CONFLICT (logical_key) WHERE logical_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('approved', true, 'email_queued', v_rows = 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_user(p_user_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_target public.profiles%ROWTYPE; v_reason TEXT; v_key TEXT; v_rows INTEGER;
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'officer') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  PERFORM internal.enforce_rate_limit('verification_admin', auth.uid()::TEXT, 60, 3600);
  v_reason := COALESCE(NULLIF(btrim(p_reason), ''), 'No specific reason provided.');
  SELECT * INTO STRICT v_target FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_target.status = 'rejected' AND v_target.rejection_reason = v_reason THEN
    RETURN jsonb_build_object('rejected', true, 'email_queued', false, 'already_rejected', true);
  END IF;
  UPDATE public.profiles
  SET status = 'rejected', rejection_reason = v_reason, profile_complete = false,
      approved_at = NULL, approved_by = NULL, updated_at = now()
  WHERE id = p_user_id;
  v_key := 'verification-rejected:' || p_user_id::TEXT || ':' || floor(extract(epoch FROM now()))::BIGINT::TEXT;
  INSERT INTO public.email_queue (profile_id, recipient_email, email_type, subject, html_body, logical_key, provider_idempotency_key)
  VALUES (
    p_user_id, v_target.email, 'verification_rejected', '[CCIS SC] Profile changes required',
    '<p>Hello <strong>' || public.html_escape(COALESCE(v_target.full_name, 'Student')) || '</strong>. Your profile needs changes.</p><p><strong>Reason:</strong> ' || public.html_escape(v_reason) || '</p>',
    v_key, replace(v_key, ':', '-')
  ) ON CONFLICT (logical_key) WHERE logical_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('rejected', true, 'email_queued', v_rows = 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_for_event(p_event_id UUID, p_profile_id UUID)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.check_in_audience(p_event_id UUID, p_attendance_token TEXT)
RETURNS TABLE (registration_id UUID, profile_id UUID, was_already_attended BOOLEAN, attended_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_profile_id UUID; v_registration public.event_registrations%ROWTYPE;
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'comm_registration') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  PERFORM internal.enforce_rate_limit('attendance_scan', auth.uid()::TEXT, 180, 60);
  IF NULLIF(btrim(p_attendance_token), '') IS NULL THEN RAISE EXCEPTION 'ATTENDANCE_TOKEN_REQUIRED'; END IF;
  PERFORM 1 FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EVENT_NOT_FOUND'; END IF;
  SELECT id INTO STRICT v_profile_id FROM public.profiles
  WHERE attendance_qr_code = btrim(p_attendance_token)
    AND status = 'approved'
    AND NOT banned;
  SELECT * INTO v_registration FROM public.event_registrations
  WHERE event_id = p_event_id AND event_registrations.profile_id = v_profile_id FOR UPDATE;
  IF FOUND AND v_registration.status = 'attended' THEN
    RETURN QUERY SELECT v_registration.id, v_profile_id, true, COALESCE(v_registration.attended_at, v_registration.registered_at);
    RETURN;
  END IF;
  IF FOUND THEN
    UPDATE public.event_registrations SET status = 'attended', attended_at = now()
    WHERE id = v_registration.id RETURNING * INTO v_registration;
  ELSE
    INSERT INTO public.event_registrations (event_id, profile_id, status, registered_at, attended_at)
    VALUES (p_event_id, v_profile_id, 'attended', now(), now()) RETURNING * INTO v_registration;
  END IF;
  RETURN QUERY SELECT v_registration.id, v_profile_id, false, v_registration.attended_at;
END;
$$;

-- Network-wide IP bans are retired in favor of per-profile controls.
DROP FUNCTION IF EXISTS public.check_ip_banned(TEXT);

-- Explicit function grants. Trigger-only helpers are never API-callable.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION internal.enqueue_verification_emails(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION internal.enforce_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE v_signature REGPROCEDURE;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.update_student_profile(text,text,text,smallint,text,text,text,boolean,boolean)'::regprocedure,
    'public.record_privacy_consent()'::regprocedure,
    'public.set_email_preferences(boolean)'::regprocedure,
    'public.submit_profile_for_verification(text,smallint,text,text,text)'::regprocedure,
    'public.resubmit_for_verification()'::regprocedure,
    'public.issue_attendance_pass(boolean)'::regprocedure,
    'public.ensure_user_profile()'::regprocedure,
    'public.admin_approve_user(uuid)'::regprocedure,
    'public.admin_reject_user(uuid,text)'::regprocedure,
    'public.register_for_event(uuid,uuid)'::regprocedure,
    'public.check_in_audience(uuid,text)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_signature);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_student_profile(TEXT, TEXT, TEXT, SMALLINT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_privacy_consent() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_email_preferences(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_profile_for_verification(TEXT, SMALLINT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resubmit_for_verification() TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_attendance_pass(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_approve_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_for_event(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_in_audience(UUID, TEXT) TO authenticated;
