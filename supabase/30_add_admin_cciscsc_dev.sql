-- ============================================================
-- CCIS PLATFORM BACKEND: ADD CCISCSC.DEV@GMAIL.COM ADMIN ACCESS
-- ============================================================
-- Automatically promotes cciscsc.dev@gmail.com to devcom_head (Admin) status.

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 1. Find user ID from auth.users for cciscsc.dev@gmail.com
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'cciscsc.dev@gmail.com';

  IF v_user_id IS NOT NULL THEN
    -- 2. Upsert complete profile details into public.profiles
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

    -- 3. Clear ban timestamp in auth.users
    UPDATE auth.users SET banned_until = NULL WHERE id = v_user_id;

    RAISE NOTICE 'Successfully granted admin access to cciscsc.dev@gmail.com!';
  ELSE
    RAISE NOTICE 'User cciscsc.dev@gmail.com is not signed up yet. Upon registration, rerun this script or let auto-trigger assign devcom_head.';
  END IF;
END $$;
