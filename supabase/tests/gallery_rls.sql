BEGIN;

INSERT INTO public.gallery_items (title, category, image_url)
VALUES ('RLS test item', 'test', 'https://example.invalid/gallery-rls-test');

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';

DO $gallery_rls$
DECLARE
  v_rows integer;
BEGIN
  BEGIN
    INSERT INTO public.gallery_items (title, category, image_url)
    VALUES ('Anonymous RLS test', 'test', 'https://example.invalid/gallery-rls-anon-insert');
    RAISE EXCEPTION 'anonymous gallery INSERT was allowed';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  UPDATE public.gallery_items
  SET image_url = 'https://example.invalid/gallery-rls-anon-update'
  WHERE image_url = 'https://example.invalid/gallery-rls-test';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'anonymous gallery UPDATE was allowed';
  END IF;

  DELETE FROM public.gallery_items
  WHERE image_url = 'https://example.invalid/gallery-rls-test';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'anonymous gallery DELETE was allowed';
  END IF;
END;
$gallery_rls$;

ROLLBACK;
