-- Media metadata is immutable from PostgREST. Cleanup state changes go through
-- a narrow RPC so callers cannot rewrite paths, ownership, or entity metadata.
drop policy if exists media_assets_staff_update on public.media_assets;
revoke update on table public.media_assets from authenticated;

create or replace function public.mark_media_asset_cleanup(
  p_bucket text,
  p_storage_path text,
  p_cleanup_status text,
  p_cleanup_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_cleanup_status not in ('active', 'pending', 'failed') then
    raise exception 'invalid cleanup status';
  end if;

  update public.media_assets
  set cleanup_status = p_cleanup_status,
      cleanup_requested_at = now(),
      cleanup_error = p_cleanup_error
  where bucket = p_bucket
    and storage_path = p_storage_path
    and (
      created_by = (select auth.uid())
      or public.get_user_role() = 'devcom_head'
    );

  if not found then
    raise exception 'media asset cleanup is not authorized';
  end if;
end;
$$;

revoke all on function public.mark_media_asset_cleanup(text, text, text, text) from public, anon;
grant execute on function public.mark_media_asset_cleanup(text, text, text, text) to authenticated;
