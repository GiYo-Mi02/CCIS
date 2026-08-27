-- Repair the purpose-limited registration listing API on environments where
-- the release-readiness migration was skipped. This definition is forward-only
-- and idempotent so it remains safe if the original migration is applied later.
CREATE OR REPLACE FUNCTION public.list_registration_admin_rows(
  p_search TEXT DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'comm_registration') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100
     OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'INVALID_PAGINATION';
  END IF;

  WITH filtered AS MATERIALIZED (
    SELECT
      registration.id,
      registration.event_id,
      registration.profile_id,
      registration.status,
      registration.registered_at,
      registration.attended_at,
      registration.attendance_origin,
      profile.full_name,
      profile.student_number,
      profile.email,
      profile.section,
      event.title AS event_title,
      event.event_date,
      event.location
    FROM public.event_registrations AS registration
    JOIN public.profiles AS profile ON profile.id = registration.profile_id
    JOIN public.events AS event ON event.id = registration.event_id
    WHERE (p_event_id IS NULL OR registration.event_id = p_event_id)
      AND (
        NULLIF(btrim(p_search), '') IS NULL
        OR profile.full_name ILIKE '%' || btrim(p_search) || '%'
        OR profile.email ILIKE '%' || btrim(p_search) || '%'
      )
  ), page AS (
    SELECT *
    FROM filtered
    ORDER BY registered_at DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', page.id,
          'event_id', page.event_id,
          'profile_id', page.profile_id,
          'status', page.status,
          'registered_at', page.registered_at,
          'attended_at', page.attended_at,
          'attendance_origin', page.attendance_origin,
          'profiles', jsonb_build_object(
            'full_name', page.full_name,
            'student_number', page.student_number,
            'email', page.email,
            'section', page.section
          ),
          'events', jsonb_build_object(
            'title', page.event_title,
            'event_date', page.event_date,
            'location', page.location
          )
        ) ORDER BY page.registered_at DESC
      )
      FROM page
    ), '[]'::JSONB),
    'total', (SELECT count(*) FROM filtered),
    'confirmed', (SELECT count(*) FROM filtered WHERE status = 'confirmed'),
    'pending', (SELECT count(*) FROM filtered WHERE status = 'pending'),
    'attended', (SELECT count(*) FROM filtered WHERE status = 'attended'),
    'cancelled', (SELECT count(*) FROM filtered WHERE status = 'cancelled')
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.list_registration_admin_rows(TEXT, UUID, INTEGER, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_registration_admin_rows(TEXT, UUID, INTEGER, INTEGER)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
