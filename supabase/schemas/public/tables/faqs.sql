create table "public"."faqs" (
  "id"            uuid                     not null default extensions.uuid_generate_v4(),
  "question"      text                     not null,
  "answer"        text                     not null,
  "display_order" smallint                 default 0,
  "is_active"     boolean                  default true,
  "created_at"    timestamp with time zone default now(),
  "updated_at"    timestamp with time zone default now(),
  constraint "faqs_pkey" primary key (id)
);

alter table "public"."faqs"
  enable row level security;

alter table "public"."faqs"
  force row level security;

create index idx_faqs_active on public.faqs using btree (is_active, display_order);

create policy "faqs_content_write" on "public"."faqs"
  for all
  to "authenticated"
  using ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_content'::text])))
  with check ((public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_content'::text])));

create policy "faqs_public_read" on "public"."faqs"
  for select
  to "anon", "authenticated"
  using ((is_active or (public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'comm_content'::text]))));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."faqs" to "anon", "authenticated", "postgres", "service_role";
