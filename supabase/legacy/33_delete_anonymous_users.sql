-- ============================================================
-- CCIS DATABASE CLEANUP: PERMANENT PURGE OF ANONYMOUS USERS
-- Deletes all anonymous accounts, orphaned profiles, and test ghost sessions
-- ============================================================

DO $$
DECLARE
  v_deleted_auth_count INT := 0;
  v_deleted_profile_count INT := 0;
BEGIN
  -- 1. Clean up event registrations and messages linked to anonymous users
  DELETE FROM public.messages
  WHERE sender_id IN (
    SELECT id FROM auth.users 
    WHERE is_anonymous = TRUE 
       OR email IS NULL 
       OR email = '' 
       OR (raw_user_meta_data->>'is_anonymous')::boolean = TRUE
  );

  DELETE FROM public.conversations
  WHERE profile_id IN (
    SELECT id FROM auth.users 
    WHERE is_anonymous = TRUE 
       OR email IS NULL 
       OR email = '' 
       OR (raw_user_meta_data->>'is_anonymous')::boolean = TRUE
  );

  DELETE FROM public.event_registrations
  WHERE profile_id IN (
    SELECT id FROM auth.users 
    WHERE is_anonymous = TRUE 
       OR email IS NULL 
       OR email = '' 
       OR (raw_user_meta_data->>'is_anonymous')::boolean = TRUE
  );

  DELETE FROM public.concerns
  WHERE profile_id IN (
    SELECT id FROM auth.users 
    WHERE is_anonymous = TRUE 
       OR email IS NULL 
       OR email = '' 
       OR (raw_user_meta_data->>'is_anonymous')::boolean = TRUE
  );

  -- 2. Delete anonymous / null email profiles from public.profiles
  DELETE FROM public.profiles
  WHERE email IS NULL 
     OR email = '' 
     OR id IN (
       SELECT id FROM auth.users 
       WHERE is_anonymous = TRUE 
          OR (raw_user_meta_data->>'is_anonymous')::boolean = TRUE
     );

  -- 3. Delete any orphaned profiles whose auth.users record no longer exists
  DELETE FROM public.profiles
  WHERE id NOT IN (SELECT id FROM auth.users);

  -- 4. Delete anonymous users from auth.users (Supabase internal auth schema)
  DELETE FROM auth.users
  WHERE is_anonymous = TRUE 
     OR email IS NULL 
     OR email = '' 
     OR (raw_user_meta_data->>'is_anonymous')::boolean = TRUE;

  RAISE NOTICE 'Clean anonymous user deletion complete.';
END $$;

-- 5. Stored Procedure for Admin Console to trigger clean deletion anytime
CREATE OR REPLACE FUNCTION public.purge_anonymous_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count INT := 0;
  v_calling_role TEXT;
BEGIN
  -- Check caller is admin/devcom_head
  SELECT role INTO v_calling_role FROM public.profiles WHERE id = auth.uid();
  IF v_calling_role NOT IN ('devcom_head', 'officer') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Only devcom_head can perform anonymous user purges.';
  END IF;

  -- Count target anonymous users
  SELECT count(*) INTO v_count FROM auth.users 
  WHERE is_anonymous = TRUE 
     OR email IS NULL 
     OR email = '' 
     OR (raw_user_meta_data->>'is_anonymous')::boolean = TRUE;

  -- Delete associated records with correct schema columns
  DELETE FROM public.messages WHERE sender_id IN (
    SELECT id FROM auth.users WHERE is_anonymous = TRUE OR email IS NULL OR email = ''
  );
  DELETE FROM public.conversations WHERE profile_id IN (
    SELECT id FROM auth.users WHERE is_anonymous = TRUE OR email IS NULL OR email = ''
  );
  DELETE FROM public.concerns WHERE profile_id IN (
    SELECT id FROM auth.users WHERE is_anonymous = TRUE OR email IS NULL OR email = ''
  );
  DELETE FROM public.event_registrations WHERE profile_id IN (
    SELECT id FROM auth.users WHERE is_anonymous = TRUE OR email IS NULL OR email = ''
  );
  DELETE FROM public.profiles WHERE email IS NULL OR email = '' OR id IN (
    SELECT id FROM auth.users WHERE is_anonymous = TRUE
  );
  DELETE FROM public.profiles WHERE id NOT IN (SELECT id FROM auth.users);
  DELETE FROM auth.users WHERE is_anonymous = TRUE OR email IS NULL OR email = '' OR (raw_user_meta_data->>'is_anonymous')::boolean = TRUE;

  RETURN jsonb_build_object(
    'success', true,
    'purged_count', v_count,
    'timestamp', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_anonymous_users() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.purge_anonymous_users() TO authenticated, service_role;
