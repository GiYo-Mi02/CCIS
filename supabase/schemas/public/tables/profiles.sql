create table "public"."profiles" (
  "id"                             uuid                     not null,
  "email"                          text                     not null,
  "full_name"                      text,
  "avatar_url"                     text,
  "student_number"                 text,
  "year_level"                     smallint,
  "program"                        text,
  "role"                           text                     not null default 'student'::text,
  "position"                       text,
  "committee_id"                   uuid,
  "profile_complete"               boolean                  default false,
  "created_at"                     timestamp with time zone default now(),
  "updated_at"                     timestamp with time zone default now(),
  "section"                        text,
  "banned"                         boolean                  not null default false,
  "banned_until"                   timestamp with time zone,
  "subscribe_announcements_events" boolean                  not null default false,
  "email_subscription_decided"     boolean                  not null default false,
  "status"                         text                     default 'pending'::text,
  "privacy_agreed_at"              timestamp with time zone,
  "submitted_at"                   timestamp with time zone default now(),
  "approved_at"                    timestamp with time zone,
  "approved_by"                    uuid,
  "rejection_reason"               text,
  "contact_number"                 text,
  "last_ip"                        text,
  "attendance_qr_code"             text,
  "attendance_qr_generated_at"     timestamp with time zone default now(),
  constraint "check_profile_name_length" check (((full_name IS NULL) OR (length(full_name) <= 255))),
  constraint "check_profile_section" check (((section IS NULL) OR (section ~ '^[A-Z0-9-]+$'::text))),
  constraint "profiles_committee_id_fkey" foreign key (committee_id) references public.committees(id),
  constraint "profiles_email_key" unique (email),
  constraint "profiles_id_fkey" foreign key (id) references auth.users(id) on delete cascade,
  constraint "profiles_pkey" primary key (id),
  constraint "profiles_approved_by_fkey" foreign key (approved_by) references public.profiles(id) on delete set null,
  constraint "profiles_role_check"
    check ((role = ANY (ARRAY['student'::text, 'officer'::text, 'devcom_head'::text, 'comm_content'::text, 'comm_registration'::text, 'comm_photobooth'::text]))),
  constraint "profiles_status_check" check ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
  constraint "profiles_year_level_check" check (((year_level >= 1) AND (year_level <= 4)))
);

alter table "public"."profiles"
  enable row level security;

alter table "public"."profiles"
  force row level security;

create index idx_profiles_committee on public.profiles using btree (committee_id);

create index idx_profiles_role on public.profiles using btree (role);

create unique index profiles_attendance_qr_code_idx on public.profiles using btree (attendance_qr_code)
  where (attendance_qr_code is not null);

create index profiles_committee_id_idx on public.profiles using btree (committee_id);

create index profiles_status_idx on public.profiles using btree (status);

create index profiles_student_number_idx on public.profiles using btree (student_number)
  where (student_number is not null);

create trigger check_profile_metadata_trigger
  before insert or update on public.profiles
  for each row
  execute function public.check_profile_metadata();

create trigger ensure_approved_student_attendance_pass
  before insert or update of status, role, attendance_qr_code on public.profiles
  for each row
  execute function public.ensure_approved_student_attendance_pass();

create trigger trigger_sync_profile_role_to_auth
  after insert or update of role on public.profiles
  for each row
  execute function public.sync_profile_role_to_auth();

create policy "profiles_select_owner_or_staff" on "public"."profiles"
  for select
  to "authenticated"
  using
    (((id = auth.uid()) or (public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'officer'::text, 'comm_content'::text, 'comm_registration'::text, 'comm_photobooth'::text]))));

create policy "profiles_update_devcom" on "public"."profiles"
  for update
  to "authenticated"
  using ((public.get_user_role() = 'devcom_head'::text))
  with check ((public.get_user_role() = 'devcom_head'::text));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."profiles" to "anon", "authenticated", "postgres", "service_role";

comment on column "public"."profiles"."attendance_qr_code" is 'Unique generated security token for student audience event attendance QR passes';

comment on column "public"."profiles"."attendance_qr_generated_at" is 'Timestamp of when the attendance QR token was issued or regenerated';
