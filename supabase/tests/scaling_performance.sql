\set ON_ERROR_STOP on

begin;

do $$
declare
  required_index text;
begin
  if not exists (
    select 1 from pg_class table_class
    join pg_namespace namespace on namespace.oid = table_class.relnamespace
    where namespace.nspname = 'public' and table_class.relname = 'media_assets'
  ) then
    raise exception 'media_assets table is missing';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.media_assets'::regclass) then
    raise exception 'media_assets RLS is not enabled';
  end if;

  foreach required_index in array array[
    'announcements_author_id_idx', 'concern_replies_admin_id_idx',
    'concerns_assigned_committee_id_idx', 'events_created_by_idx',
    'ip_bans_banned_by_idx', 'messages_sender_id_idx',
    'officers_committee_id_idx', 'photobooth_gallery_profile_id_idx',
    'profiles_approved_by_idx'
  ] loop
    if to_regclass('public.' || required_index) is null then
      raise exception 'required supporting index % is missing', required_index;
    end if;
  end loop;

  if to_regclass('public.idx_concerns_profile') is not null
    or to_regclass('public.idx_registrations_profile') is not null
    or to_regclass('public.messages_conversation_created_idx') is not null
    or to_regclass('public.idx_profiles_committee') is not null then
    raise exception 'a confirmed duplicate index still exists';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages'
      and policyname = 'messages_owner_or_staff_read'
      and qual like '%( SELECT auth.uid()%'
  ) then
    raise exception 'messages owner policy does not initialize auth.uid once';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'media_assets'
      and policyname = 'media_assets_creator_delete'
      and cmd = 'DELETE'
      and roles = array['authenticated']::name[]
      and qual like '%created_by = ( SELECT auth.uid()%'
  ) then
    raise exception 'media asset creator cleanup policy is missing or too broad';
  end if;
end
$$;

rollback;
