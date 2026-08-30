create or replace function public.admin_reject_user (
  p_user_id uuid,
  p_reason  text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
DECLARE v_target public.profiles%ROWTYPE; v_reason TEXT; v_key TEXT; v_rows INTEGER;
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'officer') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  PERFORM internal.enforce_rate_limit('verification_admin', auth.uid()::TEXT, 60, 3600);
  v_reason := COALESCE(NULLIF(btrim(p_reason), ''), 'No specific reason provided.');
  SELECT * INTO STRICT v_target FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_target.status = 'rejected' AND v_target.rejection_reason = v_reason THEN
    RETURN jsonb_build_object('rejected', true, 'email_queued', false, 'already_rejected', true);
  END IF;
  UPDATE public.profiles
  SET status = 'rejected', rejection_reason = v_reason, profile_complete = false,
      approved_at = NULL, approved_by = NULL, updated_at = now()
  WHERE id = p_user_id;
  v_key := 'verification-rejected:' || p_user_id::TEXT || ':' || floor(extract(epoch FROM now()))::BIGINT::TEXT;
  INSERT INTO public.email_queue (profile_id, recipient_email, email_type, subject, html_body, logical_key, provider_idempotency_key)
  VALUES (
    p_user_id, v_target.email, 'verification_rejected', '[CCIS SC] Profile changes required',
    '<p>Hello <strong>' || public.html_escape(COALESCE(v_target.full_name, 'Student')) || '</strong>. Your profile needs changes.</p><p><strong>Reason:</strong> ' || public.html_escape(v_reason) || '</p>',
    v_key, replace(v_key, ':', '-')
  ) ON CONFLICT (logical_key) WHERE logical_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('rejected', true, 'email_queued', v_rows = 1);
END;
$function$;

grant execute on function "public"."admin_reject_user"(uuid, text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."admin_reject_user"(uuid, text) from public;
