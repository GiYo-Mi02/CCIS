create table "public"."events" (
  "id"                    uuid                     not null default extensions.uuid_generate_v4(),
  "title"                 text                     not null,
  "description"           text,
  "category"              text                     not null default 'general'::text,
  "event_date"            date                     not null,
  "event_time"            time without time zone,
  "location"              text,
  "registration_required" boolean                  default false,
  "registration_cap"      integer,
  "created_by"            uuid,
  "created_at"            timestamp with time zone default now(),
  "banner_url"            text,
  "event_type"            text                     default 'general'::text,
  constraint "events_category_check" check ((category = ANY (ARRAY['general'::text, 'priority'::text]))),
  constraint "events_pkey" primary key (id),
  constraint "events_created_by_fkey" foreign key (created_by) references public.profiles(id) on delete cascade
);

alter table "public"."events"
  enable row level security;

alter table "public"."events"
  force row level security;

create index idx_events_date on public.events using btree (event_date);

create trigger trigger_queue_event_email
  after insert on public.events
  for each row
  execute function public.queue_event_emails_fn();

create policy "events_public_read" on "public"."events"
  for select
  to "anon", "authenticated"
  using (true);

create policy "events_registration_write" on "public"."events"
  for all
  to "authenticated"
  using ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_registration'::text])))
  with check ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_registration'::text])));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."events" to "anon", "authenticated", "postgres", "service_role";

comment on column "public"."events"."event_type" is 'Classification: competition (requires participant registration) vs general (uses Universal Audience QR pass)';

comment on column "public"."events"."registration_cap" is 'NULL means unlimited capacity; non-null values are enforced transactionally by register_for_event().';
