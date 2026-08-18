-- ============================================================
-- CCIS DATABASE SECURITY HARDENING: FIX PROFILE SELF-UPDATE PRIVILEGE ESCALATION
-- Prevents standard users/students from modifying privileged columns:
-- role, status, banned, banned_until, committee_id, position, approved_at, approved_by, rejection_reason
-- ============================================================

-- 1. Create the Security Enforcer Function for Profiles BEFORE UPDATE
CREATE OR REPLACE FUNCTION public.enforce_profile_update_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_role TEXT;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- Allow service_role (backend administrative service) to perform any update
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Determine caller role from public.profiles
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role IN ('devcom_head', 'officer', 'comm_registration') THEN
    v_is_admin := TRUE;
  END IF;

  -- If the caller is NOT an admin:
  IF NOT v_is_admin THEN
    -- A non-admin user can ONLY update their own profile row
    IF auth.uid() IS NULL OR auth.uid() <> OLD.id THEN
      RAISE EXCEPTION 'Access denied: You can only update your own profile.';
    END IF;

    -- Block modifications to privileged columns
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Access denied: You cannot modify your own system role.';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Access denied: You cannot modify your own verification status.';
    END IF;

    IF NEW.banned IS DISTINCT FROM OLD.banned OR NEW.banned_until IS DISTINCT FROM OLD.banned_until THEN
      RAISE EXCEPTION 'Access denied: You cannot modify restriction or ban status.';
    END IF;

    IF NEW.committee_id IS DISTINCT FROM OLD.committee_id OR NEW.position IS DISTINCT FROM OLD.position THEN
      RAISE EXCEPTION 'Access denied: You cannot assign committee memberships or leadership positions.';
    END IF;

    IF NEW.approved_at IS DISTINCT FROM OLD.approved_at OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
      RAISE EXCEPTION 'Access denied: You cannot modify administrative verification metadata.';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Access denied: Core user identifiers (id, email) cannot be altered.';
    END IF;
  END IF;

  -- Maintain updated_at timestamp
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

-- 2. Attach the BEFORE UPDATE Trigger to public.profiles
DROP TRIGGER IF EXISTS trg_enforce_profile_update_security ON public.profiles;
CREATE TRIGGER trg_enforce_profile_update_security
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_update_security();

-- 3. Hardened RLS Update Policy on public.profiles
-- Drop legacy or insecure update policies
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;

-- Allow users to update their own profile (further secured by the BEFORE UPDATE trigger)
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow DevCom Heads, Officers, and Registration Committee to update any profile for approvals/bans
CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() IN ('devcom_head', 'officer', 'comm_registration')
  )
  WITH CHECK (
    public.get_user_role() IN ('devcom_head', 'officer', 'comm_registration')
  );

GRANT EXECUTE ON FUNCTION public.enforce_profile_update_security() TO authenticated, service_role;

RAISE NOTICE 'Profile privilege escalation fix successfully installed.';
