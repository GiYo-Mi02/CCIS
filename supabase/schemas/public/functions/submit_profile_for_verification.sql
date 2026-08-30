create or replace function public.submit_profile_for_verification (
  p_student_number text,
  p_year_level     smallint,
  p_program        text,
  p_section        text,
  p_contact_number text     default null::text
)
  returns public.profiles
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
DECLARE
  v_profile public.profiles;
  v_submission_key TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM internal.enforce_rate_limit('verification_submit', auth.uid()::TEXT, 3, 3600);

  SELECT * INTO STRICT v_profile FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF v_profile.status = 'pending'
     AND v_profile.profile_complete
     AND v_profile.submitted_at IS NOT NULL THEN
    RETURN v_profile;
  END IF;
  IF NOT internal.is_allowed_identity(v_profile.email) THEN RAISE EXCEPTION 'INSTITUTIONAL_EMAIL_REQUIRED'; END IF;
  IF v_profile.privacy_agreed_at IS NULL THEN RAISE EXCEPTION 'PRIVACY_CONSENT_REQUIRED'; END IF;
  IF v_profile.banned AND (v_profile.banned_until IS NULL OR v_profile.banned_until > now()) THEN
    RAISE EXCEPTION 'ACCOUNT_BANNED';
  END IF;
  IF NULLIF(btrim(p_student_number), '') IS NULL
     OR p_year_level IS NULL OR p_year_level < 1 OR p_year_level > 6
     OR NULLIF(btrim(p_program), '') IS NULL
     OR NULLIF(btrim(p_section), '') IS NULL THEN
    RAISE EXCEPTION 'INCOMPLETE_PROFILE';
  END IF;

  UPDATE public.profiles
  SET student_number = btrim(p_student_number),
      year_level = p_year_level,
      program = btrim(p_program),
      section = btrim(p_section),
      contact_number = NULLIF(btrim(p_contact_number), ''),
      status = 'pending',
      profile_complete = true,
      submitted_at = now(),
      approved_at = NULL,
      approved_by = NULL,
      rejection_reason = NULL,
      updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;

  v_submission_key := v_profile.id::TEXT || ':' || floor(extract(epoch FROM v_profile.submitted_at))::BIGINT::TEXT;
  PERFORM internal.enqueue_verification_emails(v_profile.id, v_submission_key);
  RETURN v_profile;
END;
$function$;

grant execute on function "public"."submit_profile_for_verification"(text, smallint, text, text, text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."submit_profile_for_verification"(text, smallint, text, text, text) from public;
