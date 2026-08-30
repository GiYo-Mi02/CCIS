create or replace function public.expand_email_outbox (
  p_limit integer default 25
)
  returns integer
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
DECLARE
  v_item internal.email_outbox%ROWTYPE;
  v_announcement public.announcements%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_html TEXT;
  v_expanded INTEGER := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Invalid outbox expansion limit';
  END IF;

  FOR v_item IN
    SELECT *
    FROM internal.email_outbox
    WHERE status IN ('pending', 'failed') AND attempts < 5
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  LOOP
    UPDATE internal.email_outbox
    SET status = 'processing', attempts = attempts + 1, error_code = NULL
    WHERE id = v_item.id;

    BEGIN
      IF v_item.event_type = 'announcement_published' THEN
        SELECT * INTO STRICT v_announcement
        FROM public.announcements
        WHERE id = v_item.source_id AND status = 'published';

        v_html := '<!doctype html><html><body style="font-family:Arial,sans-serif;background:#FAF7EA;color:#123524;padding:40px 20px">' ||
          '<main style="max-width:550px;background:#fff;border:1px solid rgba(18,53,36,.22);border-radius:20px;padding:30px;margin:auto">' ||
          '<p style="color:#FFBC00;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:bold">Latest Update</p>' ||
          '<h1>CCIS Announcement</h1><p><strong>' || public.html_escape(upper(v_announcement.category)) || '</strong></p>' ||
          '<h2>' || public.html_escape(v_announcement.title) || '</h2>' ||
          '<p style="white-space:pre-wrap">' || public.html_escape(v_announcement.content) || '</p></main>' ||
          '<p style="text-align:center;font-size:11px;color:#5E6E64">Manage notification preferences in your CCIS Portal account.</p></body></html>';

        INSERT INTO public.email_queue (
          profile_id, recipient_email, email_type, subject, html_body, logical_key, provider_idempotency_key
        )
        SELECT
          profiles.id,
          profiles.email,
          'announcement',
          '[Announcement] ' || v_announcement.title,
          v_html,
          'announcement:' || v_announcement.id::TEXT || ':' || profiles.id::TEXT,
          'announcement-' || v_announcement.id::TEXT || '-' || profiles.id::TEXT
        FROM public.profiles AS profiles
        WHERE profiles.subscribe_announcements_events
          AND profiles.status = 'approved'
          AND NOT profiles.banned
          AND profiles.email IS NOT NULL
        ON CONFLICT (logical_key) WHERE logical_key IS NOT NULL DO NOTHING;
      ELSE
        SELECT * INTO STRICT v_event
        FROM public.events
        WHERE id = v_item.source_id;

        v_html := '<!doctype html><html><body style="font-family:Arial,sans-serif;background:#FAF7EA;color:#123524;padding:40px 20px">' ||
          '<main style="max-width:550px;background:#fff;border:1px solid rgba(18,53,36,.22);border-radius:20px;padding:30px;margin:auto">' ||
          '<p style="color:#FFBC00;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:bold">New Event</p>' ||
          '<h1>' || public.html_escape(v_event.title) || '</h1>' ||
          '<p><strong>Date:</strong> ' || public.html_escape(v_event.event_date::TEXT) || '</p>' ||
          '<p><strong>Time:</strong> ' || public.html_escape(COALESCE(v_event.event_time::TEXT, 'TBA')) || '</p>' ||
          '<p><strong>Venue:</strong> ' || public.html_escape(COALESCE(v_event.location, 'TBA')) || '</p>' ||
          '<p style="white-space:pre-wrap">' || public.html_escape(COALESCE(v_event.description, '')) || '</p></main>' ||
          '<p style="text-align:center;font-size:11px;color:#5E6E64">Manage notification preferences in your CCIS Portal account.</p></body></html>';

        INSERT INTO public.email_queue (
          profile_id, recipient_email, email_type, subject, html_body, logical_key, provider_idempotency_key
        )
        SELECT
          profiles.id,
          profiles.email,
          'event',
          '[New Event] ' || v_event.title,
          v_html,
          'event:' || v_event.id::TEXT || ':' || profiles.id::TEXT,
          'event-' || v_event.id::TEXT || '-' || profiles.id::TEXT
        FROM public.profiles AS profiles
        WHERE profiles.subscribe_announcements_events
          AND profiles.status = 'approved'
          AND NOT profiles.banned
          AND profiles.email IS NOT NULL
        ON CONFLICT (logical_key) WHERE logical_key IS NOT NULL DO NOTHING;
      END IF;

      UPDATE internal.email_outbox
      SET status = 'expanded', processed_at = now(), error_code = NULL
      WHERE id = v_item.id;
      v_expanded := v_expanded + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE internal.email_outbox
      SET status = 'failed', error_code = SQLSTATE
      WHERE id = v_item.id;
    END;
  END LOOP;

  RETURN v_expanded;
END;
$function$;

grant execute on function "public"."expand_email_outbox"(integer) to "postgres", "service_role";

revoke all on function "public"."expand_email_outbox"(integer) from public;
