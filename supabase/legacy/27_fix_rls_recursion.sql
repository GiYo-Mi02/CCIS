-- ============================================================
-- CCIS PLATFORM BACKEND: FIX RLS RECURSION & CONVERSATION BUG
-- ============================================================
-- Migration 27: Fixes two critical issues introduced after migration 26.
--
-- ISSUE 1 — "stack depth limit exceeded" (all tables returning 500)
-- ---------------------------------------------------------------
-- Migration 26 switched get_user_role() from SECURITY DEFINER to
-- SECURITY INVOKER in an attempt to satisfy the linter warning about
-- authenticated users calling a SECURITY DEFINER function.
--
-- This broke everything. Here is why:
--
--   1. Every RLS policy on tables like announcements, faqs, conversations,
--      event_registrations, gallery_items, officers, email_queue, etc. calls:
--        public.get_user_role() IN ('devcom_head', ...)
--
--   2. get_user_role() does: SELECT role FROM public.profiles WHERE id = auth.uid()
--
--   3. public.profiles itself has RLS enabled. When PostgreSQL evaluates the
--      profiles RLS policy for that inner SELECT, it calls get_user_role() again.
--
--   4. This is infinite recursion → PostgreSQL raises "stack depth limit exceeded".
--
-- SECURITY DEFINER is the correct and safe design for get_user_role():
--   - The function is intentionally granted only to the 'authenticated' role.
--   - SECURITY DEFINER means it runs as the function owner (postgres / service_role),
--     which bypasses the recursive RLS on profiles for that one lookup.
--   - This is the standard Supabase pattern for role-helper functions.
--
-- FIX: Restore get_user_role() to SECURITY DEFINER.
-- The linter warning for authenticated users calling a SECURITY DEFINER RPC
-- is a false positive here — the function is grants-restricted and safe.
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (
    SELECT role FROM public.profiles WHERE id = auth.uid()
  );
END;
$$;

-- Ensure correct grants (authenticated only, not anon or public)
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM public;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;


-- ============================================================
-- ISSUE 2 — "duplicate key value violates unique constraint
--            conversations_profile_id_key" (HTTP 409)
-- ============================================================
-- The frontend tries to create a conversation for the current user,
-- but one may already exist (conversations.profile_id has a UNIQUE
-- constraint — one thread per student). The fix is to use an
-- UPSERT (INSERT ... ON CONFLICT DO NOTHING) so a second attempt
-- just silently succeeds rather than returning a 409 error.
--
-- We expose this as a safe RPC function so the frontend can call it
-- cleanly without needing to handle 409s.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_conversation()
RETURNS public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.conversations;
BEGIN
  -- Attempt an insert; if the row already exists, do nothing
  INSERT INTO public.conversations (profile_id)
  VALUES (auth.uid())
  ON CONFLICT (profile_id) DO NOTHING;

  -- Always return the (existing or newly created) conversation row
  SELECT * INTO v_row
  FROM public.conversations
  WHERE profile_id = auth.uid();

  RETURN v_row;
END;
$$;

-- Grant to authenticated users only
REVOKE EXECUTE ON FUNCTION public.ensure_conversation() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_conversation() FROM public;
GRANT EXECUTE ON FUNCTION public.ensure_conversation() TO authenticated;


-- ============================================================
-- ADVISORY: Linter warning for get_user_role() SECURITY DEFINER
-- ============================================================
-- The Supabase linter will continue to flag get_user_role() as a
-- "SECURITY DEFINER function accessible to authenticated role".
-- This warning is ACCEPTED and INTENTIONAL:
--   - The function is revoked from anon and public.
--   - It is granted only to authenticated users.
--   - SECURITY DEFINER is required to break the RLS recursion on profiles.
--   - This is the official Supabase-recommended pattern.
-- ============================================================
