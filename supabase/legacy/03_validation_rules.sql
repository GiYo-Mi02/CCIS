-- ============================================================
-- CCIS PLATFORM BACKEND VALIDATION RULES & ADMIN ACCESS
-- ============================================================
-- Run this script in your Supabase SQL Editor to enforce constraints 
-- and promote the administrator account.

-- 0. ADD SECTION COLUMN TO PROFILES TABLE
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS section TEXT;


-- 1. ENFORCE EMAIL DOMAIN, NAME LIMITS, AND SECTION CONSTRAINTS (TRIGGER LAYER)
CREATE OR REPLACE FUNCTION public.check_profile_metadata()
RETURNS trigger AS $$
BEGIN
  -- SAFETY GUARD / PROMOTION: Automatically make ggiojoshua2006@gmail.com devcom_head
  IF NEW.email = 'ggiojoshua2006@gmail.com' THEN
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

-- Drop trigger if it already exists to prevent duplicate execution errors
DROP TRIGGER IF EXISTS check_profile_metadata_trigger ON public.profiles;

CREATE TRIGGER check_profile_metadata_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_profile_metadata();


-- 2. ENFORCE COLUMN LEVEL CHECK CONSTRAINTS
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS check_profile_email_domain,
  DROP CONSTRAINT IF EXISTS check_profile_name_length,
  DROP CONSTRAINT IF EXISTS check_profile_section;

-- Add check constraint for email domain regex matching (with exemption for the main administrator account)
ALTER TABLE public.profiles
  ADD CONSTRAINT check_profile_email_domain
  CHECK (email = 'ggiojoshua2006@gmail.com' OR email ~* '^[a-zA-Z0-9._%+-]+@umak\.edu\.ph$');

-- Add check constraint for full_name length
ALTER TABLE public.profiles
  ADD CONSTRAINT check_profile_name_length
  CHECK (full_name IS NULL OR length(full_name) <= 255);

-- Add check constraint for section regex matching (uppercase, numbers & hyphens only, no spaces)
ALTER TABLE public.profiles
  ADD CONSTRAINT check_profile_section
  CHECK (section IS NULL OR section ~ '^[A-Z0-9-]+$');


-- 3. IMMEDIATELY PROMOTE EXISTING ACCOUNT IF ALREADY CREATED
UPDATE public.profiles
SET 
  role = 'devcom_head', 
  position = 'Lead Administrator', 
  profile_complete = true
WHERE email = 'ggiojoshua2006@gmail.com';


-- 4. PASSWORD PROTECTION ADVISORY
-- NOTE: In Supabase, raw passwords are never visible to the database schema triggers 
-- because they are encrypted (hashed) by the auth provider before storage.
-- To enforce password complexity in the backend:
-- Navigate to your Supabase Dashboard:
-- -> Authentication
-- -> Sign In / Up (or Providers -> Email)
-- -> Password Protection (under Security/Email settings)
-- -> Enable custom complexity matching there (Min Length: 8, require letters/symbols).
