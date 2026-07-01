-- CCIS PLATFORM BACKEND: ADD OFFICERS ACADEMIC YEAR (TERM) COLUMN
-- ============================================================
-- Run this in your Supabase Dashboard SQL Editor (https://supabase.com/dashboard)
-- to update the public.officers table structure to support historical terms.

ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS term TEXT DEFAULT '2026-2027';

-- Backfill any existing officers to the current term '2026-2027' if they don't have it
UPDATE public.officers SET term = '2026-2027' WHERE term IS NULL;
