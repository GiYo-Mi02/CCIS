BEGIN;

ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gallery_items_public_read ON public.gallery_items;
DROP POLICY IF EXISTS gallery_items_user_insert ON public.gallery_items;
DROP POLICY IF EXISTS gallery_items_user_delete ON public.gallery_items;
DROP POLICY IF EXISTS gallery_items_admin_all ON public.gallery_items;
DROP POLICY IF EXISTS "Allow public select on gallery_items" ON public.gallery_items;
DROP POLICY IF EXISTS "Allow admin write on gallery_items" ON public.gallery_items;

CREATE POLICY "Allow public select on gallery_items" ON public.gallery_items
  FOR SELECT
  USING (true);

CREATE POLICY "Allow admin write on gallery_items" ON public.gallery_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN (
          'devcom_head',
          'officer',
          'comm_content',
          'comm_registration',
          'comm_photobooth'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN (
          'devcom_head',
          'officer',
          'comm_content',
          'comm_registration',
          'comm_photobooth'
        )
    )
  );

COMMIT;
