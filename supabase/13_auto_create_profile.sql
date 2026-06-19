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
