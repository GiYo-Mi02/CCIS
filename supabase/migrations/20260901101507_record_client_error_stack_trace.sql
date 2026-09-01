ALTER TABLE internal.client_error_events
  ADD COLUMN stack_trace TEXT
  CHECK (stack_trace IS NULL OR length(stack_trace) <= 8192);

DROP FUNCTION public.record_client_error_event(UUID, TEXT, TEXT);

CREATE FUNCTION public.record_client_error_event(
  p_reference_id UUID,
  p_route TEXT,
  p_release TEXT,
  p_stack_trace TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_reference_id IS NULL
     OR p_route !~ '^/[A-Za-z0-9/_-]{0,200}$'
     OR p_release !~ '^[A-Za-z0-9._-]{1,100}$'
     OR (p_stack_trace IS NOT NULL AND length(p_stack_trace) > 8192) THEN
    RAISE EXCEPTION 'Invalid client error event';
  END IF;

  INSERT INTO internal.client_error_events (reference_id, route, release, stack_trace)
  VALUES (p_reference_id, p_route, p_release, p_stack_trace)
  ON CONFLICT (reference_id) DO UPDATE
    SET stack_trace = COALESCE(EXCLUDED.stack_trace, internal.client_error_events.stack_trace);
END;
$$;

REVOKE ALL ON FUNCTION public.record_client_error_event(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_client_error_event(UUID, TEXT, TEXT, TEXT)
  TO service_role;

CREATE FUNCTION public.record_client_error_event(
  p_reference_id UUID,
  p_route TEXT,
  p_release TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.record_client_error_event(p_reference_id, p_route, p_release, NULL::TEXT);
$$;

REVOKE ALL ON FUNCTION public.record_client_error_event(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_client_error_event(UUID, TEXT, TEXT)
  TO service_role;
