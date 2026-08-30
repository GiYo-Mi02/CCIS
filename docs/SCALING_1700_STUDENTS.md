# CCIS 1,700-Student Scaling Implementation Report

## Outcome

The repository contains the local implementation and guarded migration path for media compression, frontend egress reduction, lifecycle-scoped chat/Realtime, database-advisor remediation, idle email-worker gating, monitoring, and load-test preparation. Production remains unchanged pending explicit approvals.

## Root causes

- Public officer images were stored/rendered at multi-megabyte source sizes with one-hour caching.
- Administrative upload surfaces accepted raw images and stored only one public URL.
- Gallery/hero views could place many full images in the DOM, including hidden slides.
- Chat/unread behavior existed in global navigation/admin chrome in addition to page/widget channels.
- Profile/chat queries used broad projections and duplicated work across surfaces.
- Twelve owner RLS policies evaluated auth helpers per row; nine FKs lacked indexes; four index pairs were exact duplicates; broad staff policies overlapped public read policies.
- Cron called the email Edge Function every minute even if no work was actionable.

## Implemented repository changes

Media modules under `src/lib/media/` validate JPEG/PNG/WebP/AVIF signatures, correct orientation during canvas/sharp processing, strip metadata, resize without stretching, emit WebP, enforce category limits, build content-hashed `v1` paths, set one-year immutable cache metadata, and store dimensions/bytes/variants. Supabase remains the default provider. A configured static provider is read-only until a protected upload workflow exists, preventing browser-side privileged writes or accidental private-file movement.

Officer, gallery, event, announcement, patch-thumbnail, and PDF-preview uploads use the optimizer. Administrative feedback reports original/optimized sizes. PDF files require a `%PDF-` signature, use versioned paths, display saved size, and are fetched by PDF.js only after the detail modal opens.

`OptimizedImage` adds lazy loading, async decoding, intrinsic dimensions, optional responsive variants, and fallback behavior. Officer data waits for the organization tab. Gallery cards reveal 24 at a time; hidden carousel slides are not mounted; detail media loads on demand.

Student chat initializes only when opened, uses 30-message pages, explicit fields, result deduplication, one conversation-filtered INSERT channel, offline/hidden pause, and cleanup tracking. Account preview queries wait for the Messages tab. Admin global sidebar channels/polling were removed; the inbox owns one screen-scoped channel. Auth profiles are cached for five minutes and concurrent loads deduplicated.

## Scripts and migration

- `scripts/audit-supabase-usage.ts`: read-only aggregate audit with hashed object identifiers.
- `scripts/optimize-existing-storage-assets.ts`: dry-run by default; supports all requested flags; processes one object at a time, uploads via Storage API, verifies, transactionally updates known URL references, writes a manifest, and never deletes originals.
- `scripts/load/scaling-browse.k6.js`: local/staging profiles for 50, 200, 500, and a 1,700-account population at 10% concurrency.
- `supabase/migrations/20260828055012_optimize_scaling_egress_and_rls.sql`: CLI-created forward migration. Not applied.

## Before/after model

The 23 officer originals total 106,646,006 bytes. A 120 KiB average yields 2,826,240 bytes, a 97.35% reduction. The 300 KiB hard ceiling yields at least 93.38%. At 1,700 cold complete loads, modeled transfer falls from 181.30 GB to 4.80 GB at target. Actual results require approved conversion and after capture; targets are not production measurements.

## Email worker review

The worker already had authentication, bounded body, batch, lease, idempotency, retry, failure-state, and aggregate logging controls. The migration adds only an actionable-work gate before `net.http_post`. No Edge Function source deployment is required for that gate.

## Testing surfaces

Coverage includes image signatures/presets/cache/provider selection, deterministic version paths, image lazy behavior, message deduplication/channel cleanup, upload contracts, lazy chat, scoped subscriptions, pagination, profile caching, migration/index/RLS contracts, development-only telemetry, and dry-run/no-deletion behavior. Database assertions are in `supabase/tests/scaling_performance.sql`.

Current local verification on 2026-08-28:

- `npm run validate`: passed TypeScript checking, 47/47 tests, production build, bundle budget, and all four Edge Function Deno checks.
- `npm run test:db:local-postgres`: passed a clean replay of every repository migration, the security/RLS/database suites (including the new scaling assertions), and registration check-in concurrency testing.
- `supabase db lint --linked --level warning`: returned no schema errors against the current production schema.
- `git diff --check`: passed; the final diff also contains no detected hardcoded secret values.
- Rendered desktop/mobile browser QA was not run because no browser-control backend was available in this session. Responsive source contracts pass, but visual inspection remains a staging checkpoint.

The K6 script is prepared but must run only against local or approved staging. Authenticated API, Storage, and Realtime profiles require approved fixture accounts/keys and are intentionally not embedded.

## Remaining risks and manual work

- The 62 production objects still use one-hour caching and remain unoptimized.
- Database URL references still point to originals.
- Six local migration entries are absent from remote history; bulk `db push` is unsafe until reconciled.
- Served cache headers, browser transfer, Storage `info()` initiators, and post-change advisor counts require observation.
- Static/CDN migration requires an owner-selected provider, credentials, privacy review, and explicit approval. No provider was contacted.
- PDF byte optimization was not performed because financial-document readability needs source-specific review; delivery is deferred/preview-based instead.
- Unused indexes remain for multi-week observation.

## Production plan requiring approval

1. Reconcile the six local-only migration-history entries and review the remote diff.
2. Apply/test the scaling migration in approved development/staging.
3. Run application, Edge, database/RLS, and browser media/chat checks.
4. Review advisors, headers, requests, and cold/warm transfer.
5. Request separate approval for the production database migration.
6. Request separate approval for frontend deployment.
7. Run Storage dry-run and review its manifest.
8. Request separate approval for a one-object apply batch, verify, then repeat in bounded batches.
9. Keep originals through the rollback window. Deletion requires a new explicit approval.

See `docs/ROLLBACK_PLAN.md`, `docs/EGRESS_MONITORING.md`, and `docs/EGRESS_BEFORE_AFTER.md`.
