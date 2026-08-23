-- CCIS PLATFORM BACKEND: ADD COMMITTEE HEAD_NAME COLUMN
-- ============================================================
-- Run this in your Supabase Dashboard SQL Editor (https://supabase.com/dashboard)
-- to update the public.committees table structure to include a head_name.

ALTER TABLE public.committees ADD COLUMN IF NOT EXISTS head_name TEXT;
