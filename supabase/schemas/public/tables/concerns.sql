create table "public"."concerns" (
  "id"                    uuid                     not null default extensions.uuid_generate_v4(),
  "profile_id"            uuid,
  "category"              text                     not null,
  "subject"               text                     not null,
  "message"               text                     not null,
  "status"                text                     not null default 'new'::text,
  "assigned_committee_id" uuid,
  "created_at"            timestamp with time zone default now(),
  "updated_at"            timestamp with time zone default now(),
  constraint "concerns_assigned_committee_id_fkey" foreign key (assigned_committee_id) references public.committees(id),
  constraint "concerns_pkey" primary key (id),
  constraint "concerns_status_check" check ((status = ANY (ARRAY['new'::text, 'in_progress'::text, 'resolved'::text]))),
  constraint "concerns_profile_id_fkey" foreign key (profile_id) references public.profiles(id) on delete cascade
);

alter table "public"."concerns"
  enable row level security;

alter table "public"."concerns"
  force row level security;

create index concerns_profile_id_idx on public.concerns using btree (profile_id);

create index idx_concerns_profile on public.concerns using btree (profile_id);

create index idx_concerns_status on public.concerns using btree (status);

create policy "concerns_owner_insert" on "public"."concerns"
  for insert
  to "authenticated"
  with check ((profile_id = auth.uid()));

create policy "concerns_owner_read" on "public"."concerns"
  for select
  to "authenticated"
  using (((profile_id = auth.uid()) or (public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'officer'::text]))));

create policy "concerns_staff_update" on "public"."concerns"
  for update
  to "authenticated"
  using ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'officer'::text])))
  with check ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'officer'::text])));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."concerns" to "anon", "authenticated", "postgres", "service_role";
