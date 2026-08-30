create table "public"."officers" (
  "id"            uuid                     not null default gen_random_uuid(),
  "name"          text                     not null,
  "position"      text                     not null,
  "committee_id"  uuid,
  "photo_url"     text,
  "email"         text,
  "display_order" integer                  default 0,
  "created_at"    timestamp with time zone default now(),
  "quote"         text,
  "term"          text                     default '2026-2027'::text,
  "organization"  text                     default 'Student Council'::text,
  constraint "officers_committee_id_fkey" foreign key (committee_id) references public.committees(id) on delete set null,
  constraint "officers_pkey" primary key (id)
);

alter table "public"."officers"
  enable row level security;

alter table "public"."officers"
  force row level security;

create policy "officers_devcom_write" on "public"."officers"
  for all
  to "authenticated"
  using ((public.get_user_role() = 'devcom_head'::text))
  with check ((public.get_user_role() = 'devcom_head'::text));

create policy "officers_public_read" on "public"."officers"
  for select
  to "anon", "authenticated"
  using (true);

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."officers" to "anon", "authenticated", "postgres", "service_role";
