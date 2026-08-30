create or replace function public.list_pending_verifications (
  p_search text    default null::text,
  p_limit  integer default 10,
  p_offset integer default 0
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
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
$function$;

grant execute on function "public"."list_pending_verifications"(text, integer, integer) to "authenticated", "postgres", "service_role";

revoke all on function "public"."list_pending_verifications"(text, integer, integer) from public;
