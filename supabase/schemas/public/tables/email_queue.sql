create table "public"."email_queue" (
  "id"                       uuid                     not null default gen_random_uuid(),
  "recipient_email"          text                     not null,
  "email_type"               text                     not null,
  "subject"                  text                     not null,
  "html_body"                text                     not null,
  "status"                   text                     not null default 'pending'::text,
  "error_message"            text,
  "attempts"                 integer                  default 0,
  "created_at"               timestamp with time zone default now(),
  "processed_at"             timestamp with time zone,
  "scheduled_for"            timestamp with time zone default now(),
  "profile_id"               uuid,
  "sent_at"                  timestamp with time zone,
  "logical_key"              text,
  "delivery_state"           text                     not null default 'queued'::text,
  "provider_idempotency_key" text,
  "provider_message_id"      text,
  "lease_expires_at"         timestamp with time zone,
  "lease_worker_id"          text,
  "dead_lettered_at"         timestamp with time zone,
  constraint "email_queue_pkey" primary key (id),
  constraint "email_queue_status_check"
    check ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'dead_letter'::text, 'delivery_unknown'::text])))
);

alter table "public"."email_queue"
  enable row level security;

alter table "public"."email_queue"
  force row level security;

create index email_queue_dequeue_idx on public.email_queue using btree (status, scheduled_for, created_at)
  where (status = ANY (ARRAY['pending'::text, 'failed'::text]));

create unique index email_queue_logical_key_idx on public.email_queue using btree (logical_key)
  where (logical_key is not null);

create index email_queue_profile_id_idx on public.email_queue using btree (profile_id);

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."email_queue" to "postgres", "service_role";
