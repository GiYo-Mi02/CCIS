create table "internal"."rate_limits" (
  "operation"         text                     not null,
  "subject"           text                     not null,
  "window_started_at" timestamp with time zone not null default clock_timestamp(),
  "request_count"     integer                  not null default 0,
  "updated_at"        timestamp with time zone not null default clock_timestamp(),
  constraint "rate_limits_pkey" primary key (operation, subject),
  constraint "rate_limits_request_count_check" check ((request_count >= 0))
);

grant delete, insert, maintain, references, select, trigger, truncate, update on table "internal"."rate_limits" to "postgres";

grant delete, insert, select, update on table "internal"."rate_limits" to "service_role";
