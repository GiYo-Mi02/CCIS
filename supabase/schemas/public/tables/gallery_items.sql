create table "public"."gallery_items" (
  "id"           uuid                     not null default gen_random_uuid(),
  "profile_id"   uuid,
  "image_url"    text                     not null,
  "frame_id"     text,
  "featured"     boolean                  default false,
  "created_at"   timestamp with time zone default now(),
  "title"        text                     not null,
  "description"  text,
  "category"     text                     not null,
  "posted_by"    text,
  "thumbnails"   text[]                   default '{}'::text[],
  "aspect_ratio" text,
  "index_label"  text,
  constraint "gallery_items_aspect_ratio_check" check ((aspect_ratio = ANY (ARRAY['portrait'::text, 'landscape'::text, 'square'::text]))),
  constraint "gallery_items_pkey" primary key (id),
  constraint "gallery_items_profile_id_fkey" foreign key (profile_id) references public.profiles(id) on delete cascade
);

alter table "public"."gallery_items"
  enable row level security;

alter table "public"."gallery_items"
  force row level security;

create index gallery_items_profile_id_idx on public.gallery_items using btree (profile_id);

create policy "gallery_public_read" on "public"."gallery_items"
  for select
  to "anon", "authenticated"
  using (true);

create policy "gallery_staff_write" on "public"."gallery_items"
  for all
  to "authenticated"
  using ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_content'::text, 'comm_photobooth'::text])))
  with check ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_content'::text, 'comm_photobooth'::text])));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."gallery_items" to "anon", "authenticated", "postgres", "service_role";

comment on column "public"."gallery_items"."title" is 'Canonical display title. Legacy frame_id/index_label columns, if present on an existing project, are retained pending live data inventory.';
