create or replace function public.resubmit_for_verification()
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
  PERFORM internal.enforce_rate_limit('verification_resubmit', auth.uid()::TEXT, 2, 3600);
  SELECT * INTO STRICT v_profile FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF v_profile.status <> 'rejected' THEN RAISE EXCEPTION 'RESUBMIT_NOT_ALLOWED'; END IF;
  IF NOT internal.is_allowed_identity(v_profile.email) THEN RAISE EXCEPTION 'INSTITUTIONAL_EMAIL_REQUIRED'; END IF;
  IF v_profile.student_number IS NULL OR v_profile.program IS NULL OR v_profile.section IS NULL THEN
    RAISE EXCEPTION 'INCOMPLETE_PROFILE';
  END IF;

  UPDATE public.profiles
  SET status = 'pending', submitted_at = now(), rejection_reason = NULL,
      profile_complete = true, updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;
  v_submission_key := v_profile.id::TEXT || ':' || floor(extract(epoch FROM v_profile.submitted_at))::BIGINT::TEXT;
  PERFORM internal.enqueue_verification_emails(v_profile.id, v_submission_key);
  RETURN v_profile;
END;
$function$;

grant execute on function "public"."resubmit_for_verification"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."resubmit_for_verification"() from public;
