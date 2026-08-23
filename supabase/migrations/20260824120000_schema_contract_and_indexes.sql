-- ============================================================
-- SUPABASE STANDARDS AUDIT: schema contract, indexes, and private state
-- Findings 2, 15, 16, 19, 20, 21, 22
-- ============================================================

CREATE SCHEMA IF NOT EXISTS internal;
REVOKE ALL ON SCHEMA internal FROM PUBLIC, anon, authenticated;

-- Converge older live databases on the canonical application contract.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS committee_id UUID REFERENCES public.committees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attendance_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS attendance_qr_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_agreed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscribe_announcements_events BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_subscription_decided BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS registration_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registration_cap INTEGER,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS banner_url TEXT;

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ;

ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS logical_key TEXT,
  ADD COLUMN IF NOT EXISTS delivery_state TEXT NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS provider_idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_worker_id TEXT,
  ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;

ALTER TABLE public.email_queue DROP CONSTRAINT IF EXISTS email_queue_status_check;
ALTER TABLE public.email_queue DROP CONSTRAINT IF EXISTS email_queue_email_type_check;
ALTER TABLE public.email_queue
  ADD CONSTRAINT email_queue_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter', 'delivery_unknown')) NOT VALID;
ALTER TABLE public.email_queue VALIDATE CONSTRAINT email_queue_status_check;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sender_role TEXT,
  ADD COLUMN IF NOT EXISTS read_by_student BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_by_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'is_admin'
  ) THEN
    EXECUTE $sql$
      UPDATE public.messages
      SET sender_role = CASE WHEN COALESCE(is_admin, false) THEN 'admin' ELSE 'student' END
      WHERE sender_role IS NULL
    $sql$;
  ELSE
    UPDATE public.messages
    SET sender_role = 'student'
    WHERE sender_role IS NULL;
  END IF;
END;
$$;

ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS posted_by TEXT,
  ADD COLUMN IF NOT EXISTS thumbnails TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS aspect_ratio TEXT,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;

UPDATE public.gallery_items
SET title = COALESCE(NULLIF(title, ''), 'Untitled gallery item'),
    category = COALESCE(NULLIF(category, ''), 'General')
WHERE title IS NULL OR category IS NULL;

ALTER TABLE public.gallery_items
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN category SET NOT NULL;

-- Stable logical keys make all queue producers idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS email_queue_logical_key_idx
  ON public.email_queue (logical_key)
  WHERE logical_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS email_queue_dequeue_idx
  ON public.email_queue (status, scheduled_for, created_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS email_queue_profile_id_idx ON public.email_queue (profile_id);
CREATE INDEX IF NOT EXISTS event_registrations_profile_id_idx ON public.event_registrations (profile_id);
CREATE INDEX IF NOT EXISTS event_registrations_event_status_idx ON public.event_registrations (event_id, status);
CREATE INDEX IF NOT EXISTS gallery_items_profile_id_idx ON public.gallery_items (profile_id);
CREATE INDEX IF NOT EXISTS messages_student_id_idx ON public.messages (student_id);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_admin_unread_idx ON public.messages (conversation_id)
  WHERE sender_role = 'student' AND read_by_admin = false;
CREATE INDEX IF NOT EXISTS concerns_profile_id_idx ON public.concerns (profile_id);
CREATE INDEX IF NOT EXISTS conversations_profile_id_idx ON public.conversations (profile_id);
CREATE INDEX IF NOT EXISTS profiles_status_idx ON public.profiles (status);
CREATE INDEX IF NOT EXISTS profiles_committee_id_idx ON public.profiles (committee_id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_attendance_qr_code_idx
  ON public.profiles (attendance_qr_code)
  WHERE attendance_qr_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_student_number_idx
  ON public.profiles (student_number)
  WHERE student_number IS NOT NULL;

-- Private allowlist for the documented non-institutional administrator exception.
CREATE TABLE IF NOT EXISTS internal.admin_bypass_emails (
  email TEXT PRIMARY KEY CHECK (email = lower(email)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO internal.admin_bypass_emails (email)
VALUES
  ('ggiojoshua2006@gmail.com'),
  ('devcommgio2006@gmail.com'),
  ('cciscsc.dev@gmail.com')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION internal.is_allowed_identity(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    lower(COALESCE(p_email, '')) LIKE '%@umak.edu.ph'
    OR EXISTS (
      SELECT 1
      FROM internal.admin_bypass_emails AS allowed
      WHERE allowed.email = lower(COALESCE(p_email, ''))
    );
$$;

CREATE OR REPLACE FUNCTION internal.is_admin_bypass_email(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM internal.admin_bypass_emails AS allowed
    WHERE allowed.email = lower(COALESCE(p_email, ''))
  );
$$;

-- Database-backed rate limits are shared by RPCs and Edge Functions.
CREATE TABLE IF NOT EXISTS internal.rate_limits (
  operation TEXT NOT NULL,
  subject TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (operation, subject)
);

CREATE OR REPLACE FUNCTION internal.consume_rate_limit(
  p_operation TEXT,
  p_subject TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row internal.rate_limits%ROWTYPE;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_retry_after INTEGER := 0;
BEGIN
  IF NULLIF(btrim(p_operation), '') IS NULL
     OR NULLIF(btrim(p_subject), '') IS NULL
     OR p_limit < 1
     OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid rate-limit configuration';
  END IF;

  INSERT INTO internal.rate_limits AS limits (
    operation, subject, window_started_at, request_count, updated_at
  ) VALUES (
    p_operation, p_subject, v_now, 1, v_now
  )
  ON CONFLICT (operation, subject) DO UPDATE
  SET
    window_started_at = CASE
      WHEN limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now THEN v_now
      ELSE limits.window_started_at
    END,
    request_count = CASE
      WHEN limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now THEN 1
      ELSE limits.request_count + 1
    END,
    updated_at = v_now
  RETURNING * INTO v_row;

  IF v_row.request_count > p_limit THEN
    v_retry_after := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (
        v_row.window_started_at + make_interval(secs => p_window_seconds) - v_now
      )))::INTEGER
    );
  END IF;

  RETURN v_retry_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit(
  p_operation TEXT,
  p_subject TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT internal.consume_rate_limit(p_operation, p_subject, p_limit, p_window_seconds);
$$;

REVOKE ALL ON FUNCTION public.consume_edge_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_edge_rate_limit(TEXT, TEXT, INTEGER, INTEGER)
  TO service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA internal FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA internal FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA internal TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA internal TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA internal TO service_role;

-- Remove the obsolete, lease-less public dequeue overload permanently.
DROP FUNCTION IF EXISTS public.dequeue_emails(INTEGER);
REVOKE ALL ON FUNCTION public.dequeue_emails(INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dequeue_emails(INTEGER, TEXT) TO service_role;

COMMENT ON COLUMN public.gallery_items.title IS 'Canonical display title. Legacy frame_id/index_label columns, if present on an existing project, are retained pending live data inventory.';
COMMENT ON COLUMN public.events.registration_cap IS 'NULL means unlimited capacity; non-null values are enforced transactionally by register_for_event().';
