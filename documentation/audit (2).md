# Production Release Readiness Audit

**Date:** 2026-08-25
**Scope:** Branch `additionalFixes` at `12b2d5a` versus `origin/main` at `0e773fb`; React/Vite application, canonical Supabase migrations, RLS and grants, Edge Functions, Auth, email queue operations, CI, and deployment boundaries
**Standards:** Supabase RLS, Auth, Edge Function, database-linter, migration, least-privilege, and production verification guidance; repository security contracts; `documentation/audit (1).md`

This is a release-focused static and live audit. It includes read-only checks against the linked Supabase project, anonymous Data API probes, deployed Edge Function and secret-name inventory, Vault/cron/queue counters, Supabase security and performance advisors, GitHub PR/CI state, and a local production build. No migration, secret, Edge Function, production setting, deployment, or merge was changed. Email delivery, authenticated role behavior, real institutional Google OAuth, account deletion, and end-to-end rendered behavior were not exercised because those checks would require test identities, outbound side effects, or deployment authority.

---

## Remediation Update

**Local status on 2026-08-25:** The corrective migration, scoped admin/scanner RPCs, RLS and storage-policy changes, email lease recovery, SECURITY DEFINER allowlist, duplicate-index cleanup, CLI pinning, CSP cleanup, bundle splitting, and operational documentation are implemented in the worktree. PDF.js was upgraded from the CommonJS 3.x build to the supported ESM 6.2.108 distribution; the production build now completes without the former `eval("require")` warning.

**Database evidence:** `npm.cmd run test:db:local-postgres` replayed the canonical application migration chain, including `20260825044618_production_release_readiness_fixes.sql`, against a fresh PostgreSQL 18 cluster and passed the security, public-content, profile-least-privilege, gallery, message, attendance, and email-recovery SQL suites. The standalone runner skips only the already-existing scheduled-worker migration because `pg_net`, `pg_cron`, and Supabase Vault are hosted extensions. The pinned linked dry run also passed with `--skip-vault --dns-resolver https` and listed only the new reviewed migration. Neither check changed the hosted database.

**Issues discovered during replay:** The SQL contract exposed a trigger-only email function that remained callable by authenticated users; the corrective migration now revokes that access. The public-content test also used duplicate FAQ order values; its fixture now uses unique values. Both fixes passed a clean replay.

**Still approval-gated:** Applying the pending migration, deploying Edge Functions, setting Edge/Vault secrets, reconciling hosted queue rows, validating cron/provider delivery, choosing leaked-password protection versus OAuth-only authentication, final-commit GitHub CI, and real OAuth/browser/scanner/deletion/email acceptance. No merge, push, deployment, hosted secret, Vault entry, cron setting, or Auth setting was changed.

---

## Overall Score

| Category | ERRORs | WARNINGs |
|----------|--------|----------|
| Security | 2 | 3 |
| Data Integrity | 2 | 0 |
| Error Handling | 1 | 0 |
| API Design | 1 | 0 |
| DevOps | 1 | 1 |
| Testing | 1 | 1 |
| Performance | 0 | 4 |
| Code Quality | 0 | 1 |
| **Total** | **8** | **10** |

---

## CRITICAL — Must Fix Before Production

### 1. Public RLS policies call a helper that `anon` cannot execute

**Severity:** ERROR — Security / Availability / API Design
**Files:** `supabase/migrations/20260824123000_rls_grants_and_storage.sql:80-122`; `src/components/FaqSection.tsx:12-20`; `src/RootRouter.tsx:14-24`
**Live evidence:** Anonymous Data API reads of active FAQs, published announcements, active themes, and featured photobooth items returned HTTP `401`, PostgreSQL code `42501`, with `permission denied for function get_user_role`.

The policies for `faqs`, `announcements`, and `theme_settings` apply to both `anon` and `authenticated`, but their `USING` expressions call `public.get_user_role()`. The live catalog correctly denies `anon` permission to execute that privileged helper. PostgreSQL is free to evaluate policy expressions without application-style short-circuit assumptions, so even requests filtered to public rows fail. The live-only `photobooth_gallery.gallery_admin_all` policy has the same defect because it applies to `PUBLIC` and participates in SELECT checks.

**Risk:** Public FAQ, announcement, theme, and featured photobooth content can fail to load for signed-out visitors. This is a confirmed linked-production failure, not a theoretical review comment.

**Fix:** Create a new forward migration. Do not edit `20260824123000`, because it is already recorded as applied remotely. Split public and staff access into separate policies: `TO anon` policies must contain only public-row predicates such as `is_active`, `status = 'published'`, or `featured`; authenticated staff policies may call a role helper after verifying its grant and behavior. Replace legacy `TO PUBLIC` policies with explicit `TO anon` and `TO authenticated` policies. Add anonymous HTTP or SQL role tests for each table, including active and inactive rows, and require a normal empty/result response rather than `401`.

### 2. Committee roles can read every sensitive column in `profiles`

**Severity:** ERROR — Security / Privacy
**File:** `supabase/migrations/20260824123000_rls_grants_and_storage.sql:48-57`
**Live evidence:** `authenticated` has table-level SELECT, and `profiles_select_owner_or_staff` permits `devcom_head`, `officer`, `comm_content`, `comm_registration`, and `comm_photobooth` to read matching profile rows. The live table contains email, student number, contact number, ban state, verification fields, `last_ip`, attendance QR token, and attendance token timestamp.

RLS restricts rows, not columns. Once one of the listed committee roles satisfies this policy, direct browser queries such as `.from('profiles').select('*')` can return complete profile rows. Content and photobooth roles do not need the full identity, security, verification, and attendance record merely to perform their assigned workflows.

**Risk:** A compromised or over-assigned staff account can enumerate private student data and reusable attendance tokens beyond operational need. This conflicts with the portal privacy policy's least-necessary-access statement.

**Fix:** Use a new forward migration to remove `comm_content`, `comm_registration`, and `comm_photobooth` from full-row profile SELECT access unless a documented workflow proves otherwise. Keep owner self-read. Give each committee a narrowly scoped RPC that returns only required columns and verifies `auth.uid()` plus the server-owned database role; alternatively use carefully granted column-limited interfaces. Do not create a default security-definer view that bypasses RLS. Add behavioral contract tests proving each committee role cannot select email, contact number, `last_ip`, ban metadata, verification metadata, or attendance tokens outside its approved workflow.

### 3. The scheduled email worker is continuously failing configuration checks

**Severity:** ERROR — Error Handling / DevOps
**Files:** `supabase/migrations/20260824124000_scheduled_email_worker.sql:16-98`; `supabase/setup_vault_secret.sql:1-51`; `supabase/functions/process-email-queue/index.ts`
**Live evidence:** The `ccis-email-worker` cron job is active every minute, but Vault contains neither `email_worker_url` nor `email_worker_secret`. The Edge secret inventory does not contain `EMAIL_WORKER_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, or `APP_ORIGIN`. The invocation log recorded exactly 1,440 `configuration_error` rows during the last 24 hours.

The migration intentionally fails closed when the URL or shared worker secret is absent. That security behavior is correct, but the required one-time hosted setup was never completed. A cron job that writes a known configuration failure every minute creates noise without delivering mail.

**Risk:** Verification, rejection, ticket, event, and announcement mail remains undelivered while application writes can still appear successful. The invocation table grows by 1,440 rows per day and can obscure new operational failures.

**Fix:** As an authorized production operation, generate a dedicated random worker secret, configure matching `email_worker_secret` in Vault and `EMAIL_WORKER_SECRET` in the Edge environment, configure the exact deployed worker URL as `email_worker_url`, and configure `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_ORIGIN`. Never reuse or expose the service-role/secret API key. Deploy the audited worker source, invoke one controlled test, confirm a `2xx` provider path and database completion transition, then add retention or aggregation for invocation telemetry. If configuration cannot be completed immediately, pause the cron job to stop predictable error growth while preserving queued mail.

### 4. Fifteen legacy queue rows are permanently stuck outside the lease-recovery path

**Severity:** ERROR — Data Integrity
**File:** `supabase/migrations/20260824121000_email_outbox_and_delivery.sql:198-242`
**Live evidence:** The queue contains 15 `processing` rows whose oldest creation date is 2026-08-04. Their `lease_expires_at` values are null. One additional item is pending and 100 are marked sent.

`dequeue_emails()` only recovers processing rows when `lease_expires_at IS NOT NULL AND lease_expires_at <= now()`. Legacy processing rows with null leases can never become candidates and remain invisible to normal retries.

**Risk:** These messages remain stuck indefinitely. Blindly moving them back to `pending` could duplicate delivery if an older worker sent them but failed to record completion.

**Fix:** Perform a one-time, reviewed reconciliation rather than a blanket retry. Compare each affected row against historical provider/SMTP evidence using non-sensitive identifiers. Mark confirmed deliveries `sent`, uncertain outcomes `delivery_unknown`, and only confirmed unsent rows `failed` or `pending` with a fresh schedule. Add a forward migration or bounded operator script that detects `processing` plus null lease, records the reconciliation reason, and prevents recurrence. Add a contract test with a legacy null-lease row.

### 5. The deployed Edge Function set does not match the repository contract

**Severity:** ERROR — API Design / DevOps
**Files:** `supabase/config.toml:11-18`; `supabase/functions/delete-user/index.ts`; `supabase/functions/send-ticket-email/index.ts`; `src/admin/sections/UserManager.tsx:232-288`; `.github/workflows/typecheck.yml:1-51`
**Live evidence:** The linked project lists only `process-email-queue` as ACTIVE, version 3, with JWT verification disabled. `delete-user` and `send-ticket-email` are absent. The admin UI directly invokes `delete-user` for single and batch deletion.

CI type-checks three functions but does not deploy or compare them with hosted versions. A successful Vercel/frontend deployment therefore cannot make the repository's server contract available.

**Risk:** Admin account deletion will fail at runtime. The hosted worker may also differ from the audited branch source and key-resolution contract. Missing or stale server code can make frontend and database verification misleading.

**Fix:** Add an approval-gated release step or runbook that deploys the exact reviewed commit of each required function with the intended JWT setting. Deploy `delete-user` with JWT verification enabled and `process-email-queue` with JWT verification disabled only because its body enforces the dedicated worker secret. Confirm whether `send-ticket-email` is still an active API; deploy it if supported or remove it from the runtime contract if the database outbox fully supersedes it. Verify deployed source hashes or versions after release and test unauthorized, forbidden, valid, and oversized requests.

### 6. Production migrations were applied before the application branch was merged

**Severity:** ERROR — DevOps / Data Integrity
**Files:** `supabase/migrations/*`; `.github/workflows/typecheck.yml:29-51`
**Live evidence:** The linked project reports every canonical migration through `20260824125000` as applied, while PR #7 remains open and `main` remains at `0e773fb`. The confirmed anonymous RLS failure is already present in the linked database.

The release process allowed the production schema and policies to advance ahead of the application release and reviewer approval. The workflow validates a fresh local database but has no staged production release order, compatibility gate, or rollback/roll-forward checkpoint.

**Risk:** `main` can run against an unmerged database contract, and a merge can deploy a frontend against partially configured Edge/Vault infrastructure. Failures can begin before the Git merge and cannot be repaired by merging frontend code alone.

**Fix:** Adopt an explicit release sequence: backward-compatible forward migration, database role smoke tests, Edge Function deployment, secret/Vault validation, preview smoke tests, frontend production deployment, then cleanup migrations. Record the exact commit and migration versions in the release checklist. Because the current migrations are already applied, all corrections must be new migrations; never rewrite applied history as the production fix.

---

## HIGH — Fix Before Release

### 7. CI security contracts pass while confirmed live access failures remain

**Severity:** ERROR — Testing / Security
**Files:** `supabase/tests/security_contract.sql:3-141`; `tests/supabase-contract.test.ts:12-85`; `.github/workflows/typecheck.yml:20-48`

The latest Validation workflow passed application checks, Edge Function type-checking, a clean migration replay, and database contracts. However, the contracts do not execute anonymous reads against FAQs, announcements, themes, or `photobooth_gallery`; do not verify least-privilege profile projections by committee role; do not compare deployed Edge Functions or hosted secret names; and do not assert that cron invocations succeed or the queue drains.

**Risk:** A green CI badge gives a false release signal even when anonymous production requests return `401` and the email worker records one configuration failure per minute.

**Fix:** Add role-behavior tests with seeded public/private rows and `SET LOCAL ROLE anon`/`authenticated`, plus JWT claims for each committee role. Test results and errors, not only catalog policy names. Expand the catalog contract to every exposed live table. Add a non-destructive staging or post-deploy smoke gate for public reads, function inventory/configuration names, cron health, and a synthetic mail item that uses a controlled recipient. Production smoke tests must be bounded and approval-gated.

### 8. Live tables and PUBLIC policies are missing from the canonical migration boundary

**Severity:** ERROR — Data Integrity / DevOps
**Files:** `supabase/migrations/20260824123000_rls_grants_and_storage.sql:9-45`; `supabase/tests/security_contract.sql:7-27`; `src/types/database.ts:54-63`
**Live evidence:** `committee_subteams` and `photobooth_gallery` exist in the linked `public` schema but have no definitions in `supabase/migrations`. Both have RLS enabled but not forced, broad table grants to `anon`, and policies assigned to `PUBLIC`. `photobooth_gallery` public featured reads return the same helper-permission `401`.

The canonical RLS migration and CI table list omit both tables, so clean migration replay cannot reproduce or test their live schema and policies.

**Risk:** Fresh, preview, and production databases can differ. Security fixes made only in production are lost from version control, while CI remains unaware of exposed objects.

**Fix:** Inventory the complete linked schema and create forward migrations that converge these objects without deleting data. Replace `TO PUBLIC` policies with explicit roles, apply FORCE RLS where compatible with intended server functions, and add both tables to security contracts. If either feature is retired, revoke API access and remove the live table only after data retention and consumer checks.

### 9. The message RLS test uses a guaranteed no-op update

**Severity:** WARNING — Testing / Data Integrity
**File:** `supabase/tests/messages_rls.sql:10-30`

The behavioral block performs `UPDATE public.messages ... WHERE false`, so it always affects zero rows regardless of grants or policies. The later catalog assertion that no direct UPDATE policy exists is valuable, but it does not prove that an unauthorized actor cannot mutate a real message through an unexpected grant, policy, trigger, or function path.

**Risk:** Message immutability regressions can pass CI. This concern remains explicitly noted in the PR review.

**Fix:** Seed a real conversation and message inside a transaction, authenticate as the student or an unrelated user, attempt an UPDATE targeting that row, and assert an insufficient-privilege/RLS error or unchanged protected columns. Separately test the two allowed read-state RPCs for ownership and staff-role enforcement. Roll back all test data.

### 10. Leaked-password protection is disabled while password authentication is enabled

**Severity:** WARNING — Security / Auth
**File:** `src/context/AuthContext.tsx:382-415`
**Live evidence:** The Supabase security advisor reports `auth_leaked_password_protection`. The client supports both `signInWithPassword()` and password-based `signUp()`.

**Risk:** Students can choose passwords already present in known breach corpora, increasing credential-stuffing risk. Client-side login cooldown is per browser state and is not a substitute for compromised-password screening or server-side abuse controls.

**Fix:** If the project is on Supabase Pro or above, enable leaked-password protection and enforce an appropriate minimum password policy in Auth settings. [Supabase password-security guidance](https://supabase.com/docs/guides/auth/password-security) documents this specific protection as a Pro-plan feature. If the project must remain on a plan without it, decide whether to disable password signup/sign-in and require institutional Google OAuth, or document compensating controls and accepted risk. Test signup, reset, and sign-in behavior after any Auth change.

### 11. Nineteen authenticated SECURITY DEFINER RPCs remain advisor-visible

**Severity:** WARNING — Security
**Files:** `supabase/migrations/20260818152000_dashboard_unread_counts.sql`; `supabase/migrations/20260818153000_secure_account_deletion.sql`; `supabase/migrations/20260818161000_restrict_message_read_updates.sql`; `supabase/migrations/20260824122000_identity_workflows_and_rate_limits.sql`
**Live evidence:** The Supabase security advisor reports 19 `authenticated_security_definer_function_executable` warnings.

Several warnings are expected because self-service RPCs must be callable by signed-in users and their bodies enforce `auth.uid()`, ownership, or database roles. However, privileged administrative, attendance, listing, and message functions share the same exposed `public` RPC surface, and current tests do not behaviorally prove every authorization path.

**Risk:** A future edit can remove an internal guard while leaving an authenticated grant intact; the advisor warning would look unchanged. Blanket dismissal makes real privilege regressions harder to detect.

**Fix:** Create an explicit reviewed allowlist containing signature, caller roles, reason for `SECURITY DEFINER`, internal authorization predicate, returned columns, and tests. Move non-API helpers to `internal`; revoke unused RPCs; prefer `SECURITY INVOKER` where elevated access is unnecessary. For every retained privileged RPC, test anonymous denial, ordinary-student denial where applicable, allowed ownership/role behavior, cross-user isolation, and bounded inputs. Do not blanket-convert functions that legitimately need elevated access.

**Remediation status:** Fixed locally. `documentation/security-definer-allowlist.md` records the intentional authenticated surface, the database contract fails on any unlisted function, and the corrective migration revokes direct API execution of trigger-only `auto_process_email_queue_fn()`.

---

## MEDIUM — Fix Soon

### 12. Twelve RLS policies re-evaluate Auth helpers per row

**Severity:** WARNING — Performance
**Files:** `supabase/migrations/20260824123000_rls_grants_and_storage.sql:48-230`; live `photobooth_gallery` policies

The Supabase performance advisor reports 12 `auth_rls_initplan` warnings across `photobooth_gallery`, `conversations`, `profiles`, `event_registrations`, `messages`, `concerns`, and `concern_replies`.

**Risk:** `auth.uid()` and equivalent stable role checks can be evaluated for every row during larger scans, increasing latency and database CPU as profiles, messages, registrations, and concerns grow.

**Fix:** After correcting authorization semantics, follow the [Supabase RLS performance guidance](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) and wrap stable helpers as scalar subqueries, for example `(select auth.uid())` and `(select public.get_user_role())`, only where the result is statement-stable and row-independent. Preserve ownership predicates and validate with query plans and role-behavior tests.

### 13. Twenty-seven overlapping permissive-policy advisories remain

**Severity:** WARNING — Performance / Security
**Files:** `supabase/migrations/20260824123000_rls_grants_and_storage.sql`; live policies on `committee_subteams` and `photobooth_gallery`

The advisor reports 27 `multiple_permissive_policies` warnings. Repeated tables include announcements, FAQs, committees, events, gallery items, officers, patch videos, themes, transparency reports, committee subteams, and the photobooth gallery. `FOR ALL` staff policies overlap public SELECT policies and `TO PUBLIC` expands some live policies to every role.

**Risk:** PostgreSQL evaluates multiple policies for the same role/action and ORs permissive results. This costs work and makes access reasoning harder; a broad policy can silently override a restrictive intention.

**Fix:** Replace `FOR ALL` with command-specific staff policies when SELECT is already handled, use explicit `TO anon`/`TO authenticated`, and consolidate equivalent SELECT logic where clarity improves. Re-run role-behavior tests and the advisor after each forward migration; do not optimize by accidentally removing required UPDATE `USING`/`WITH CHECK` protections.

### 14. Four duplicate index pairs add avoidable write overhead

**Severity:** WARNING — Performance
**Live evidence:** Supabase reports duplicate indexes on `concerns.profile_id`, `event_registrations.profile_id`, `messages` conversation ordering, and `profiles.committee_id`.

**Risk:** Duplicate indexes consume storage and add maintenance cost to inserts and updates without improving query coverage.

**Fix:** Compare definitions, constraint ownership, usage statistics, and query plans. Keep the canonical or constraint-backed index and remove only the redundant copy in a forward migration. Do not drop an index solely by name; verify columns, order, predicate, uniqueness, and dependency first.

### 15. CI installs an unpinned Supabase CLI version

**Severity:** WARNING — DevOps
**File:** `.github/workflows/typecheck.yml:38-40`

The workflow uses `supabase/setup-cli@v1` with `version: latest`. Supabase CLI behavior and local stack images can change independently of the branch.

**Risk:** A future CI run can fail or change migration/advisor behavior without a repository change, reducing reproducibility at the release gate.

**Fix:** Pin a reviewed Supabase CLI version and update it deliberately after reading release notes and running the full database reset/security suite. If possible, record the local stack image versions used by the successful release.

### 16. Production bundles exceed the current size warning threshold

**Severity:** WARNING — Performance / Security
**Files:** `vite.config.ts`; imports used by `src/admin/AdminApp.tsx`, `src/pages/AccountPage.tsx`, and `src/pages/BukasKabanPage.tsx`
**Build evidence:** The production build succeeds, but the main bundle is about 691 kB minified, the admin bundle about 855 kB, and the PDF worker about 1.09 MB. Rollup also warns that `pdfjs-dist/build/pdf.js` uses `eval`.

**Risk:** Larger initial downloads and parse/execute cost affect slower student devices and networks. The PDF dependency warning expands the amount of third-party code requiring security review and may conflict with stricter future CSP choices.

**Fix:** Measure actual route-level loading before changing architecture. Lazy-load admin, account PDF/export, transparency, and PDF viewer code; configure intentional manual chunks; verify that the PDF worker is loaded only where needed. Review the pinned `pdfjs-dist` version and supported non-eval/worker build options. Add a bundle-size budget so regressions are visible without treating the current warning as a build failure.

**Remediation status:** Fixed locally. The main and admin chunks are about 195 kB and 184 kB minified, PDF loading remains route-lazy, bundle budgets pass, and PDF.js 6.2.108's ESM build removes the Rollup `eval("require")` warning. The PDF worker is about 1.26 MB and remains within the explicit worker budget.

---

## LOW — Cleanup / Verification

### 17. Registration source describes a trigger that the migration removed

**Severity:** WARNING — Code Quality
**Files:** `src/components/Registration.tsx:250-252`; `supabase/migrations/20260824124000_scheduled_email_worker.sql:10-14,86-98`

The registration comment says email processing is handled by the `auto_process_email_queue_fn` insert trigger. The scheduled-worker migration explicitly drops that trigger and function and replaces them with `pg_cron` calling `internal.invoke_email_worker()`.

**Risk:** Future maintainers may debug or modify a retired delivery path and overlook the required Vault/cron configuration.

**Fix:** Update the comment to describe the transactional queue/outbox and scheduled worker. Keep operational details in `documentation/debugging_and_handover.md` and link to them rather than duplicating fragile implementation claims in UI code.

### 18. CSP still permits the retired IP lookup origin

**Severity:** WARNING — Security
**Files:** `vercel.json:8`; `public/_headers:13`; `tests/supabase-contract.test.ts:57-65`

Browser source no longer calls `api.ipify.org`, and a test asserts that it cannot invoke the retired lookup. Both production header definitions still permit that external origin in `connect-src`.

**Risk:** The browser is allowed to send data to an unnecessary third-party origin if another injection or compromised dependency finds a request path.

**Fix:** Remove `https://api.ipify.org` from both CSP definitions, confirm no production feature depends on it, deploy to preview, and verify the effective response header plus console behavior.

---

## Files With Zero Violations

Within this release-focused scope, no additional issue was found in the following reviewed files. This is not an absolute certification against future runtime or dependency changes.

- `supabase/functions/_shared/supabase-keys.js` — resolves migrated key maps, explicit new variables, and legacy fallbacks without exposing server secrets to browser code.
- `supabase/migrations/20260824125000_attendance_qr_registration_source.sql` — preserves the universal attendance token contract and records registered versus walk-in origin.
- `tests/supabase-keys.test.ts` — covers valid, fallback, malformed, and blank key-map cases.
- `tests/ticket-scanner.test.ts` — protects stable camera discovery and laptop/user-facing camera support.
- `tests/privacy-policy.test.ts` and `src/pages/PrivacyPolicyPage.tsx` — keep the privacy route public, informational, and free of unnecessary inputs.
- `supabase/legacy/README.md` — clearly marks archived numbered SQL as non-canonical and non-deployable.

---

## Things that were done correctly

- PR #7 is mechanically mergeable without a reported conflict, and the branch is clean and synchronized with `origin/additionalFixes` at `12b2d5a`.
- The latest GitHub [Validation](https://github.com/GiYo-Mi02/CCIS/actions/runs/32803508375) and [CodeQL](https://github.com/GiYo-Mi02/CCIS/actions/runs/32803508312) runs passed for the exact head commit. Validation covered TypeScript, 17 unit/static tests, production build, Deno Edge Function checks, clean Supabase migration replay, and database security contracts.
- Canonical production SQL is now under `supabase/migrations`; legacy numbered scripts were moved under `supabase/legacy` and documented as archived.
- `supabase/tests/security_contract.sql:31-64` checks fixed `search_path`, removes the obsolete dequeue overload, and prevents public execution of trigger-only and dequeue functions.
- `supabase/migrations/20260824121000_email_outbox_and_delivery.sql` implements logical keys, provider idempotency keys, bounded dequeue batches, `FOR UPDATE SKIP LOCKED`, leases, completion/failure transitions, and service-role-only worker RPC grants.
- `supabase/migrations/20260824122000_identity_workflows_and_rate_limits.sql` moves profile workflow, consent, preference, verification, registration, and attendance operations behind server-side RPCs with rate limits and state checks.
- `src/context/AuthContext.tsx` keeps the `onAuthStateChange` callback synchronous and defers profile hydration, avoiding the prior OAuth lock/loading behavior.
- Browser code no longer invokes the internal email worker or calls the retired IP lookup service.
- The production build and preview deployment complete successfully. These are useful signals, but they do not supersede the confirmed linked-backend failures above.

---

## Priority Fix Roadmap

### P0 — Stop broken or unsafe production behavior

| # | Issue | Required outcome |
|---|-------|------------------|
| 1 | Repair anonymous public-content policies | New forward migration; anonymous FAQ, announcement, theme, and photobooth reads return `200`, never helper-permission `401` |
| 2 | Narrow profile visibility | Committee roles can access only workflow-required fields; sensitive columns fail direct selection |
| 3 | Complete or pause email scheduling | Matching Vault/Edge worker secret, worker URL, provider configuration, and successful invocation; otherwise cron paused |
| 4 | Reconcile legacy processing rows | All 15 null-lease rows classified from evidence; no blind duplicate retry |
| 5 | Align hosted Edge Functions | Required functions deployed from the reviewed commit with verified JWT/custom-secret settings |
| 6 | Restore release ordering | Database, Edge, secrets, preview, frontend, and cleanup steps recorded and approval-gated |

### P1 — Make the release gate trustworthy

| # | Issue | Required outcome |
|---|-------|------------------|
| 7 | Expand RLS and deployment contracts | Role-behavior tests reproduce public and staff workflows and fail on the current defects |
| 8 | Converge live-only tables | `committee_subteams` and `photobooth_gallery` are represented, secured, and tested in canonical migrations |
| 9 | Replace no-op message test | A real unauthorized row update is denied or leaves protected fields unchanged |
| 10 | Decide password protection | Pro control enabled, or password auth removed/compensated with an explicit accepted-risk decision |
| 11 | Triage privileged RPCs | Every authenticated SECURITY DEFINER function is justified, least-privileged, and behaviorally tested |
| 12 | Clear reviewer gate | Blocking comments addressed in code and tests, re-review requested, and approval recorded before merge |

### P2 — Reduce operational and performance debt

| # | Issue | Required outcome |
|---|-------|------------------|
| 13 | Optimize RLS evaluation and overlap | Correct policies preserved while advisor counts decrease from the 12 init-plan and 27 overlap warnings |
| 14 | Remove duplicate indexes | Four redundant pairs reviewed and only dependency-safe duplicates removed |
| 15 | Pin release tooling | Supabase CLI version fixed in CI and updated deliberately |
| 16 | Set bundle budgets | Route-level lazy loading and a documented size threshold with no functional regression |
| 17 | Correct operational comments | Source and handover documentation describe cron/Vault delivery accurately |
| 18 | Tighten CSP | Retired IP lookup origin removed from Vercel and static-host headers |

---

## Required Pre-Merge Verification

1. Apply corrective work only as new forward migrations to a non-production environment first; replay the full canonical chain from a clean database.
2. Run anonymous and authenticated role tests for FAQs, announcements, themes, photobooth items, profiles, registrations, messages, and storage.
3. Confirm the Supabase security contract, gallery/message/attendance SQL tests, TypeScript, unit tests, production build, Edge Function type-checking, and CodeQL all pass on the final commit.
4. Confirm hosted function inventory and versions match that commit; verify required secret names and Vault names without printing values.
5. Confirm cron produces successful requests rather than `configuration_error`, a controlled synthetic email reaches the approved test inbox once, and queue counters advance to a terminal state.
6. Reconcile the 15 legacy processing rows before enabling normal retries.
7. Test signed-out public rendering, Google OAuth without manual refresh, password auth if retained, registration and ticket display, attendance scan, role-specific admin screens, and account deletion in preview/staging.
8. Request a fresh security review, resolve the existing changes-requested state, and merge only after the final head commit satisfies every P0 item.

---

*Generated by release-readiness audit on 2026-08-25 against the current branch and linked Supabase project. Live checks were read-only and credentials were redacted. The audit confirms database/API and operational state but does not claim outbound email delivery, real-user OAuth acceptance, destructive account-deletion behavior, or unrestricted visual production verification.*
