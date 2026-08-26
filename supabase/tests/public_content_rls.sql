BEGIN;

INSERT INTO public.faqs (question, answer, is_active, display_order)
VALUES
  ('Public FAQ test', 'Visible answer', true, 1001),
  ('Draft FAQ test', 'Hidden answer', false, 1002);

INSERT INTO public.announcements (title, content, status)
VALUES
  ('Published announcement test', 'Visible content', 'published'),
  ('Draft announcement test', 'Hidden content', 'draft');

INSERT INTO public.theme_settings (
  preset_name, primary_color, accent_color, canvas_color, is_active
) VALUES
  ('Active theme test', '#123524', '#FFBC00', '#FAF7EA', true),
  ('Inactive theme test', '#000000', '#FFFFFF', '#EEEEEE', false);

INSERT INTO public.photobooth_gallery (image_url, featured)
VALUES
  ('https://example.invalid/featured.webp', true),
  ('https://example.invalid/private.webp', false);

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';

DO $public_reads$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count FROM public.faqs WHERE question LIKE '%FAQ test';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'anon FAQ filtering returned %, expected 1', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.announcements WHERE title LIKE '%announcement test';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'anon announcement filtering returned %, expected 1', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.theme_settings WHERE preset_name LIKE '%theme test';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'anon theme filtering returned %, expected 1', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.photobooth_gallery
  WHERE image_url LIKE 'https://example.invalid/%';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'anon photobooth filtering returned %, expected 1', v_count;
  END IF;
END;
$public_reads$;

ROLLBACK;
