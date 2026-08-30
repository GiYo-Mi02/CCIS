-- Permit rollback cleanup only for the staff member who created the media row.
-- The existing DevCom delete policy remains available for administrative cleanup.
drop policy if exists media_assets_creator_delete on public.media_assets;
create policy media_assets_creator_delete on public.media_assets
  for delete to authenticated
  using (created_by = (select auth.uid()));
