-- ============================================================
-- CCIS PLATFORM BACKEND: PRODUCTION ADMIN ACCESS FIX FOR CCISCSC.DEV@GMAIL.COM
-- ============================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- to update the database trigger and grant full devcom_head admin rights to cciscsc.dev@gmail.com.

-- 1. Update check_profile_metadata() trigger function to whitelist cciscsc.dev@gmail.com
CREATE OR REPLACE FUNCTION public.check_profile_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- SAFETY GUARD / PROMOTION: Automatically make whitelist emails devcom_head and approved
  IF NEW.email = 'ggiojoshua2006@gmail.com' 
     OR NEW.email = 'devcommgio2006@gmail.com' 
     OR NEW.email = 'cciscsc.dev@gmail.com' THEN
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
$$;

-- 2. Upsert profile and unban cciscsc.dev@gmail.com if account already exists in auth.users
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'cciscsc.dev@gmail.com';

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      student_number,
      program,
      year_level,
      section,
      contact_number,
      role,
      position,
      status,
      profile_complete,
      banned,
      banned_until,
      subscribe_announcements_events,
      email_subscription_decided,
      privacy_agreed_at,
      approved_at,
      submitted_at
    ) VALUES (
      v_user_id,
      'cciscsc.dev@gmail.com',
      'CCIS DevCom Admin',
      '2022-99999',
      'BS Computer Science',
      4,
      'CS-4A',
      '09999999999',
      'devcom_head',
      'DevCom Administrator',
      'approved',
      true,
      false,
      NULL,
      true,
      true,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'devcom_head',
      position = 'DevCom Administrator',
      status = 'approved',
      profile_complete = true,
      banned = false,
      banned_until = NULL,
      approved_at = COALESCE(public.profiles.approved_at, NOW());

    UPDATE auth.users SET banned_until = NULL WHERE id = v_user_id;

    RAISE NOTICE 'Successfully granted admin access to cciscsc.dev@gmail.com!';
  ELSE
    RAISE NOTICE 'User cciscsc.dev@gmail.com has not signed up yet. The database trigger check_profile_metadata() is now updated to auto-promote upon signup.';
  END IF;
END $$;
