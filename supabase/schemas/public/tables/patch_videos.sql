create table "public"."patch_videos" (
  "id"                 uuid                     not null default gen_random_uuid(),
  "episode_number"     integer                  not null,
  "title"              text                     not null,
  "description"        text                     not null,
  "category"           text                     not null,
  "facebook_permalink" text,
  "thumbnail_url"      text                     not null,
  "is_featured"        boolean                  not null default false,
  "created_at"         timestamp with time zone default now(),
  "video_url"          text,
  constraint "patch_videos_pkey" primary key (id)
);

alter table "public"."patch_videos"
  enable row level security;

alter table "public"."patch_videos"
  force row level security;

create policy "patch_content_write" on "public"."patch_videos"
  for all
  to "authenticated"
  using ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_content'::text])))
  with check ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_content'::text])));

create policy "patch_public_read" on "public"."patch_videos"
  for select
  to "anon", "authenticated"
  using (true);

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."patch_videos" to "anon", "authenticated", "postgres", "service_role";
