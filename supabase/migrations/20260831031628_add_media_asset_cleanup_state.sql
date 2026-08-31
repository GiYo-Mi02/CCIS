-- Keep cross-system media deletion retryable when Storage or metadata operations fail.
alter table public.media_assets
  add column if not exists cleanup_status text not null default 'active'
    check (cleanup_status in ('active', 'pending', 'failed')),
  add column if not exists cleanup_requested_at timestamptz,
  add column if not exists cleanup_error text;

create index if not exists media_assets_cleanup_idx
  on public.media_assets (cleanup_status, cleanup_requested_at)
  where cleanup_status <> 'active';
