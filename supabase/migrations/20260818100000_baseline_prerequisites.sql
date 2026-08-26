-- ============================================================
-- CANONICAL BASELINE PREREQUISITES
-- ============================================================
-- This is the authoritative starting point for the versioned migration chain.
-- It intentionally contains schema only: no production seed data, destructive
-- cleanup, permissive legacy policies, or environment secrets.
--
-- Existing projects converge through IF NOT EXISTS statements and the final
-- audit-remediation migration. Fresh projects have every relation and column
-- required by the later migrations before those migrations execute.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.committees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  responsibilities TEXT[] NOT NULL DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  head_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  student_number TEXT,
  year_level INTEGER,
  program TEXT,
  section TEXT,
  contact_number TEXT,
  role TEXT NOT NULL DEFAULT 'student',
  position TEXT,
  committee_id UUID REFERENCES public.committees(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  profile_complete BOOLEAN NOT NULL DEFAULT false,
  subscribe_announcements_events BOOLEAN NOT NULL DEFAULT false,
  email_subscription_decided BOOLEAN NOT NULL DEFAULT false,
  privacy_agreed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  banned BOOLEAN NOT NULL DEFAULT false,
  banned_until TIMESTAMPTZ,
  attendance_qr_code TEXT,
  attendance_qr_generated_at TIMESTAMPTZ,
  last_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_role_check CHECK (
    role IN ('student', 'officer', 'devcom_head', 'comm_content', 'comm_registration', 'comm_photobooth')
  ),
  CONSTRAINT profiles_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  committee_id UUID REFERENCES public.committees(id) ON DELETE SET NULL,
  photo_url TEXT,
  email TEXT,
  quote TEXT,
  term TEXT NOT NULL DEFAULT '2026-2027',
  organization TEXT NOT NULL DEFAULT 'Student Council',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'draft',
  pinned BOOLEAN NOT NULL DEFAULT false,
  banner_url TEXT,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT announcements_status_check CHECK (status IN ('draft', 'published'))
);

CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  event_type TEXT NOT NULL DEFAULT 'general',
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  registration_required BOOLEAN NOT NULL DEFAULT false,
  registration_cap INTEGER,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  banner_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT events_registration_cap_check CHECK (registration_cap IS NULL OR registration_cap >= 0)
);

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmed',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attended_at TIMESTAMPTZ,
  CONSTRAINT event_registrations_status_check CHECK (status IN ('confirmed', 'pending', 'cancelled', 'attended')),
  CONSTRAINT event_registrations_event_profile_key UNIQUE (event_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  logical_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_state TEXT NOT NULL DEFAULT 'queued',
  provider_idempotency_key TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_expires_at TIMESTAMPTZ,
  lease_worker_id TEXT,
  dead_lettered_at TIMESTAMPTZ,
  CONSTRAINT email_queue_attempts_check CHECK (attempts >= 0)
);

CREATE TABLE IF NOT EXISTS public.theme_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_name TEXT NOT NULL,
  primary_color TEXT NOT NULL DEFAULT '#123524',
  accent_color TEXT NOT NULL DEFAULT '#FFBC00',
  canvas_color TEXT NOT NULL DEFAULT '#FAF7EA',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL,
  content TEXT NOT NULL,
  read_by_student BOOLEAN NOT NULL DEFAULT false,
  read_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT messages_sender_role_check CHECK (sender_role IN ('student', 'admin'))
);

CREATE TABLE IF NOT EXISTS public.concerns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'Verification',
  subject TEXT NOT NULL DEFAULT 'Account Verification Concern',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  assigned_committee_id UUID REFERENCES public.committees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT concerns_status_check CHECK (status IN ('new', 'in_progress', 'resolved'))
);

CREATE TABLE IF NOT EXISTS public.concern_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concern_id UUID NOT NULL REFERENCES public.concerns(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gallery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  posted_by TEXT,
  image_url TEXT NOT NULL,
  thumbnails TEXT[] NOT NULL DEFAULT '{}',
  aspect_ratio TEXT,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gallery_items_aspect_ratio_check CHECK (aspect_ratio IS NULL OR aspect_ratio IN ('portrait', 'landscape', 'square'))
);

CREATE TABLE IF NOT EXISTS public.transparency_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  caption TEXT NOT NULL,
  semester TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  file_size_label TEXT NOT NULL,
  total_budget_requested NUMERIC NOT NULL DEFAULT 0,
  total_expenses NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patch_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  facebook_permalink TEXT,
  video_url TEXT,
  thumbnail_url TEXT NOT NULL,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Kept only for backward-compatible inventory. Network-wide bans are retired;
-- authorization uses per-profile banned/banned_until fields.
CREATE TABLE IF NOT EXISTS public.ip_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  reason TEXT,
  banned_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'committees', 'profiles', 'officers', 'faqs', 'announcements', 'events',
    'event_registrations', 'email_queue', 'theme_settings', 'conversations',
    'messages', 'concerns', 'concern_replies', 'gallery_items',
    'transparency_reports', 'patch_videos', 'ip_bans'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.html_escape(text_to_escape TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT replace(replace(replace(replace(replace(text_to_escape,
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;

REVOKE ALL ON FUNCTION public.html_escape(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.html_escape(TEXT) TO authenticated, service_role;
