-- ============================================================
-- CCIS PLATFORM: PATCH SERIES VIDEO ARCHIVE CONFIGURATION
-- ============================================================

-- 1. Create patch_videos table
CREATE TABLE IF NOT EXISTS public.patch_videos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  episode_number integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL, -- e.g. 'Full Episodes', 'Highlights', 'Behind the Scenes'
  facebook_permalink text, -- Nullable to allow native uploads
  video_url text, -- To store native file upload URLs
  thumbnail_url text NOT NULL,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Migration alter queries if table was already created
-- ALTER TABLE public.patch_videos ALTER COLUMN facebook_permalink DROP NOT NULL;
-- ALTER TABLE public.patch_videos ADD COLUMN IF NOT EXISTS video_url text;

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.patch_videos ENABLE ROW LEVEL SECURITY;

-- 3. Policies for patch_videos table
-- SELECT: Allow public read access to all users
CREATE POLICY "Allow public select on patch_videos" ON public.patch_videos
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: Restrict write access to authenticated administrators only
CREATE POLICY "Allow admin write on patch_videos" ON public.patch_videos
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

-- 4. Set up patch-thumbnails Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('patch-thumbnails', 'patch-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage Object Policies for 'patch-thumbnails' bucket
-- SELECT: Allow public read access to thumbnails
CREATE POLICY "Allow public select on patch-thumbnails storage" ON storage.objects
  FOR SELECT USING (bucket_id = 'patch-thumbnails');

-- INSERT/UPDATE/DELETE: Restrict storage changes to authenticated administrators only
CREATE POLICY "Allow admin write on patch-thumbnails storage" ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'patch-thumbnails'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
    )
  )
  WITH CHECK (
    bucket_id = 'patch-thumbnails'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
    )
  );

-- 6. Set up patch-videos Storage Bucket for direct file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('patch-videos', 'patch-videos', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage Object Policies for 'patch-videos' bucket
-- SELECT: Allow public read access to uploaded videos
CREATE POLICY "Allow public select on patch-videos storage" ON storage.objects
  FOR SELECT USING (bucket_id = 'patch-videos');

-- INSERT/UPDATE/DELETE: Restrict storage changes to authenticated administrators only
CREATE POLICY "Allow admin write on patch-videos storage" ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'patch-videos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
    )
  )
  WITH CHECK (
    bucket_id = 'patch-videos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
    )
  );
