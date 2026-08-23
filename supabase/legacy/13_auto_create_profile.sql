-- ============================================================
-- CCIS PLATFORM BACKEND: AUTO CREATE PROFILE TRIGGER
-- ============================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- to automatically create a profile in public.profiles when a new user
-- registers via auth.users.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
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
  )
  VALUES (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'full_name', ''), 
    new.raw_user_meta_data->>'avatar_url', 
    'student', 
    'pending', 
    false,
    false,
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add RLS insert policy to public.profiles as a frontend upsert fallback
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_insert_policy ON public.profiles;
CREATE POLICY profiles_insert_policy ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Grant update permissions to devcom_head and comm_registration for approvals
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.profiles;
CREATE POLICY "Enable update for users based on email" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id 
    OR coalesce(auth.jwt() -> 'app_metadata' -> 'role' ->> 0, 'student') IN ('devcom_head', 'comm_registration')
    OR auth.jwt() ->> 'email' IN ('ggiojoshua2006@gmail.com', 'devcommgio2006@gmail.com')
  );
