# Database and Worker Changes

Migrations:

- `supabase/migrations/20260828055012_optimize_scaling_egress_and_rls.sql`
- `supabase/migrations/20260830091121_allow_media_asset_owner_cleanup.sql`

The file was created by Supabase CLI 2.115.0. It has not been pushed to production.

## Media metadata

`public.media_assets` records provider, bucket, immutable path, public URL, optional thumbnail path, dimensions, original and optimized byte sizes, MIME type, category, owning application entity, variants, creator, and visibility. RLS is forced. Public rows are readable by anonymous/authenticated clients; protected rows are visible only to existing staff roles. Staff can insert/update. Deletion remains available to `devcom_head`, and a second narrowly scoped policy lets the original creator delete their own row during failed-upload or replacement rollback. Grants are explicit.

Existing URL columns remain authoritative during staged rollout. The table does not move private drafts or make protected files public.

## Supporting indexes

The migration adds the nine production-advisor FK indexes confirmed missing: announcement author, concern-reply admin, concern assigned committee, event creator, IP-ban actor, message sender, officer committee, photobooth profile, and profile approver.

It drops four exact duplicate, non-constraint indexes after production-schema comparison: `idx_concerns_profile`, `idx_registrations_profile`, `messages_conversation_created_idx`, and `idx_profiles_committee`. Equivalent retained indexes remain. The ten unused-index candidates are not dropped.

## RLS initialization and consolidation

Owner comparisons on profiles, conversations, messages, event registrations, concerns, concern replies, and photobooth gallery evaluate `(select auth.uid())` once per statement. Full profile rows remain limited to the owner and DevCom head; committee workflows continue to use scoped RPCs.

Photobooth read/insert policies are consolidated so featured public access, owner access, and staff access remain explicit without multiple equivalent permissive checks. Broad `FOR ALL` staff policies on officers, announcements, and events are split into INSERT/UPDATE/DELETE policies so they do not overlap SELECT policies.

`supabase/tests/scaling_performance.sql` checks RLS, required indexes, removed duplicates, the optimized message policy, and the uploader-owned media cleanup policy. Existing role/RLS suites remain required before production approval.

## Email worker

The Edge Function already validates an internal secret with constant-time comparison, limits request bodies, dequeues ten records per batch, leases rows, uses provider idempotency keys, caps retries, applies exponential rescheduling, distinguishes unknown delivery outcomes, and dead-letters permanent failures.

The cron remains every minute for delivery latency, but `internal.invoke_email_worker()` now returns without HTTP when neither outbox nor queue contains actionable work. Secrets stay in Vault/environment variables. The function records configuration/invocation failures without logging recipient/content data.

At one tick per minute, the scheduler executes about 43,200 times in 30 days. After migration, Edge Function requests should approach minutes with actionable work rather than every cron tick. This must be measured after deployment.

## Pre-production checks

Run local database startup/tests, `supabase db lint`, migration list/diff, the full role/RLS suite, and advisors. Production currently has six local migration entries absent from remote history; those must be reconciled before any `db push`. Do not push the scaling migration as part of an unreviewed bulk set.
