create table "internal"."email_outbox" (
  "id"           uuid                     not null default gen_random_uuid(),
  "event_type"   text                     not null,
  "source_id"    uuid                     not null,
  "status"       text                     not null default 'pending'::text,
  "attempts"     integer                  not null default 0,
  "created_at"   timestamp with time zone not null default now(),
  "processed_at" timestamp with time zone,
  "error_code"   text,
  constraint "email_outbox_attempts_check" check ((attempts >= 0)),
  constraint "email_outbox_event_type_check" check ((event_type = ANY (ARRAY['announcement_published'::text, 'event_created'::text]))),
  constraint "email_outbox_event_type_source_id_key" unique (event_type, source_id),
  constraint "email_outbox_pkey" primary key (id),
  constraint "email_outbox_status_check" check ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'expanded'::text, 'failed'::text])))
);

grant delete, insert, maintain, references, select, trigger, truncate, update on table "internal"."email_outbox" to "postgres";

grant delete, insert, select, update on table "internal"."email_outbox" to "service_role";
