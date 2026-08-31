create or replace function public.admin_update_profile_role (
  p_user_id uuid,
  p_role text,
  p_position text default null
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
DECLARE v_updated public.profiles;
BEGIN
  IF public.get_user_role() <> 'devcom_head' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
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
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found.'; END IF;
  RETURN jsonb_build_object('id', v_updated.id, 'role', v_updated.role, 'position', v_updated.position);
END;
$function$;

grant execute on function "public"."admin_update_profile_role"(uuid, text, text) to "authenticated";
revoke all on function "public"."admin_update_profile_role"(uuid, text, text) from public, anon;
