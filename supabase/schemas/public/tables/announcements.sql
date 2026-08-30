create table "public"."announcements" (
  "id"           uuid                     not null default extensions.uuid_generate_v4(),
  "title"        text                     not null,
  "content"      text                     not null,
  "category"     text                     not null,
  "status"       text                     not null default 'draft'::text,
  "pinned"       boolean                  default false,
  "banner_url"   text,
  "author_id"    uuid,
  "published_at" timestamp with time zone,
  "created_at"   timestamp with time zone default now(),
  "updated_at"   timestamp with time zone default now(),
  constraint "announcements_category_check" check ((category = ANY (ARRAY['event'::text, 'deadline'::text, 'result'::text, 'general'::text]))),
  constraint "announcements_pkey" primary key (id),
  constraint "announcements_status_check" check ((status = ANY (ARRAY['draft'::text, 'published'::text]))),
  constraint "announcements_author_id_fkey" foreign key (author_id) references public.profiles(id) on delete set null
);

alter table "public"."announcements"
  enable row level security;

alter table "public"."announcements"
  force row level security;

create index idx_announcements_category on public.announcements using btree (category);

create index idx_announcements_feed on public.announcements using btree (status, pinned desc, published_at desc);

create trigger trigger_queue_announcement_email
  after insert or update of status on public.announcements
  for each row
  execute function public.queue_announcement_emails_fn();

create policy "announcements_content_write" on "public"."announcements"
  for all
  to "authenticated"
  using ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_content'::text])))
  with check ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_content'::text])));

create policy "announcements_public_read" on "public"."announcements"
  for select
  to "anon", "authenticated"
  using (((status = 'published'::text) or (public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_content'::text]))));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."announcements" to "anon", "authenticated", "postgres", "service_role";
