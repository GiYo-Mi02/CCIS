-- Repair the admin verification API on environments where the release-readiness
-- migration was not reflected in PostgREST's schema. This is intentionally a
-- forward-only, idempotent definition so it is safe after the original migration.
CREATE OR REPLACE FUNCTION public.list_pending_verifications(
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
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
      profile.id,
      profile.email,
      profile.full_name,
      profile.student_number,
      profile.year_level,
      profile.program,
      profile.section,
      profile.contact_number,
      profile.created_at,
      profile.submitted_at,
      profile.status,
      profile.profile_complete
    FROM public.profiles AS profile
    WHERE profile.status = 'pending'
      AND profile.profile_complete
      AND (
        NULLIF(btrim(p_search), '') IS NULL
        OR profile.full_name ILIKE '%' || btrim(p_search) || '%'
        OR profile.email ILIKE '%' || btrim(p_search) || '%'
        OR profile.student_number ILIKE '%' || btrim(p_search) || '%'
      )
  ), page AS (
    SELECT *
    FROM filtered
    ORDER BY submitted_at DESC NULLS LAST, created_at DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::JSONB),
    'total', (SELECT count(*) FROM filtered)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.list_pending_verifications(TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_verifications(TEXT, INTEGER, INTEGER)
  TO authenticated;

-- Make the repaired signature visible to the Data API immediately after deploy.
NOTIFY pgrst, 'reload schema';
