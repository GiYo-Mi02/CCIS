-- ============================================================
-- SUPABASE STANDARDS AUDIT: canonical RLS, grants, and storage boundaries
-- Findings 5, 10, 11, 12, 13, 15
-- ============================================================

-- Remove every permissive legacy policy on application tables before creating
-- the single authoritative policy set below. Policies combine with OR, so
-- leaving even one legacy policy would reopen the boundary.
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'profiles', 'committees', 'officers', 'faqs', 'announcements', 'events',
        'event_registrations', 'email_queue', 'theme_settings', 'conversations',
        'messages', 'concerns', 'concern_replies', 'gallery_items',
        'transparency_reports', 'patch_videos', 'ip_bans',
        'account_deletion_tombstones'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      v_policy.policyname, v_policy.schemaname, v_policy.tablename);
  END LOOP;
END;
$$;

DO $$
DECLARE v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'profiles', 'committees', 'officers', 'faqs', 'announcements', 'events',
    'event_registrations', 'email_queue', 'theme_settings', 'conversations',
    'messages', 'concerns', 'concern_replies', 'gallery_items',
    'transparency_reports', 'patch_videos', 'ip_bans',
    'account_deletion_tombstones'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
  END LOOP;
END;
$$;

-- Profiles contain private student and security fields. They are readable only
-- by the owner or a role that has a genuine operational need for the directory.
CREATE POLICY profiles_select_owner_or_staff ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.get_user_role() IN (
    'devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth'
  )
);

-- Only the DevCom head receives direct profile UPDATE access. Student edits and
-- verification operations use scoped SECURITY DEFINER RPCs.
CREATE POLICY profiles_update_devcom ON public.profiles
FOR UPDATE TO authenticated
USING (public.get_user_role() = 'devcom_head')
WITH CHECK (public.get_user_role() = 'devcom_head');

CREATE POLICY committees_public_read ON public.committees
FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY committees_devcom_write ON public.committees
FOR ALL TO authenticated
USING (public.get_user_role() = 'devcom_head')
WITH CHECK (public.get_user_role() = 'devcom_head');

CREATE POLICY officers_public_read ON public.officers
FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY officers_devcom_write ON public.officers
FOR ALL TO authenticated
USING (public.get_user_role() = 'devcom_head')
WITH CHECK (public.get_user_role() = 'devcom_head');

CREATE POLICY faqs_public_read ON public.faqs
FOR SELECT TO anon, authenticated
USING (is_active OR public.get_user_role() IN ('devcom_head', 'comm_content'));
CREATE POLICY faqs_content_write ON public.faqs
FOR ALL TO authenticated
USING (public.get_user_role() IN ('devcom_head', 'comm_content'))
WITH CHECK (public.get_user_role() IN ('devcom_head', 'comm_content'));

CREATE POLICY announcements_public_read ON public.announcements
FOR SELECT TO anon, authenticated
USING (status = 'published' OR public.get_user_role() IN ('devcom_head', 'comm_content'));
CREATE POLICY announcements_content_write ON public.announcements
FOR ALL TO authenticated
USING (public.get_user_role() IN ('devcom_head', 'comm_content'))
WITH CHECK (public.get_user_role() IN ('devcom_head', 'comm_content'));

CREATE POLICY events_public_read ON public.events
FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY events_registration_write ON public.events
FOR ALL TO authenticated
USING (public.get_user_role() IN ('devcom_head', 'comm_registration'))
WITH CHECK (public.get_user_role() IN ('devcom_head', 'comm_registration'));

CREATE POLICY registrations_owner_or_staff_read ON public.event_registrations
FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR public.get_user_role() IN ('devcom_head', 'comm_registration')
);
CREATE POLICY registrations_staff_update ON public.event_registrations
FOR UPDATE TO authenticated
USING (public.get_user_role() IN ('devcom_head', 'comm_registration'))
WITH CHECK (public.get_user_role() IN ('devcom_head', 'comm_registration'));
CREATE POLICY registrations_staff_delete ON public.event_registrations
FOR DELETE TO authenticated
USING (public.get_user_role() IN ('devcom_head', 'comm_registration'));

-- email_queue has no client policy. Queue mutations happen only in trusted RPCs
-- and the service-role worker.

CREATE POLICY themes_active_public_read ON public.theme_settings
FOR SELECT TO anon, authenticated
USING (is_active OR public.get_user_role() = 'devcom_head');
CREATE POLICY themes_devcom_write ON public.theme_settings
FOR ALL TO authenticated
USING (public.get_user_role() = 'devcom_head')
WITH CHECK (public.get_user_role() = 'devcom_head');

CREATE POLICY conversations_owner_read ON public.conversations
FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR public.get_user_role() IN ('devcom_head', 'officer')
);
CREATE POLICY conversations_owner_insert ON public.conversations
FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());
CREATE POLICY conversations_staff_update ON public.conversations
FOR UPDATE TO authenticated
USING (public.get_user_role() IN ('devcom_head', 'officer'))
WITH CHECK (public.get_user_role() IN ('devcom_head', 'officer'));

CREATE POLICY messages_owner_or_staff_read ON public.messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations AS conversation
    WHERE conversation.id = messages.conversation_id
      AND (
        conversation.profile_id = auth.uid()
        OR public.get_user_role() IN ('devcom_head', 'officer')
      )
  )
);
CREATE POLICY messages_scoped_insert ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  (
    sender_role = 'student'
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations AS conversation
      WHERE conversation.id = messages.conversation_id
        AND conversation.profile_id = auth.uid()
    )
  )
  OR (
    sender_role = 'admin'
    AND sender_id = auth.uid()
    AND public.get_user_role() IN ('devcom_head', 'officer')
  )
);
CREATE POLICY messages_devcom_delete ON public.messages
FOR DELETE TO authenticated USING (public.get_user_role() = 'devcom_head');

CREATE POLICY concerns_owner_read ON public.concerns
FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR public.get_user_role() IN ('devcom_head', 'officer')
);
CREATE POLICY concerns_owner_insert ON public.concerns
FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());
CREATE POLICY concerns_staff_update ON public.concerns
FOR UPDATE TO authenticated
USING (public.get_user_role() IN ('devcom_head', 'officer'))
WITH CHECK (public.get_user_role() IN ('devcom_head', 'officer'));

CREATE POLICY concern_replies_owner_or_staff_read ON public.concern_replies
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.concerns AS concern
    WHERE concern.id = concern_replies.concern_id
      AND (
        concern.profile_id = auth.uid()
        OR public.get_user_role() IN ('devcom_head', 'officer')
      )
  )
);
CREATE POLICY concern_replies_staff_insert ON public.concern_replies
FOR INSERT TO authenticated
WITH CHECK (
  admin_id = auth.uid()
  AND public.get_user_role() IN ('devcom_head', 'officer')
);

CREATE POLICY gallery_public_read ON public.gallery_items
FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY gallery_staff_write ON public.gallery_items
FOR ALL TO authenticated
USING (public.get_user_role() IN ('devcom_head', 'comm_content', 'comm_photobooth'))
WITH CHECK (public.get_user_role() IN ('devcom_head', 'comm_content', 'comm_photobooth'));

CREATE POLICY transparency_public_read ON public.transparency_reports
FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY transparency_staff_write ON public.transparency_reports
FOR ALL TO authenticated
USING (public.get_user_role() IN ('devcom_head', 'officer'))
WITH CHECK (public.get_user_role() IN ('devcom_head', 'officer'));

CREATE POLICY patch_public_read ON public.patch_videos
FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY patch_content_write ON public.patch_videos
FOR ALL TO authenticated
USING (public.get_user_role() IN ('devcom_head', 'comm_content'))
WITH CHECK (public.get_user_role() IN ('devcom_head', 'comm_content'));

REVOKE ALL ON public.email_queue FROM anon, authenticated;
REVOKE ALL ON public.ip_bans FROM anon, authenticated;
REVOKE ALL ON public.account_deletion_tombstones FROM anon, authenticated;

GRANT SELECT ON public.committees, public.officers, public.faqs,
  public.announcements, public.events, public.gallery_items,
  public.transparency_reports, public.patch_videos, public.theme_settings
TO anon, authenticated;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.committees, public.officers, public.faqs,
  public.announcements, public.events, public.gallery_items,
  public.transparency_reports, public.patch_videos, public.theme_settings
TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.event_registrations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.concerns TO authenticated;
GRANT SELECT, INSERT ON public.concern_replies TO authenticated;

-- Prevent the slots view from bypassing underlying RLS as its owner.
ALTER VIEW public.events_with_slots SET (security_invoker = true);
GRANT SELECT ON public.events_with_slots TO anon, authenticated;

-- Published assets are intentionally public. Drafts/private material is stored
-- in a separate private bucket, never mixed with public CDN objects.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('gallery-images', 'gallery-images', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('banners', 'banners', true, 10485760, ARRAY['image/jpeg','image/png','image/webp']),
  ('bukas-kaban-reports', 'bukas-kaban-reports', true, 52428800, ARRAY['application/pdf','image/jpeg','image/png','image/webp']),
  ('patch-thumbnails', 'patch-thumbnails', true, 10485760, ARRAY['image/jpeg','image/png','image/webp']),
  ('patch-videos', 'patch-videos', true, 262144000, ARRAY['video/mp4','video/webm']),
  ('ccis-private-drafts', 'ccis-private-drafts', false, 52428800, NULL)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
DECLARE v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        qual LIKE '%gallery-images%'
        OR qual LIKE '%banners%'
        OR qual LIKE '%bukas-kaban-reports%'
        OR qual LIKE '%patch-thumbnails%'
        OR qual LIKE '%patch-videos%'
        OR qual LIKE '%ccis-private-drafts%'
        OR with_check LIKE '%gallery-images%'
        OR with_check LIKE '%banners%'
        OR with_check LIKE '%bukas-kaban-reports%'
        OR with_check LIKE '%patch-thumbnails%'
        OR with_check LIKE '%patch-videos%'
        OR with_check LIKE '%ccis-private-drafts%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', v_policy.policyname);
  END LOOP;
END;
$$;

CREATE POLICY ccis_published_assets_read ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id IN ('gallery-images', 'banners', 'bukas-kaban-reports', 'patch-thumbnails', 'patch-videos'));

CREATE POLICY ccis_staff_assets_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('gallery-images', 'banners', 'bukas-kaban-reports', 'patch-thumbnails', 'patch-videos', 'ccis-private-drafts')
  AND public.get_user_role() IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
);

CREATE POLICY ccis_staff_assets_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id IN ('gallery-images', 'banners', 'bukas-kaban-reports', 'patch-thumbnails', 'patch-videos', 'ccis-private-drafts')
  AND public.get_user_role() IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
)
WITH CHECK (
  bucket_id IN ('gallery-images', 'banners', 'bukas-kaban-reports', 'patch-thumbnails', 'patch-videos', 'ccis-private-drafts')
  AND public.get_user_role() IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
);

CREATE POLICY ccis_staff_assets_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id IN ('gallery-images', 'banners', 'bukas-kaban-reports', 'patch-thumbnails', 'patch-videos', 'ccis-private-drafts')
  AND public.get_user_role() IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
);

CREATE POLICY ccis_private_drafts_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'ccis-private-drafts'
  AND public.get_user_role() IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
);
