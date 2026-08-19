BEGIN;

-- Capacity is consumed by every registration that is not cancelled.
-- Drop first because events.e.* gained columns after the original view was created.
DROP VIEW IF EXISTS public.events_with_slots;

CREATE VIEW public.events_with_slots AS
SELECT
  e.*,
  COALESCE(COUNT(r.id) FILTER (WHERE r.status != 'cancelled'), 0) AS registered_count,
  CASE
    WHEN e.registration_cap IS NOT NULL
    THEN e.registration_cap - COALESCE(COUNT(r.id) FILTER (WHERE r.status != 'cancelled'), 0)
    ELSE NULL
  END AS slots_left
FROM public.events e
LEFT JOIN public.event_registrations r ON r.event_id = e.id
GROUP BY e.id;

-- The public registration page reads this view without an authenticated session.
GRANT SELECT ON public.events_with_slots TO anon, authenticated;

COMMIT;
