-- CCIS PLATFORM BACKEND: ADD OFFICERS QUOTE COLUMN
-- ============================================================
-- Run this in your Supabase Dashboard SQL Editor to update
-- the public.officers table structure to include a custom quote.

ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS quote TEXT;
