-- Identity admission is enforced by the private allowlist in provisioning functions.
-- This legacy constraint only allowed one of the approved external admin identities.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS check_profile_email_domain;
