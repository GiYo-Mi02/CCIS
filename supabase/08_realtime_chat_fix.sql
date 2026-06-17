-- ============================================================
-- CCIS PLATFORM BACKEND: REALTIME CHAT REPLICATION & RLS FIX
-- ============================================================
-- Run this script in your Supabase SQL Editor to resolve the 
-- realtime chat subscription issue. 
--
-- Why was it not working?
-- Supabase Realtime Simplified RLS evaluation does NOT support subqueries 
-- (like EXISTS) in SELECT policies. If a SELECT policy uses subqueries,
-- the Realtime listener fails to filter rows and silently receives no updates.
--
-- Solution:
-- 1. Sync public roles to auth.users metadata so we can inspect roles in the JWT without queries.
-- 2. Add student_id directly to public.messages and auto-fill it using a trigger, enabling a subquery-free RLS select policy.

-- 1. DEFINE ROLE SYNC FUNCTION & TRIGGER TO POPULATE JWT METADATA
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = 
    coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_profile_role_to_auth ON public.profiles;
CREATE TRIGGER trigger_sync_profile_role_to_auth
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_role_to_auth();

-- Backfill role claims for all existing users
UPDATE auth.users u
SET raw_user_meta_data = 
  coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role)
FROM public.profiles p
WHERE u.id = p.id;


-- 2. ADD STUDENT_ID COLUMN TO MESSAGES
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;


-- 3. DEFINE TRIGGER TO AUTOMATICALLY SET STUDENT_ID ON MESSAGE INSERT
CREATE OR REPLACE FUNCTION public.populate_message_student_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT profile_id INTO NEW.student_id
  FROM public.conversations
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_populate_message_student_id ON public.messages;
CREATE TRIGGER trigger_populate_message_student_id
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.populate_message_student_id();

-- Backfill student_id for all existing messages
UPDATE public.messages m
SET student_id = c.profile_id
FROM public.conversations c
WHERE m.conversation_id = c.id
AND m.student_id IS NULL;


-- 4. REWRITE MESSAGES SELECT POLICY TO BE SUBQUERY-FREE (JWT CLAIMS & DIRECT CHECKS)
DROP POLICY IF EXISTS messages_select_own ON public.messages;
DROP POLICY IF EXISTS messages_admin_select ON public.messages;
DROP POLICY IF EXISTS messages_select_policy ON public.messages;

CREATE POLICY messages_select_policy ON public.messages
  FOR SELECT USING (
    auth.uid() = student_id 
    OR coalesce(auth.jwt() -> 'user_metadata' ->> 'role', 'student') IN ('devcom_head', 'officer')
    OR auth.jwt() ->> 'email' = 'ggiojoshua2006@gmail.com'
  );


-- 5. SAFELY ENABLE SUPABASE REALTIME REPLICATION FOR MESSAGES & CONVERSATIONS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;
