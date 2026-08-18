-- ============================================================
-- Issue #1 LIVE FIX: Drop denylist approach, enforce proper allowlist RPC
-- Applies: update_student_profile() SECURITY DEFINER function
--          + admin-only UPDATE policy (removes student direct UPDATE)
-- ============================================================

-- 1. Allowlist RPC for student self-updates
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
  p_profile_complete               BOOLEAN     DEFAULT NULL
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
    avatar_url                      = COALESCE(p_avatar_url,                     avatar_url),
    student_number                  = COALESCE(p_student_number,                 student_number),
    year_level                      = COALESCE(p_year_level,                     year_level),
    program                         = COALESCE(p_program,                        program),
    section                         = COALESCE(p_section,                        section),
    contact_number                  = COALESCE(p_contact_number,                 contact_number),
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
  TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, BOOLEAN, TEXT, TIMESTAMPTZ, TEXT, BOOLEAN
) TO authenticated;

REVOKE ALL ON FUNCTION public.update_student_profile(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN, BOOLEAN, TEXT, TIMESTAMPTZ, TEXT, BOOLEAN
) FROM anon;

-- 2. Remove student direct UPDATE access; keep admin-only policy
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"                    ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin"                  ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy"                 ON public.profiles;

-- Students must call the RPC. Only council admins can UPDATE directly.
CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE
  TO authenticated
  USING  (public.get_user_role() IN ('devcom_head', 'officer', 'comm_registration'))
  WITH CHECK (public.get_user_role() IN ('devcom_head', 'officer', 'comm_registration'));

DO $$
BEGIN
  RAISE NOTICE 'Live fix applied: update_student_profile() RPC + admin-only direct UPDATE policy.';
END $$;
