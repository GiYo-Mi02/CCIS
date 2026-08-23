-- ============================================================
-- AUDIT ROUND 2 COMPREHENSIVE FIXES
-- Covers: ERROR 2,5,6,7,8 + WARNING 9,12,13,14,15
-- ============================================================

-- ============================================================
-- 1. ERROR 6: Add profile_id column to email_queue for scoped deletion
-- ============================================================
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS profile_id UUID;

-- ============================================================
-- 2. WARNING 14: Add dedicated attendance timestamp
-- ============================================================
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ;

-- ============================================================
-- 3. WARNING 15: Add sent_at for lease-reclaim safety
-- ============================================================
-- ACCEPTED RISK: Setting sent_at before SMTP means a genuine SMTP failure
-- after that point gets treated as "sent" by lease reclaim (email silently lost,
-- no retry). This favors no-duplicate-delivery over guaranteed-delivery, which
-- is the correct tradeoff for a notification system where duplicates reaching
-- inboxes is worse than a rare missed email.
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;


-- ============================================================
-- 4. ERROR 2: Internal schema + vault accessor for service role key
-- ============================================================
CREATE SCHEMA IF NOT EXISTS internal;

-- Accessor function for the service role key stored in Supabase Vault.
-- SECURITY: Locked down so only service_role and SECURITY DEFINER callers
-- (i.e. the email trigger function) can read it.
CREATE OR REPLACE FUNCTION internal.get_service_role_key()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION internal.get_service_role_key() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION internal.get_service_role_key() FROM anon, authenticated;
-- Only service_role (implicit) and SECURITY DEFINER contexts can call this.


-- ============================================================
-- 5. ERROR 2: Update auto email trigger to send apikey header
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_process_email_queue_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := internal.get_service_role_key();

  -- Fail closed: if vault key is not configured, skip invocation silently
  -- (emails remain queued for manual processing or cron pickup).
  IF v_key IS NULL OR btrim(v_key) = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://aecrmddgsnnxtemyikqu.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_key
    ),
    body := '{}'::jsonb
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block email_queue inserts due to network/http errors
  RETURN NEW;
END;
$$;


-- ============================================================
-- 6. ERROR 5: ensure_user_profile() with tombstone check
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  -- ERROR 5: Reject tombstoned accounts before provisioning
  IF EXISTS (
    SELECT 1 FROM public.account_deletion_tombstones
    WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'ACCOUNT_DELETED';
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
    id, email, full_name, avatar_url, role, status,
    profile_complete, subscribe_announcements_events, email_subscription_decided
  ) VALUES (
    v_user.id,
    v_user.email,
    coalesce(v_user.raw_user_meta_data->>'full_name', v_user.raw_user_meta_data->>'name', ''),
    coalesce(v_user.raw_user_meta_data->>'avatar_url', v_user.raw_user_meta_data->>'picture', null),
    v_role, v_status,
    (v_role = 'devcom_head'), false, false
  )
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_profile() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated, service_role;


-- ============================================================
-- 7. ERROR 7: queue_verification_emails() with HTML escaping
-- ============================================================
CREATE OR REPLACE FUNCTION public.queue_verification_emails()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  -- All profile-controlled values are HTML-escaped to prevent injection
  v_student_html := '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px;">' ||
    '<h2 style="color:#123524;margin-bottom:8px;">CCIS Student Council — Profile Submitted</h2>' ||
    '<p style="color:#4b5563;">Hello <strong>' || public.html_escape(COALESCE(v_prof.full_name, 'Student')) || '</strong>,</p>' ||
    '<p style="color:#4b5563;">Your profile has been submitted and is currently <strong>Pending Verification</strong> by the Student Council administrator. You will be notified once reviewed.</p>' ||
    '<div style="background:#FAF7EA;padding:16px;border-radius:12px;margin:16px 0;color:#123524;">' ||
    '<p style="margin:4px 0;"><strong>Student No:</strong> ' || public.html_escape(COALESCE(v_prof.student_number, 'N/A')) || '</p>' ||
    '<p style="margin:4px 0;"><strong>Program:</strong> ' || public.html_escape(COALESCE(v_prof.program, 'CCIS')) || '</p>' ||
    '<p style="margin:4px 0;"><strong>Section:</strong> ' || public.html_escape(COALESCE(v_prof.section, 'N/A')) || '</p>' ||
    '</div>' ||
    '<p style="color:#9ca3af;font-size:12px;">This is an automated system notification.</p>' ||
    '</div>';

  v_admin_html := '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px;">' ||
    '<h2 style="color:#123524;margin-bottom:8px;">New Student Profile Pending Verification</h2>' ||
    '<p style="color:#4b5563;">A student has submitted their profile for admin review:</p>' ||
    '<div style="background:#FAF7EA;padding:16px;border-radius:12px;margin:16px 0;color:#123524;">' ||
    '<p style="margin:4px 0;"><strong>Name:</strong> ' || public.html_escape(COALESCE(v_prof.full_name, 'Student')) || '</p>' ||
    '<p style="margin:4px 0;"><strong>Email:</strong> ' || public.html_escape(COALESCE(v_prof.email, 'N/A')) || '</p>' ||
    '<p style="margin:4px 0;"><strong>Student No:</strong> ' || public.html_escape(COALESCE(v_prof.student_number, 'N/A')) || '</p>' ||
    '<p style="margin:4px 0;"><strong>Program / Section:</strong> ' || public.html_escape(COALESCE(v_prof.program, 'CCIS')) || ' - ' || public.html_escape(COALESCE(v_prof.section, 'N/A')) || '</p>' ||
    '</div>' ||
    '<p style="color:#4b5563;">Review this student on the Admin Verification Desk.</p>' ||
    '</div>';

  -- Queue student notification
  IF v_prof.email IS NOT NULL AND v_prof.email <> '' THEN
    INSERT INTO public.email_queue (recipient_email, email_type, subject, html_body, profile_id)
    VALUES (
      v_prof.email,
      'verification_student',
      '[CCIS SC] Profile Submitted — Pending Verification',
      v_student_html,
      v_uid
    );
  END IF;

  -- Queue admin notification
  INSERT INTO public.email_queue (recipient_email, email_type, subject, html_body)
  VALUES (
    v_admin_email,
    'verification_admin',
    '[Pending Verification] New User Profile: ' || public.html_escape(COALESCE(v_prof.full_name, 'Student')),
    v_admin_html
  );
END;
$$;

REVOKE ALL ON FUNCTION public.queue_verification_emails() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.queue_verification_emails() TO authenticated, service_role;


-- ============================================================
-- 8. ERROR 8: resubmit_for_verification() RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.resubmit_for_verification()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_prof public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  IF v_prof.status <> 'rejected' THEN
    RAISE EXCEPTION 'RESUBMIT_NOT_ALLOWED: Profile is not in rejected status.';
  END IF;

  UPDATE public.profiles SET
    status = 'pending',
    submitted_at = now(),
    rejection_reason = NULL,
    profile_complete = true
  WHERE id = v_uid;

  -- Queue notification emails (reuses existing logic)
  PERFORM public.queue_verification_emails();
END;
$$;

REVOKE ALL ON FUNCTION public.resubmit_for_verification() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.resubmit_for_verification() TO authenticated;


-- ============================================================
-- 9. WARNING 9: update_student_profile() with clear flags
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_student_profile(
  p_full_name                      TEXT        DEFAULT NULL,
  p_avatar_url                     TEXT        DEFAULT NULL,
  p_student_number                 TEXT        DEFAULT NULL,
  p_year_level                     TEXT        DEFAULT NULL,
  p_program                        TEXT        DEFAULT NULL,
  p_section                        TEXT        DEFAULT NULL,
  p_contact_number                 TEXT        DEFAULT NULL,
  p_privacy_agreed_at              TIMESTAMPTZ DEFAULT NULL,
  p_submitted_at                   TIMESTAMPTZ DEFAULT NULL,
  p_subscribe_announcements_events BOOLEAN     DEFAULT NULL,
  p_email_subscription_decided     BOOLEAN     DEFAULT NULL,
  p_attendance_qr_code             TEXT        DEFAULT NULL,
  p_attendance_qr_generated_at     TIMESTAMPTZ DEFAULT NULL,
  p_last_ip                        TEXT        DEFAULT NULL,
  p_profile_complete               BOOLEAN     DEFAULT NULL,
  -- Clear flags for nullable fields (WARNING 9)
  p_clear_contact_number           BOOLEAN     DEFAULT false,
  p_clear_avatar_url               BOOLEAN     DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  UPDATE public.profiles SET
    full_name                       = COALESCE(p_full_name,                      full_name),
    avatar_url                      = CASE WHEN p_clear_avatar_url THEN NULL
                                           ELSE COALESCE(p_avatar_url, avatar_url) END,
    student_number                  = COALESCE(p_student_number,                 student_number),
    year_level                      = COALESCE(p_year_level,                     year_level),
    program                         = COALESCE(p_program,                        program),
    section                         = COALESCE(p_section,                        section),
    contact_number                  = CASE WHEN p_clear_contact_number THEN NULL
                                           ELSE COALESCE(p_contact_number, contact_number) END,
    privacy_agreed_at               = COALESCE(p_privacy_agreed_at,              privacy_agreed_at),
    submitted_at                    = COALESCE(p_submitted_at,                   submitted_at),
    subscribe_announcements_events  = COALESCE(p_subscribe_announcements_events, subscribe_announcements_events),
    email_subscription_decided      = COALESCE(p_email_subscription_decided,     email_subscription_decided),
    attendance_qr_code              = COALESCE(p_attendance_qr_code,             attendance_qr_code),
    attendance_qr_generated_at      = COALESCE(p_attendance_qr_generated_at,     attendance_qr_generated_at),
    last_ip                         = COALESCE(p_last_ip,                        last_ip),
    profile_complete                = COALESCE(p_profile_complete,               profile_complete),
    updated_at                      = now()
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for the authenticated user.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_student_profile(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, BOOLEAN, TEXT, TIMESTAMPTZ, TEXT, BOOLEAN,
  BOOLEAN, BOOLEAN
) TO authenticated;

REVOKE ALL ON FUNCTION public.update_student_profile(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, BOOLEAN, TEXT, TIMESTAMPTZ, TEXT, BOOLEAN,
  BOOLEAN, BOOLEAN
) FROM anon;


-- ============================================================
-- 10. WARNING 12: Admin approve/reject RPCs
-- ============================================================
-- Checks the CURRENT database role (not stale JWT claims).
-- Degrades gracefully: status change commits even if email queueing fails.
-- The return value indicates whether the email was queued successfully.

CREATE OR REPLACE FUNCTION public.admin_approve_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_role TEXT;
  v_target public.profiles%ROWTYPE;
  v_html TEXT;
  v_email_queued BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('devcom_head', 'officer', 'comm_registration') THEN
    RAISE EXCEPTION 'FORBIDDEN: Administrative access required.';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target profile not found.';
  END IF;

  -- Perform the status change
  UPDATE public.profiles SET
    status = 'approved',
    approved_at = now(),
    approved_by = auth.uid(),
    profile_complete = true
  WHERE id = p_user_id;

  -- Attempt to queue approval email (degrade gracefully on failure)
  BEGIN
    v_html := '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px;">' ||
      '<h2 style="color:#16a34a;margin-bottom:8px;">Account Approved!</h2>' ||
      '<p style="color:#4b5563;">Hi <strong>' || public.html_escape(COALESCE(v_target.full_name, 'Tiger')) || '</strong>, your student profile has been verified and approved by the administrator.</p>' ||
      '<p style="color:#4b5563;">You now have complete access to the CCIS Student Portal, including announcement subscriptions, event registrations, and ticketing features!</p>' ||
      '<p style="color:#9ca3af;font-size:12px;">This is an automated status update.</p>' ||
      '</div>';

    INSERT INTO public.email_queue (recipient_email, email_type, subject, html_body, profile_id)
    VALUES (
      v_target.email,
      'verification_approved',
      '[CCIS SC] Account Approved!',
      v_html,
      p_user_id
    );
    v_email_queued := true;
  EXCEPTION WHEN OTHERS THEN
    -- Status change already committed; email failure is non-fatal
    RAISE WARNING 'Failed to queue approval email for %: %', p_user_id, SQLERRM;
  END;

  RETURN jsonb_build_object('approved', true, 'email_queued', v_email_queued);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_approve_user(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_approve_user(UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_reject_user(p_user_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_role TEXT;
  v_target public.profiles%ROWTYPE;
  v_html TEXT;
  v_email_queued BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role NOT IN ('devcom_head', 'officer', 'comm_registration') THEN
    RAISE EXCEPTION 'FORBIDDEN: Administrative access required.';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target profile not found.';
  END IF;

  -- Perform the status change, unlock profile for re-editing
  UPDATE public.profiles SET
    status = 'rejected',
    rejection_reason = COALESCE(btrim(p_reason), 'No specific reason provided.'),
    profile_complete = false
  WHERE id = p_user_id;

  -- Attempt to queue rejection email (degrade gracefully on failure)
  BEGIN
    v_html := '<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px;">' ||
      '<h2 style="color:#dc2626;margin-bottom:8px;">Verification Declined</h2>' ||
      '<p style="color:#4b5563;">Hi <strong>' || public.html_escape(COALESCE(v_target.full_name, 'Tiger')) || '</strong>, your profile submission was reviewed, but could not be approved.</p>' ||
      '<div style="background:rgba(220,38,38,0.1);border-left:3px solid #dc2626;padding:15px;border-radius:0 12px 12px 0;margin:16px 0;color:#7f1d1d;">' ||
      '<strong>Reason:</strong><br>' || public.html_escape(COALESCE(btrim(p_reason), 'No specific reason provided.')) ||
      '</div>' ||
      '<p style="color:#4b5563;">Your profile has been unlocked. Please sign in and correct the information, then re-submit for review.</p>' ||
      '<p style="color:#9ca3af;font-size:12px;">This is an automated status update.</p>' ||
      '</div>';

    INSERT INTO public.email_queue (recipient_email, email_type, subject, html_body, profile_id)
    VALUES (
      v_target.email,
      'verification_rejected',
      '[CCIS SC] Verification Rejection & Update Needed',
      v_html,
      p_user_id
    );
    v_email_queued := true;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to queue rejection email for %: %', p_user_id, SQLERRM;
  END;

  RETURN jsonb_build_object('rejected', true, 'email_queued', v_email_queued);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reject_user(UUID, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_reject_user(UUID, TEXT) TO authenticated;


-- ============================================================
-- 11. WARNING 13: register_for_event() with lock-first + exception handler
-- ============================================================
CREATE OR REPLACE FUNCTION public.register_for_event(p_event_id UUID, p_profile_id UUID)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  -- Lock the event row FIRST to serialize all capacity checks
  SELECT * INTO v_event
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;

  -- Check for existing registration AFTER acquiring the lock
  SELECT * INTO v_existing_registration
  FROM public.event_registrations
  WHERE event_id = p_event_id AND profile_id = p_profile_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_registration.status = 'cancelled' THEN
      -- Recompute live count inside the lock
      SELECT count(*) INTO v_current_count
      FROM public.event_registrations
      WHERE event_id = p_event_id AND status != 'cancelled';

      IF v_current_count >= v_event.registration_cap THEN
        RAISE EXCEPTION 'EVENT_FULL';
      END IF;

      UPDATE public.event_registrations
      SET status = 'confirmed', registered_at = now()
      WHERE event_id = p_event_id AND profile_id = p_profile_id
      RETURNING * INTO v_new_registration;

      RETURN v_new_registration;
    ELSE
      RAISE EXCEPTION 'ALREADY_REGISTERED';
    END IF;
  END IF;

  -- Compute current active registrations count inside the lock
  SELECT count(*) INTO v_current_count
  FROM public.event_registrations
  WHERE event_id = p_event_id AND status != 'cancelled';

  IF v_current_count >= v_event.registration_cap THEN
    RAISE EXCEPTION 'EVENT_FULL';
  END IF;

  -- Insert new registration with unique violation handler
  BEGIN
    INSERT INTO public.event_registrations (event_id, profile_id, status, registered_at)
    VALUES (p_event_id, p_profile_id, 'confirmed', now())
    RETURNING * INTO v_new_registration;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'ALREADY_REGISTERED';
  END;

  RETURN v_new_registration;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_for_event(UUID, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.register_for_event(UUID, UUID) TO authenticated, service_role;


-- ============================================================
-- 12. WARNING 14: check_in_audience() with attended_at
-- ============================================================
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
SET search_path = ''
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

  PERFORM 1 FROM public.events WHERE id = p_event_id FOR UPDATE;

  SELECT * INTO v_registration
  FROM public.event_registrations
  WHERE event_id = p_event_id AND profile_id = v_profile_id
  FOR UPDATE;

  IF FOUND AND v_registration.status = 'attended' THEN
    -- Return the actual attended_at timestamp, not registered_at
    RETURN QUERY SELECT v_registration.id, v_profile_id, true,
      COALESCE(v_registration.attended_at, v_registration.registered_at);
    RETURN;
  END IF;

  IF FOUND THEN
    UPDATE public.event_registrations
    SET status = 'attended', attended_at = now()
    WHERE id = v_registration.id
    RETURNING * INTO v_registration;
  ELSE
    INSERT INTO public.event_registrations (event_id, profile_id, status, registered_at, attended_at)
    VALUES (p_event_id, v_profile_id, 'attended', now(), now())
    RETURNING * INTO v_registration;
  END IF;

  RETURN QUERY SELECT v_registration.id, v_profile_id, false, v_registration.attended_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_in_audience(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_audience(UUID, TEXT) TO authenticated;


-- ============================================================
-- 13. WARNING 15: Updated dequeue_emails with sent_at safety
-- ============================================================
CREATE OR REPLACE FUNCTION public.dequeue_emails(p_limit INTEGER, p_worker_id TEXT)
RETURNS SETOF public.email_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Invalid dequeue limit';
  END IF;

  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RAISE EXCEPTION 'Worker ID is required';
  END IF;

  -- Reclaim expired leases, but respect sent_at:
  -- If sent_at IS NOT NULL, the email was likely delivered — mark as sent, not failed.
  UPDATE public.email_queue
  SET
    status = CASE
      WHEN sent_at IS NOT NULL THEN 'sent'
      WHEN attempts >= 3 THEN 'dead_letter'
      ELSE 'failed'
    END,
    error_message = CASE
      WHEN sent_at IS NOT NULL THEN NULL
      ELSE COALESCE(error_message || ' ', '') || 'Processing lease expired.'
    END,
    scheduled_for = CASE
      WHEN sent_at IS NOT NULL THEN scheduled_for
      WHEN attempts >= 3 THEN scheduled_for
      ELSE now()
    END,
    lease_expires_at = NULL,
    lease_worker_id = NULL,
    dead_lettered_at = CASE WHEN attempts >= 3 AND sent_at IS NULL THEN now() ELSE dead_lettered_at END,
    processed_at = CASE WHEN sent_at IS NOT NULL THEN COALESCE(processed_at, now()) ELSE processed_at END
  WHERE status = 'processing'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at <= now();

  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.email_queue
    WHERE (status = 'pending' OR (status = 'failed' AND attempts < 3))
      AND scheduled_for <= now()
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.email_queue AS queue
  SET status = 'processing',
      attempts = attempts + 1,
      lease_expires_at = now() + interval '15 minutes',
      lease_worker_id = p_worker_id,
      error_message = NULL,
      sent_at = NULL
  FROM candidates
  WHERE queue.id = candidates.id
  RETURNING queue.*;
END;
$$;

REVOKE ALL ON FUNCTION public.dequeue_emails(INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dequeue_emails(INTEGER, TEXT) TO service_role;
