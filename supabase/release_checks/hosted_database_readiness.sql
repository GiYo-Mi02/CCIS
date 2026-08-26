-- Read-only hosted release gate. This script never prints secret values.
DO $readiness$
DECLARE
  v_failures TEXT[] := ARRAY[]::TEXT[];
  v_missing TEXT;
BEGIN
  SELECT string_agg(required.name, ', ' ORDER BY required.name)
  INTO v_missing
  FROM (VALUES ('email_worker_url'), ('email_worker_secret')) AS required(name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets AS secret
    WHERE secret.name = required.name
      AND NULLIF(btrim(secret.decrypted_secret), '') IS NOT NULL
  );

  IF v_missing IS NOT NULL THEN
    v_failures := array_append(v_failures, 'missing Vault configuration: ' || v_missing);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'ccis-email-worker'
      AND active
      AND schedule = '* * * * *'
      AND command = 'SELECT internal.invoke_email_worker();'
  ) THEN
    v_failures := array_append(
      v_failures,
      'ccis-email-worker cron job is missing, inactive, or has an unexpected definition'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.email_queue
    WHERE status = 'processing'
      AND lease_expires_at IS NULL
  ) THEN
    v_failures := array_append(
      v_failures,
      'email_queue still contains processing rows without leases'
    );
  END IF;

  SELECT string_agg(expected.table_name, ', ' ORDER BY expected.table_name)
  INTO v_missing
  FROM (VALUES
    ('profiles'), ('committees'), ('committee_subteams'), ('officers'),
    ('faqs'), ('announcements'), ('events'), ('event_registrations'),
    ('email_queue'), ('theme_settings'), ('conversations'), ('messages'),
    ('concerns'), ('concern_replies'), ('gallery_items'),
    ('photobooth_gallery'), ('transparency_reports'), ('patch_videos'),
    ('ip_bans'), ('account_deletion_tombstones')
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
    v_failures := array_append(
      v_failures,
      'tables missing ENABLE/FORCE RLS: ' || v_missing
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('faqs', 'announcements', 'theme_settings', 'photobooth_gallery')
      AND cmd = 'SELECT'
      AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
      AND COALESCE(qual, '') LIKE '%get_user_role%'
  ) THEN
    v_failures := array_append(
      v_failures,
      'an anonymous hosted policy still invokes get_user_role'
    );
  END IF;

  IF cardinality(v_failures) > 0 THEN
    RAISE EXCEPTION 'Hosted readiness blocked: %', array_to_string(v_failures, '; ');
  END IF;
END;
$readiness$;

SELECT
  count(*) FILTER (WHERE status = 'delivery_unknown') AS delivery_unknown_rows,
  count(*) FILTER (WHERE status = 'dead_letter') AS dead_letter_rows,
  count(*) FILTER (WHERE status = 'failed') AS retryable_failed_rows
FROM public.email_queue;

SELECT 'hosted database readiness checks passed' AS result;
