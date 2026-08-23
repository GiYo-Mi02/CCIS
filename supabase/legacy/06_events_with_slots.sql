-- ============================================================
-- CREATE VIEW: EVENTS WITH SLOTS
-- ============================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- to create the public.events_with_slots view which aggregates
-- registered counts and computes remaining slot capacity.

CREATE OR REPLACE VIEW public.events_with_slots AS
SELECT
  e.*,
  COALESCE(COUNT(r.id) FILTER (WHERE r.status = 'confirmed'), 0) AS registered_count,
  CASE
    WHEN e.registration_cap IS NOT NULL
    THEN e.registration_cap - COALESCE(COUNT(r.id) FILTER (WHERE r.status = 'confirmed'), 0)
    ELSE NULL
  END AS slots_left
FROM public.events e
LEFT JOIN public.event_registrations r ON r.event_id = e.id
GROUP BY e.id;
