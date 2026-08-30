create table "public"."messages" (
  "id"              uuid                     not null default gen_random_uuid(),
  "conversation_id" uuid,
  "sender_id"       uuid,
  "sender_role"     text                     not null,
  "content"         text                     not null,
  "read_by_student" boolean                  default false,
  "read_by_admin"   boolean                  default false,
  "created_at"      timestamp with time zone default now(),
  "student_id"      uuid,
  constraint "messages_conversation_id_fkey" foreign key (conversation_id) references public.conversations(id) on delete cascade,
  constraint "messages_pkey" primary key (id),
  constraint "messages_sender_role_check" check ((sender_role = ANY (ARRAY['student'::text, 'admin'::text]))),
  constraint "messages_sender_id_fkey" foreign key (sender_id) references public.profiles(id) on delete cascade,
  constraint "messages_student_id_fkey" foreign key (student_id) references public.profiles(id) on delete cascade
);

alter table "public"."messages"
  enable row level security;

alter table "public"."messages"
  force row level security;

create index idx_messages_conversation on public.messages using btree (conversation_id, created_at);

create index messages_admin_unread_idx on public.messages using btree (conversation_id)
  where ((sender_role = 'student'::text) AND (read_by_admin = false));

create index messages_conversation_created_idx on public.messages using btree (conversation_id, created_at);

create index messages_student_id_idx on public.messages using btree (student_id);

create trigger trigger_populate_message_student_id
  before insert on public.messages
  for each row
  execute function public.populate_message_student_id();

create trigger trigger_update_conversation_last_message_at
  after insert on public.messages
  for each row
  execute function public.update_conversation_last_message_at();

create policy "messages_devcom_delete" on "public"."messages"
  for delete
  to "authenticated"
  using ((public.get_user_role() = 'devcom_head'::text));

create policy "messages_owner_or_staff_read" on "public"."messages"
  for select
  to "authenticated"
  using ((exists ( select 1
   from public.conversations conversation
  where
    ((conversation.id = messages.conversation_id) AND ((conversation.profile_id = auth.uid()) or (public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'officer'::text])))))));

create policy "messages_scoped_insert" on "public"."messages"
  for insert
  to "authenticated"
  with check ((((sender_role = 'student'::text) AND (sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.conversations conversation
  WHERE ((conversation.id = messages.conversation_id) AND (conversation.profile_id = auth.uid()))))) OR
    ((sender_role = 'admin'::text) AND (sender_id = auth.uid()) AND (public.get_user_role() = ANY (ARRAY['devcom_head'::text, 'officer'::text])))));

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."messages" to "anon", "authenticated", "postgres", "service_role";
