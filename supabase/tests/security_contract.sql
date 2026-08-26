\set ON_ERROR_STOP on

-- Catalog-level contract for every security boundary touched by the audit.
DO $$
DECLARE v_missing TEXT;
BEGIN
  SELECT string_agg(table_name, ', ' ORDER BY table_name) INTO v_missing
  FROM (VALUES
    ('profiles'), ('committees'), ('committee_subteams'), ('officers'), ('faqs'), ('announcements'),
    ('events'), ('event_registrations'), ('email_queue'), ('theme_settings'),
    ('conversations'), ('messages'), ('concerns'), ('concern_replies'),
    ('gallery_items'), ('photobooth_gallery'), ('transparency_reports'), ('patch_videos'), ('ip_bans'),
    ('account_deletion_tombstones')
  ) AS expected(table_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = expected.table_name
      AND relation.relkind = 'r'
      AND relation.relrowsecurity
      AND relation.relforcerowsecurity
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Tables missing ENABLE/FORCE RLS: %', v_missing;
  END IF;
END;
$$;

DO $$
DECLARE v_function TEXT;
BEGIN
  SELECT string_agg(namespace.nspname || '.' || procedure.proname, ', ')
  INTO v_function
  FROM pg_proc AS procedure
  JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname IN ('public', 'internal')
    AND procedure.prosecdef
    AND COALESCE(array_to_string(procedure.proconfig, ','), '') NOT LIKE '%search_path=%';
  IF v_function IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY DEFINER functions without fixed search_path: %', v_function;
  END IF;
END;
$$;

DO $$
DECLARE
  v_unlisted TEXT;
BEGIN
  SELECT string_agg(procedure.oid::regprocedure::TEXT, ', ' ORDER BY procedure.oid::regprocedure::TEXT)
  INTO v_unlisted
  FROM pg_proc AS procedure
  JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.prosecdef
    AND has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    AND procedure.proname <> ALL (ARRAY[
      'admin_approve_user',
      'admin_reject_user',
      'activate_theme',
      'check_in_audience',
      'check_in_event_registration',
      'check_in_registration',
      'ensure_conversation',
      'ensure_user_profile',
      'get_dashboard_unread_counts',
      'get_user_role',
      'is_account_deletion_tombstoned',
      'issue_attendance_pass',
      'list_loadtest_account_ids',
      'list_pending_account_deletions',
      'list_pending_verifications',
      'list_registration_admin_rows',
      'lookup_attendance_profile',
      'lookup_event_registration',
      'mark_conversation_messages_read_by_student',
      'mark_messages_read_by_admin',
      'record_privacy_consent',
      'register_for_event',
      'resolve_attendance_pass',
      'resubmit_for_verification',
      'set_email_preferences',
      'swap_faq_order',
      'swap_officer_order',
      'submit_profile_for_verification',
      'update_student_profile'
    ]::TEXT[]);

  IF v_unlisted IS NOT NULL THEN
    RAISE EXCEPTION 'Authenticated SECURITY DEFINER functions missing from the allowlist: %', v_unlisted;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.ensure_conversation()') IS NULL
     OR NOT has_function_privilege('authenticated', 'public.ensure_conversation()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.ensure_conversation()', 'EXECUTE') THEN
    RAISE EXCEPTION 'ensure_conversation() must be authenticated-only';
  END IF;
  IF pg_get_functiondef('public.ensure_conversation()'::regprocedure) NOT LIKE '%auth.uid()%'
     OR pg_get_functiondef('public.ensure_conversation()'::regprocedure) NOT LIKE '%ON CONFLICT (profile_id) DO NOTHING%' THEN
    RAISE EXCEPTION 'ensure_conversation() is not an authenticated idempotent upsert';
  END IF;

  IF to_regprocedure('internal.reconcile_email_worker_invocations()') IS NULL
     OR NOT has_function_privilege('service_role', 'internal.reconcile_email_worker_invocations()', 'EXECUTE')
     OR to_regclass('internal.email_worker_alerts') IS NULL THEN
    RAISE EXCEPTION 'email worker outcome reconciliation is missing';
  END IF;
  IF pg_get_functiondef('internal.reconcile_email_worker_invocations()'::regprocedure) NOT LIKE '%net._http_response%'
     OR pg_get_functiondef('internal.reconcile_email_worker_invocations()'::regprocedure) NOT LIKE '%HTTP_TIMEOUT%' THEN
    RAISE EXCEPTION 'email worker outcomes are not reconciled from pg_net responses';
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.dequeue_emails(integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'Obsolete dequeue_emails(integer) overload still exists';
  END IF;
  IF has_function_privilege('anon', 'public.dequeue_emails(integer,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.dequeue_emails(integer,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Email dequeue is callable by a public API role';
  END IF;
  IF has_function_privilege('anon', 'public.queue_announcement_emails_fn()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.queue_announcement_emails_fn()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.queue_event_emails_fn()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.queue_event_emails_fn()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE') THEN
    RAISE EXCEPTION 'A trigger-only function is callable by an API role';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
  ) THEN
    RAISE EXCEPTION 'Profiles expose a policy to anon/PUBLIC';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('faqs', 'announcements', 'theme_settings', 'photobooth_gallery')
      AND cmd = 'SELECT'
      AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
      AND COALESCE(qual, '') LIKE '%get_user_role%'
  ) THEN
    RAISE EXCEPTION 'An anonymous public-content policy invokes get_user_role';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND COALESCE(qual, '') ~ 'comm_(content|registration|photobooth)|officer'
  ) THEN
    RAISE EXCEPTION 'A committee or officer role can select unrestricted profile rows';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_queue'
      AND ('anon' = ANY(roles) OR 'authenticated' = ANY(roles) OR 'public' = ANY(roles))
  ) THEN
    RAISE EXCEPTION 'email_queue exposes a client policy';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'gallery_items'
      AND cmd = 'INSERT'
      AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
  ) THEN
    RAISE EXCEPTION 'Gallery permits anonymous inserts';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND cmd = 'UPDATE'
      AND ('authenticated' = ANY(roles) OR 'public' = ANY(roles))
  ) THEN
    RAISE EXCEPTION 'Messages expose direct authenticated UPDATE';
  END IF;
END;
$$;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.list_pending_verifications(text,integer,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.list_registration_admin_rows(text,uuid,integer,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.lookup_attendance_profile(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.lookup_event_registration(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.check_in_event_registration(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.resolve_attendance_pass(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.check_in_registration(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'A scoped registration RPC is callable anonymously';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.list_pending_verifications(text,integer,integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.list_registration_admin_rows(text,uuid,integer,integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.lookup_attendance_profile(text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.lookup_event_registration(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.check_in_event_registration(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.resolve_attendance_pass(text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.check_in_registration(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'A scoped registration RPC is unavailable to authenticated callers';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'email_queue_logical_key_idx'
  ) THEN
    RAISE EXCEPTION 'Email queue idempotency index is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'profiles_attendance_qr_code_idx'
  ) THEN
    RAISE EXCEPTION 'Attendance-token lookup index is missing';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'ccis-private-drafts' AND public
  ) THEN
    RAISE EXCEPTION 'Private draft bucket is public';
  END IF;
  IF EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id IN ('gallery-images', 'banners', 'bukas-kaban-reports', 'patch-thumbnails', 'patch-videos')
      AND NOT public
  ) THEN
    RAISE EXCEPTION 'A documented published-assets bucket is unexpectedly private';
  END IF;
END;
$$;

SELECT 'security contract passed' AS result;
