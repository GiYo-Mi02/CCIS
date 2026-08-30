create table "public"."conversations" (
  "id"              uuid                     not null default gen_random_uuid(),
  "profile_id"      uuid,
  "created_at"      timestamp with time zone default now(),
  "last_message_at" timestamp with time zone default now(),
  constraint "conversations_pkey" primary key (id),
  constraint "conversations_profile_id_key" unique (profile_id),
  constraint "conversations_profile_id_fkey" foreign key (profile_id) references public.profiles(id) on delete cascade
);

alter table "public"."conversations"
  enable row level security;

alter table "public"."conversations"
  force row level security;

create index conversations_profile_id_idx on public.conversations using btree (profile_id);

create index idx_conversations_last_message on public.conversations using btree (last_message_at desc);

create policy "conversations_owner_insert" on "public"."conversations"
  for insert
  to "authenticated"
  with check ((profile_id = auth.uid()));

create policy "conversations_owner_read" on "public"."conversations"
  for select
  to "authenticated"
  using (((profile_id = auth.uid()) or (public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'officer'::text]))));

create policy "conversations_staff_update" on "public"."conversations"
  for update
  to "authenticated"
  using ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'officer'::text])))
  with check ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'officer'::text])));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."conversations" to "anon", "authenticated", "postgres", "service_role";
