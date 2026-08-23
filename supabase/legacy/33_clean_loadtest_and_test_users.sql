-- ============================================================
-- CCIS DATABASE CLEANUP: PERMANENT PURGE OF LOAD TEST USERS
-- Deletes all loadtest accounts (e.g. loadtest001@umak.edu.ph up to loadtest982@umak.edu.ph)
-- and any dummy/test users from auth.users, profiles, and associated tables.
-- ============================================================

DO $$
BEGIN
  -- 1. Delete email queue entries
  DELETE FROM public.email_queue
  WHERE recipient_email ILIKE 'loadtest%'
     OR recipient_email ILIKE 'test%@umak.edu.ph';

  -- 2. Delete messages
  DELETE FROM public.messages
  WHERE sender_id IN (
    SELECT id FROM public.profiles 
    WHERE email ILIKE 'loadtest%' 
       OR email ILIKE 'test%@umak.edu.ph'
  );

  -- 3. Delete conversations
  DELETE FROM public.conversations
  WHERE profile_id IN (
    SELECT id FROM public.profiles 
    WHERE email ILIKE 'loadtest%' 
       OR email ILIKE 'test%@umak.edu.ph'
  );

  -- 4. Delete concerns / support tickets
  DELETE FROM public.concerns
  WHERE profile_id IN (
    SELECT id FROM public.profiles 
    WHERE email ILIKE 'loadtest%' 
       OR email ILIKE 'test%@umak.edu.ph'
  );

  -- 5. Delete event registrations / tickets
  DELETE FROM public.event_registrations
  WHERE profile_id IN (
    SELECT id FROM public.profiles 
    WHERE email ILIKE 'loadtest%' 
       OR email ILIKE 'test%@umak.edu.ph'
  );

  -- 6. Delete profiles from public.profiles
  DELETE FROM public.profiles
  WHERE email ILIKE 'loadtest%'
     OR email ILIKE 'test%@umak.edu.ph'
     OR student_number ILIKE 'LOADTEST%'
     OR student_number ILIKE 'TEST%'
     OR id IN (
       SELECT id FROM auth.users 
       WHERE email ILIKE 'loadtest%' 
          OR email ILIKE 'test%@umak.edu.ph'
     );

  -- 7. Delete orphaned profiles
  DELETE FROM public.profiles
  WHERE id NOT IN (SELECT id FROM auth.users);

  -- 8. Delete authentication logins from auth.users
  DELETE FROM auth.users
  WHERE email ILIKE 'loadtest%'
     OR email ILIKE 'test%@umak.edu.ph';

  RAISE NOTICE 'Successfully purged all loadtest001-982 accounts and dummy records.';
END $$;

-- 9. Stored Procedure for Admin Console to trigger clean deletion anytime
CREATE OR REPLACE FUNCTION public.purge_loadtest_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count INT := 0;
  v_calling_role TEXT;
BEGIN
  -- Verify caller is admin/devcom_head
  SELECT role INTO v_calling_role FROM public.profiles WHERE id = auth.uid();
  IF v_calling_role NOT IN ('devcom_head', 'officer') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Only devcom_head can perform user purges.';
  END IF;

  -- Count total load test users to be deleted
  SELECT count(*) INTO v_count FROM auth.users 
  WHERE email ILIKE 'loadtest%' OR email ILIKE 'test%@umak.edu.ph';

  -- Delete associated logs and records
  DELETE FROM public.email_queue WHERE recipient_email ILIKE 'loadtest%' OR recipient_email ILIKE 'test%@umak.edu.ph';
  DELETE FROM public.messages WHERE sender_id IN (SELECT id FROM public.profiles WHERE email ILIKE 'loadtest%' OR email ILIKE 'test%@umak.edu.ph');
  DELETE FROM public.conversations WHERE profile_id IN (SELECT id FROM public.profiles WHERE email ILIKE 'loadtest%' OR email ILIKE 'test%@umak.edu.ph');
  DELETE FROM public.concerns WHERE profile_id IN (SELECT id FROM public.profiles WHERE email ILIKE 'loadtest%' OR email ILIKE 'test%@umak.edu.ph');
  DELETE FROM public.event_registrations WHERE profile_id IN (SELECT id FROM public.profiles WHERE email ILIKE 'loadtest%' OR email ILIKE 'test%@umak.edu.ph');
  DELETE FROM public.profiles WHERE email ILIKE 'loadtest%' OR email ILIKE 'test%@umak.edu.ph' OR id IN (SELECT id FROM auth.users WHERE email ILIKE 'loadtest%' OR email ILIKE 'test%@umak.edu.ph');
  DELETE FROM public.profiles WHERE id NOT IN (SELECT id FROM auth.users);
  DELETE FROM auth.users WHERE email ILIKE 'loadtest%' OR email ILIKE 'test%@umak.edu.ph';

  RETURN jsonb_build_object(
    'success', true,
    'purged_count', v_count,
    'timestamp', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_loadtest_users() TO authenticated, service_role;
