create or replace function public.dequeue_emails (
  p_limit     integer,
  p_worker_id text
)
  returns SETOF public.email_queue
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Invalid dequeue limit';
  END IF;
  IF NULLIF(btrim(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'Worker ID is required';
  END IF;

  UPDATE public.email_queue
  SET
    status = CASE
      WHEN delivery_state IN ('provider_accepted', 'delivery_unknown') OR sent_at IS NOT NULL THEN 'delivery_unknown'
      WHEN attempts >= 3 THEN 'dead_letter'
      ELSE 'failed'
    END,
    delivery_state = CASE
      WHEN delivery_state IN ('provider_accepted', 'delivery_unknown') OR sent_at IS NOT NULL THEN 'delivery_unknown'
      ELSE delivery_state
    END,
    error_message = CASE
      WHEN delivery_state IN ('provider_accepted', 'delivery_unknown') OR sent_at IS NOT NULL THEN 'Delivery outcome requires reconciliation.'
      ELSE COALESCE(error_message || ' ', '') || 'Processing lease expired.'
    END,
    scheduled_for = CASE WHEN attempts < 3 THEN now() ELSE scheduled_for END,
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
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.email_queue AS queue
  SET
    status = 'processing',
    delivery_state = 'sending',
    attempts = queue.attempts + 1,
    lease_expires_at = now() + interval '10 minutes',
    lease_worker_id = p_worker_id,
    provider_idempotency_key = COALESCE(queue.provider_idempotency_key, 'queue-' || queue.id::TEXT),
    error_message = NULL
  FROM candidates
  WHERE queue.id = candidates.id
  RETURNING queue.*;
END;
$function$;

grant execute on function "public"."dequeue_emails"(integer, text) to "postgres", "service_role";

revoke all on function "public"."dequeue_emails"(integer, text) from public;
