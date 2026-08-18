-- Final cleanup migration. Apply after the numbered SQL scripts and all prior migrations.
BEGIN;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.gallery_items') IS NULL
     OR to_regclass('public.email_queue') IS NULL
     OR to_regclass('public.event_registrations') IS NULL
     OR to_regclass('public.conversations') IS NULL
     OR to_regclass('public.concerns') IS NULL
     OR to_regclass('public.messages') IS NULL THEN
    RAISE EXCEPTION 'secure_account_deletion requires the numbered schema scripts to be applied first';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.account_deletion_tombstones (
  user_id UUID PRIMARY KEY,
  deleted_by UUID NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  storage_deleted BOOLEAN NOT NULL DEFAULT false,
  public_data_deleted BOOLEAN NOT NULL DEFAULT false,
  auth_deleted BOOLEAN NOT NULL DEFAULT false,
  storage_paths TEXT[] NOT NULL DEFAULT '{}',
  target_email TEXT,
  lock_id TEXT,
  lock_expires_at TIMESTAMPTZ
);

ALTER TABLE public.account_deletion_tombstones
  ADD COLUMN IF NOT EXISTS storage_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_data_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auth_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS storage_paths TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_email TEXT,
  ADD COLUMN IF NOT EXISTS lock_id TEXT,
  ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMPTZ;

ALTER TABLE public.account_deletion_tombstones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_tombstones FROM PUBLIC;
REVOKE ALL ON public.account_deletion_tombstones FROM anon;
REVOKE ALL ON public.account_deletion_tombstones FROM authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.account_deletion_tombstones
    WHERE user_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'ACCOUNT_DELETED';
  END IF;

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
  ) VALUES (
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    'student',
    'pending',
    false,
    false,
    false
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_account_deletion_tombstoned()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_deletion_tombstones
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_account_deletion_tombstoned() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_account_deletion_tombstoned() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_account_deletion_tombstoned() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_pending_account_deletions()
RETURNS TABLE (user_id UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_role() <> 'devcom_head' THEN
    RAISE EXCEPTION 'Only devcom_head users can list pending deletions';
  END IF;

  RETURN QUERY
  SELECT tombstones.user_id
  FROM public.account_deletion_tombstones AS tombstones
  WHERE NOT tombstones.storage_deleted
     OR NOT tombstones.public_data_deleted
     OR NOT tombstones.auth_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.list_pending_account_deletions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_pending_account_deletions() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_pending_account_deletions() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_loadtest_account_ids()
RETURNS TABLE (user_id UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF public.get_user_role() <> 'devcom_head' THEN
    RAISE EXCEPTION 'Only devcom_head users can list purge targets';
  END IF;

  RETURN QUERY
  SELECT users.id
  FROM auth.users AS users
  WHERE users.email ILIKE 'loadtest%'
     OR users.email ILIKE 'test%@umak.edu.ph'
  UNION
  SELECT tombstones.user_id
  FROM public.account_deletion_tombstones AS tombstones
  WHERE NOT tombstones.storage_deleted
     OR NOT tombstones.public_data_deleted
     OR NOT tombstones.auth_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.list_loadtest_account_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_loadtest_account_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_loadtest_account_ids() TO authenticated;

DROP POLICY IF EXISTS profiles_insert_policy ON public.profiles;
CREATE POLICY profiles_insert_policy ON public.profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = id
    AND NOT public.is_account_deletion_tombstoned()
  );

CREATE OR REPLACE FUNCTION public.prevent_profile_admin_field_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id AND (
    OLD.role IS DISTINCT FROM NEW.role OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.banned IS DISTINCT FROM NEW.banned OR
    OLD.banned_until IS DISTINCT FROM NEW.banned_until OR
    OLD.approved_at IS DISTINCT FROM NEW.approved_at OR
    OLD.approved_by IS DISTINCT FROM NEW.approved_by OR
    OLD.rejection_reason IS DISTINCT FROM NEW.rejection_reason
  ) THEN
    RAISE EXCEPTION 'Administrative profile fields are server-controlled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_admin_field_changes ON public.profiles;
CREATE TRIGGER prevent_profile_admin_field_changes
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_admin_field_changes();

-- Purges now use the resumable, storage-aware delete-user Edge Function.
DROP FUNCTION IF EXISTS public.purge_loadtest_users();

COMMIT;
