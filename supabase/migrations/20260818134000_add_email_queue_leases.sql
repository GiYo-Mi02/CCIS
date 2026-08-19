-- Reclaim crashed workers and retain an operator-visible terminal state.

ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_worker_id TEXT,
  ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;

ALTER TABLE public.email_queue
  DROP CONSTRAINT IF EXISTS email_queue_status_check;

ALTER TABLE public.email_queue
  ADD CONSTRAINT email_queue_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter'));

DROP FUNCTION IF EXISTS public.dequeue_emails(INTEGER);

CREATE OR REPLACE FUNCTION public.dequeue_emails(p_limit INTEGER, p_worker_id TEXT)
RETURNS SETOF public.email_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Invalid dequeue limit';
  END IF;

  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RAISE EXCEPTION 'Worker ID is required';
  END IF;

  UPDATE public.email_queue
  SET status = CASE WHEN attempts >= 3 THEN 'dead_letter' ELSE 'failed' END,
      error_message = COALESCE(error_message || ' ', '') || 'Processing lease expired.',
      scheduled_for = CASE WHEN attempts >= 3 THEN scheduled_for ELSE now() END,
      lease_expires_at = NULL,
      lease_worker_id = NULL,
      dead_lettered_at = CASE WHEN attempts >= 3 THEN now() ELSE dead_lettered_at END
  WHERE status = 'processing'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at <= now();

  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.email_queue
    WHERE (status = 'pending' OR (status = 'failed' AND attempts < 3))
      AND scheduled_for <= now()
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.email_queue AS queue
  SET status = 'processing',
      attempts = attempts + 1,
      lease_expires_at = now() + interval '10 minutes',
      lease_worker_id = p_worker_id,
      error_message = NULL
  FROM candidates
  WHERE queue.id = candidates.id
  RETURNING queue.*;
END;
$$;

REVOKE ALL ON FUNCTION public.dequeue_emails(INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dequeue_emails(INTEGER, TEXT) TO service_role;
