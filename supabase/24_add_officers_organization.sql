-- CCIS PLATFORM BACKEND: ADD OFFICERS ORGANIZATION COLUMN
-- ============================================================
-- Run this in your Supabase Dashboard SQL Editor (https://supabase.com/dashboard)
-- to update the public.officers table structure to support multiple organisations.

ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS organization TEXT DEFAULT 'Student Council';

-- Backfill any existing officers to 'Student Council' if they don't have it
UPDATE public.officers SET organization = 'Student Council' WHERE organization IS NULL;
