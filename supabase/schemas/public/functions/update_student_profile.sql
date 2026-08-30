create or replace function public.update_student_profile (
  p_full_name            text     default null::text,
  p_avatar_url           text     default null::text,
  p_student_number       text     default null::text,
  p_year_level           smallint default null::smallint,
  p_program              text     default null::text,
  p_section              text     default null::text,
  p_contact_number       text     default null::text,
  p_clear_avatar_url     boolean  default false,
  p_clear_contact_number boolean  default false
)
  returns public.profiles
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
DECLARE
  v_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM internal.enforce_rate_limit('profile_update', auth.uid()::TEXT, 20, 3600);

  UPDATE public.profiles
  SET
    full_name = COALESCE(NULLIF(btrim(p_full_name), ''), full_name),
    avatar_url = CASE WHEN p_clear_avatar_url THEN NULL ELSE COALESCE(p_avatar_url, avatar_url) END,
    student_number = COALESCE(NULLIF(btrim(p_student_number), ''), student_number),
    year_level = COALESCE(p_year_level, year_level),
    program = COALESCE(NULLIF(btrim(p_program), ''), program),
    section = COALESCE(NULLIF(btrim(p_section), ''), section),
    contact_number = CASE WHEN p_clear_contact_number THEN NULL ELSE COALESCE(p_contact_number, contact_number) END,
    updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  RETURN v_profile;
END;
$function$;

grant execute on function "public"."update_student_profile"(text, text, text, smallint, text, text, text, boolean, boolean) to "authenticated", "postgres", "service_role";

revoke all on function "public"."update_student_profile"(text, text, text, smallint, text, text, text, boolean, boolean) from public;
