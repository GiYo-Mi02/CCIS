create or replace function public.admin_approve_user (
  p_user_id uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
DECLARE v_target public.profiles%ROWTYPE; v_key TEXT; v_rows INTEGER;
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'officer') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  PERFORM internal.enforce_rate_limit('verification_admin', auth.uid()::TEXT, 60, 3600);
  SELECT * INTO STRICT v_target FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_target.status = 'approved' THEN
    RETURN jsonb_build_object('approved', true, 'email_queued', false, 'already_approved', true);
  END IF;
  UPDATE public.profiles
  SET status = 'approved', approved_at = now(), approved_by = auth.uid(),
      rejection_reason = NULL, profile_complete = true, updated_at = now()
  WHERE id = p_user_id;
  v_key := 'verification-approved:' || p_user_id::TEXT || ':' || floor(extract(epoch FROM now()))::BIGINT::TEXT;
  INSERT INTO public.email_queue (profile_id, recipient_email, email_type, subject, html_body, logical_key, provider_idempotency_key)
  VALUES (
    p_user_id, v_target.email, 'verification_approved', '[CCIS SC] Account approved',
    '<p>Hello <strong>' || public.html_escape(COALESCE(v_target.full_name, 'Student')) || '</strong>, your CCIS Portal profile has been approved.</p>',
    v_key, replace(v_key, ':', '-')
  ) ON CONFLICT (logical_key) WHERE logical_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('approved', true, 'email_queued', v_rows = 1);
END;
$function$;

grant execute on function "public"."admin_approve_user"(uuid) to "authenticated", "postgres", "service_role";

revoke all on function "public"."admin_approve_user"(uuid) from public;
