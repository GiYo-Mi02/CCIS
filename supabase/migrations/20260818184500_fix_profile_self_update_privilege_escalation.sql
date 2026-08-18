-- ============================================================
-- CCIS Security: Fix profiles self-update privilege escalation (Issue #1)
-- Audit finding: Broad RLS UPDATE policy + upsert() allowed arbitrary column writes.
--
-- Strategy:
--   1. Create update_student_profile() SECURITY DEFINER RPC — strict column allowlist.
--      Students MUST use this RPC; no direct PostgREST UPDATE is granted to them.
--   2. Admin roles (devcom_head, officer, comm_registration) retain direct UPDATE policy.
--   3. Denylist trigger kept as defence-in-depth backstop.
--   4. RAISE NOTICE wrapped in DO block (top-level RAISE is invalid outside PL/pgSQL).
-- ============================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Strict allowlist RPC for student self-updates
-- ─────────────────────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Denylist trigger — defence-in-depth backstop against direct PATCH
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_profile_update_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_role TEXT;
  v_is_admin    BOOLEAN := FALSE;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role IN ('devcom_head', 'officer', 'comm_registration') THEN
    v_is_admin := TRUE;
  END IF;

  IF NOT v_is_admin THEN
    IF auth.uid() IS NULL OR auth.uid() <> OLD.id THEN
      RAISE EXCEPTION 'Access denied: You can only update your own profile.';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Access denied: role is not student-editable.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Access denied: status is not student-editable.';
    END IF;
    IF NEW.banned IS DISTINCT FROM OLD.banned OR NEW.banned_until IS DISTINCT FROM OLD.banned_until THEN
      RAISE EXCEPTION 'Access denied: ban fields are not student-editable.';
    END IF;
    IF NEW.committee_id IS DISTINCT FROM OLD.committee_id OR NEW.position IS DISTINCT FROM OLD.position THEN
      RAISE EXCEPTION 'Access denied: committee fields are not student-editable.';
    END IF;
    IF NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
      RAISE EXCEPTION 'Access denied: approval metadata is not student-editable.';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Access denied: core identifiers cannot be changed.';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_update_security ON public.profiles;
CREATE TRIGGER trg_enforce_profile_update_security
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_update_security();

GRANT EXECUTE ON FUNCTION public.enforce_profile_update_security() TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: RLS — admin-only direct UPDATE; students use the allowlist RPC
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"                    ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin"                  ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy"                 ON public.profiles;

-- Students have NO direct UPDATE policy. They call update_student_profile() which
-- runs as SECURITY DEFINER and bypasses RLS, writing only whitelisted columns.
CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE
  TO authenticated
  USING  (public.get_user_role() IN ('devcom_head', 'officer', 'comm_registration'))
  WITH CHECK (public.get_user_role() IN ('devcom_head', 'officer', 'comm_registration'));


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Confirmation notice — wrapped in DO block (top-level RAISE is invalid)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'Issue #1 fix applied: update_student_profile() RPC (allowlist) + denylist trigger + admin-only direct UPDATE policy.';
END $$;
