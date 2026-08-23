-- ============================================================
-- CCIS PLATFORM BACKEND: IP-BASED BANNING ACCESS CONTROLS
-- ============================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- to create the ip_bans table and enforce security policies.

CREATE TABLE IF NOT EXISTS public.ip_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  banned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  banned_until TIMESTAMPTZ DEFAULT NULL
);

-- Enable RLS
ALTER TABLE public.ip_bans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS ip_bans_select ON public.ip_bans;
DROP POLICY IF EXISTS ip_bans_admin_all ON public.ip_bans;

-- 1. Allow anyone to read (to check if their IP is banned)
CREATE POLICY ip_bans_select ON public.ip_bans
  FOR SELECT USING (true);

-- 2. Allow DevCom Heads and Officers to manage IP bans
CREATE POLICY ip_bans_admin_all ON public.ip_bans
  FOR ALL USING (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'student') IN ('devcom_head', 'officer')
    OR auth.jwt() ->> 'email' = 'ggiojoshua2006@gmail.com'
  );

-- Add last_ip column to profiles to keep track of user IP
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_ip TEXT;
