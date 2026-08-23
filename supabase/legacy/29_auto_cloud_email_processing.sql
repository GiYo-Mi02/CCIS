-- ============================================================
-- CCIS PLATFORM BACKEND: AUTOMATED CLOUD EMAIL QUEUE PROCESSING
-- ============================================================
-- Run this script in your Supabase SQL Editor to enable automatic
-- serverless email processing in production (no localhost required).

-- 1. Enable pg_net for asynchronous HTTP dispatching
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Create trigger function to invoke process-email-queue Edge Function on insert
CREATE OR REPLACE FUNCTION public.auto_process_email_queue_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Trigger the Supabase Edge Function process-email-queue asynchronously
  -- (Requires process-email-queue function deployed to Supabase Edge Functions)
  PERFORM net.http_post(
    url := 'https://aecrmddgsnnxtemyikqu.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Fallback silently so table insert is never blocked by network/http errors
  RETURN NEW;
END;
$$;

-- 3. Attach trigger to email_queue table
DROP TRIGGER IF EXISTS trg_auto_process_email_queue ON public.email_queue;
CREATE TRIGGER trg_auto_process_email_queue
AFTER INSERT ON public.email_queue
FOR EACH STATEMENT
EXECUTE FUNCTION public.auto_process_email_queue_fn();
