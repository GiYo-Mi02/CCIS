-- ============================================================
-- ONE-TIME OPERATION: configure the scheduled email worker
-- ============================================================
-- This file is an operator template, not a migration. Never commit real
-- values. Generate a dedicated random worker secret; do not reuse the
-- service-role key.
--
-- 1. Replace both placeholders locally.
-- 2. Run this script once in the Supabase SQL editor.
-- 3. Configure the identical secret on the Edge Function:
--      supabase secrets set EMAIL_WORKER_SECRET=<same-random-secret>
-- 4. Configure RESEND_API_KEY, EMAIL_FROM, and APP_ORIGIN as Edge secrets.
-- 5. Configure an external webhook so worker failures alert independently:
--      SELECT vault.create_secret('<ALERT_WEBHOOK_URL>', 'email_worker_alert_webhook_url', 'External worker-alert webhook');
-- ============================================================

DO $$
BEGIN
  IF '<PROCESS_EMAIL_QUEUE_FUNCTION_URL>' LIKE '<%'
     OR '<DEDICATED_RANDOM_WORKER_SECRET>' LIKE '<%' THEN
    RAISE EXCEPTION 'Replace the worker URL and dedicated secret placeholders before running.';
  END IF;
END;
$$;

SELECT vault.create_secret(
  '<PROCESS_EMAIL_QUEUE_FUNCTION_URL>',
  'email_worker_url',
  'URL for the scheduled process-email-queue Edge Function'
);

SELECT vault.create_secret(
  '<DEDICATED_RANDOM_WORKER_SECRET>',
  'email_worker_secret',
  'Dedicated authentication secret for the scheduled email worker'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'email_worker_url' AND NULLIF(btrim(decrypted_secret), '') IS NOT NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'email_worker_secret' AND NULLIF(btrim(decrypted_secret), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Email worker Vault configuration is incomplete.';
  END IF;
END;
$$;

-- Rotation: create a new Vault secret with the same name, then update the Edge
-- secret to the same value. internal.get_vault_secret() selects the newest row.
