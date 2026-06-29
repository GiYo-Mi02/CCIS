-- ============================================================
-- CCIS PLATFORM: GALLERY SCHEMA ALTERS & RLS FIXES
-- ============================================================

-- 1. Alter public.gallery_items table to add missing CCIS Gallery columns
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS posted_by text;
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS thumbnails text[] DEFAULT '{}';
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS aspect_ratio text;
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS index_label text;

-- 2. Modify constraint on aspect_ratio to match new types
ALTER TABLE public.gallery_items DROP CONSTRAINT IF EXISTS gallery_items_aspect_ratio_check;
ALTER TABLE public.gallery_items ADD CONSTRAINT gallery_items_aspect_ratio_check 
  CHECK (aspect_ratio IN ('portrait', 'landscape', 'square'));

-- 3. Drop conflicting RLS policies to reset cleanly
DROP POLICY IF EXISTS gallery_items_public_read ON public.gallery_items;
DROP POLICY IF EXISTS gallery_items_admin_all ON public.gallery_items;
DROP POLICY IF EXISTS "Allow public select on gallery_items" ON public.gallery_items;
DROP POLICY IF EXISTS "Allow admin write on gallery_items" ON public.gallery_items;

-- 4. Re-enable Row Level Security (RLS)
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

-- 5. Recreate SELECT and WRITE policies
CREATE POLICY "Allow public select on gallery_items" ON public.gallery_items
  FOR SELECT USING (true);

CREATE POLICY "Allow admin write on gallery_items" ON public.gallery_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
    )
  );
