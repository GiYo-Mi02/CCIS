create table "public"."photobooth_gallery" (
  "id"         uuid                     not null default extensions.uuid_generate_v4(),
  "profile_id" uuid,
  "image_url"  text                     not null,
  "frame_id"   text,
  "featured"   boolean                  default false,
  "created_at" timestamp with time zone default now(),
  constraint "photobooth_gallery_pkey" primary key (id),
  constraint "photobooth_gallery_profile_id_fkey" foreign key (profile_id) references public.profiles(id) on delete cascade
);

alter table "public"."photobooth_gallery"
  enable row level security;

create index idx_gallery_featured on public.photobooth_gallery using btree (featured, created_at desc);

create policy "gallery_admin_all" on "public"."photobooth_gallery"
  for all
  to PUBLIC
  using ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_photobooth'::text])));

create policy "gallery_insert_own" on "public"."photobooth_gallery"
  for insert
  to PUBLIC
  with check ((auth.uid() = profile_id));

create policy "gallery_public_read_featured" on "public"."photobooth_gallery"
  for select
  to PUBLIC
  using ((featured = true));

create policy "gallery_select_own" on "public"."photobooth_gallery"
  for select
  to PUBLIC
  using ((auth.uid() = profile_id));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."photobooth_gallery" to "anon", "authenticated", "postgres", "service_role";
