-- ============================================================
-- CCIS PLATFORM BACKEND: GALLERY ITEMS & OFFICERS SCHEMAS
-- ============================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- to create the missing tables, enable Row Level Security (RLS),
-- configure policies, and seed the officers database table.

-- ============================================================
-- 1. GALLERY ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gallery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  frame_id TEXT,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent duplicate errors
DROP POLICY IF EXISTS gallery_items_public_read ON public.gallery_items;
DROP POLICY IF EXISTS gallery_items_user_insert ON public.gallery_items;
DROP POLICY IF EXISTS gallery_items_user_delete ON public.gallery_items;
DROP POLICY IF EXISTS gallery_items_admin_all ON public.gallery_items;

-- Gallery RLS Policies
-- Allow anyone (public + logged in) to view all gallery snaps
CREATE POLICY gallery_items_public_read ON public.gallery_items
  FOR SELECT USING (true);

-- Allow authenticated users to save their own photobooth photos, or anonymous entries (profile_id is null)
CREATE POLICY gallery_items_user_insert ON public.gallery_items
  FOR INSERT WITH CHECK (auth.uid() = profile_id OR profile_id IS NULL);

-- Allow users to delete their own uploaded photos
CREATE POLICY gallery_items_user_delete ON public.gallery_items
  FOR DELETE USING (auth.uid() = profile_id);

-- Allow DevCom Heads and Photobooth Committee members to perform all actions
CREATE POLICY gallery_items_admin_all ON public.gallery_items
  FOR ALL USING (public.get_user_role() in ('devcom_head', 'comm_photobooth'));


-- ============================================================
-- 2. OFFICERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  committee_id UUID REFERENCES public.committees(id) ON DELETE SET NULL,
  photo_url TEXT,
  email TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.officers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent duplicate errors
DROP POLICY IF EXISTS officers_public_read ON public.officers;
DROP POLICY IF EXISTS officers_admin_all ON public.officers;

-- Officers RLS Policies
-- Allow anyone to read the officers directory
CREATE POLICY officers_public_read ON public.officers
  FOR SELECT USING (true);

-- Allow DevCom Heads (administrators) to manage officers (insert, update, delete)
CREATE POLICY officers_admin_all ON public.officers
  FOR ALL USING (public.get_user_role() in ('devcom_head'));


-- ============================================================
-- 3. SEED OFFICERS DIRECTORY
-- ============================================================
-- Clean delete any existing mock/duplicated seed values before populating
TRUNCATE TABLE public.officers RESTART IDENTITY CASCADE;

-- Insert CCIS Student Council Officers
INSERT INTO public.officers (name, position, committee_id, display_order, email, photo_url)
VALUES
  -- Executive Board
  ('Gio Joshua Gonzales', 'President / DevCom Head', (SELECT id FROM public.committees WHERE slug = 'developers' LIMIT 1), 1, 'ggiojoshua2006@gmail.com', NULL),
  ('Jane Smith', 'Vice President', NULL, 2, 'vp@ccis-council.org', NULL),
  ('Alice Johnson', 'Secretary', NULL, 3, 'secretary@ccis-council.org', NULL),
  ('Bob Brown', 'Treasurer', NULL, 4, 'treasurer@ccis-council.org', NULL),
  
  -- Committee Heads (mapped automatically to the seeded committee slugs)
  ('Charlie Green', 'Logistics Head', (SELECT id FROM public.committees WHERE slug = 'logistics' LIMIT 1), 5, 'logistics@ccis-council.org', NULL),
  ('Diana Prince', 'Finance Head', (SELECT id FROM public.committees WHERE slug = 'finance' LIMIT 1), 6, 'finance@ccis-council.org', NULL),
  ('Ethan Hunt', 'Inventory Head', (SELECT id FROM public.committees WHERE slug = 'inventory' LIMIT 1), 7, 'inventory@ccis-council.org', NULL),
  ('Fiona Gallagher', 'Technical Head', (SELECT id FROM public.committees WHERE slug = 'technical' LIMIT 1), 8, 'technical@ccis-council.org', NULL),
  ('George Clark', 'External Affairs Head', (SELECT id FROM public.committees WHERE slug = 'external-affairs' LIMIT 1), 9, 'external@ccis-council.org', NULL),
  ('Hannah Abbott', 'Advertising Head', (SELECT id FROM public.committees WHERE slug = 'advertising' LIMIT 1), 10, 'publicity@ccis-council.org', NULL),
  ('Ian Malcolm', 'Welfare Head', (SELECT id FROM public.committees WHERE slug = 'welfare' LIMIT 1), 11, 'welfare@ccis-council.org', NULL)
ON CONFLICT DO NOTHING;
