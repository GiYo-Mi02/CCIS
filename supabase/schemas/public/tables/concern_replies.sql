create table "public"."concern_replies" (
  "id"         uuid                     not null default extensions.uuid_generate_v4(),
  "concern_id" uuid,
  "admin_id"   uuid,
  "message"    text                     not null,
  "created_at" timestamp with time zone default now(),
  constraint "concern_replies_pkey" primary key (id),
  constraint "concern_replies_concern_id_fkey" foreign key (concern_id) references public.concerns(id) on delete cascade,
  constraint "concern_replies_admin_id_fkey" foreign key (admin_id) references public.profiles(id) on delete cascade
);

alter table "public"."concern_replies"
  enable row level security;

alter table "public"."concern_replies"
  force row level security;

create index idx_concern_replies_concern on public.concern_replies using btree (concern_id);

create policy "concern_replies_owner_or_staff_read" on "public"."concern_replies"
  for select
  to "authenticated"
  using ((exists ( select 1
   from public.concerns concern
  where ((concern.id = concern_replies.concern_id) AND ((concern.profile_id = auth.uid()) or (public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'officer'::text])))))));

create policy "concern_replies_staff_insert" on "public"."concern_replies"
  for insert
  to "authenticated"
  with check (((admin_id = auth.uid()) AND (public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'officer'::text]))));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."concern_replies" to "anon", "authenticated", "postgres", "service_role";
