# CCIS 1,700-Student Scaling Implementation Plan

## Safety boundary

This implementation keeps the production application available and leaves production data unchanged until a separate approval. The following actions are explicitly gated:

- pushing database migrations;
- deploying Edge Functions or frontend builds;
- replacing production media references;
- running an `--apply` storage conversion;
- deleting original Storage objects; and
- load-testing production.

New media is uploaded before any record is updated. Existing objects are retained. The migration utility defaults to dry-run and never deletes originals.

## Measured baseline

The 2026-08-27 production snapshot contains 62 Storage objects totaling 150.50 MiB. The 23 officer originals total 101.71 MiB and use one-hour caching. A complete transfer of that set is approximately 5.33 GB for 50 users and 181.30 GB for 1,700 users. The database advisor currently reports 62 performance notices: 12 RLS init-plan warnings, 9 unindexed foreign keys, 27 multiple-permissive-policy notices, 4 duplicate-index notices, and 10 unused-index observations.

The authoritative measurements and assumptions are recorded in `docs/SCALING_BASELINE.md`.

## Implementation slices

1. **Measurement and guardrails**
   - Add a read-only database audit script and committed baseline.
   - Add media/request/Realtime development telemetry with no production UI.
   - Add transfer budgets and a local/staging load-test profile.

2. **New-upload optimization**
   - Validate signatures and decoded images before upload.
   - Normalize orientation, resize, strip metadata, and emit WebP.
   - Use category presets, byte ceilings, content hashes, versioned paths, and one-year immutable caching.
   - Generate gallery card thumbnails and banner card/mobile variants.
   - Show administrators original and optimized sizes before save.

3. **Provider-independent public media**
   - Add a `PublicMediaProvider` contract with Supabase as the default.
   - Support a configured static/CDN base URL without shipping credentials.
   - Keep protected documents out of the public-provider path.
   - Record paths, URLs, variants, dimensions, byte sizes, MIME types, and hashes in a new RLS-protected media metadata table while retaining legacy URL fields during rollout.

4. **Existing-object conversion**
   - Add a dry-run-first, resumable utility with bucket/folder/limit/manifest/apply flags.
   - Download with bounded concurrency, optimize to new names, upload via the Storage API, verify readability, and produce a reference-update manifest.
   - Update references transactionally only after approval; retain originals for rollback.

5. **Frontend egress**
   - Add a reusable responsive/lazy image component with intrinsic dimensions and a branded fallback.
   - Fetch officer/gallery data only when needed and page large collections.
   - Use card/mobile variants in lists; fetch full assets only in open detail views.
   - Render only active carousel media.
   - Keep PDFs metadata-only until an explicit Preview or Download action.

6. **Chat and Realtime**
   - Remove global conversation creation and unfiltered message channels.
   - Initialize chat only when opened, paginate history, use explicit projections, and deduplicate request/results.
   - Keep at most one conversation-scoped channel, pause it while hidden/offline, and remove it on close/unmount/logout.
   - Cache the authenticated profile per session and avoid refresh-event refetches.
   - Restrict verification RPCs to active authorized admin screens.

7. **Database and worker performance**
   - Create a CLI-generated migration for equivalent `(select auth.uid())` policy predicates and verified useful FK indexes.
   - Consolidate only provably equivalent permissive policies.
   - Drop only confirmed duplicate non-constraint indexes and leave unused-index candidates for observation.
   - Add rollback SQL and role-matrix RLS tests.
   - Keep the authenticated, batched, idempotent email worker; reduce empty-queue work only if the current contract permits it without losing delivery latency.

8. **Validation and handoff**
   - Run TypeScript, unit tests, database/RLS tests, Edge checks, production build, bundle budget, migration lint/diff, and advisors.
   - Run browser transfer/request checks and local or staging load tests at 50, 200, and 500 concurrent users plus a 1,700-account population model.
   - Publish measured before/after results, remaining risks, deployment steps, and rollback steps.

## Exit criteria before production approval

- No ordinary public page creates a conversation or opens a message channel.
- Repeated chat mount/open/close cycles leave zero leaked channels.
- Officer initial media is below 3 MiB and no officer asset exceeds 300 KB.
- No banner exceeds 1 MiB and no large PDF loads automatically.
- Versioned media returns long-lived immutable cache headers.
- Storage metadata is not queried once per rendered image.
- RLS tests pass for anon, authenticated owner, staff, administrator, and developer roles.
- The post-change advisor output and migration diff are reviewed.
- The production runbook contains explicit checkpoints and a tested rollback path.
