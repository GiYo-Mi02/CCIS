create table "public"."committee_subteams" (
  "id"            uuid     not null default extensions.uuid_generate_v4(),
  "committee_id"  uuid,
  "name"          text     not null,
  "description"   text,
  "display_order" smallint default 0,
  constraint "committee_subteams_pkey" primary key (id),
  constraint "committee_subteams_committee_id_fkey" foreign key (committee_id) references public.committees(id) on delete cascade
);

alter table "public"."committee_subteams"
  enable row level security;

create index idx_committee_subteams_committee on public.committee_subteams using btree (committee_id);

create policy "subteams_admin_write" on "public"."committee_subteams"
  for all
  to PUBLIC
  using ((public.get_user_role() = 'devcom_head'::text));

create policy "subteams_public_read" on "public"."committee_subteams"
  for select
  to PUBLIC
  using (true);

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."committee_subteams" to "anon", "authenticated", "postgres", "service_role";
