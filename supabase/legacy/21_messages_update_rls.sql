-- ============================================================
-- CCIS PLATFORM BACKEND: ALLOW MESSAGES UPDATE RLS POLICIES
-- ============================================================
-- Run this in your Supabase SQL Editor to allow both students
-- and administrators to mark messages as read.

-- Drop existing update policies if any
DROP POLICY IF EXISTS messages_update_policy ON public.messages;
DROP POLICY IF EXISTS messages_student_update ON public.messages;
DROP POLICY IF EXISTS messages_admin_update ON public.messages;

-- 1. Students can update read status on messages belonging to their conversation
CREATE POLICY messages_student_update ON public.messages
  FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- 2. DevCom Heads and Officers can update read status on any messages
CREATE POLICY messages_admin_update ON public.messages
  FOR UPDATE
  USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'student') IN ('devcom_head', 'officer')
    OR auth.jwt() ->> 'email' = 'ggiojoshua2006@gmail.com'
  )
  WITH CHECK (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'student') IN ('devcom_head', 'officer')
    OR auth.jwt() ->> 'email' = 'ggiojoshua2006@gmail.com'
  );
