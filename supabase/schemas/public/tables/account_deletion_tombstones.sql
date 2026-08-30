create table "public"."account_deletion_tombstones" (
  "user_id"             uuid                     not null,
  "deleted_by"          uuid                     not null,
  "deleted_at"          timestamp with time zone not null default now(),
  "storage_deleted"     boolean                  not null default false,
  "public_data_deleted" boolean                  not null default false,
  "auth_deleted"        boolean                  not null default false,
  "storage_paths"       text[]                   not null default '{}'::text[],
  "target_email"        text,
  "lock_id"             text,
  "lock_expires_at"     timestamp with time zone,
  constraint "account_deletion_tombstones_pkey" primary key (user_id)
);

alter table "public"."account_deletion_tombstones"
  enable row level security;

alter table "public"."account_deletion_tombstones"
  force row level security;

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."account_deletion_tombstones" to "postgres", "service_role";
