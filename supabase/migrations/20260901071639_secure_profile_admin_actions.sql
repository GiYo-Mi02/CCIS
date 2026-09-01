-- Administrative account controls are server-authorized rather than client PATCHes.
CREATE OR REPLACE FUNCTION public.admin_set_profile_completion(
  p_user_id UUID,
  p_profile_complete BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.get_user_role() <> 'devcom_head' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_user_id IS NULL OR p_profile_complete IS NULL THEN
    RAISE EXCEPTION 'Invalid profile update.';
  END IF;

  UPDATE public.profiles
  SET profile_complete = p_profile_complete,
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_profile_ban(
  p_user_id UUID,
  p_banned BOOLEAN,
  p_banned_until TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.get_user_role() <> 'devcom_head' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_user_id IS NULL OR p_banned IS NULL THEN
    RAISE EXCEPTION 'Invalid ban update.';
  END IF;

  IF p_banned = false AND p_banned_until IS NOT NULL THEN
    RAISE EXCEPTION 'An unbanned profile cannot have a ban expiry.';
  END IF;

  UPDATE public.profiles
  SET banned = p_banned,
      banned_until = CASE WHEN p_banned THEN p_banned_until ELSE NULL END,
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_profile_completion(UUID, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_profile_ban(UUID, BOOLEAN, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_completion(UUID, BOOLEAN)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_profile_ban(UUID, BOOLEAN, TIMESTAMPTZ)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
