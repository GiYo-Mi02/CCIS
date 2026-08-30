# Scaling Rollback Plan

No production action has been taken. Every stage requires its own checkpoint and approval.

## Frontend rollback

Redeploy the previously verified production commit. New optimized object URLs remain readable because names are immutable. Reverting the frontend does not require deleting Storage objects or database rows.

If media metadata insertion blocks an administrative upload, stop new uploads and roll back the application deployment. Do not expose a service key in the browser and do not bypass RLS.

## Storage-reference rollback

The optimization utility writes an old-to-new manifest and never deletes originals. For each verified record, use the manifest to transactionally restore the old URL in the applicable table/column, verify the application, and keep both objects. Do not manipulate `storage.objects` rows.

Original deletion is not part of this implementation. If requested later, it must be a separate reviewed command, use the Storage API, resolve exact paths from an approved manifest, and have an independent retention decision.

## Database rollback SQL

Prepare a new forward migration; do not edit an applied migration. Its reviewed content would restore prior policies from the production schema snapshot and, only if required, recreate the prior duplicate catalog:

```sql
create index if not exists idx_concerns_profile on public.concerns (profile_id);
create index if not exists idx_registrations_profile on public.event_registrations (profile_id);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists idx_profiles_committee on public.profiles (committee_id);
```

It would also restore the previous `internal.invoke_email_worker()` definition if idle gating delays work. Drop `public.media_assets` only after confirming no deployment depends on it and exporting nonsecret mapping data. Retain new FK indexes unless proven harmful. Never disable RLS during rollback.

## Deployment checkpoints

- Checkpoint A: local migration and all RLS tests pass.
- Checkpoint B: migration applied to approved development/staging; advisors and schema diff reviewed.
- Checkpoint C: frontend staged; upload, public media, PDF, chat, offline/resume, and cleanup browser tests pass.
- Checkpoint D: production database migration explicitly approved and applied.
- Checkpoint E: production frontend explicitly approved and deployed.
- Checkpoint F: Storage dry-run manifest reviewed, then a one-object `--apply --limit 1` batch separately approved.
- Checkpoint G: transfer/cache/reference verification succeeds before larger batches.

Stop at a failed checkpoint, roll back only that stage, and preserve logs/manifests without credentials or user data.
