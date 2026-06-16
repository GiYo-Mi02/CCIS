-- ============================================================
-- CCIS PLATFORM BACKEND: DIRECT MESSAGING PLATFORM SCHEMAS
-- ============================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- to create the tables, define index performance, trigger events,
-- and apply strict role-based RLS access control.

-- ============================================================
-- 1. CONVERSATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS conversations_select_own ON public.conversations;
DROP POLICY IF EXISTS conversations_insert_own ON public.conversations;
DROP POLICY IF EXISTS conversations_admin_select ON public.conversations;

-- Conversations RLS Policies
-- Students can only read their own conversation thread
CREATE POLICY conversations_select_own ON public.conversations
  FOR SELECT USING (auth.uid() = profile_id);

-- Students can insert their own conversation thread
CREATE POLICY conversations_insert_own ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- DevCom Heads and Officers can view all student conversations
CREATE POLICY conversations_admin_select ON public.conversations
  FOR SELECT USING (public.get_user_role() in ('devcom_head','officer'));


-- ============================================================
-- 2. MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('student','admin')),
  content TEXT NOT NULL,
  read_by_student BOOLEAN DEFAULT false,
  read_by_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS messages_select_own ON public.messages;
DROP POLICY IF EXISTS messages_insert_own ON public.messages;
DROP POLICY IF EXISTS messages_admin_select ON public.messages;
DROP POLICY IF EXISTS messages_admin_insert ON public.messages;

-- Messages RLS Policies
-- Students can only read messages belonging to their conversation
CREATE POLICY messages_select_own ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.profile_id = auth.uid()
    )
  );

-- Students can only insert student-role messages into their own conversation
CREATE POLICY messages_insert_own ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'student'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.profile_id = auth.uid()
    )
  );

-- DevCom Heads and Officers can view all messages in any conversation
CREATE POLICY messages_admin_select ON public.messages
  FOR SELECT USING (public.get_user_role() in ('devcom_head','officer'));

-- DevCom Heads and Officers can insert admin-role replies in any conversation
CREATE POLICY messages_admin_insert ON public.messages
  FOR INSERT WITH CHECK (
    sender_role = 'admin'
    AND public.get_user_role() in ('devcom_head','officer')
  );


-- ============================================================
-- 3. INDEXES & PERFORMANCE OPTIMIZATIONS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);


-- ============================================================
-- 4. AUTOMATIC UPDATE LAST_MESSAGE_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_conversation_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation_last_message_at ON public.messages;
CREATE TRIGGER trigger_update_conversation_last_message_at
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message_at();
