# Supabase Standards Audit

**Date:** 2026-08-23
**Scope:** Database layer, PostgreSQL RPCs/triggers, RLS, storage policies, and Supabase Edge Functions in `/home/charles/Documents/Misc/CCIS`
**Standards:** `/home/charles/Documents/Standards/Supabase Standards.md`

This is a targeted static audit. Live catalog state, deployed function settings, database grants, bucket contents, and production traffic were not available. Findings marked probable must be confirmed against the linked Supabase project before destructive changes.

---

## Overall Score

| Category | ERRORs | WARNINGs |
|----------|--------|----------|
| Security | 6 | 5 |
| Data Integrity | 4 | 2 |
| Performance | 1 | 3 |
| Code Quality | 0 | 3 |
| Error Handling | 1 | 1 |
| API Design | 0 | 2 |
| **Total** | **10** | **17** |

---

## CRITICAL — Must Fix Before Production

### 1. Automatic email processing is configured to fail closed

**Severity:** ERROR — Error Handling / DevOps
**Files:** `supabase/29_auto_cloud_email_processing.sql:11-29`; `supabase/functions/process-email-queue/index.ts:28-63`

The database trigger calls `process-email-queue` with only `Content-Type`. The Edge Function rejects every request without `Authorization`. The trigger also catches every exception and silently returns, so email inserts succeed while the queue is never processed automatically.

**Risk:** Verification, ticket, announcement, and event emails can remain queued indefinitely with no visible application failure.

**Fix:** Replace the trigger with a scheduled server-side invocation carrying a short-lived or dedicated secret, or use Supabase scheduled jobs. Do not put a service-role key in SQL. Remove the blanket silent exception or record invocation failures in an observable channel.

### 2. Legacy SQL can restore public access to the email dequeue RPC

**Severity:** ERROR — Security
**Files:** `supabase/28_grant_dequeue_emails.sql:4-7`; `supabase/10_email_queue_and_subscription.sql:51-71`; `supabase/migrations/20260818134000_add_email_queue_leases.sql:17-66`

The current migration restricts `dequeue_emails(integer, text)` to `service_role`, but the numbered scripts contain a separate one-argument function and a later script that grants it to `anon` and `authenticated`. The repository has two competing deployment systems and no single authoritative migration boundary.

**Risk:** Re-running a setup script can expose email recipients, HTML bodies, retry state, and queue mutation to public API roles. The wrong function signature may also cause the worker to call an older implementation without leases.

**Fix:** Retire numbered production SQL scripts or convert them into reviewed migrations. Drop every obsolete `dequeue_emails` overload, revoke from `PUBLIC`, `anon`, and `authenticated`, and grant only the current signature to `service_role`. Add a CI assertion for the final grants.

### 3. Privileged functions still use mutable `search_path`

**Severity:** ERROR — Security
**Files:** `supabase/migrations/20260819130000_audit_fixes_issues_1_to_20.sql:8-13,113-118,198-204,219-224`; `supabase/migrations/20260818162000_atomic_audience_attendance.sql:13-16`; `supabase/migrations/20260818153000_secure_account_deletion.sql:46-50,87-92,105-110,168-172`

Multiple `SECURITY DEFINER` functions use `SET search_path = public`. This leaves name resolution dependent on a mutable schema and conflicts with the Supabase hardening standard.

**Risk:** If an attacker can create or shadow an unqualified object in a searched schema, privileged code can resolve the wrong object. Exploitability depends on live schema privileges, but the function definitions are unsafe by construction.

**Fix:** Set `search_path = ''` and fully qualify every object and built-in that needs qualification, or move privileged helpers to a private schema. Revoke default execution from `PUBLIC` and grant only the intended caller role.

### 4. Student profile RPC allows client control of workflow and security fields

**Severity:** ERROR — Security / Data Integrity
**File:** `supabase/migrations/20260818193400_issue1_enforce_allowlist_rpc_live.sql:8-54`

`update_student_profile()` is correctly scoped to `auth.uid()`, but its allowlist includes `submitted_at`, `profile_complete`, `attendance_qr_code`, `attendance_qr_generated_at`, and `last_ip`. The function accepts arbitrary values for all of them and performs no transition or server-origin validation.

**Risk:** A student can mark a profile complete, forge submission time and IP data, or replace the attendance token. This undermines verification workflow and attendance identity checks.

**Fix:** Split ordinary profile editing from submission, subscription, QR issuance, and audit metadata. Derive IP from a trusted server boundary, generate QR tokens server-side, and enforce allowed state transitions in RPCs or constraints.

### 5. Raw profile data appears to be broadly readable

**Severity:** WARNING — Security
**Files:** `documentation/database.md:24-48`; application queries including `src/admin/sections/UserManager.tsx:57-193` and `src/admin/sections/VerificationManager.tsx:51-156`

The documentation describes profiles as readable by everyone, while the table contains email, student number, program, section, ban state, IP, verification metadata, and attendance QR fields. A final authoritative profile SELECT policy is not present in the migration stream reviewed.

**Risk:** Public or ordinary authenticated clients may enumerate sensitive student and attendance data.

**Fix:** Confirm `pg_policies` in production. Restrict profile reads to the owner and explicitly authorized admin roles. Create a narrow public directory view containing only fields intended for public display, with `security_invoker = true` where supported.

---

## HIGH — Fix Before Release

### 6. No rate limiting on high-impact RPCs or Edge Functions

**Severity:** ERROR — Security / Performance
**Files:** `supabase/functions/send-ticket-email/index.ts:19-204`; `supabase/functions/process-email-queue/index.ts:11-189`; `supabase/functions/delete-user/index.ts:13-287`; `supabase/migrations/20260819130000_audit_fixes_issues_1_to_20.sql:113-182`; `supabase/migrations/20260818162000_atomic_audience_attendance.sql:3-79`

There is no per-user, per-IP, per-target, or global quota. Authenticated callers can repeatedly send ticket emails, enqueue verification emails, invoke queue batches, scan attendance, or retry deletion.

**Risk:** Email abuse and provider cost, queue starvation, attendance brute force, and resource exhaustion. Authentication is not rate limiting.

**Fix:** Add database-backed counters or a gateway limit for each operation. Return `429` with `Retry-After`; use stricter limits for email, QR scanning, deletion, and admin batch operations. Log safe operation identifiers and outcomes.

### 7. Ticket email dispatch is not idempotent

**Severity:** ERROR — Data Integrity
**File:** `supabase/functions/send-ticket-email/index.ts:114-204`

The function sends an email on every successful request and does not accept or persist an idempotency key. A retry after a timeout or a user double-submit sends another ticket.

**Risk:** Duplicate customer emails and uncontrolled provider usage.

**Fix:** Require an idempotency key tied to registration and email type, enforce it with a unique database constraint, persist the provider result, and return the stored result on retries.

### 8. Queue delivery can duplicate after SMTP success

**Severity:** ERROR — Data Integrity
**File:** `supabase/functions/process-email-queue/index.ts:119-164`

The worker sends mail first and updates `email_queue` afterward. If SMTP succeeds and the status update fails or the worker crashes, lease expiry makes the message eligible again.

**Risk:** Duplicate delivery, especially during network failures and function restarts.

**Fix:** Use a stable provider idempotency key per queue row, persist it before sending, and make claim/complete transitions explicit. If the provider cannot guarantee idempotency, model the state as `delivery_unknown` and reconcile instead of blindly retrying.

### 9. Verification email queueing has no deduplication

**Severity:** ERROR — Data Integrity
**File:** `supabase/migrations/20260819130000_audit_fixes_issues_1_to_20.sql:113-182`

`queue_verification_emails()` inserts two rows on every call. There is no submission identifier, cooldown, unique logical key, or `ON CONFLICT` clause.

**Risk:** Repeated UI retries or deliberate calls create an unbounded email backlog and duplicate notifications.

**Fix:** Add a stable submission/event key and a unique constraint such as `(profile_id, email_type, submission_id)`, then use `ON CONFLICT DO NOTHING`. Add a bounded resend policy.

### 10. Legacy gallery policies allow anonymous inserts

**Severity:** ERROR — Security
**Files:** `supabase/04_missing_tables.sql:29-45`; `supabase/15_gallery_fix.sql:19-48`

The legacy policy allows `INSERT` when `profile_id IS NULL`. The later gallery policy does not clearly remove every policy from the first script, and permissive policies combine with OR.

**Risk:** Anonymous users may create arbitrary gallery rows and associated storage references if the legacy policy remains active.

**Fix:** Explicitly drop every legacy gallery write policy by name. Keep one authenticated admin write policy, or a narrowly scoped authenticated photobooth upload policy. Add an integration test that asserts anonymous INSERT is rejected.

### 11. Student message UPDATE policy is broader than read-state mutation

**Severity:** ERROR — Security / Data Integrity
**File:** `supabase/21_messages_update_rls.sql:12-28`

The student policy permits UPDATE on any row where `auth.uid() = student_id`, with no column-level restriction. It can therefore permit changes to content, sender identity, conversation, role, and read flags. A later migration removes these policies, but the legacy script can restore them.

**Risk:** Students can rewrite support messages or reassign message ownership if this script is applied after the restrictive migration.

**Fix:** Retire the script and expose only `mark_conversation_messages_read_by_student(UUID)`. Keep direct UPDATE disabled for students. If direct updates are unavoidable, enforce protected-column immutability with a reliable trigger and test every protected field.

### 12. Trigger-only functions retain callable or ambiguous grants

**Severity:** WARNING — Security
**Files:** `supabase/migrations/20260818184500_fix_profile_self_update_privilege_escalation.sql:85-145`; `supabase/29_auto_cloud_email_processing.sql:11-31`

`enforce_profile_update_security()` is granted to `authenticated` even though it is trigger-only. `auto_process_email_queue_fn()` has no explicit execution revoke. Trigger functions should not be exposed through PostgREST by default.

**Risk:** Unnecessary privileged API surface and inconsistent behavior across environments.

**Fix:** Revoke all function privileges from `PUBLIC`, `anon`, and `authenticated` for trigger-only functions; grant only the trigger execution role if required. Assert this in CI.

### 13. Storage buckets are public while the application handles potentially non-public content

**Severity:** WARNING — Security
**Files:** `supabase/14_gallery_setup.sql:47-55`; `supabase/17_transparency_setup.sql:50-58`; `supabase/18_patch_videos_setup.sql:50-89`

The buckets are created with `public = true`, and public object URLs are used by the app. Storage table SELECT policies cannot protect objects once public CDN URLs are exposed.

**Risk:** Anyone with a URL can retrieve reports, videos, thumbnails, or gallery objects. This is only safe if every object in each bucket is intentionally public.

**Fix:** Make buckets private by default. Use signed URLs for restricted content and separate published assets from drafts/private reports. Confirm existing bucket contents before changing visibility.

### 14. Security tests cover only a small subset of RLS and grants

**Severity:** WARNING — Testing / Security
**Files:** `supabase/tests/attendance_rpc.sql`; `supabase/tests/gallery_rls.sql`; `supabase/tests/messages_rls.sql`

Tests cover attendance, gallery writes, and message read behavior, but do not assert RLS enablement for every public table, FORCE RLS, public profile reads, storage visibility, RPC grants, function `search_path`, rate limits, queue deduplication, or Edge Function authorization.

**Risk:** A later numbered script can silently reopen a production boundary without CI detecting it.

**Fix:** Add catalog contract tests for every `public` table and exposed function. Test anon/authenticated/admin/service-role behavior, policy columns, public buckets, and all high-impact RPCs.

---

## MEDIUM — Fix Soon

### 15. RLS is not demonstrably enabled on every public table

**Severity:** WARNING — Security
**Evidence:** The repository contains explicit `ENABLE ROW LEVEL SECURITY` for only a subset of tables, while application code accesses `events`, `announcements`, `committees`, `theme_settings`, `banners`, and others. See the enablement scripts and `src` queries, for example `src/admin/sections/Dashboard.tsx:70-89` and `src/components/InfoHub.tsx:100-101`.

There is no single migration that enables and forces RLS for every `public` table. The numbered scripts are order-sensitive and the repository has no catalog assertion for missing coverage.

**Risk:** Any table created without RLS is reachable according to grants alone. This is a high-impact configuration gap even where a policy may happen to exist.

**Fix:** Query `pg_class`/`pg_namespace` in CI and fail if any exposed `public` table has `relrowsecurity = false`. Explicitly enable and force RLS where appropriate, then add role-specific policies.

### 16. Missing indexes on RLS/FK/query columns

**Severity:** WARNING — Performance
**Files:** `supabase/04_missing_tables.sql:11-18`; `supabase/05_messages_and_conversations.sql:43-100`; `supabase/12_user_verification_flow.sql:58-80`; `supabase/migrations/20260818162000_atomic_audience_attendance.sql:37-41`

The reviewed schema does not add indexes for several high-frequency policy and lookup columns, including `gallery_items.profile_id`, `messages.student_id`, `concerns.profile_id`, `event_registrations.profile_id`, and `profiles.attendance_qr_code`.

**Risk:** Full-table scans for RLS checks, attendance scans, account deletion, and admin lists as data grows.

**Fix:** Add targeted B-tree indexes after checking live query plans. At minimum verify indexes for every FK and every column used in RLS predicates. Use partial indexes for active/non-banned lookups where justified.

### 17. Registration RPC has a check-before-lock race

**Severity:** WARNING — Data Integrity / Concurrency
**File:** `supabase/migrations/20260819130000_audit_fixes_issues_1_to_20.sql:34-73`

The function checks for an existing registration before locking the event. Two concurrent first-time requests can both observe no row, then serialize on the event and one can fail on the unique constraint rather than return the existing registration deterministically.

**Risk:** Retry behavior is unstable and clients may report a server error after a successful concurrent registration.

**Fix:** Lock the event before the existence check, or use a unique constraint plus `INSERT ... ON CONFLICT` and return the existing row. Keep the capacity calculation inside the same transaction.

### 18. Queue trigger performs recipient fan-out inside the write transaction

**Severity:** WARNING — Performance / Data Integrity
**File:** `supabase/migrations/20260818133000_set_based_email_fanout.sql:12-30,46-64`

The set-based rewrite is better than the old per-recipient loop, but publishing an announcement or creating an event still inserts one queue row per subscriber synchronously in the source transaction.

**Risk:** A large subscriber list makes the user-facing write slow and increases lock duration. A failed fan-out rolls back the originating content write.

**Fix:** Persist one outbox event in the transaction and let a worker batch recipient expansion, or document and bound the supported subscriber count. Add indexes for the subscription predicate.

### 19. Schema definitions and application types have drifted

**Severity:** WARNING — Code Quality / Data Integrity
**Files:** `supabase/04_missing_tables.sql:11-18`; `supabase/14_gallery_setup.sql:6-17`; `supabase/15_gallery_fix.sql:9-17`; `src/types/database.ts:150-167`; `documentation/database.md:146-155`

`gallery_items` has two incompatible initial definitions. The app expects the later title/description/category/thumbnails shape, while the first definition creates `frame_id` and `featured` but not the later required fields. Theme code uses `preset_name`, while documentation says `name`.

**Risk:** Fresh environments can produce a schema that differs from the deployed environment; `CREATE TABLE IF NOT EXISTS` does not reconcile existing columns.

**Fix:** Keep one canonical migration history, add explicit column migrations, regenerate database types, and make a fresh database reset part of CI.

### 20. Destructive and non-idempotent setup scripts are mixed with migrations

**Severity:** WARNING — Data Integrity / DevOps
**Files:** `supabase/04_missing_tables.sql:81-82`; `supabase/01_faq_table.sql:4-23`; `supabase/07_user_management_rules.sql:15-49`; `supabase/migrations/20260818153000_secure_account_deletion.sql:1-15`

The repository includes `TRUNCATE ... CASCADE`, scripts that assume prior manual execution, duplicate policy creation, and a migration that explicitly depends on the numbered scripts. This is not a deterministic Supabase migration chain.

**Risk:** Re-runs can delete data, fail halfway through, or leave grants/policies dependent on operator ordering. Fresh environments may not match production.

**Fix:** Move schema and policy changes into ordered migrations, keep seed data separate, remove destructive statements from deploy paths, and validate with `supabase db reset` locally and CI migration replay. Use reviewed forward migrations for rollback.

---

## LOW — Cleanup / Verification

### 21. Probable garbage columns remain in `gallery_items`

**Severity:** WARNING — Code Quality / Data Integrity
**Files:** `supabase/04_missing_tables.sql:11-18`; `supabase/14_gallery_setup.sql:6-17`; `supabase/15_gallery_fix.sql:9-17`; `src/pages/GalleryPage.tsx:104-115`

Static application search found no read or write path for `gallery_items.frame_id` or `gallery_items.index_label`. `frame_id` exists only in the older table definition. `index_label` is added by the repair script but is not mapped into the app response. These are dead-column candidates, not proven safe-to-drop columns.

**Fix:** Query live `pg_attribute`, inspect historical data, and confirm no external consumer uses them. If unused, write a migration to drop them and remove stale type/schema references. Do not use `DROP COLUMN` until that inventory is complete.

### 22. `registration_count` is a stale type/schema name

**Severity:** WARNING — Code Quality
**Files:** `src/types/database.ts:111`; `supabase/06_events_with_slots.sql:11`; `supabase/migrations/20260818151000_align_event_capacity_statuses.sql:10`; `documentation/database.md:164-168`

The application reads `registered_count` from `events_with_slots`, while the TypeScript model still carries `registration_count`. This is not a physical garbage column, but it is a stale contract that can hide schema mistakes.

**Fix:** Keep only the canonical `registered_count` name in generated types and documentation, then regenerate types from the live schema.

### 23. Edge Functions accept arbitrary methods and unbounded JSON bodies

**Severity:** WARNING — API Design / Performance
**Files:** `supabase/functions/send-ticket-email/index.ts:19-65`; `supabase/functions/delete-user/index.ts:13-70`; `supabase/functions/process-email-queue/index.ts:11-19`

Only `OPTIONS` is handled specially. GET, PUT, and malformed or oversized JSON requests reach parsing or business logic. Provider calls also have no explicit timeout or bounded backoff policy.

**Risk:** Wasteful invocations, inconsistent 500 responses, memory pressure, and slow hung requests.

**Fix:** Require `POST`, reject unexpected content types, enforce a small body-size limit before parsing, validate payload shape, and add bounded timeouts/retry classification for external calls.

### 24. Direct external provider response content is logged

**Severity:** WARNING — Error Handling / Security
**File:** `supabase/functions/send-ticket-email/index.ts:192-206`

The function logs the full Resend error text and catches/logs arbitrary error objects. Provider responses can contain recipient addresses, request identifiers, or operational metadata.

**Fix:** Log only a request ID, provider status, and a redacted error code. Never log full request/response bodies or sensitive email data.

---

## Files With Zero Violations

No complete zero-violation file can be certified for the requested scope because live grants and final migration order were unavailable. The following reviewed areas had no specific additional finding:

- `supabase/migrations/20260818134000_add_email_queue_leases.sql` — uses `FOR UPDATE SKIP LOCKED`, leases, bounded batch size, and service-role-only dequeue grants.
- `supabase/migrations/20260818162000_atomic_audience_attendance.sql` — locks event/registration rows and handles repeat attendance scans.
- `supabase/migrations/20260818110806_repair_display_order_constraints.sql` — uses transaction-level advisory locks and scoped uniqueness for reorder operations.
- `supabase/tests/attendance_rpc.sql` — asserts authenticated execution and rejects anonymous execution for the attendance RPC.
- `supabase/tests/messages_rls.sql` — verifies protected message fields cannot be changed through the tested student path.

---

## Things that we're done correctly

- `supabase/migrations/20260818134000_add_email_queue_leases.sql:17-66` bounds dequeue size, uses `FOR UPDATE SKIP LOCKED`, records leases, caps attempts, and restricts the current dequeue function to `service_role`.
- `supabase/migrations/20260819130000_audit_fixes_issues_1_to_20.sql:69-90` performs event capacity checks under an event-row lock.
- `supabase/migrations/20260818162000_atomic_audience_attendance.sql:47-74` serializes attendance writes and returns an explicit already-attended result.
- `supabase/functions/delete-user/index.ts:30-61` verifies the bearer token and requires both a database role and server-side app metadata role before deletion.
- `supabase/functions/send-ticket-email/index.ts:44-99` verifies the caller identity and restricts ticket access to the registrant or approved staff roles.
- `supabase/functions/send-ticket-email/index.ts:10-17,101-105` escapes interpolated ticket fields before generating HTML.
- `supabase/migrations/20260818133000_set_based_email_fanout.sql:25-30,59-64` replaced the original per-recipient database loop with set-based inserts.

---

## Priority Fix Roadmap

### P0 — Stop unsafe or broken production behavior

| # | Issue | File(s) |
|---|-------|---------|
| 1 | Fix the queue trigger/function authentication mismatch | `29_auto_cloud_email_processing.sql`, `process-email-queue/index.ts` |
| 2 | Retire legacy scripts and revoke obsolete dequeue overloads | `28_grant_dequeue_emails.sql`, `10_email_queue_and_subscription.sql`, current migrations |
| 3 | Harden every SECURITY DEFINER function | Current migrations and numbered SQL |
| 4 | Narrow profile reads and profile self-update fields | `update_student_profile`, profile policies |
| 5 | Add rate limits to email, queue, attendance, registration, and deletion paths | RPCs and all Edge Functions |

### P1 — Prevent duplicates and data corruption

| # | Issue | File(s) |
|---|-------|---------|
| 6 | Add ticket-email and queue-delivery idempotency | `send-ticket-email`, `process-email-queue` |
| 7 | Deduplicate verification queueing | `20260819130000_audit_fixes_issues_1_to_20.sql` |
| 8 | Fix registration check-before-lock behavior | `20260819130000_audit_fixes_issues_1_to_20.sql` |
| 9 | Remove anonymous gallery insert policy and broad message UPDATE policy | `04_missing_tables.sql`, `21_messages_update_rls.sql` |
| 10 | Make bucket visibility intentional and enforce private/public separation | Storage setup scripts |

### P2 — Make the schema deterministic and observable

| # | Issue | File(s) |
|---|-------|---------|
| 11 | Establish one migration chain and remove destructive setup scripts | `supabase/*.sql`, `supabase/migrations/*` |
| 12 | Assert RLS, FORCE RLS, grants, function search paths, and storage policies in CI | `supabase/tests/*` |
| 13 | Add missing FK/RLS indexes and inspect query plans | Schema migrations |
| 14 | Reconcile gallery/theme schemas and regenerate types | `gallery_items`, `theme_settings`, `src/types/database.ts` |
| 15 | Confirm and remove dead gallery columns only after live inventory | `frame_id`, `index_label` |

---

*Generated by targeted audit on 2026-08-23 against Supabase standards. Heuristic N+1/round-trip analysis was included; the main queue fan-out and multi-step Edge Function round trips were reviewed. Static analysis only: live database catalog, deployed settings, and runtime load behavior still require verification.*
