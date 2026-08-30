create table "public"."theme_settings" (
  "id"            uuid                     not null default extensions.uuid_generate_v4(),
  "preset_name"   text                     not null,
  "primary_color" text                     not null,
  "accent_color"  text                     not null,
  "canvas_color"  text                     not null,
  "is_active"     boolean                  default false,
  "created_at"    timestamp with time zone default now(),
  constraint "theme_settings_pkey" primary key (id)
);

alter table "public"."theme_settings"
  enable row level security;

alter table "public"."theme_settings"
  force row level security;

create unique index idx_theme_only_one_active on public.theme_settings using btree (is_active)
  where (is_active = true);

create policy "themes_active_public_read" on "public"."theme_settings"
  for select
  to "anon", "authenticated"
  using ((is_active or (public.get_user_role() = 'devcom_head'::text)));

create policy "themes_devcom_write" on "public"."theme_settings"
  for all
  to "authenticated"
  using ((public.get_user_role() = 'devcom_head'::text))
  with check ((public.get_user_role() = 'devcom_head'::text));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."theme_settings" to "anon", "authenticated", "postgres", "service_role";
