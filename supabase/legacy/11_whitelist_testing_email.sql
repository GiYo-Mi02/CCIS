-- ============================================================
-- CCIS PLATFORM BACKEND: WHITELIST TESTING EMAIL AS DEVCOM HEAD
-- ============================================================
-- Run this script in your Supabase SQL Editor to whitelist and promote
-- devcommgio2006@gmail.com to DevCom Head.

-- 1. UPDATE PROFILE CONSTRAINT TO ALLOW THE NEW EMAIL
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_profile_email_domain;

ALTER TABLE public.profiles
  ADD CONSTRAINT check_profile_email_domain
  CHECK (
    email = 'ggiojoshua2006@gmail.com' 
    OR email = 'devcommgio2006@gmail.com' 
    OR email ~* '^[a-zA-Z0-9._%+-]+@umak\.edu\.ph$'
  );

-- 2. UPDATE PROFILE TRIGGER FUNCTION TO AUTOMATICALLY PROMOTE THE EMAIL
CREATE OR REPLACE FUNCTION public.check_profile_metadata()
RETURNS trigger AS $$
BEGIN
  -- SAFETY GUARD / PROMOTION: Automatically make whitelist emails devcom_head
  IF NEW.email = 'ggiojoshua2006@gmail.com' OR NEW.email = 'devcommgio2006@gmail.com' THEN
    NEW.role := 'devcom_head';
    NEW.position := 'Lead Administrator';
    NEW.profile_complete := true;
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

-- 3. REWRITE MESSAGES SELECT POLICY TO INCLUDE BOTH EMAILS
DROP POLICY IF EXISTS messages_select_policy ON public.messages;

CREATE POLICY messages_select_policy ON public.messages
  FOR SELECT USING (
    auth.uid() = student_id 
    OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'student') IN ('devcom_head', 'officer')
    OR auth.jwt() ->> 'email' IN ('ggiojoshua2006@gmail.com', 'devcommgio2006@gmail.com')
  );

-- 4. IMMEDIATELY PROMOTE THE ACCOUNT IF IT ALREADY EXISTS
UPDATE public.profiles
SET 
  role = 'devcom_head', 
  position = 'Lead Administrator', 
  profile_complete = true
WHERE email = 'devcommgio2006@gmail.com';
