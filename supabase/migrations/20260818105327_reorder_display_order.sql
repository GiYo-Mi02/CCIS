-- Keep display-order swaps atomic and serialize reorder operations per list.

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
BEGIN
  IF public.get_user_role() <> 'devcom_head' THEN
    RAISE EXCEPTION 'Only devcom_head users can reorder officers';
  END IF;

  IF p_direction NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'Invalid reorder direction';
  END IF;

  SELECT *
  INTO v_officer
  FROM public.officers
  WHERE id = p_officer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Officer not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('officers:display_order'));

  SELECT *
  INTO v_officer
  FROM public.officers
  WHERE id = p_officer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Officer was removed while reordering';
  END IF;

  IF p_direction = 'up' THEN
    SELECT *
    INTO v_neighbor
    FROM public.officers
    WHERE coalesce(term, '2026-2027') = coalesce(v_officer.term, '2026-2027')
      AND coalesce(organization, 'Student Council') = coalesce(v_officer.organization, 'Student Council')
      AND display_order < v_officer.display_order
    ORDER BY display_order DESC
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT *
    INTO v_neighbor
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

  UPDATE public.officers
  SET display_order = v_neighbor.display_order
  WHERE id = v_officer.id;

  UPDATE public.officers
  SET display_order = v_officer.display_order
  WHERE id = v_neighbor.id;
END;
$$;

REVOKE ALL ON FUNCTION public.swap_officer_order(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.swap_officer_order(UUID, TEXT) TO authenticated;

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
BEGIN
  IF public.get_user_role() NOT IN ('devcom_head', 'comm_content') THEN
    RAISE EXCEPTION 'Only content administrators can reorder FAQs';
  END IF;

  IF p_direction NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'Invalid reorder direction';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('faqs:display_order'));

  SELECT *
  INTO v_faq
  FROM public.faqs
  WHERE id = p_faq_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAQ not found';
  END IF;

  IF p_direction = 'up' THEN
    SELECT *
    INTO v_neighbor
    FROM public.faqs
    WHERE display_order < v_faq.display_order
    ORDER BY display_order DESC
    LIMIT 1
    FOR UPDATE;
  ELSE
    SELECT *
    INTO v_neighbor
    FROM public.faqs
    WHERE display_order > v_faq.display_order
    ORDER BY display_order ASC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.faqs
  SET display_order = v_neighbor.display_order
  WHERE id = v_faq.id;

  UPDATE public.faqs
  SET display_order = v_faq.display_order
  WHERE id = v_neighbor.id;
END;
$$;

REVOKE ALL ON FUNCTION public.swap_faq_order(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.swap_faq_order(UUID, TEXT) TO authenticated;
