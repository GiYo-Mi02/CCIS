-- Keep record mutations aligned with the media optimizer's resource roles.
DROP POLICY IF EXISTS gallery_staff_insert ON public.gallery_items;
DROP POLICY IF EXISTS gallery_staff_update ON public.gallery_items;
DROP POLICY IF EXISTS gallery_staff_delete ON public.gallery_items;

CREATE POLICY gallery_staff_insert ON public.gallery_items
FOR INSERT TO authenticated
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_photobooth'));

CREATE POLICY gallery_staff_update ON public.gallery_items
FOR UPDATE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_photobooth'))
WITH CHECK ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_photobooth'));

CREATE POLICY gallery_staff_delete ON public.gallery_items
FOR DELETE TO authenticated
USING ((SELECT public.get_user_role()) IN ('devcom_head', 'comm_photobooth'));

-- Storage policies are bucket-wide in the existing schema, so constrain the
-- officer prefix separately from general gallery media.
DROP POLICY IF EXISTS ccis_staff_assets_insert ON storage.objects;
DROP POLICY IF EXISTS ccis_staff_assets_update ON storage.objects;
DROP POLICY IF EXISTS ccis_staff_assets_delete ON storage.objects;

CREATE POLICY ccis_staff_assets_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  (
    bucket_id = 'gallery-images'
    AND (
      (name LIKE 'officers/%' AND (SELECT public.get_user_role()) = 'devcom_head')
      OR (name NOT LIKE 'officers/%' AND (SELECT public.get_user_role()) IN ('devcom_head', 'comm_photobooth'))
    )
  )
  OR (bucket_id = 'banners' AND (SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'))
  OR (bucket_id = 'bukas-kaban-reports' AND (SELECT public.get_user_role()) IN ('devcom_head', 'officer'))
  OR (bucket_id IN ('patch-thumbnails', 'patch-videos') AND (SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'))
  OR (bucket_id = 'ccis-private-drafts' AND (SELECT public.get_user_role()) IN (
    'devcom_head', 'officer', 'comm_content', 'comm_photobooth'
  ))
);

CREATE POLICY ccis_staff_assets_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  (
    bucket_id = 'gallery-images'
    AND (
      (name LIKE 'officers/%' AND (SELECT public.get_user_role()) = 'devcom_head')
      OR (name NOT LIKE 'officers/%' AND (SELECT public.get_user_role()) IN ('devcom_head', 'comm_photobooth'))
    )
  )
  OR (bucket_id = 'banners' AND (SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'))
  OR (bucket_id = 'bukas-kaban-reports' AND (SELECT public.get_user_role()) IN ('devcom_head', 'officer'))
  OR (bucket_id IN ('patch-thumbnails', 'patch-videos') AND (SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'))
  OR (bucket_id = 'ccis-private-drafts' AND (SELECT public.get_user_role()) IN (
    'devcom_head', 'officer', 'comm_content', 'comm_photobooth'
  ))
)
WITH CHECK (
  (
    bucket_id = 'gallery-images'
    AND (
      (name LIKE 'officers/%' AND (SELECT public.get_user_role()) = 'devcom_head')
      OR (name NOT LIKE 'officers/%' AND (SELECT public.get_user_role()) IN ('devcom_head', 'comm_photobooth'))
    )
  )
  OR (bucket_id = 'banners' AND (SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'))
  OR (bucket_id = 'bukas-kaban-reports' AND (SELECT public.get_user_role()) IN ('devcom_head', 'officer'))
  OR (bucket_id IN ('patch-thumbnails', 'patch-videos') AND (SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'))
  OR (bucket_id = 'ccis-private-drafts' AND (SELECT public.get_user_role()) IN (
    'devcom_head', 'officer', 'comm_content', 'comm_photobooth'
  ))
);

CREATE POLICY ccis_staff_assets_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  (
    bucket_id = 'gallery-images'
    AND (
      (name LIKE 'officers/%' AND (SELECT public.get_user_role()) = 'devcom_head')
      OR (name NOT LIKE 'officers/%' AND (SELECT public.get_user_role()) IN ('devcom_head', 'comm_photobooth'))
    )
  )
  OR (bucket_id = 'banners' AND (SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'))
  OR (bucket_id = 'bukas-kaban-reports' AND (SELECT public.get_user_role()) IN ('devcom_head', 'officer'))
  OR (bucket_id IN ('patch-thumbnails', 'patch-videos') AND (SELECT public.get_user_role()) IN ('devcom_head', 'comm_content'))
  OR (bucket_id = 'ccis-private-drafts' AND (SELECT public.get_user_role()) IN (
    'devcom_head', 'officer', 'comm_content', 'comm_photobooth'
  ))
);
