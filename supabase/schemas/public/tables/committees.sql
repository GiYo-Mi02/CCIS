create table "public"."committees" (
  "id"               uuid                     not null default extensions.uuid_generate_v4(),
  "name"             text                     not null,
  "slug"             text                     not null,
  "description"      text,
  "icon"             text,
  "responsibilities" text[]                   default '{}'::text[],
  "display_order"    smallint                 default 0,
  "created_at"       timestamp with time zone default now(),
  "head_name"        text,
  constraint "committees_pkey" primary key (id),
  constraint "committees_slug_key" unique (slug)
);

alter table "public"."committees"
  enable row level security;

alter table "public"."committees"
  force row level security;

create policy "committees_devcom_write" on "public"."committees"
  for all
  to "authenticated"
  using ((public.get_user_role() = 'devcom_head'::text))
  with check ((public.get_user_role() = 'devcom_head'::text));

create policy "committees_public_read" on "public"."committees"
  for select
  to "anon", "authenticated"
  using (true);

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."committees" to "anon", "authenticated", "postgres", "service_role";
