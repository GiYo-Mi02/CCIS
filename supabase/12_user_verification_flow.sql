-- ============================================================
-- CCIS PLATFORM BACKEND: USER VERIFICATION & FALLBACK SCHEMA
-- ============================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)

-- 1. ADD VERIFICATION COLUMNS TO PROFILES TABLE
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_agreed_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_number TEXT;

-- 2. AUTO-APPROVE COMPLETED AND WHITELISTED PROFILES
UPDATE public.profiles SET status = 'approved' WHERE profile_complete = true;
UPDATE public.profiles SET status = 'approved' WHERE email IN ('ggiojoshua2006@gmail.com', 'devcommgio2006@gmail.com');

-- 3. EXTEND EMAIL QUEUE TYPE CHECK CONSTRAINT
ALTER TABLE public.email_queue DROP CONSTRAINT IF EXISTS email_queue_email_type_check;
ALTER TABLE public.email_queue ADD CONSTRAINT email_queue_email_type_check 
  CHECK (email_type IN ('ticket', 'announcement', 'event', 'verification_admin', 'verification_student', 'verification_approved', 'verification_rejected'));

-- 4. RE-DEFINE PROFILE CONSTRAINT TRIGGER TO HANDLE AUTOMATIC APPROVAL OF WHITELISTED ADMINS
CREATE OR REPLACE FUNCTION public.check_profile_metadata()
RETURNS trigger AS $$
BEGIN
  -- SAFETY GUARD / PROMOTION: Automatically make whitelist emails devcom_head and approved
  IF NEW.email = 'ggiojoshua2006@gmail.com' OR NEW.email = 'devcommgio2006@gmail.com' THEN
    NEW.role := 'devcom_head';
    NEW.position := 'Lead Administrator';
    NEW.profile_complete := true;
    NEW.status := 'approved';
    NEW.approved_at := now();
    RETURN NEW;
  END IF;

  -- Enforce email ends with @umak.edu.ph (case-insensitive) for all other accounts
  IF NEW.email !~* '^[a-zA-Z0-9._%+-]+@umak\.edu\.ph$' THEN
    RAISE EXCEPTION 'Unsupported email. Only @umak.edu.ph accounts are acceptable.';
  END IF;

  -- Enforce name limit (not exceeding 255 characters)
  IF NEW.full_name IS NOT NULL AND length(NEW.full_name) > 255 THEN
    RAISE EXCEPTION 'Full name must not exceed 255 characters.';
  END IF;

  -- Enforce section matches uppercase letters, numbers, and hyphens only, no spaces
  IF NEW.section IS NOT NULL AND NEW.section !~ '^[A-Z0-9-]+$' THEN
    RAISE EXCEPTION 'Invalid section format. It must contain only uppercase letters, numbers, and hyphens, with no spaces (e.g., ACSAD, A-APPDEV).';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. CONCERNS TABLE SETUP
CREATE TABLE IF NOT EXISTS public.concerns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT DEFAULT 'Verification',
  subject TEXT DEFAULT 'Account Verification Fallback Access Concern',
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security on concerns if it's new
ALTER TABLE public.concerns ENABLE ROW LEVEL SECURITY;

-- Concerns RLS Policies
DROP POLICY IF EXISTS concerns_user_all ON public.concerns;
CREATE POLICY concerns_user_all ON public.concerns
  FOR ALL USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS concerns_admin_all ON public.concerns;
CREATE POLICY concerns_admin_all ON public.concerns
  FOR ALL USING (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'student') IN ('devcom_head', 'officer'));

-- Allow authenticated users to insert into email_queue (for queueing verification/ticket emails)
DROP POLICY IF EXISTS email_queue_insert_policy ON public.email_queue;
CREATE POLICY email_queue_insert_policy ON public.email_queue
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
