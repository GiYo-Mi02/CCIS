create table "public"."event_registrations" (
  "id"                uuid                     not null default extensions.uuid_generate_v4(),
  "event_id"          uuid,
  "profile_id"        uuid,
  "status"            text                     not null default 'confirmed'::text,
  "registered_at"     timestamp with time zone default now(),
  "attended_at"       timestamp with time zone,
  "attendance_origin" text                     not null default 'registered'::text,
  constraint "event_registrations_attendance_origin_check" check ((attendance_origin = ANY (ARRAY['registered'::text, 'walk_in'::text]))),
  constraint "event_registrations_event_id_profile_id_key" unique (event_id, profile_id),
  constraint "event_registrations_pkey" primary key (id),
  constraint "event_registrations_status_check" check ((status = ANY (ARRAY['confirmed'::text, 'pending'::text, 'cancelled'::text, 'attended'::text]))),
  constraint "event_registrations_event_id_fkey" foreign key (event_id) references public.events(id) on delete cascade,
  constraint "event_registrations_profile_id_fkey" foreign key (profile_id) references public.profiles(id) on delete cascade
);

alter table "public"."event_registrations"
  enable row level security;

alter table "public"."event_registrations"
  force row level security;

create index event_registrations_event_status_idx on public.event_registrations using btree (event_id, status);

create index event_registrations_profile_id_idx on public.event_registrations using btree (profile_id);

create index idx_registrations_event on public.event_registrations using btree (event_id);

create index idx_registrations_profile on public.event_registrations using btree (profile_id);

create policy "registrations_owner_or_staff_read" on "public"."event_registrations"
  for select
  to "authenticated"
  using (((profile_id = auth.uid()) or (public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_registration'::text]))));

create policy "registrations_staff_delete" on "public"."event_registrations"
  for delete
  to "authenticated"
  using ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_registration'::text])));

create policy "registrations_staff_update" on "public"."event_registrations"
  for update
  to "authenticated"
  using ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_registration'::text])))
  with check ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_registration'::text])));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."event_registrations" to "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."event_registrations" to "postgres", "service_role";

revoke all on table "public"."event_registrations" from "authenticated";

grant delete, maintain, references, select, trigger, truncate, update on table "public"."event_registrations" to "authenticated";
