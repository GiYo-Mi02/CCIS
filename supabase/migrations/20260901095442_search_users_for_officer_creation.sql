CREATE OR REPLACE FUNCTION public.search_users(
  p_search TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.get_user_role() <> 'devcom_head' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_search IS NULL OR length(btrim(p_search)) < 2
     OR p_limit IS NULL OR p_limit < 1 OR p_limit > 25 THEN
    RAISE EXCEPTION 'INVALID_SEARCH';
  END IF;

  RETURN QUERY
  SELECT profile.id, profile.full_name, profile.email
  FROM public.profiles AS profile
  WHERE profile.full_name ILIKE '%' || btrim(p_search) || '%'
     OR profile.email ILIKE '%' || btrim(p_search) || '%'
  ORDER BY profile.full_name NULLS LAST, profile.email
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.search_users(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_users(TEXT, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
