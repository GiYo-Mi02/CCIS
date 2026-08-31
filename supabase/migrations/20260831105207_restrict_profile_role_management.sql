-- Restrict role and position changes to one server-side authorization boundary.
-- Direct profile UPDATE remains available only to devcom_head via the canonical
-- RLS policy, but role management must not depend on a client-selected column set.
CREATE OR REPLACE FUNCTION public.admin_update_profile_role(
  p_user_id UUID,
  p_role TEXT,
  p_position TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated public.profiles;
BEGIN
  IF public.get_user_role() <> 'devcom_head' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'A DevCom Head cannot change their own role.';
  END IF;

  IF p_role IS NULL OR p_role NOT IN (
    'student', 'officer', 'devcom_head', 'comm_content',
    'comm_registration', 'comm_photobooth'
  ) THEN
    RAISE EXCEPTION 'Invalid profile role.';
  END IF;

  UPDATE public.profiles
  SET role = p_role,
      position = CASE WHEN p_role = 'student' THEN NULL ELSE p_position END,
      profile_complete = CASE WHEN p_role = 'student' THEN profile_complete ELSE true END,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  RETURN jsonb_build_object(
    'id', v_updated.id,
    'role', v_updated.role,
    'position', v_updated.position
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_profile_role(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_profile_role(UUID, TEXT, TEXT)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
