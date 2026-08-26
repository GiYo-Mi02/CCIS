-- ============================================================
-- PRODUCTION RELEASE READINESS
-- Audit (2) findings 1, 2, 4, 7, 8, 11, 12, 13, and 14
-- ============================================================

-- Canonicalize the two public tables that previously existed only in the
-- hosted database. CREATE TABLE IF NOT EXISTS keeps this migration forward
-- compatible with the already-provisioned production tables.
CREATE TABLE IF NOT EXISTS public.committee_subteams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id UUID REFERENCES public.committees(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  display_order SMALLINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_committee_subteams_committee
  ON public.committee_subteams (committee_id);

CREATE TABLE IF NOT EXISTS public.photobooth_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  frame_id TEXT,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gallery_featured
  ON public.photobooth_gallery (featured, created_at DESC);

-- Rebuild the policy set as command-specific policies. Public policies never
-- invoke an authenticated-only helper, and authenticated helpers are wrapped
-- in scalar SELECTs so Postgres evaluates them once per statement.
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'profiles', 'committees', 'committee_subteams', 'officers', 'faqs',
        'announcements', 'events', 'event_registrations', 'email_queue',
        'theme_settings', 'conversations', 'messages', 'concerns',
        'concern_replies', 'gallery_items', 'photobooth_gallery',
        'transparency_reports', 'patch_videos', 'ip_bans',
        'account_deletion_tombstones'
      ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'profiles', 'committees', 'committee_subteams', 'officers', 'faqs',
    'announcements', 'events', 'event_registrations', 'email_queue',
    'theme_settings', 'conversations', 'messages', 'concerns',
    'concern_replies', 'gallery_items', 'photobooth_gallery',
    'transparency_reports', 'patch_videos', 'ip_bans',
    'account_deletion_tombstones'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
  END LOOP;
END;
$$;

-- Full profile rows contain contact details, ban state, IP history, and the
-- reusable attendance credential. Only the owner and DevCom head can select
-- them directly. Registration workflows use the scoped RPCs below.
CREATE POLICY profiles_select_owner_or_devcom ON public.profiles
FOR SELECT TO authenticated
USING (
  id = (SELECT auth.uid())
  OR (SELECT public.get_user_role()) = 'devcom_head'
);

CREATE POLICY profiles_update_devcom ON public.profiles
FOR UPDATE TO authenticated
USING ((SELECT public.get_user_role()) = 'devcom_head')
WITH CHECK ((SELECT public.get_user_role()) = 'devcom_head');

CREATE POLICY committees_anon_read ON public.committees
FOR SELECT TO anon USING (true);
CREATE POLICY committees_authenticated_read ON public.committees
FOR SELECT TO authenticated USING (true);
CREATE POLICY committees_devcom_insert ON public.committees
FOR INSERT TO authenticated
WITH CHECK ((SELECT public.get_user_role()) = 'devcom_head');
CREATE POLICY committees_devcom_update ON public.committees
FOR UPDATE TO authenticated
USING ((SELECT public.get_user_role()) = 'devcom_head')
WITH CHECK ((SELECT public.get_user_role()) = 'devcom_head');
CREATE POLICY committees_devcom_delete ON public.committees
FOR DELETE TO authenticated
USING ((SELECT public.get_user_role()) = 'devcom_head');

CREATE POLICY subteams_anon_read ON public.committee_subteams
FOR SELECT TO anon USING (true);
CREATE POLICY subteams_authenticated_read ON public.committee_subteams
FOR SELECT TO authenticated USING (true);
CREATE POLICY subteams_devcom_insert ON public.committee_subteams
FOR INSERT TO authenticated
WITH CHECK ((SELECT public.get_user_role()) = 'devcom_head');
CREATE POLICY subteams_devcom_update ON public.committee_subteams
FOR UPDATE TO authenticated
USING ((SELECT public.get_user_role()) = 'devcom_head')
WITH CHECK ((SELECT public.get_user_role()) = 'devcom_head');
CREATE POLICY subteams_devcom_delete ON public.committee_subteams
FOR DELETE TO authenticated
USING ((SELECT public.get_user_role()) = 'devcom_head');

CREATE POLICY officers_anon_read ON public.officers
FOR SELECT TO anon USING (true);
CREATE POLICY officers_authenticated_read ON public.officers
FOR SELECT TO authenticated USING (true);
CREATE POLICY officers_devcom_insert ON public.officers
FOR INSERT TO authenticated
WITH CHECK ((SELECT public.get_user_role()) = 'devcom_head');
CREATE POLICY officers_devcom_update ON public.officers
FOR UPDATE TO authenticated
USING ((SELECT public.get_user_role()) = 'devcom_head')
WITH CHECK ((SELECT public.get_user_role()) = 'devcom_head');
CREATE POLICY officers_devcom_delete ON public.officers
FOR DELETE TO authenticated
USING ((SELECT public.get_user_role()) = 'devcom_head');

CREATE POLICY faqs_anon_read ON public.faqs
FOR SELECT TO anon USING (is_active);
CREATE POLICY faqs_authenticated_read ON public.faqs
FOR SELECT TO authenticated
USING (
  is_active
  OR (SELECT public.get_user_role()) IN ('devcom_head', 'comm_content')
);
CREATE POLICY faqs_content_insert ON public.faqs
FOR INSERT TO authenticated
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'));
CREATE POLICY faqs_content_update ON public.faqs
FOR UPDATE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'))
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'));
CREATE POLICY faqs_content_delete ON public.faqs
FOR DELETE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'));

CREATE POLICY announcements_anon_read ON public.announcements
FOR SELECT TO anon USING (status = 'published');
CREATE POLICY announcements_authenticated_read ON public.announcements
FOR SELECT TO authenticated
USING (
  status = 'published'
  OR (SELECT public.get_user_role()) IN ('devcom_head', 'comm_content')
);
CREATE POLICY announcements_content_insert ON public.announcements
FOR INSERT TO authenticated
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'));
CREATE POLICY announcements_content_update ON public.announcements
FOR UPDATE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'))
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'));
CREATE POLICY announcements_content_delete ON public.announcements
FOR DELETE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'));

CREATE POLICY events_anon_read ON public.events
FOR SELECT TO anon USING (true);
CREATE POLICY events_authenticated_read ON public.events
FOR SELECT TO authenticated USING (true);
CREATE POLICY events_content_insert ON public.events
FOR INSERT TO authenticated
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'));
CREATE POLICY events_content_update ON public.events
FOR UPDATE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'))
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'));
CREATE POLICY events_content_delete ON public.events
FOR DELETE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'));

CREATE POLICY registrations_owner_or_staff_read ON public.event_registrations
FOR SELECT TO authenticated
USING (
  profile_id = (SELECT auth.uid())
  OR (SELECT public.get_user_role()) IN ('devcom_head', 'comm_registration')
);
CREATE POLICY registrations_staff_update ON public.event_registrations
FOR UPDATE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_registration'))
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_registration'));
CREATE POLICY registrations_staff_delete ON public.event_registrations
FOR DELETE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_registration'));

-- email_queue, ip_bans, and account_deletion_tombstones intentionally have no
-- client policy.

CREATE POLICY themes_anon_read ON public.theme_settings
FOR SELECT TO anon USING (is_active);
CREATE POLICY themes_authenticated_read ON public.theme_settings
FOR SELECT TO authenticated
USING (is_active OR (SELECT public.get_user_role()) = 'devcom_head');
CREATE POLICY themes_devcom_insert ON public.theme_settings
FOR INSERT TO authenticated
WITH CHECK ((SELECT public.get_user_role()) = 'devcom_head');
CREATE POLICY themes_devcom_update ON public.theme_settings
FOR UPDATE TO authenticated
USING ((SELECT public.get_user_role()) = 'devcom_head')
WITH CHECK ((SELECT public.get_user_role()) = 'devcom_head');
CREATE POLICY themes_devcom_delete ON public.theme_settings
FOR DELETE TO authenticated
USING ((SELECT public.get_user_role()) = 'devcom_head');

CREATE POLICY conversations_owner_or_staff_read ON public.conversations
FOR SELECT TO authenticated
USING (
  profile_id = (SELECT auth.uid())
  OR (SELECT public.get_user_role()) IN ('devcom_head', 'officer')
);
CREATE POLICY conversations_owner_insert ON public.conversations
FOR INSERT TO authenticated
WITH CHECK (profile_id = (SELECT auth.uid()));
CREATE POLICY conversations_staff_update ON public.conversations
FOR UPDATE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'officer'))
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'officer'));

CREATE POLICY messages_owner_or_staff_read ON public.messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversations AS conversation
    WHERE conversation.id = messages.conversation_id
      AND (
        conversation.profile_id = (SELECT auth.uid())
        OR (SELECT public.get_user_role()) IN ('devcom_head', 'officer')
      )
  )
);
CREATE POLICY messages_scoped_insert ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  (
    sender_role = 'student'
    AND sender_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.conversations AS conversation
      WHERE conversation.id = messages.conversation_id
        AND conversation.profile_id = (SELECT auth.uid())
    )
  )
  OR (
    sender_role = 'admin'
    AND sender_id = (SELECT auth.uid())
    AND (SELECT public.get_user_role()) IN ('devcom_head', 'officer')
  )
);
CREATE POLICY messages_devcom_delete ON public.messages
FOR DELETE TO authenticated
USING ((SELECT public.get_user_role()) = 'devcom_head');

CREATE POLICY concerns_owner_or_staff_read ON public.concerns
FOR SELECT TO authenticated
USING (
  profile_id = (SELECT auth.uid())
  OR (SELECT public.get_user_role()) IN ('devcom_head', 'officer')
);
CREATE POLICY concerns_owner_insert ON public.concerns
FOR INSERT TO authenticated
WITH CHECK (profile_id = (SELECT auth.uid()));
CREATE POLICY concerns_staff_update ON public.concerns
FOR UPDATE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'officer'))
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'officer'));

CREATE POLICY concern_replies_owner_or_staff_read ON public.concern_replies
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.concerns AS concern
    WHERE concern.id = concern_replies.concern_id
      AND (
        concern.profile_id = (SELECT auth.uid())
        OR (SELECT public.get_user_role()) IN ('devcom_head', 'officer')
      )
  )
);
CREATE POLICY concern_replies_staff_insert ON public.concern_replies
FOR INSERT TO authenticated
WITH CHECK (
  admin_id = (SELECT auth.uid())
  AND (SELECT public.get_user_role()) IN ('devcom_head', 'officer')
);

CREATE POLICY gallery_anon_read ON public.gallery_items
FOR SELECT TO anon USING (true);
CREATE POLICY gallery_authenticated_read ON public.gallery_items
FOR SELECT TO authenticated USING (true);
CREATE POLICY gallery_staff_insert ON public.gallery_items
FOR INSERT TO authenticated
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content', 'comm_photobooth'));
CREATE POLICY gallery_staff_update ON public.gallery_items
FOR UPDATE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content', 'comm_photobooth'))
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content', 'comm_photobooth'));
CREATE POLICY gallery_staff_delete ON public.gallery_items
FOR DELETE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content', 'comm_photobooth'));

CREATE POLICY photobooth_anon_featured_read ON public.photobooth_gallery
FOR SELECT TO anon USING (featured);
CREATE POLICY photobooth_authenticated_read ON public.photobooth_gallery
FOR SELECT TO authenticated
USING (
  featured
  OR profile_id = (SELECT auth.uid())
  OR (SELECT public.get_user_role()) IN ('devcom_head', 'comm_photobooth')
);
CREATE POLICY photobooth_owner_or_staff_insert ON public.photobooth_gallery
FOR INSERT TO authenticated
WITH CHECK (
  profile_id = (SELECT auth.uid())
  OR (SELECT public.get_user_role()) IN ('devcom_head', 'comm_photobooth')
);
CREATE POLICY photobooth_staff_update ON public.photobooth_gallery
FOR UPDATE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_photobooth'))
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_photobooth'));
CREATE POLICY photobooth_staff_delete ON public.photobooth_gallery
FOR DELETE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_photobooth'));

CREATE POLICY transparency_anon_read ON public.transparency_reports
FOR SELECT TO anon USING (true);
CREATE POLICY transparency_authenticated_read ON public.transparency_reports
FOR SELECT TO authenticated USING (true);
CREATE POLICY transparency_staff_insert ON public.transparency_reports
FOR INSERT TO authenticated
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'officer'));
CREATE POLICY transparency_staff_update ON public.transparency_reports
FOR UPDATE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'officer'))
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'officer'));
CREATE POLICY transparency_staff_delete ON public.transparency_reports
FOR DELETE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'officer'));

CREATE POLICY patch_anon_read ON public.patch_videos
FOR SELECT TO anon USING (true);
CREATE POLICY patch_authenticated_read ON public.patch_videos
FOR SELECT TO authenticated USING (true);
CREATE POLICY patch_content_insert ON public.patch_videos
FOR INSERT TO authenticated
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'));
CREATE POLICY patch_content_update ON public.patch_videos
FOR UPDATE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'))
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'));
CREATE POLICY patch_content_delete ON public.patch_videos
FOR DELETE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'));

REVOKE ALL ON public.email_queue FROM anon, authenticated;
REVOKE ALL ON public.ip_bans FROM anon, authenticated;
REVOKE ALL ON public.account_deletion_tombstones FROM anon, authenticated;

GRANT SELECT ON public.committees, public.committee_subteams, public.officers,
  public.faqs, public.announcements, public.events, public.gallery_items,
  public.photobooth_gallery, public.transparency_reports, public.patch_videos,
  public.theme_settings
TO anon, authenticated;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.committees, public.committee_subteams,
  public.officers, public.faqs, public.announcements, public.events,
  public.gallery_items, public.photobooth_gallery, public.transparency_reports,
  public.patch_videos, public.theme_settings
TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.event_registrations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.concerns TO authenticated;
GRANT SELECT, INSERT ON public.concern_replies TO authenticated;

-- The registration committee receives only the fields required for the
-- verification screen, and only for completed pending submissions.
CREATE OR REPLACE FUNCTION public.list_pending_verifications(
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'comm_registration') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'INVALID_PAGINATION';
  END IF;

  WITH filtered AS MATERIALIZED (
    SELECT
      profile.id,
      profile.email,
      profile.full_name,
      profile.student_number,
      profile.year_level,
      profile.program,
      profile.section,
      profile.contact_number,
      profile.created_at,
      profile.submitted_at,
      profile.status,
      profile.profile_complete
    FROM public.profiles AS profile
    WHERE profile.status = 'pending'
      AND profile.profile_complete
      AND (
        NULLIF(btrim(p_search), '') IS NULL
        OR profile.full_name ILIKE '%' || btrim(p_search) || '%'
        OR profile.email ILIKE '%' || btrim(p_search) || '%'
        OR profile.student_number ILIKE '%' || btrim(p_search) || '%'
      )
  ), page AS (
    SELECT *
    FROM filtered
    ORDER BY submitted_at DESC NULLS LAST, created_at DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::JSONB),
    'total', (SELECT count(*) FROM filtered)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

-- Registration lists expose a purpose-limited projection instead of granting
-- the registration role access to every column of every profile.
CREATE OR REPLACE FUNCTION public.list_registration_admin_rows(
  p_search TEXT DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'comm_registration') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'INVALID_PAGINATION';
  END IF;

  WITH filtered AS MATERIALIZED (
    SELECT
      registration.id,
      registration.event_id,
      registration.profile_id,
      registration.status,
      registration.registered_at,
      registration.attended_at,
      registration.attendance_origin,
      profile.full_name,
      profile.student_number,
      profile.email,
      profile.section,
      event.title AS event_title,
      event.event_date,
      event.location
    FROM public.event_registrations AS registration
    JOIN public.profiles AS profile ON profile.id = registration.profile_id
    JOIN public.events AS event ON event.id = registration.event_id
    WHERE (p_event_id IS NULL OR registration.event_id = p_event_id)
      AND (
        NULLIF(btrim(p_search), '') IS NULL
        OR profile.full_name ILIKE '%' || btrim(p_search) || '%'
        OR profile.email ILIKE '%' || btrim(p_search) || '%'
      )
  ), page AS (
    SELECT *
    FROM filtered
    ORDER BY registered_at DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', page.id,
          'event_id', page.event_id,
          'profile_id', page.profile_id,
          'status', page.status,
          'registered_at', page.registered_at,
          'attended_at', page.attended_at,
          'attendance_origin', page.attendance_origin,
          'profiles', jsonb_build_object(
            'full_name', page.full_name,
            'student_number', page.student_number,
            'email', page.email,
            'section', page.section
          ),
          'events', jsonb_build_object(
            'title', page.event_title,
            'event_date', page.event_date,
            'location', page.location
          )
        ) ORDER BY page.registered_at DESC
      )
      FROM page
    ), '[]'::JSONB),
    'total', (SELECT count(*) FROM filtered),
    'confirmed', (SELECT count(*) FROM filtered WHERE status = 'confirmed'),
    'pending', (SELECT count(*) FROM filtered WHERE status = 'pending'),
    'attended', (SELECT count(*) FROM filtered WHERE status = 'attended'),
    'cancelled', (SELECT count(*) FROM filtered WHERE status = 'cancelled')
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

-- A token lookup returns only the identity fields needed to render the scan
-- result. The reusable attendance credential itself is never returned.
CREATE OR REPLACE FUNCTION public.resolve_attendance_pass(p_attendance_token TEXT)
RETURNS TABLE (
  profile_id UUID,
  full_name TEXT,
  student_number TEXT,
  program TEXT,
  section TEXT,
  status TEXT,
  banned BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'comm_registration') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF NULLIF(btrim(p_attendance_token), '') IS NULL THEN
    RAISE EXCEPTION 'ATTENDANCE_TOKEN_REQUIRED';
  END IF;
  PERFORM internal.enforce_rate_limit('attendance_lookup', auth.uid()::TEXT, 240, 60);

  RETURN QUERY
  SELECT
    profile.id,
    profile.full_name,
    profile.student_number,
    profile.program,
    profile.section,
    profile.status,
    profile.banned
  FROM public.profiles AS profile
  WHERE profile.attendance_qr_code = btrim(p_attendance_token);
END;
$$;

-- Event-ticket validation and attendance mutation are atomic and do not rely
-- on a profile join performed with the caller's broad table privileges.
CREATE OR REPLACE FUNCTION public.check_in_registration(p_registration_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_registration public.event_registrations%ROWTYPE;
  v_already_attended BOOLEAN;
  v_result JSONB;
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'comm_registration') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  PERFORM internal.enforce_rate_limit('registration_scan', auth.uid()::TEXT, 180, 60);

  SELECT * INTO STRICT v_registration
  FROM public.event_registrations
  WHERE id = p_registration_id
  FOR UPDATE;

  v_already_attended := v_registration.status = 'attended';
  IF NOT v_already_attended THEN
    UPDATE public.event_registrations
    SET status = 'attended', attended_at = now()
    WHERE id = p_registration_id
    RETURNING * INTO v_registration;
  END IF;

  SELECT jsonb_build_object(
    'id', v_registration.id,
    'event_id', v_registration.event_id,
    'profile_id', v_registration.profile_id,
    'status', v_registration.status,
    'registered_at', v_registration.registered_at,
    'attended_at', v_registration.attended_at,
    'attendance_origin', v_registration.attendance_origin,
    'was_already_attended', v_already_attended,
    'profiles', jsonb_build_object(
      'full_name', profile.full_name,
      'student_number', profile.student_number,
      'program', profile.program,
      'section', profile.section
    ),
    'events', jsonb_build_object('title', event.title)
  )
  INTO v_result
  FROM public.profiles AS profile
  JOIN public.events AS event ON event.id = v_registration.event_id
  WHERE profile.id = v_registration.profile_id;

  RETURN v_result;
EXCEPTION
  WHEN no_data_found THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND';
END;
$$;

-- Keep the verification UI and server authorization aligned.
CREATE OR REPLACE FUNCTION public.admin_approve_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
  v_key TEXT;
  v_rows INTEGER;
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'comm_registration') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
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
  INSERT INTO public.email_queue (
    profile_id, recipient_email, email_type, subject, html_body,
    logical_key, provider_idempotency_key
  ) VALUES (
    p_user_id, v_target.email, 'verification_approved', '[CCIS SC] Account approved',
    '<p>Hello <strong>' || public.html_escape(COALESCE(v_target.full_name, 'Student')) ||
      '</strong>, your CCIS Portal profile has been approved.</p>',
    v_key, replace(v_key, ':', '-')
  ) ON CONFLICT (logical_key) WHERE logical_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('approved', true, 'email_queued', v_rows = 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_user(p_user_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
  v_reason TEXT;
  v_key TEXT;
  v_rows INTEGER;
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'comm_registration') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
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
  INSERT INTO public.email_queue (
    profile_id, recipient_email, email_type, subject, html_body,
    logical_key, provider_idempotency_key
  ) VALUES (
    p_user_id, v_target.email, 'verification_rejected', '[CCIS SC] Profile changes required',
    '<p>Hello <strong>' || public.html_escape(COALESCE(v_target.full_name, 'Student')) ||
      '</strong>. Your profile needs changes.</p><p><strong>Reason:</strong> ' ||
      public.html_escape(v_reason) || '</p>',
    v_key, replace(v_key, ':', '-')
  ) ON CONFLICT (logical_key) WHERE logical_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('rejected', true, 'email_queued', v_rows = 1);
END;
$$;

REVOKE ALL ON FUNCTION public.list_pending_verifications(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_registration_admin_rows(TEXT, UUID, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_attendance_pass(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_in_registration(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_verifications(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_registration_admin_rows(TEXT, UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_attendance_pass(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_registration(UUID) TO authenticated;

-- Rows left in processing before leases existed have an unknowable provider
-- outcome. Quarantine them for operator reconciliation; never auto-resend them.
UPDATE public.email_queue
SET status = 'delivery_unknown',
    delivery_state = 'delivery_unknown',
    error_message = 'Legacy processing row has no lease; reconcile provider outcome before retrying.',
    lease_expires_at = NULL,
    lease_worker_id = NULL
WHERE status = 'processing'
  AND lease_expires_at IS NULL;

CREATE OR REPLACE FUNCTION public.dequeue_emails(p_limit INTEGER, p_worker_id TEXT)
RETURNS SETOF public.email_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Invalid dequeue limit';
  END IF;
  IF NULLIF(btrim(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'Worker ID is required';
  END IF;

  UPDATE public.email_queue
  SET status = CASE
        WHEN lease_expires_at IS NULL
          OR delivery_state IN ('provider_accepted', 'delivery_unknown')
          OR sent_at IS NOT NULL THEN 'delivery_unknown'
        WHEN attempts >= 3 THEN 'dead_letter'
        ELSE 'failed'
      END,
      delivery_state = CASE
        WHEN lease_expires_at IS NULL
          OR delivery_state IN ('provider_accepted', 'delivery_unknown')
          OR sent_at IS NOT NULL THEN 'delivery_unknown'
        ELSE delivery_state
      END,
      error_message = CASE
        WHEN lease_expires_at IS NULL THEN 'Processing row has no lease; reconcile provider outcome before retrying.'
        WHEN delivery_state IN ('provider_accepted', 'delivery_unknown') OR sent_at IS NOT NULL
          THEN 'Delivery outcome requires reconciliation.'
        ELSE COALESCE(error_message || ' ', '') || 'Processing lease expired.'
      END,
      scheduled_for = CASE WHEN attempts < 3 THEN now() ELSE scheduled_for END,
      lease_expires_at = NULL,
      lease_worker_id = NULL,
      dead_lettered_at = CASE WHEN attempts >= 3 THEN now() ELSE dead_lettered_at END
  WHERE status = 'processing'
    AND (lease_expires_at IS NULL OR lease_expires_at <= now());

  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.email_queue
    WHERE (status = 'pending' OR (status = 'failed' AND attempts < 3))
      AND scheduled_for <= now()
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.email_queue AS queue
  SET status = 'processing',
      delivery_state = 'sending',
      attempts = queue.attempts + 1,
      lease_expires_at = now() + interval '10 minutes',
      lease_worker_id = p_worker_id,
      provider_idempotency_key = COALESCE(
        queue.provider_idempotency_key,
        'queue-' || queue.id::TEXT
      ),
      error_message = NULL
  FROM candidates
  WHERE queue.id = candidates.id
  RETURNING queue.*;
END;
$$;

REVOKE ALL ON FUNCTION public.dequeue_emails(INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dequeue_emails(INTEGER, TEXT) TO service_role;

-- Remove the older names from each confirmed duplicate index pair. The newer
-- canonical indexes remain in place.
DROP INDEX IF EXISTS public.idx_concerns_profile;
DROP INDEX IF EXISTS public.idx_registrations_profile;
DROP INDEX IF EXISTS public.idx_messages_conversation;
DROP INDEX IF EXISTS public.idx_profiles_committee;

-- Apply the same init-plan optimization to storage policy helpers.
DROP POLICY IF EXISTS ccis_published_assets_read ON storage.objects;
DROP POLICY IF EXISTS ccis_staff_assets_insert ON storage.objects;
DROP POLICY IF EXISTS ccis_staff_assets_update ON storage.objects;
DROP POLICY IF EXISTS ccis_staff_assets_delete ON storage.objects;
DROP POLICY IF EXISTS ccis_private_drafts_read ON storage.objects;
DROP POLICY IF EXISTS ccis_published_assets_anon_read ON storage.objects;
DROP POLICY IF EXISTS ccis_assets_authenticated_read ON storage.objects;

CREATE POLICY ccis_published_assets_anon_read ON storage.objects
FOR SELECT TO anon
USING (bucket_id IN (
  'gallery-images', 'banners', 'bukas-kaban-reports',
  'patch-thumbnails', 'patch-videos'
));

CREATE POLICY ccis_assets_authenticated_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id IN (
    'gallery-images', 'banners', 'bukas-kaban-reports',
    'patch-thumbnails', 'patch-videos'
  )
  OR (
    bucket_id = 'ccis-private-drafts'
    AND (SELECT public.get_user_role()) IN (
      'devcom_head', 'officer', 'comm_content',
      'comm_registration', 'comm_photobooth'
    )
  )
);

CREATE POLICY ccis_staff_assets_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN (
    'gallery-images', 'banners', 'bukas-kaban-reports',
    'patch-thumbnails', 'patch-videos', 'ccis-private-drafts'
  )
  AND (SELECT public.get_user_role()) IN (
    'devcom_head', 'officer', 'comm_content',
    'comm_registration', 'comm_photobooth'
  )
);

CREATE POLICY ccis_staff_assets_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id IN (
    'gallery-images', 'banners', 'bukas-kaban-reports',
    'patch-thumbnails', 'patch-videos', 'ccis-private-drafts'
  )
  AND (SELECT public.get_user_role()) IN (
    'devcom_head', 'officer', 'comm_content',
    'comm_registration', 'comm_photobooth'
  )
)
WITH CHECK (
  bucket_id IN (
    'gallery-images', 'banners', 'bukas-kaban-reports',
    'patch-thumbnails', 'patch-videos', 'ccis-private-drafts'
  )
  AND (SELECT public.get_user_role()) IN (
    'devcom_head', 'officer', 'comm_content',
    'comm_registration', 'comm_photobooth'
  )
);

CREATE POLICY ccis_staff_assets_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id IN (
    'gallery-images', 'banners', 'bukas-kaban-reports',
    'patch-thumbnails', 'patch-videos', 'ccis-private-drafts'
  )
  AND (SELECT public.get_user_role()) IN (
    'devcom_head', 'officer', 'comm_content',
    'comm_registration', 'comm_photobooth'
  )
);

-- auto_process_email_queue_fn is invoked only by the email_queue trigger. It
-- must not remain directly executable through PostgREST's authenticated role.
REVOKE ALL ON FUNCTION public.auto_process_email_queue_fn() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_process_email_queue_fn()
  FROM anon, authenticated;
