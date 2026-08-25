BEGIN;

DELETE FROM internal.email_outbox
WHERE source_id = '00000000-0000-0000-0000-000000000003';
DELETE FROM public.events
WHERE id = '00000000-0000-0000-0000-000000000003';
DELETE FROM auth.users
WHERE id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'registration-admin@umak.edu.ph', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'registration-student@umak.edu.ph', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

UPDATE public.profiles
SET role = 'comm_registration', status = 'approved'
WHERE id = '00000000-0000-0000-0000-000000000001';

UPDATE public.profiles
SET status = 'approved'
WHERE id = '00000000-0000-0000-0000-000000000002';

INSERT INTO public.events (id, title, event_date)
VALUES ('00000000-0000-0000-0000-000000000003', 'Registration check-in contract', current_date);

INSERT INTO public.event_registrations (id, event_id, profile_id)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002'
);

COMMIT;
