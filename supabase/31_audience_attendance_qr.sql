-- Migration 31: Add audience attendance QR code fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS attendance_qr_code TEXT,
ADD COLUMN IF NOT EXISTS attendance_qr_generated_at TIMESTAMPTZ DEFAULT now();

-- Update comment
COMMENT ON COLUMN public.profiles.attendance_qr_code IS 'Unique generated security token for student audience event attendance QR passes';
COMMENT ON COLUMN public.profiles.attendance_qr_generated_at IS 'Timestamp of when the attendance QR token was issued or regenerated';
