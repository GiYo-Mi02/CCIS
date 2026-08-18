-- Migration 32: Add event_type column to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'general';

COMMENT ON COLUMN public.events.event_type IS 'Classification: competition (requires participant registration) vs general (uses Universal Audience QR pass)';
