-- ============================================================
-- Issue #1 Final: Force proper 403 on privileged field updates
--
-- The previous approach (no student UPDATE policy) silently returns 200 [].
-- To get the correct 403, students need the row to be reachable via RLS
-- so the BEFORE UPDATE trigger can fire and raise an exception.
--
-- Layer 1: profiles_update_own  → lets student reach their own row
-- Layer 2: enforce_profile_update_security trigger → raises EXCEPTION on
--          any attempt to modify role, status, banned, committee_id, etc.
--          → PostgreSQL returns error → PostgREST maps to 403 Forbidden
-- Layer 3: update_student_profile() RPC → the only CORRECT path for updates
-- ============================================================

-- Re-add the student self-update RLS policy so the trigger can fire
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  TO authenticated
  USING  (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure the denylist trigger is current
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
  -- service_role has full access
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role IN ('devcom_head', 'officer', 'comm_registration') THEN
    v_is_admin := TRUE;
  END IF;

  -- Non-admin: block any privileged column modifications
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

DO $$
BEGIN
  RAISE NOTICE 'Final fix: profiles_update_own restored + trigger enforces 403 on privileged columns.';
END $$;
