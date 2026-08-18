-- Repair duplicate positions before enforcing the intended list scopes.

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY coalesce(term, '2026-2027'), coalesce(organization, 'Student Council')
      ORDER BY display_order NULLS LAST, created_at, id
    )::integer AS repaired_order
  FROM public.officers
)
UPDATE public.officers AS officers
SET display_order = ranked.repaired_order
FROM ranked
WHERE officers.id = ranked.id;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      ORDER BY display_order NULLS LAST, created_at, id
    )::smallint AS repaired_order
  FROM public.faqs
)
UPDATE public.faqs AS faqs
SET display_order = ranked.repaired_order
FROM ranked
WHERE faqs.id = ranked.id;

CREATE UNIQUE INDEX IF NOT EXISTS officers_display_order_scope_idx
  ON public.officers (
    (coalesce(term, '2026-2027')),
    (coalesce(organization, 'Student Council')),
    display_order
  );

CREATE UNIQUE INDEX IF NOT EXISTS faqs_display_order_idx
  ON public.faqs (display_order);

-- The temporary position keeps the unique indexes valid during a swap.

CREATE OR REPLACE FUNCTION public.swap_officer_order(
  p_officer_id UUID,
  p_direction TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_officer public.officers%ROWTYPE;
  v_neighbor public.officers%ROWTYPE;
  v_temp_order INTEGER;
BEGIN
  IF public.get_user_role() <> 'devcom_head' THEN
    RAISE EXCEPTION 'Only devcom_head users can reorder officers';
  END IF;

  IF p_direction NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'Invalid reorder direction';
  END IF;

  SELECT * INTO v_officer
  FROM public.officers
  WHERE id = p_officer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Officer not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('officers:display_order'));

  SELECT * INTO v_officer
  FROM public.officers
  WHERE id = p_officer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Officer was removed while reordering';
  END IF;

  IF p_direction = 'up' THEN
    SELECT * INTO v_neighbor
    FROM public.officers
    WHERE coalesce(term, '2026-2027') = coalesce(v_officer.term, '2026-2027')
      AND coalesce(organization, 'Student Council') = coalesce(v_officer.organization, 'Student Council')
      AND display_order < v_officer.display_order
    ORDER BY display_order DESC
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT * INTO v_neighbor
    FROM public.officers
    WHERE coalesce(term, '2026-2027') = coalesce(v_officer.term, '2026-2027')
      AND coalesce(organization, 'Student Council') = coalesce(v_officer.organization, 'Student Council')
      AND display_order > v_officer.display_order
    ORDER BY display_order ASC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(MIN(display_order), 0) - 1 INTO v_temp_order
  FROM public.officers
  WHERE coalesce(term, '2026-2027') = coalesce(v_officer.term, '2026-2027')
    AND coalesce(organization, 'Student Council') = coalesce(v_officer.organization, 'Student Council');

  UPDATE public.officers
  SET display_order = v_temp_order
  WHERE id = v_neighbor.id;

  UPDATE public.officers
  SET display_order = v_neighbor.display_order
  WHERE id = v_officer.id;

  UPDATE public.officers
  SET display_order = v_officer.display_order
  WHERE id = v_neighbor.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.swap_faq_order(
  p_faq_id UUID,
  p_direction TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_faq public.faqs%ROWTYPE;
  v_neighbor public.faqs%ROWTYPE;
  v_temp_order INTEGER;
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'comm_content') THEN
    RAISE EXCEPTION 'Only content administrators can reorder FAQs';
  END IF;

  IF p_direction NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'Invalid reorder direction';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('faqs:display_order'));

  SELECT * INTO v_faq
  FROM public.faqs
  WHERE id = p_faq_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAQ not found';
  END IF;

  IF p_direction = 'up' THEN
    SELECT * INTO v_neighbor
    FROM public.faqs
    WHERE display_order < v_faq.display_order
    ORDER BY display_order DESC
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT * INTO v_neighbor
    FROM public.faqs
    WHERE display_order > v_faq.display_order
    ORDER BY display_order ASC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(MIN(display_order), 0) - 1 INTO v_temp_order
  FROM public.faqs;

  UPDATE public.faqs
  SET display_order = v_temp_order::smallint
  WHERE id = v_neighbor.id;

  UPDATE public.faqs
  SET display_order = v_neighbor.display_order
  WHERE id = v_faq.id;

  UPDATE public.faqs
  SET display_order = v_faq.display_order
  WHERE id = v_neighbor.id;
END;
$$;
