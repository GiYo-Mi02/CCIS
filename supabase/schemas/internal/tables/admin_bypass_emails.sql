create table "internal"."admin_bypass_emails" (
  "email"      text                     not null,
  "created_at" timestamp with time zone not null default now(),
  constraint "admin_bypass_emails_email_check" check ((email = lower(email))),
  constraint "admin_bypass_emails_pkey" primary key (email)
);

grant delete, insert, maintain, references, select, trigger, truncate, update on table "internal"."admin_bypass_emails" to "postgres";

grant delete, insert, select, update on table "internal"."admin_bypass_emails" to "service_role";
