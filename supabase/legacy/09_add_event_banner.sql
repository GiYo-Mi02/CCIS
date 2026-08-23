-- ============================================================
-- ADD EVENT BANNER AND SETUP BANNERS STORAGE RLS POLICIES
-- ============================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- to add support for event banner pictures and secure image uploading.

-- 1. ADD BANNER_URL COLUMN TO EVENTS
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- 2. CREATE STORAGE POLICIES FOR THE 'BANNERS' BUCKET
-- Ensure the storage.objects table has policies allowed for our 'banners' bucket.

-- Allow anyone (public) to view/read banners
CREATE POLICY "Allow public read access to banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'banners');

-- Allow DevCom Heads and Content Committee members to upload new banners
CREATE POLICY "Allow admin insert access to banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'banners'
  AND (public.get_user_role() IN ('devcom_head', 'comm_content'))
);

-- Allow DevCom Heads and Content Committee members to update banners
CREATE POLICY "Allow admin update access to banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'banners'
  AND (public.get_user_role() IN ('devcom_head', 'comm_content'))
);

-- Allow DevCom Heads and Content Committee members to delete banners
CREATE POLICY "Allow admin delete access to banners"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'banners'
  AND (public.get_user_role() IN ('devcom_head', 'comm_content'))
);
