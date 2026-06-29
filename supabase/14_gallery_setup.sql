-- ============================================================
-- CCIS PLATFORM: PHOTO GALLERY AND STORAGE CONFIGURATION
-- ============================================================

-- 1. Create gallery_items table
CREATE TABLE IF NOT EXISTS public.gallery_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text NOT NULL,
  posted_by text,
  image_url text NOT NULL,
  thumbnails text[] DEFAULT '{}',
  aspect_ratio text CHECK (aspect_ratio IN ('portrait', 'landscape', 'square')),
  index_label text,
  created_at timestamptz DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

-- 3. Policies for gallery_items table
-- SELECT: Allow public read access to all users (anonymous and authenticated)
CREATE POLICY "Allow public select on gallery_items" ON public.gallery_items
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: Restrict write access to authenticated administrators only
-- Admins are defined by role: devcom_head, officer, comm_content, comm_registration, comm_photobooth
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

-- 4. Set up gallery-images Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery-images', 'gallery-images', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage Object Policies for the 'gallery-images' bucket
-- SELECT: Allow anyone to view images
CREATE POLICY "Allow public select on gallery-images storage" ON storage.objects
  FOR SELECT USING (bucket_id = 'gallery-images');

-- INSERT/UPDATE/DELETE: Only authenticated admin users can modify objects
CREATE POLICY "Allow admin write on gallery-images storage" ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'gallery-images' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
    )
  )
  WITH CHECK (
    bucket_id = 'gallery-images' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
    )
  );

-- ============================================================
-- LOCAL DEV TESTING BYPASS POLICY
-- ============================================================
-- For local dev testing where you want to perform CRUD operations without authenticating:
-- ALTER TABLE public.gallery_items DISABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Bypass storage RLS for local dev" ON storage.objects FOR ALL USING (bucket_id = 'gallery-images');
-- ============================================================
