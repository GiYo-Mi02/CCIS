create table "public"."ip_bans" (
  "id"           uuid                     not null default gen_random_uuid(),
  "ip_address"   text                     not null,
  "banned_by"    uuid,
  "reason"       text,
  "created_at"   timestamp with time zone default now(),
  "banned_until" timestamp with time zone,
  constraint "ip_bans_ip_address_key" unique (ip_address),
  constraint "ip_bans_pkey" primary key (id),
  constraint "ip_bans_banned_by_fkey" foreign key (banned_by) references public.profiles(id) on delete set null
);

alter table "public"."ip_bans"
  enable row level security;

alter table "public"."ip_bans"
  force row level security;

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."ip_bans" to "postgres", "service_role";
