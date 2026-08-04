-- ============================================================
-- CCIS PLATFORM BACKEND: REMAINING SECURITY LINTER FIXES
-- ============================================================
-- Migration 26: Fixes warnings that persisted after migration 25.
--   1. rls_auto_enable() — Revoke API access (system function)
--   2. get_user_role() — Switch to SECURITY INVOKER
--   3. register_for_event() — ACCEPTED WARNING (intentional)
-- ============================================================


-- 1. rls_auto_enable() — Supabase system/dashboard function
-- Not meant to be callable via the API by any user role.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM public;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;


-- 2. get_user_role() — Switch from SECURITY DEFINER to SECURITY INVOKER
-- SECURITY INVOKER is safe here because authenticated users can already
-- read their own profile row via RLS (auth.uid() = id).
-- This eliminates the linter warning about authenticated users calling
-- a SECURITY DEFINER function via /rest/v1/rpc/get_user_role.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN (
    SELECT role FROM public.profiles WHERE id = auth.uid()
  );
END;
$$;

-- Revoke from anon to prevent unauthenticated RPC calls
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM public;


-- 3. register_for_event(uuid, uuid) — ACCEPTED WARNING
-- This function MUST remain SECURITY DEFINER + callable by authenticated
-- because it uses FOR UPDATE row locks and bypasses RLS for atomic
-- capacity checks. The linter will still flag this — that is intentional.
-- No changes needed, warning is accepted and documented.


-- ============================================================
-- REMINDER: auth_leaked_password_protection
-- ============================================================
-- Enable manually in Supabase Dashboard:
--   Authentication → Settings → Enable "Leaked Password Protection"
-- ============================================================
