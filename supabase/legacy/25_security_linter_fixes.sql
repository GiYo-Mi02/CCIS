-- ============================================================
-- CCIS PLATFORM BACKEND: SUPABASE SECURITY LINTER FIXES
-- ============================================================
-- Migration 25: Fixes all warnings from the Supabase Database Linter:
--   1. function_search_path_mutable — Add SET search_path = '' to all functions
--   2. public_bucket_allows_listing — Restrict SELECT policies on storage.objects
--   3. SECURITY DEFINER function exposure — Revoke EXECUTE from anon/public
--   4. auth_leaked_password_protection — (Dashboard-only, see advisory at end)
--
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- AFTER all previous migrations (01–24) have been applied.
-- ============================================================


-- ============================================================
-- CATEGORY 1: FUNCTION SEARCH PATH MUTABLE
-- ============================================================
-- Fix: Recreate every function with SET search_path = ''
-- This forces all object references to be schema-qualified,
-- preventing search-path injection attacks.
-- ============================================================


-- 1.1  get_user_role()
-- Used extensively in RLS policies. Must be SECURITY DEFINER
-- so it can read public.profiles on behalf of the calling user.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (
    SELECT role FROM public.profiles WHERE id = auth.uid()
  );
END;
$$;


-- 1.2  check_profile_metadata()
-- Trigger function on public.profiles (BEFORE INSERT OR UPDATE).
-- NOT a SECURITY DEFINER — runs as the table owner via trigger context.
CREATE OR REPLACE FUNCTION public.check_profile_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- SAFETY GUARD / PROMOTION: Automatically make whitelist emails devcom_head and approved
  IF NEW.email = 'ggiojoshua2006@gmail.com' OR NEW.email = 'devcommgio2006@gmail.com' THEN
    NEW.role := 'devcom_head';
    NEW.position := 'Lead Administrator';
    NEW.profile_complete := true;
    NEW.status := 'approved';
    NEW.approved_at := now();
    RETURN NEW;
  END IF;

  -- Enforce email ends with @umak.edu.ph (case-insensitive) for all other accounts
  IF NEW.email !~* '^[a-zA-Z0-9._%+-]+@umak\.edu\.ph$' THEN
    RAISE EXCEPTION 'Unsupported email. Only @umak.edu.ph accounts are acceptable.';
  END IF;

  -- Enforce name limit (not exceeding 255 characters)
  IF NEW.full_name IS NOT NULL AND length(NEW.full_name) > 255 THEN
    RAISE EXCEPTION 'Full name must not exceed 255 characters.';
  END IF;

  -- Enforce section matches uppercase letters, numbers, and hyphens only, no spaces
  IF NEW.section IS NOT NULL AND NEW.section !~ '^[A-Z0-9-]+$' THEN
    RAISE EXCEPTION 'Invalid section format. It must contain only uppercase letters, numbers, and hyphens, with no spaces (e.g., ACSAD, A-APPDEV).';
  END IF;

  RETURN NEW;
END;
$$;


-- 1.3  handle_new_user()
-- Trigger on auth.users AFTER INSERT. SECURITY DEFINER is required
-- because the trigger inserts into public.profiles on behalf of the auth system.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    status,
    profile_complete,
    subscribe_announcements_events,
    email_subscription_decided
  )
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url',
    'student',
    'pending',
    false,
    false,
    false
  );
  RETURN NEW;
END;
$$;


-- 1.4  html_escape(text)
-- Pure helper. IMMUTABLE, no security context needed.
CREATE OR REPLACE FUNCTION public.html_escape(text_to_escape TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF text_to_escape IS NULL THEN
    RETURN '';
  END IF;
  RETURN replace(replace(replace(replace(replace(text_to_escape,
    '&', '&amp;'),
    '<', '&lt;'),
    '>', '&gt;'),
    '"', '&quot;'),
    '''', '&#39;');
END;
$$;


-- 1.5  dequeue_emails(integer)
-- Called by Edge Function (service_role). SECURITY DEFINER required
-- for FOR UPDATE SKIP LOCKED across the email_queue table.
CREATE OR REPLACE FUNCTION public.dequeue_emails(p_limit INTEGER)
RETURNS SETOF public.email_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.email_queue
  SET status = 'processing',
      attempts = attempts + 1
  WHERE id IN (
    SELECT id
    FROM public.email_queue
    WHERE (status = 'pending' OR (status = 'failed' AND attempts < 3))
      AND scheduled_for <= now()
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING *;
END;
$$;


-- 1.6  queue_ticket_email_fn()
-- Trigger on event_registrations AFTER INSERT. SECURITY DEFINER needed
-- to read profiles/events and insert into email_queue.
CREATE OR REPLACE FUNCTION public.queue_ticket_email_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email TEXT;
  v_name TEXT;
  v_section TEXT;
  v_program TEXT;
  v_event_title TEXT;
  v_qr_url TEXT;
  v_html TEXT;
BEGIN
  -- Get user profile details
  SELECT email, COALESCE(full_name, 'Student'), COALESCE(section, '—'), COALESCE(program, 'CCIS')
  INTO v_email, v_name, v_section, v_program
  FROM public.profiles
  WHERE id = NEW.profile_id;

  -- Get event details
  SELECT title
  INTO v_event_title
  FROM public.events
  WHERE id = NEW.event_id;

  -- Build boarding pass and queue
  IF v_email IS NOT NULL AND v_event_title IS NOT NULL THEN
    v_qr_url := 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' || NEW.id;

    v_html := '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #FAF7EA;
      color: #1A3C2E;
      margin: 0;
      padding: 40px 20px;
    }
    .card {
      max-width: 550px;
      background: #ffffff;
      border-radius: 24px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      margin: 0 auto;
      box-shadow: 0 4px 12px rgba(26,60,46,0.05);
    }
    .header {
      background-color: #1A3C2E;
      color: #ffffff;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .subheader {
      color: #F5B400;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-top: 5px;
      font-weight: bold;
    }
    .body {
      padding: 30px;
    }
    .event-title {
      font-size: 24px;
      font-weight: 900;
      color: #1A3C2E;
      margin: 0 0 20px 0;
      text-align: center;
    }
    .details-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
    }
    .details-grid td {
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
    }
    .label {
      color: #64748b;
      font-weight: 500;
      width: 40%;
    }
    .value {
      font-weight: 700;
      color: #1A3C2E;
      text-align: right;
    }
    .qr-section {
      text-align: center;
      background-color: #f8fafc;
      border-radius: 16px;
      padding: 25px;
      margin-top: 20px;
      border: 1px dashed #cbd5e1;
    }
    .qr-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #64748b;
      margin-bottom: 15px;
      font-weight: bold;
    }
    .qr-image {
      background-color: #ffffff;
      padding: 10px;
      border-radius: 12px;
      display: inline-block;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #64748b;
      margin-top: 30px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="subheader">Official Entry Boarding Pass</div>
      <h1>CCIS STUDENT COUNCIL</h1>
    </div>
    <div class="body">
      <div class="event-title">' || public.html_escape(v_event_title) || '</div>
      
      <table class="details-grid">
        <tr>
          <td class="label">Attendee Name</td>
          <td class="value">' || public.html_escape(v_name) || '</td>
        </tr>
        <tr>
          <td class="label">Section</td>
          <td class="value">' || public.html_escape(UPPER(v_section)) || '</td>
        </tr>
        <tr>
          <td class="label">Branch (Program)</td>
          <td class="value">' || public.html_escape(v_program) || '</td>
        </tr>
        <tr>
          <td class="label">Ticket Reference ID</td>
          <td class="value" style="font-family: monospace; font-size: 11px;">' || NEW.id || '</td>
        </tr>
      </table>

      <div class="qr-section">
        <div class="qr-title">Scan QR code at event entry</div>
        <div class="qr-image">
          <img src="' || v_qr_url || '" width="180" height="180" alt="Ticket QR Verification Code" style="display: block;" />
        </div>
      </div>
    </div>
  </div>
  <div class="footer">
    This is an automated boarding pass issued by the CCIS Student Council.<br>
    Do not share this QR code. Present it clearly on your mobile device at the registration desk.
  </div>
</body>
</html>';

    INSERT INTO public.email_queue (recipient_email, email_type, subject, html_body)
    VALUES (
      v_email,
      'ticket',
      '[Boarding Pass] ' || v_event_title || ' — ' || v_name,
      v_html
    );
  END IF;

  RETURN NEW;
END;
$$;


-- 1.7  queue_announcement_emails_fn()
-- Trigger on announcements AFTER INSERT OR UPDATE. SECURITY DEFINER needed.
CREATE OR REPLACE FUNCTION public.queue_announcement_emails_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user RECORD;
  v_html TEXT;
BEGIN
  -- Only queue when status transitions to published
  IF (TG_OP = 'INSERT' AND NEW.status = 'published') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'published' AND OLD.status != 'published') THEN
     
     FOR v_user IN 
       SELECT email, COALESCE(full_name, 'Student') as full_name
       FROM public.profiles 
       WHERE subscribe_announcements_events = true AND banned = false AND email IS NOT NULL
     LOOP
       v_html := '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #FAF7EA;
      color: #1A3C2E;
      margin: 0;
      padding: 40px 20px;
    }
    .card {
      max-width: 550px;
      background: #ffffff;
      border-radius: 24px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      margin: 0 auto;
      box-shadow: 0 4px 12px rgba(26,60,46,0.05);
    }
    .header {
      background-color: #1A3C2E;
      color: #ffffff;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .subheader {
      color: #F5B400;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-top: 5px;
      font-weight: bold;
    }
    .body {
      padding: 30px;
    }
    .ann-title {
      font-size: 22px;
      font-weight: 900;
      color: #1A3C2E;
      margin: 0 0 15px 0;
    }
    .category-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #1A3C2E;
      background-color: #F5B400;
      padding: 4px 8px;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    .content {
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      white-space: pre-wrap;
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #64748b;
      margin-top: 30px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="subheader">Latest Update</div>
      <h1>CCIS ANNOUNCEMENT</h1>
    </div>
    <div class="body">
      <div class="category-badge">' || public.html_escape(UPPER(NEW.category)) || '</div>
      <h2 class="ann-title">' || public.html_escape(NEW.title) || '</h2>
      <div class="content">' || public.html_escape(NEW.content) || '</div>
    </div>
  </div>
  <div class="footer">
    You are receiving this because you subscribed to email notifications from the CCIS Student Portal.<br>
    To unsubscribe, please update your account settings in the portal.
  </div>
</body>
</html>';

       INSERT INTO public.email_queue (recipient_email, email_type, subject, html_body)
       VALUES (
         v_user.email,
         'announcement',
         '[Announcement] ' || NEW.title,
         v_html
       );
     END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


-- 1.8  queue_event_emails_fn()
-- Trigger on events AFTER INSERT. SECURITY DEFINER needed.
CREATE OR REPLACE FUNCTION public.queue_event_emails_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user RECORD;
  v_html TEXT;
BEGIN
  FOR v_user IN 
    SELECT email, COALESCE(full_name, 'Student') as full_name
    FROM public.profiles 
    WHERE subscribe_announcements_events = true AND banned = false AND email IS NOT NULL
  LOOP
    v_html := '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #FAF7EA;
      color: #1A3C2E;
      margin: 0;
      padding: 40px 20px;
    }
    .card {
      max-width: 550px;
      background: #ffffff;
      border-radius: 24px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      margin: 0 auto;
      box-shadow: 0 4px 12px rgba(26,60,46,0.05);
    }
    .header {
      background-color: #1A3C2E;
      color: #ffffff;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .subheader {
      color: #F5B400;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-top: 5px;
      font-weight: bold;
    }
    .body {
      padding: 30px;
    }
    .event-title {
      font-size: 22px;
      font-weight: 900;
      color: #1A3C2E;
      margin: 0 0 15px 0;
    }
    .details-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
    }
    .details-grid td {
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
    }
    .label {
      color: #64748b;
      font-weight: 500;
      width: 40%;
    }
    .value {
      font-weight: 700;
      color: #1A3C2E;
      text-align: right;
    }
    .description {
      font-size: 13px;
      line-height: 1.6;
      color: #334155;
      margin-top: 20px;
      white-space: pre-wrap;
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #64748b;
      margin-top: 30px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="subheader">New Event Invitation</div>
      <h1>CCIS EVENT CENTER</h1>
    </div>
    <div class="body">
      <h2 class="event-title">' || public.html_escape(NEW.title) || '</h2>
      
      <table class="details-grid">
        <tr>
          <td class="label">Date</td>
          <td class="value">' || public.html_escape(NEW.event_date::TEXT) || '</td>
        </tr>
        <tr>
          <td class="label">Time</td>
          <td class="value">' || public.html_escape(COALESCE(NEW.event_time::TEXT, 'TBA')) || '</td>
        </tr>
        <tr>
          <td class="label">Venue</td>
          <td class="value">' || public.html_escape(COALESCE(NEW.location, 'TBA')) || '</td>
        </tr>
      </table>

      <div class="description">' || public.html_escape(COALESCE(NEW.description, 'No description provided.')) || '</div>
    </div>
  </div>
  <div class="footer">
    You are receiving this because you subscribed to email notifications from the CCIS Student Portal.<br>
    To unsubscribe, please update your account settings in the portal.
  </div>
</body>
</html>';

    INSERT INTO public.email_queue (recipient_email, email_type, subject, html_body)
    VALUES (
      v_user.email,
      'event',
      '[New Event] ' || NEW.title,
      v_html
    );
  END LOOP;

  RETURN NEW;
END;
$$;


-- 1.9  sync_profile_role_to_auth()
-- Trigger on profiles AFTER INSERT OR UPDATE OF role. SECURITY DEFINER needed
-- to write to auth.users.raw_app_meta_data.
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = 
    coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;


-- 1.10  populate_message_student_id()
-- Trigger on messages BEFORE INSERT. Not SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.populate_message_student_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  SELECT profile_id INTO NEW.student_id
  FROM public.conversations
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


-- 1.11  update_conversation_last_message_at()
-- Trigger on messages AFTER INSERT. Not SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.update_conversation_last_message_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


-- 1.12  register_for_event(uuid, uuid)
-- RPC callable by authenticated users. SECURITY DEFINER with explicit search_path.
-- Normalizing from SET search_path = public to SET search_path = ''
-- (all references already use public. prefix).
CREATE OR REPLACE FUNCTION public.register_for_event(p_event_id UUID, p_profile_id UUID)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_current_count INT;
  v_existing_registration public.event_registrations%ROWTYPE;
  v_new_registration public.event_registrations%ROWTYPE;
BEGIN
  -- Check if registration record already exists (cancelled or active)
  SELECT * INTO v_existing_registration
  FROM public.event_registrations
  WHERE event_id = p_event_id AND profile_id = p_profile_id;

  IF FOUND THEN
    IF v_existing_registration.status = 'cancelled' THEN
      -- Lock the event row to serialize capacity checks
      SELECT * INTO v_event
      FROM public.events
      WHERE id = p_event_id
      FOR UPDATE;

      -- Recompute live count inside the lock (excluding cancelled registrations)
      SELECT count(*) INTO v_current_count
      FROM public.event_registrations
      WHERE event_id = p_event_id
        AND status != 'cancelled';

      IF v_current_count >= v_event.registration_cap THEN
        RAISE EXCEPTION 'EVENT_FULL';
      END IF;

      -- Re-activate the cancelled registration to bypass unique constraint violation
      UPDATE public.event_registrations
      SET status = 'confirmed', registered_at = now()
      WHERE event_id = p_event_id AND profile_id = p_profile_id
      RETURNING * INTO v_new_registration;
      
      RETURN v_new_registration;
    ELSE
      RAISE EXCEPTION 'ALREADY_REGISTERED';
    END IF;
  END IF;

  -- Lock the event row for new registrations to serialize capacity checks
  SELECT * INTO v_event
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;

  -- Recompute live count inside the lock (excluding cancelled registrations)
  SELECT count(*) INTO v_current_count
  FROM public.event_registrations
  WHERE event_id = p_event_id
    AND status != 'cancelled';

  IF v_current_count >= v_event.registration_cap THEN
    RAISE EXCEPTION 'EVENT_FULL';
  END IF;

  -- Insert new registration
  INSERT INTO public.event_registrations (event_id, profile_id, status)
  VALUES (p_event_id, p_profile_id, 'confirmed')
  RETURNING * INTO v_new_registration;

  RETURN v_new_registration;
END;
$$;


-- ============================================================
-- CATEGORY 2: PUBLIC BUCKET ALLOWS LISTING
-- ============================================================
-- Fix: Replace open SELECT policies on storage.objects with
-- authenticated-only admin SELECT. Public CDN URLs still work
-- without RLS (they bypass storage.objects policies entirely).
-- This prevents anonymous directory listing of bucket contents.
-- ============================================================


-- 2.1  gallery-images bucket
DROP POLICY IF EXISTS "Allow public select on gallery-images storage" ON storage.objects;
CREATE POLICY "Restrict select on gallery-images storage" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'gallery-images' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
    )
  );


-- 2.2  bukas-kaban-reports bucket
DROP POLICY IF EXISTS "Allow public select on bukas-kaban-reports storage" ON storage.objects;
CREATE POLICY "Restrict select on bukas-kaban-reports storage" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'bukas-kaban-reports' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
    )
  );


-- 2.3  patch-thumbnails bucket
DROP POLICY IF EXISTS "Allow public select on patch-thumbnails storage" ON storage.objects;
CREATE POLICY "Restrict select on patch-thumbnails storage" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'patch-thumbnails' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
    )
  );


-- 2.4  patch-videos bucket
DROP POLICY IF EXISTS "Allow public select on patch-videos storage" ON storage.objects;
CREATE POLICY "Restrict select on patch-videos storage" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'patch-videos' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
    )
  );


-- 2.5  banners bucket
DROP POLICY IF EXISTS "Allow public read access to banners" ON storage.objects;
CREATE POLICY "Restrict select on banners storage" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'banners' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
    )
  );


-- ============================================================
-- CATEGORY 3: SECURITY DEFINER FUNCTION EXPOSURE
-- ============================================================
-- Fix: Revoke EXECUTE from anon and public roles for all
-- SECURITY DEFINER functions. Only grant to the roles that
-- actually need to call them.
-- ============================================================


-- 3.1  get_user_role() — Used in RLS policies by authenticated users
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM public;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;


-- 3.2  handle_new_user() — Trigger-only, no direct API calls
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;


-- 3.3  dequeue_emails(integer) — Called by Edge Function via service_role
REVOKE EXECUTE ON FUNCTION public.dequeue_emails(INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dequeue_emails(INTEGER) FROM public;
REVOKE EXECUTE ON FUNCTION public.dequeue_emails(INTEGER) FROM authenticated;


-- 3.4  queue_ticket_email_fn() — Trigger-only
REVOKE EXECUTE ON FUNCTION public.queue_ticket_email_fn() FROM anon;
REVOKE EXECUTE ON FUNCTION public.queue_ticket_email_fn() FROM public;
REVOKE EXECUTE ON FUNCTION public.queue_ticket_email_fn() FROM authenticated;


-- 3.5  queue_announcement_emails_fn() — Trigger-only
REVOKE EXECUTE ON FUNCTION public.queue_announcement_emails_fn() FROM anon;
REVOKE EXECUTE ON FUNCTION public.queue_announcement_emails_fn() FROM public;
REVOKE EXECUTE ON FUNCTION public.queue_announcement_emails_fn() FROM authenticated;


-- 3.6  queue_event_emails_fn() — Trigger-only
REVOKE EXECUTE ON FUNCTION public.queue_event_emails_fn() FROM anon;
REVOKE EXECUTE ON FUNCTION public.queue_event_emails_fn() FROM public;
REVOKE EXECUTE ON FUNCTION public.queue_event_emails_fn() FROM authenticated;


-- 3.7  sync_profile_role_to_auth() — Trigger-only
REVOKE EXECUTE ON FUNCTION public.sync_profile_role_to_auth() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_profile_role_to_auth() FROM public;
REVOKE EXECUTE ON FUNCTION public.sync_profile_role_to_auth() FROM authenticated;


-- 3.8  register_for_event(uuid, uuid) — Authenticated users call this RPC
-- Already locked down in 23_event_registration_rpc.sql, but ensure revokes are present
REVOKE EXECUTE ON FUNCTION public.register_for_event(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.register_for_event(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.register_for_event(UUID, UUID) TO authenticated;


-- ============================================================
-- CATEGORY 4: AUTH LEAKED PASSWORD PROTECTION (ADVISORY)
-- ============================================================
-- This setting CANNOT be changed via SQL. You must enable it
-- manually in the Supabase Dashboard:
--
--   1. Go to: Authentication → Settings (or Providers → Email)
--   2. Under Security, toggle ON "Leaked Password Protection"
--   3. Save
--
-- This uses the HaveIBeenPwned database to reject passwords
-- that appear in known data breaches.
-- ============================================================
