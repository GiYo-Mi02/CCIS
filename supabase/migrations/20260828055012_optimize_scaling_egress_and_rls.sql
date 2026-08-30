-- Scaling and egress hardening for the 1,700-student rollout.
-- Forward-only. Production application requires a separate reviewed deployment.

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'supabase' check (provider in ('supabase', 'static')),
  bucket text not null,
  storage_path text not null,
  public_url text not null,
  thumbnail_path text,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  optimized_size_bytes bigint not null check (optimized_size_bytes > 0),
  original_size_bytes bigint not null check (original_size_bytes > 0),
  mime_type text not null check (mime_type in ('image/webp', 'image/avif', 'image/jpeg', 'image/png')),
  category text not null check (category in ('officer', 'gallery', 'banner', 'patch', 'document-thumbnail')),
  entity_type text,
  entity_id uuid,
  variants jsonb not null default '[]'::jsonb check (jsonb_typeof(variants) = 'array'),
  is_public boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (provider, bucket, storage_path)
);

alter table public.media_assets enable row level security;
alter table public.media_assets force row level security;

create index if not exists media_assets_entity_idx
  on public.media_assets (entity_type, entity_id)
  where entity_id is not null;
create index if not exists media_assets_category_created_idx
  on public.media_assets (category, created_at desc);
create index if not exists media_assets_created_by_idx
  on public.media_assets (created_by);

drop policy if exists media_assets_read on public.media_assets;
create policy media_assets_read on public.media_assets
  for select to anon, authenticated
  using (
    is_public
    or (select public.get_user_role()) = any (array[
      'devcom_head'::text, 'officer'::text, 'comm_content'::text,
      'comm_registration'::text, 'comm_photobooth'::text
    ])
  );

drop policy if exists media_assets_staff_insert on public.media_assets;
create policy media_assets_staff_insert on public.media_assets
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select public.get_user_role()) = any (array[
      'devcom_head'::text, 'officer'::text, 'comm_content'::text,
      'comm_registration'::text, 'comm_photobooth'::text
    ])
  );

drop policy if exists media_assets_staff_update on public.media_assets;
create policy media_assets_staff_update on public.media_assets
  for update to authenticated
  using ((select public.get_user_role()) = any (array[
    'devcom_head'::text, 'officer'::text, 'comm_content'::text,
    'comm_registration'::text, 'comm_photobooth'::text
  ]))
  with check ((select public.get_user_role()) = any (array[
    'devcom_head'::text, 'officer'::text, 'comm_content'::text,
    'comm_registration'::text, 'comm_photobooth'::text
  ]));

drop policy if exists media_assets_staff_delete on public.media_assets;
create policy media_assets_staff_delete on public.media_assets
  for delete to authenticated
  using ((select public.get_user_role()) = 'devcom_head'::text);

revoke all on table public.media_assets from anon, authenticated;
grant select on table public.media_assets to anon, authenticated;
grant insert, update, delete on table public.media_assets to authenticated;
grant all on table public.media_assets to postgres, service_role;

-- Add only the indexes identified as missing against the pulled production schema.
create index if not exists announcements_author_id_idx on public.announcements (author_id);
create index if not exists concern_replies_admin_id_idx on public.concern_replies (admin_id);
create index if not exists concerns_assigned_committee_id_idx on public.concerns (assigned_committee_id);
create index if not exists events_created_by_idx on public.events (created_by);
-- Production already has this column and foreign key; older local migration
-- histories do not. Reconcile the drift without rewriting an applied migration.
alter table public.ip_bans
  add column if not exists banned_by uuid references public.profiles (id) on delete set null;
create index if not exists ip_bans_banned_by_idx on public.ip_bans (banned_by);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists officers_committee_id_idx on public.officers (committee_id);
create index if not exists photobooth_gallery_profile_id_idx on public.photobooth_gallery (profile_id);
create index if not exists profiles_approved_by_idx on public.profiles (approved_by);

-- Exact duplicate indexes confirmed from the production schema snapshot. None back a constraint.
drop index if exists public.idx_concerns_profile;
drop index if exists public.idx_registrations_profile;
drop index if exists public.messages_conversation_created_idx;
drop index if exists public.idx_profiles_committee;

-- Evaluate auth.uid() once per statement and retain the least-privilege profile
-- contract: full rows are visible only to the owner and DevCom head.
drop policy if exists profiles_select_owner_or_staff on public.profiles;
drop policy if exists profiles_select_owner_or_devcom on public.profiles;
create policy profiles_select_owner_or_devcom on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.get_user_role()) = 'devcom_head'
  );

drop policy if exists conversations_owner_insert on public.conversations;
create policy conversations_owner_insert on public.conversations
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists conversations_owner_read on public.conversations;
create policy conversations_owner_read on public.conversations
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.get_user_role() = any (array['devcom_head'::text, 'officer'::text])
  );

drop policy if exists messages_owner_or_staff_read on public.messages;
create policy messages_owner_or_staff_read on public.messages
  for select to authenticated
  using (exists (
    select 1
    from public.conversations conversation
    where conversation.id = messages.conversation_id
      and (
        conversation.profile_id = (select auth.uid())
        or public.get_user_role() = any (array['devcom_head'::text, 'officer'::text])
      )
  ));

drop policy if exists messages_scoped_insert on public.messages;
create policy messages_scoped_insert on public.messages
  for insert to authenticated
  with check (
    (
      sender_role = 'student'
      and sender_id = (select auth.uid())
      and exists (
        select 1 from public.conversations conversation
        where conversation.id = messages.conversation_id
          and conversation.profile_id = (select auth.uid())
      )
    )
    or (
      sender_role = 'admin'
      and sender_id = (select auth.uid())
      and public.get_user_role() = any (array['devcom_head'::text, 'officer'::text])
    )
  );

drop policy if exists registrations_owner_or_staff_read on public.event_registrations;
create policy registrations_owner_or_staff_read on public.event_registrations
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.get_user_role() = any (array['devcom_head'::text, 'comm_registration'::text])
  );

drop policy if exists concerns_owner_insert on public.concerns;
create policy concerns_owner_insert on public.concerns
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

drop policy if exists concerns_owner_read on public.concerns;
create policy concerns_owner_read on public.concerns
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.get_user_role() = any (array['devcom_head'::text, 'officer'::text])
  );

drop policy if exists concern_replies_owner_or_staff_read on public.concern_replies;
create policy concern_replies_owner_or_staff_read on public.concern_replies
  for select to authenticated
  using (exists (
    select 1 from public.concerns concern
    where concern.id = concern_replies.concern_id
      and (
        concern.profile_id = (select auth.uid())
        or public.get_user_role() = any (array['devcom_head'::text, 'officer'::text])
      )
  ));

drop policy if exists concern_replies_staff_insert on public.concern_replies;
create policy concern_replies_staff_insert on public.concern_replies
  for insert to authenticated
  with check (
    admin_id = (select auth.uid())
    and public.get_user_role() = any (array['devcom_head'::text, 'officer'::text])
  );

-- Consolidate the photobooth SELECT and INSERT policies without widening access.
drop policy if exists gallery_admin_all on public.photobooth_gallery;
drop policy if exists gallery_insert_own on public.photobooth_gallery;
drop policy if exists gallery_public_read_featured on public.photobooth_gallery;
drop policy if exists gallery_select_own on public.photobooth_gallery;
drop policy if exists gallery_scoped_read on public.photobooth_gallery;
drop policy if exists gallery_public_featured_read on public.photobooth_gallery;
drop policy if exists gallery_authenticated_scoped_read on public.photobooth_gallery;

create policy gallery_public_featured_read on public.photobooth_gallery
  for select to anon
  using (featured = true);
create policy gallery_authenticated_scoped_read on public.photobooth_gallery
  for select to authenticated
  using (
    featured = true
    or profile_id = (select auth.uid())
    or public.get_user_role() = any (array['devcom_head'::text, 'comm_photobooth'::text])
  );
create policy gallery_scoped_insert on public.photobooth_gallery
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    or public.get_user_role() = any (array['devcom_head'::text, 'comm_photobooth'::text])
  );
create policy gallery_staff_update on public.photobooth_gallery
  for update to authenticated
  using (public.get_user_role() = any (array['devcom_head'::text, 'comm_photobooth'::text]))
  with check (public.get_user_role() = any (array['devcom_head'::text, 'comm_photobooth'::text]));
create policy gallery_staff_delete on public.photobooth_gallery
  for delete to authenticated
  using (public.get_user_role() = any (array['devcom_head'::text, 'comm_photobooth'::text]));

-- Split broad FOR ALL policies so public SELECT policies do not overlap staff policies.
drop policy if exists officers_devcom_write on public.officers;
drop policy if exists officers_devcom_insert on public.officers;
drop policy if exists officers_devcom_update on public.officers;
drop policy if exists officers_devcom_delete on public.officers;
create policy officers_devcom_insert on public.officers for insert to authenticated
  with check (public.get_user_role() = 'devcom_head');
create policy officers_devcom_update on public.officers for update to authenticated
  using (public.get_user_role() = 'devcom_head') with check (public.get_user_role() = 'devcom_head');
create policy officers_devcom_delete on public.officers for delete to authenticated
  using (public.get_user_role() = 'devcom_head');

drop policy if exists announcements_content_write on public.announcements;
drop policy if exists announcements_content_insert on public.announcements;
drop policy if exists announcements_content_update on public.announcements;
drop policy if exists announcements_content_delete on public.announcements;
create policy announcements_content_insert on public.announcements for insert to authenticated
  with check (public.get_user_role() = any (array['devcom_head'::text, 'comm_content'::text]));
create policy announcements_content_update on public.announcements for update to authenticated
  using (public.get_user_role() = any (array['devcom_head'::text, 'comm_content'::text]))
  with check (public.get_user_role() = any (array['devcom_head'::text, 'comm_content'::text]));
create policy announcements_content_delete on public.announcements for delete to authenticated
  using (public.get_user_role() = any (array['devcom_head'::text, 'comm_content'::text]));

drop policy if exists events_registration_write on public.events;
drop policy if exists events_registration_insert on public.events;
drop policy if exists events_registration_update on public.events;
drop policy if exists events_registration_delete on public.events;
create policy events_registration_insert on public.events for insert to authenticated
  with check (public.get_user_role() = any (array['devcom_head'::text, 'comm_registration'::text]));
create policy events_registration_update on public.events for update to authenticated
  using (public.get_user_role() = any (array['devcom_head'::text, 'comm_registration'::text]))
  with check (public.get_user_role() = any (array['devcom_head'::text, 'comm_registration'::text]));
create policy events_registration_delete on public.events for delete to authenticated
  using (public.get_user_role() = any (array['devcom_head'::text, 'comm_registration'::text]));

-- Skip Edge Function invocations when neither outbox nor queue has actionable work.
create or replace function internal.invoke_email_worker()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  if not exists (
    select 1 from internal.email_outbox
    where status in ('pending', 'failed') and attempts < 5
  ) and not exists (
    select 1 from public.email_queue
    where (
      status = 'pending'
      or (status = 'failed' and attempts < 3)
      or (status = 'processing' and lease_expires_at <= now())
    ) and coalesce(scheduled_for, now()) <= now()
  ) then
    return null;
  end if;

  v_url := internal.get_vault_secret('email_worker_url');
  v_secret := internal.get_vault_secret('email_worker_secret');
  if nullif(btrim(v_url), '') is null or nullif(btrim(v_secret), '') is null then
    insert into internal.email_worker_invocations (status, error_code)
    values ('configuration_error', 'WORKER_SECRET_OR_URL_MISSING');
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Queue-Worker-Secret', v_secret),
    body := '{"source":"pg_cron"}'::jsonb,
    timeout_milliseconds := 10000
  ) into v_request_id;
  insert into internal.email_worker_invocations (request_id, status)
  values (v_request_id, 'requested');
  return v_request_id;
exception when others then
  insert into internal.email_worker_invocations (status, error_code)
  values ('invocation_error', sqlstate);
  return null;
end;
$$;

revoke all on function internal.invoke_email_worker() from public, anon, authenticated;
grant execute on function internal.invoke_email_worker() to postgres, service_role;
