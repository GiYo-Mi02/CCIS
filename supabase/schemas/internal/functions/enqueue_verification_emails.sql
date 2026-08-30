create or replace function internal.enqueue_verification_emails (
  p_profile_id     uuid,
  p_submission_key text
)
  returns integer
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_student_html TEXT;
  v_admin_html TEXT;
  v_inserted INTEGER := 0;
BEGIN
  SELECT * INTO STRICT v_profile
  FROM public.profiles
  WHERE id = p_profile_id;

  IF v_profile.status <> 'pending'
     OR NOT v_profile.profile_complete
     OR v_profile.submitted_at IS NULL THEN
    RAISE EXCEPTION 'Profile is not in a submittable verification state';
  END IF;

  v_student_html := '<!doctype html><html><body style="font-family:Arial,sans-serif;background:#FAF7EA;color:#123524;padding:32px">' ||
    '<main style="max-width:600px;margin:auto;background:#fff;border:1px solid rgba(18,53,36,.22);border-radius:20px;padding:28px">' ||
    '<h1>Profile submitted</h1><p>Hello <strong>' || public.html_escape(COALESCE(v_profile.full_name, 'Student')) || '</strong>,</p>' ||
    '<p>Your CCIS profile is pending Student Council verification.</p>' ||
    '<p><strong>Student number:</strong> ' || public.html_escape(COALESCE(v_profile.student_number, 'N/A')) || '<br>' ||
    '<strong>Program / section:</strong> ' || public.html_escape(COALESCE(v_profile.program, 'CCIS')) || ' / ' || public.html_escape(COALESCE(v_profile.section, 'N/A')) || '</p>' ||
    '</main></body></html>';

  v_admin_html := '<!doctype html><html><body style="font-family:Arial,sans-serif;background:#FAF7EA;color:#123524;padding:32px">' ||
    '<main style="max-width:600px;margin:auto;background:#fff;border:1px solid rgba(18,53,36,.22);border-radius:20px;padding:28px">' ||
    '<h1>Verification review required</h1><p><strong>Name:</strong> ' || public.html_escape(COALESCE(v_profile.full_name, 'Student')) || '<br>' ||
    '<strong>Email:</strong> ' || public.html_escape(v_profile.email) || '<br>' ||
    '<strong>Student number:</strong> ' || public.html_escape(COALESCE(v_profile.student_number, 'N/A')) || '<br>' ||
    '<strong>Program / section:</strong> ' || public.html_escape(COALESCE(v_profile.program, 'CCIS')) || ' / ' || public.html_escape(COALESCE(v_profile.section, 'N/A')) || '</p>' ||
    '<p>Open the Admin Verification Desk to review this submission.</p></main></body></html>';

  INSERT INTO public.email_queue (
    profile_id, recipient_email, email_type, subject, html_body, logical_key, provider_idempotency_key
  ) VALUES (
    v_profile.id,
    v_profile.email,
    'verification_student',
    '[CCIS SC] Profile submitted — pending verification',
    v_student_html,
    'verification-student:' || p_submission_key,
    'verification-student-' || p_submission_key
  )
  ON CONFLICT (logical_key) WHERE logical_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  INSERT INTO public.email_queue (
    profile_id, recipient_email, email_type, subject, html_body, logical_key, provider_idempotency_key
  ) VALUES (
    v_profile.id,
    'devcommgio2006@gmail.com',
    'verification_admin',
    '[CCIS SC] Verification review: ' || COALESCE(v_profile.full_name, 'Student'),
    v_admin_html,
    'verification-admin:' || p_submission_key,
    'verification-admin-' || p_submission_key
  )
  ON CONFLICT (logical_key) WHERE logical_key IS NOT NULL DO NOTHING;
  v_inserted := v_inserted + CASE WHEN FOUND THEN 1 ELSE 0 END;

  RETURN v_inserted;
END;
$function$;

grant execute on function "internal"."enqueue_verification_emails"(uuid, text) to "postgres";

revoke all on function "internal"."enqueue_verification_emails"(uuid, text) from public;
