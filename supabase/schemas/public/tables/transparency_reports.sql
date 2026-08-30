create table "public"."transparency_reports" (
  "id"                     uuid                     not null default gen_random_uuid(),
  "title"                  text                     not null,
  "caption"                text                     not null,
  "semester"               text                     not null,
  "pdf_url"                text                     not null,
  "thumbnail_url"          text                     not null,
  "file_size_label"        text                     not null,
  "created_at"             timestamp with time zone default now(),
  "total_budget_requested" numeric                  not null default 0,
  "total_expenses"         numeric                  not null default 0,
  constraint "transparency_reports_pkey" primary key (id)
);

alter table "public"."transparency_reports"
  enable row level security;

alter table "public"."transparency_reports"
  force row level security;

create policy "transparency_public_read" on "public"."transparency_reports"
  for select
  to "anon", "authenticated"
  using (true);

create policy "transparency_staff_write" on "public"."transparency_reports"
  for all
  to "authenticated"
  using ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'officer'::text])))
  with check ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'officer'::text])));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."transparency_reports" to "anon", "authenticated", "postgres", "service_role";
