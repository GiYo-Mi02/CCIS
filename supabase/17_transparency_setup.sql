-- ============================================================
-- CCIS PLATFORM: BUKAS KABAN TRANSPARENCY ARCHIVE CONFIGURATION
-- ============================================================

-- 1. Create transparency_reports table
CREATE TABLE IF NOT EXISTS public.transparency_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  caption text NOT NULL,
  semester text NOT NULL,
  pdf_url text NOT NULL,
  thumbnail_url text NOT NULL,
  file_size_label text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.transparency_reports ENABLE ROW LEVEL SECURITY;

-- 3. Policies for transparency_reports table
-- SELECT: Allow public read access to all users (anonymous and authenticated)
CREATE POLICY "Allow public select on transparency_reports" ON public.transparency_reports
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: Restrict write access to authenticated administrators only
CREATE POLICY "Allow admin write on transparency_reports" ON public.transparency_reports
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

-- 4. Set up bukas-kaban-reports Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('bukas-kaban-reports', 'bukas-kaban-reports', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage Object Policies for the 'bukas-kaban-reports' bucket
-- SELECT: Allow anyone to view reports and thumbnails
CREATE POLICY "Allow public select on bukas-kaban-reports storage" ON storage.objects
  FOR SELECT USING (bucket_id = 'bukas-kaban-reports');

-- INSERT/UPDATE/DELETE: Only authenticated admin users can modify objects
CREATE POLICY "Allow admin write on bukas-kaban-reports storage" ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'bukas-kaban-reports' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
    )
  )
  WITH CHECK (
    bucket_id = 'bukas-kaban-reports' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('devcom_head', 'officer', 'comm_content', 'comm_registration', 'comm_photobooth')
    )
  );
