ALTER TABLE internal.client_error_events
  ADD COLUMN error_name TEXT
    CHECK (error_name IS NULL OR length(error_name) <= 256),
  ADD COLUMN error_message TEXT
    CHECK (error_message IS NULL OR length(error_message) <= 2048);

DROP FUNCTION public.record_client_error_event(UUID, TEXT, TEXT, TEXT);

CREATE FUNCTION public.record_client_error_event(
  p_reference_id UUID,
  p_route TEXT,
  p_release TEXT,
  p_error_name TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
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
     OR (p_error_name IS NOT NULL AND length(p_error_name) > 256)
     OR (p_error_message IS NOT NULL AND length(p_error_message) > 2048)
     OR (p_stack_trace IS NOT NULL AND length(p_stack_trace) > 8192) THEN
    RAISE EXCEPTION 'Invalid client error event';
  END IF;

  INSERT INTO internal.client_error_events
    (reference_id, route, release, error_name, error_message, stack_trace)
  VALUES
    (p_reference_id, p_route, p_release, p_error_name, p_error_message, p_stack_trace)
  ON CONFLICT (reference_id) DO UPDATE
    SET error_name = COALESCE(EXCLUDED.error_name, internal.client_error_events.error_name),
        error_message = COALESCE(EXCLUDED.error_message, internal.client_error_events.error_message),
        stack_trace = COALESCE(EXCLUDED.stack_trace, internal.client_error_events.stack_trace);
END;
$$;

REVOKE ALL ON FUNCTION public.record_client_error_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_client_error_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

-- Keep the stack-trace overload for already deployed function callers.
CREATE FUNCTION public.record_client_error_event(
  p_reference_id UUID,
  p_route TEXT,
  p_release TEXT,
  p_stack_trace TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.record_client_error_event(
    p_reference_id, p_route, p_release, NULL::TEXT, NULL::TEXT, p_stack_trace
  );
$$;

REVOKE ALL ON FUNCTION public.record_client_error_event(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_client_error_event(UUID, TEXT, TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.record_client_error_event(
  p_reference_id UUID,
  p_route TEXT,
  p_release TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.record_client_error_event(
    p_reference_id, p_route, p_release, NULL::TEXT, NULL::TEXT, NULL::TEXT
  );
$$;

REVOKE ALL ON FUNCTION public.record_client_error_event(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_client_error_event(UUID, TEXT, TEXT)
  TO service_role;
