-- ============================================================
-- AUDIT COMPREHENSIVE FIXES (Issues 2, 3, 4, 7, 8, 18)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Issue 2: Enforce caller-verified identity in register_for_event
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_for_event(p_event_id UUID, p_profile_id UUID)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_current_count INT;
  v_existing_registration public.event_registrations%ROWTYPE;
  v_new_registration public.event_registrations%ROWTYPE;
  v_caller_role TEXT;
BEGIN
  -- Authenticate caller
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Security check: callers can only register themselves unless they are admin/officer
  IF p_profile_id IS DISTINCT FROM auth.uid() THEN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role NOT IN ('devcom_head', 'officer', 'comm_registration') AND auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'UNAUTHORIZED_REGISTRATION: You can only register your own account.';
    END IF;
  END IF;

  -- Check if registration record already exists (cancelled or active)
  SELECT * INTO v_existing_registration
  FROM public.event_registrations
  WHERE event_id = p_event_id AND profile_id = p_profile_id;

  IF FOUND THEN
    IF v_existing_registration.status = 'cancelled' THEN
      -- Lock the event row to serialize capacity checks
      SELECT * INTO v_event
      FROM public.events
      WHERE id = p_event_id
      FOR UPDATE;

      -- Recompute live count inside the lock (excluding cancelled registrations)
      SELECT count(*) INTO v_current_count
      FROM public.event_registrations
      WHERE event_id = p_event_id
        AND status != 'cancelled';

      IF v_current_count >= v_event.registration_cap THEN
        RAISE EXCEPTION 'EVENT_FULL';
      END IF;

      -- Re-activate the cancelled registration
      UPDATE public.event_registrations
      SET status = 'confirmed', registered_at = now()
      WHERE event_id = p_event_id AND profile_id = p_profile_id
      RETURNING * INTO v_new_registration;
      
      RETURN v_new_registration;
    ELSE
      RAISE EXCEPTION 'ALREADY_REGISTERED';
    END IF;
  END IF;

  -- Lock the event row to serialize capacity checks
  SELECT * INTO v_event
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  -- Compute current active registrations count inside the lock
  SELECT count(*) INTO v_current_count
  FROM public.event_registrations
  WHERE event_id = p_event_id
    AND status != 'cancelled';

  IF v_current_count >= v_event.registration_cap THEN
    RAISE EXCEPTION 'EVENT_FULL';
  END IF;

  -- Insert new registration record
  INSERT INTO public.event_registrations (event_id, profile_id, status, registered_at)
  VALUES (p_event_id, p_profile_id, 'confirmed', now())
  RETURNING * INTO v_new_registration;

  RETURN v_new_registration;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_for_event(UUID, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.register_for_event(UUID, UUID) TO authenticated, service_role;


-- ------------------------------------------------------------
-- 2. Issue 3: Lock down direct email_queue writes & provide safe verification RPC
-- ------------------------------------------------------------
-- Revoke broad direct INSERT on email_queue
DROP POLICY IF EXISTS email_queue_insert_policy ON public.email_queue;
DROP POLICY IF EXISTS email_queue_insert_authenticated ON public.email_queue;

-- Only admins/service_role can insert directly to email_queue
CREATE POLICY email_queue_admin_insert ON public.email_queue
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'student') IN ('devcom_head', 'officer')
  );

-- Secure RPC for queueing student verification submission emails server-side
CREATE OR REPLACE FUNCTION public.queue_verification_emails()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof public.profiles%ROWTYPE;
  v_admin_email TEXT := 'devcommgio2006@gmail.com';
  v_student_html TEXT;
  v_admin_html TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  v_student_html := '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px;">' ||
    '<h2 style="color:#123524;margin-bottom:8px;">CCIS Student Council — Profile Submitted</h2>' ||
    '<p style="color:#4b5563;">Hello <strong>' || COALESCE(v_prof.full_name, 'Student') || '</strong>,</p>' ||
    '<p style="color:#4b5563;">Your profile has been submitted and is currently <strong>Pending Verification</strong> by the Student Council administrator. You will be notified once reviewed.</p>' ||
    '<div style="background:#FAF7EA;padding:16px;border-radius:12px;margin:16px 0;color:#123524;">' ||
    '<p style="margin:4px 0;"><strong>Student No:</strong> ' || COALESCE(v_prof.student_number, 'N/A') || '</p>' ||
    '<p style="margin:4px 0;"><strong>Program:</strong> ' || COALESCE(v_prof.program, 'CCIS') || '</p>' ||
    '<p style="margin:4px 0;"><strong>Section:</strong> ' || COALESCE(v_prof.section, 'N/A') || '</p>' ||
    '</div>' ||
    '<p style="color:#9ca3af;font-size:12px;">This is an automated system notification.</p>' ||
    '</div>';

  v_admin_html := '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px;">' ||
    '<h2 style="color:#123524;margin-bottom:8px;">New Student Profile Pending Verification</h2>' ||
    '<p style="color:#4b5563;">A student has submitted their profile for admin review:</p>' ||
    '<div style="background:#FAF7EA;padding:16px;border-radius:12px;margin:16px 0;color:#123524;">' ||
    '<p style="margin:4px 0;"><strong>Name:</strong> ' || COALESCE(v_prof.full_name, 'Student') || '</p>' ||
    '<p style="margin:4px 0;"><strong>Email:</strong> ' || COALESCE(v_prof.email, 'N/A') || '</p>' ||
    '<p style="margin:4px 0;"><strong>Student No:</strong> ' || COALESCE(v_prof.student_number, 'N/A') || '</p>' ||
    '<p style="margin:4px 0;"><strong>Program / Section:</strong> ' || COALESCE(v_prof.program, 'CCIS') || ' - ' || COALESCE(v_prof.section, 'N/A') || '</p>' ||
    '</div>' ||
    '<p style="color:#4b5563;">Review this student on the Admin Verification Desk.</p>' ||
    '</div>';

  -- Queue student notification
  IF v_prof.email IS NOT NULL AND v_prof.email <> '' THEN
    INSERT INTO public.email_queue (recipient_email, email_type, subject, html_body)
    VALUES (
      v_prof.email,
      'verification_student',
      '[CCIS SC] Profile Submitted — Pending Verification',
      v_student_html
    );
  END IF;

  -- Queue admin notification
  INSERT INTO public.email_queue (recipient_email, email_type, subject, html_body)
  VALUES (
    v_admin_email,
    'verification_admin',
    '[Pending Verification] New User Profile: ' || COALESCE(v_prof.full_name, 'Student'),
    v_admin_html
  );
END;
$$;

REVOKE ALL ON FUNCTION public.queue_verification_emails() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.queue_verification_emails() TO authenticated, service_role;


-- ------------------------------------------------------------
-- 3. Issue 7: Remove public read on IP bans table
-- ------------------------------------------------------------
DROP POLICY IF EXISTS ip_bans_select ON public.ip_bans;

CREATE POLICY ip_bans_select_admin ON public.ip_bans
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'student') IN ('devcom_head', 'officer')
    OR auth.jwt() ->> 'email' IN ('ggiojoshua2006@gmail.com', 'cciscsc.dev@gmail.com')
  );

-- Helper RPC for checking if current IP is banned without exposing whole table
CREATE OR REPLACE FUNCTION public.check_ip_banned(p_ip TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ip_bans
    WHERE ip_address = p_ip
      AND (banned_until IS NULL OR banned_until > now())
  );
$$;

REVOKE ALL ON FUNCTION public.check_ip_banned(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.check_ip_banned(TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------
-- 4. Auto-Provision Missing Profiles on First Auth (ensure_user_profile)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user auth.users;
  v_profile public.profiles;
  v_role text := 'student';
  v_status text := 'pending';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF FOUND THEN
    RETURN v_profile;
  END IF;

  SELECT * INTO v_user FROM auth.users WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User account not found';
  END IF;

  IF lower(v_user.email) IN ('ggiojoshua2006@gmail.com', 'devcommgio2006@gmail.com', 'cciscsc.dev@gmail.com') THEN
    v_role := 'devcom_head';
    v_status := 'approved';
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    status,
    profile_complete,
    subscribe_announcements_events,
    email_subscription_decided
  ) VALUES (
    v_user.id,
    v_user.email,
    coalesce(v_user.raw_user_meta_data->>'full_name', v_user.raw_user_meta_data->>'name', ''),
    coalesce(v_user.raw_user_meta_data->>'avatar_url', v_user.raw_user_meta_data->>'picture', null),
    v_role,
    v_status,
    (v_role = 'devcom_head'),
    false,
    false
  )
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_profile() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated, service_role;

