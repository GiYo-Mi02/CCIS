create view "public"."events_with_slots" with (security_invoker=true) AS  SELECT e.id,
    e.title,
    e.description,
    e.category,
    e.event_date,
    e.event_time,
    e.location,
    e.registration_required,
    e.registration_cap,
    e.created_by,
    e.created_at,
    e.banner_url,
    e.event_type,
    COALESCE(count(r.id) FILTER (WHERE (r.status <> 'cancelled'::text)), (0)::bigint) AS registered_count,
        CASE
            WHEN (e.registration_cap IS NOT NULL) THEN (e.registration_cap - COALESCE(count(r.id) FILTER (WHERE (r.status <> 'cancelled'::text)), (0)::bigint))
            ELSE NULL::bigint
        END AS slots_left
   FROM (public.events e
     LEFT JOIN public.event_registrations r ON ((r.event_id = e.id)))
  GROUP BY e.id;

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."events_with_slots" to "anon", "authenticated", "postgres", "service_role";
