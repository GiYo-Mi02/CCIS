# Standards Compliance Audit - CCIS

**Date:** 2026-08-18
**Scope:** Full repository, excluding files ignored by `.gitignore`
**Method:** Second static review of the React/Vite client, Supabase SQL, Edge Functions, worker, deployment configuration, and available project checks. Production database state and deployed Edge Function gateway settings were not available. The second round re-checked the first audit and added independent findings for schema drift, RLS carry-over, queue behavior, N+1 behavior, accessibility, deployment compatibility, and Supabase key generation.

## Overall Score

| Category | ERRORs | WARNINGs |
|---|---:|---:|
| Security | 10 | 4 |
| Data Integrity | 2 | 3 |
| Performance | 0 | 5 |
| Code Quality | 0 | 1 |
| Error Handling | 0 | 3 |
| Logic | 0 | 1 |
| Testing | 0 | 2 |
| API Design | 0 | 1 |
| Concurrency | 0 | 1 |
| Accessibility | 0 | 2 |
| DevOps | 0 | 3 |
| **Total** | **12** | **26** |

## Verification

- `pnpm run lint` passed (`tsc --noEmit`).
- `pnpm run build` passed.
- Vite reported a 2,043.65 kB minified JavaScript chunk.
- No automated test script or test runner is defined in `package.json`.
- Round 2 did not have a live Supabase instance, deployed Edge Function configuration, or non-ignored environment files to verify.

## CRITICAL - Must Fix Before Deployment

### 1. `profiles` self-update permits privilege escalation

**Severity:** ERROR - Security
**Standards:** 1, 2, 4, 8, 10, 20
**Files:** `src/context/AuthContext.tsx:139-148`, `supabase/13_auto_create_profile.sql:52-57`, `supabase/25_security_linter_fixes.sql:645-661`

The client spreads arbitrary `Partial<Profile>` data into an upsert. The database update policy allows a user to update their own profile row without restricting columns. A student can therefore submit values such as `role = 'devcom_head'`, `status = 'approved'`, or `banned = false`. The role-sync trigger then copies the changed role into `auth.users.raw_app_meta_data`.

**Fix:** Replace the broad self-update policy with an allowlist of student-editable columns. Keep role, status, ban, approval, and other administrative fields writable only through server-controlled admin RPCs.

### 2. `register_for_event` trusts a caller-supplied profile ID

**Severity:** ERROR - Security
**Standards:** 2, 4, 8, 9, 10
**Files:** `supabase/23_event_registration_rpc.sql:4-19,71-74`, `supabase/25_security_linter_fixes.sql:696-768`, `src/components/Registration.tsx:213-217`

The `SECURITY DEFINER` RPC accepts `p_profile_id` and never checks it against `auth.uid()`. Any authenticated caller can register another profile for an event, reactivate that profile's cancelled registration, consume capacity, and trigger the ticket-email workflow for the selected profile.

**Fix:** Enforce `p_profile_id = auth.uid()` inside the function, or remove the parameter and derive the profile ID from `auth.uid()`. Use a separate restricted admin function for administrative registrations.

### 3. Authenticated users can create arbitrary outbound email

**Severity:** ERROR - Security
**Standards:** 4, 17, 18, 20
**Files:** `supabase/12_user_verification_flow.sql:81-84`, `src/pages/AuthPage.tsx:222-237`, `supabase/10_email_queue_and_subscription.sql:13-24`, `email_worker.js:81-103`

The `email_queue_insert_policy` allows every authenticated user to insert arbitrary recipient, subject, and HTML body values. The worker sends those rows through the configured SMTP account. This is an application-level open relay that can be used for phishing, abuse, or unexpected provider charges.

**Fix:** Remove the general insert policy. Queue mail only from trusted triggers or tightly scoped server-side functions that derive the recipient and body from database records.

### 4. The email dequeue RPC is exposed to anonymous callers

**Severity:** ERROR - Security
**Standards:** 4, 8, 10, 18
**Files:** `supabase/25_security_linter_fixes.sql:883-887`, `supabase/28_grant_dequeue_emails.sql:4-7`, `supabase/10_email_queue_and_subscription.sql:53-71`

Migration 25 revokes `dequeue_emails` from `anon` and `authenticated`, but migration 28 grants it back to both roles. The `SECURITY DEFINER` function returns full queue rows, including recipient addresses and HTML bodies, while marking them as processing. Applying the numbered scripts in order leaves the queue readable and controllable through the public API.

**Fix:** Revoke execution from `anon`, `authenticated`, and `public`; grant only to the server-side worker identity. Verify the final database grants after migration deployment.

### 5. `send-ticket-email` is an unauthenticated arbitrary email endpoint

**Severity:** ERROR - Security
**Standards:** 4, 18, 21, 22
**File:** `supabase/functions/send-ticket-email/index.ts:5-32,201-235`

The function permits wildcard CORS and does not authenticate the caller or look up `registrationId` before sending. Callers control the destination, name, section, college, event title, and HTML interpolation. When `RESEND_API_KEY` is configured, this becomes an open email relay and phishing surface.

**Fix:** Remove the function if the database queue is the canonical path. Otherwise require authenticated, role-appropriate calls, load registration data by ID server-side, validate the recipient against that record, escape HTML values, and rate-limit the operation.

### 6. Any authenticated caller can run the service-role queue processor

**Severity:** ERROR - Security
**Standards:** 4, 18, 20
**Files:** `supabase/functions/process-email-queue/index.ts:7-37,50-109`, `supabase/29_auto_cloud_email_processing.sql:10-38`

The function has wildcard CORS and no role check. Any authenticated browser session can invoke it; the function then uses `SUPABASE_SERVICE_ROLE_KEY` to dequeue and send all pending mail in batches, returning processing results and provider message IDs. The client explicitly invokes this function after registration. Migration 29 also creates an automatic trigger path into the processor without an authorization boundary.

**Fix:** Make processing server-to-server only, remove the browser invocation and unauthorized automatic trigger, and enforce a service authentication mechanism or scheduled trigger that cannot be called by ordinary users.

### 7. IP-ban records are publicly readable

**Severity:** ERROR - Security
**Standards:** 2, 4, 10
**File:** `supabase/22_ip_bans_setup.sql:23-32`

The `ip_bans_select` policy uses `USING (true)`, exposing every banned IP address, ban reason, actor, and timestamp to anonymous and authenticated clients.

**Fix:** Do not expose the table through public read access. Check only the caller's own IP through a server-side function, or keep all ban checks and management behind a trusted server boundary.

### 8. Anonymous-user purge SQL uses columns that do not exist

**Severity:** ERROR - Data Integrity
**Standards:** 9, 12, 16, 24
**File:** `supabase/33_delete_anonymous_users.sql:21-37,87-101`

The cleanup script and its `purge_anonymous_users()` function reference `conversations.student_id` and `event_registrations.user_id`. The current schema uses `conversations.profile_id` and `event_registrations.profile_id`; `student_id` exists on `messages`, not `conversations`. Both cleanup paths can fail before deleting their intended records.

**Fix:** Align the cleanup predicates with the current schema, run them in a transaction with a dry-run/count step, and test them against a disposable database snapshot before deployment.

### 22. Legacy gallery policy leaves unauthenticated inserts enabled

**Severity:** ERROR - Security
**Standards:** 4, 20
**Files:** `supabase/04_missing_tables.sql:23-40`, `supabase/15_gallery_fix.sql:19-48`

The numbered migrations create `gallery_items_user_insert` with `profile_id IS NULL`, allowing anonymous callers to insert rows. Migration 15 drops the old public/admin policy names but never drops `gallery_items_user_insert`, so applying the scripts in order leaves the permissive insert policy active alongside the later admin policy. A caller can create arbitrary public gallery records without authentication.

**Fix:** Drop the legacy user insert/delete policies in the final migration and create one authenticated admin-only write policy. Add an integration check that verifies anonymous `INSERT`, `UPDATE`, and `DELETE` are denied after all migrations run.

### 23. Students can rewrite message content and sender identity

**Severity:** ERROR - Security
**Standards:** 4, 20
**Files:** `supabase/21_messages_update_rls.sql:12-28`

The student update policy checks only `auth.uid() = student_id`. It does not restrict the columns that may change, even though the frontend only intends to update `read_by_student`. A student can submit an update that changes `content`, `sender_id`, `sender_role`, or `conversation_id`, including spoofing an administrative message or moving a message to another conversation while retaining the student ownership field.

**Fix:** Remove broad client `UPDATE` access and expose a narrow RPC for read-state changes, or enforce column-level privileges so students can update only their own read flag. Keep sender identity, role, content, and conversation ownership server-controlled.

### 24. Audience attendance writes use a nonexistent column and a revoked grant

**Severity:** ERROR - Data Integrity
**Standards:** 12, 16, 20, 24
**Files:** `src/admin/sections/TicketScanner.tsx:402-443`, `documentation/database.md:108-120`, `supabase/23_event_registration_rpc.sql:80-89`

The scanner looks up registrations with `event_registrations.user_id` and inserts new records with `user_id`, while the documented and migrated schema uses `profile_id`. The same migration also revokes direct `INSERT` from `authenticated`, so the fallback insert path cannot work even after the column name is corrected. The UI can display a successful audience check-in while no attendance row was written if the mutation result is not inspected.

**Fix:** Use a server-side attendance RPC that accepts a validated profile token and event ID, derives `profile_id`, performs an atomic already-attended check plus write, and returns a stable result. Remove the direct client insert path and check every RPC result before reporting success.

### 25. Deleting a profile does not revoke the Auth account

**Severity:** ERROR - Security
**Standards:** 4, 16, 20, 24
**Files:** `src/admin/sections/UserManager.tsx:213-239`, `src/context/AuthContext.tsx:96-123`

The admin delete action attempts to delete only the `public.profiles` row. It does not delete or disable the corresponding `auth.users` account. The auth context can then recreate a missing profile on the next authenticated session, which defeats the UI's promise to permanently purge the student and can restore access as a new student profile. The final deployed RLS behavior for the profile delete is not verifiable from the repository alone.

**Fix:** Move account deletion to a service-side admin function that revokes or deletes the Auth user and associated public data in a controlled transaction. Verify the profile delete result and final RLS policy. Do not auto-recreate profiles for accounts marked for deletion.

## WARNING - Fix Before Next Release

### 9. Attendance tokens are predictable and student numbers are accepted as credentials

**Severity:** WARNING - Security
**Standards:** 8, 20, 22
**Files:** `src/pages/AccountPage.tsx:70-85,373-404`, `src/admin/sections/TicketScanner.tsx:303-350`, `supabase/31_audience_attendance_qr.sql:1-8`

Tokens are generated with `Math.random()` and include the student's public student number. The scanner also queries directly by `student_number`, so a plain student number is accepted in place of the generated token.

**Fix:** Generate tokens with `crypto.randomUUID()` or server-side cryptographic randomness, store a hash when possible, and require the token path for attendance validation.

### 10. The local worker falls back to the anonymous key and logs recipient PII

**Severity:** WARNING - Security
**Standards:** 17, 18, 29
**File:** `email_worker.js:21-23,57-68,81-110`

The worker silently falls back from `SUPABASE_SERVICE_ROLE_KEY` to the public anonymous key. It also logs recipient email addresses and email types. With the current public dequeue grant, this fallback can make the worker operate under the same over-privileged public path instead of failing closed.

**Fix:** Require the service-role key and exit if it is missing. Redact recipient addresses and keep operational logs keyed by queue ID.

### 11. CSP allows inline scripts

**Severity:** WARNING - Security
**Standards:** 17
**Files:** `vercel.json:7-8`, `index.html:13-23`

Both CSP definitions allow `script-src 'unsafe-inline'`. This weakens the main browser mitigation against injected scripts.

**Fix:** Remove `unsafe-inline`; use external scripts, nonces, or hashes for the small set of required inline content. Keep one authoritative policy per deployment target.

### 12. Multi-step media updates can leave storage and database state inconsistent

**Severity:** WARNING - Data Integrity
**Standards:** 16, 23, 24, 35
**Files:** `src/pages/AccountPage.tsx:79-83,382-399`, `src/pages/BukasKabanPage.tsx:547-635`, `src/pages/PatchPage.tsx:738-801`

The account pass is written twice through two separate client calls. Transparency replacement deletes old storage files before the database update is known to succeed. Several upload flows treat storage and row updates as separate success paths, so a partial failure can leave orphaned files or rows pointing at deleted assets.

**Fix:** Use one server-side mutation per workflow, check every result, and use an explicit cleanup/retry strategy for storage objects.

### 13. Public and admin collection queries are unbounded

**Severity:** WARNING - Performance
**Standards:** 5, 15
**Files:** `src/pages/GalleryPage.tsx:90-99`, `src/pages/PatchPage.tsx:347-354`, `src/pages/BukasKabanPage.tsx:196-203`, `src/components/FaqSection.tsx:11-17`, `src/admin/sections/EventCalendar.tsx:1-20`, `src/admin/sections/FaqManager.tsx:1-35`

Several list views use `select('*')` with ordering but no limit or range. Gallery, videos, transparency reports, FAQs, and the admin calendar will transfer and render the entire table as data grows.

**Fix:** Add server-side pagination or bounded limits, select only displayed columns, and use a count query when the UI needs totals.

### 14. Sequential and duplicate round trips occur in user workflows

**Severity:** WARNING - Performance
**Standards:** 23
**Files:** `src/components/Registration.tsx:111-167,231-259`, `src/pages/AccountPage.tsx:192-229`, `src/context/AuthContext.tsx:184-201`

Registration loads counts, then registrations, then registration details; account messaging loads a conversation and then messages; auth initialization loads a profile, calls a third-party IP service, and then writes the profile. These are avoidable sequential round trips on page initialization and submission paths.

**Fix:** Join or batch related reads, use existing views/RPC results, and move nonessential telemetry out of the critical auth path.

### 15. The production JavaScript bundle is oversized

**Severity:** WARNING - Performance
**Standards:** 15
**Evidence:** `pnpm run build` output: `dist/assets/index-CzpjsIld.js` at 2,043.65 kB minified.

The application ships a single large initial bundle, increasing first-load cost on mobile and slower networks.

**Fix:** Lazy-load admin and rarely used page modules, split heavy chart/media/scanner dependencies, and verify the result with the bundle analyzer or equivalent build output.

### 16. Raw exception details are returned to clients

**Severity:** WARNING - Error Handling
**Standards:** 18, 22
**Files:** `supabase/functions/send-ticket-email/index.ts:228-235`, `supabase/functions/process-email-queue/index.ts:126-133`, `src/admin/sections/TicketScanner.tsx:474-482`

Provider errors, database messages, and internal exception text are returned directly in JSON or rendered in the UI. These messages can reveal schema, provider, or operational details.

**Fix:** Log detailed errors server-side with a request or queue ID and return stable, user-safe error codes/messages.

### 17. Several mutation results are ignored before showing success

**Severity:** WARNING - Error Handling
**Standards:** 19, 24
**Files:** `src/admin/sections/TicketScanner.tsx:429-443`, `src/pages/AccountPage.tsx:79-83`, `src/pages/BukasKabanPage.tsx:668-685`

Ticket attendance updates/inserts do not inspect returned errors before reporting success. The account auto-generation ignores the first update result, and transparency deletion warns on storage failure but still reports the whole operation as successful.

**Fix:** Check each mutation result, stop or clearly report partial completion, and avoid success UI until the authoritative write succeeds.

### 18. Migration scripts are manual, order-dependent, and internally contradictory

**Severity:** WARNING - DevOps
**Standards:** 16, 30, 35
**Files:** `supabase/04_missing_tables.sql`, `supabase/14_gallery_setup.sql`, `supabase/15_gallery_fix.sql`, `supabase/25_security_linter_fixes.sql`, `supabase/26_security_linter_remaining.sql`, `supabase/27_fix_rls_recursion.sql`, `supabase/28_grant_dequeue_emails.sql`

The repository does not use Supabase CLI migrations under `supabase/migrations/`. It contains numbered SQL editor scripts instead of one tracked migration history. Gallery schema and policies are created in multiple incompatible stages, `get_user_role()` changes from invoker to definer and back, and the dequeue grant is revoked then reintroduced. Correctness depends on manual execution order and final database state.

**Fix:** Adopt one migration history, make each migration transactional and idempotent where possible, remove superseded definitions, and verify the resulting grants/schema in CI or a disposable database.

**Migration workflow tutorial:**

1. Initialize and link the local project to Supabase:

   ```bash
   supabase init
   supabase link --project-ref <project-ref>
   ```

2. Pull the current remote schema into a migration file:

   ```bash
   supabase db pull
   ```

   This creates a SQL file under `supabase/migrations/`.

3. Create the next migration, edit the generated SQL, and commit it:

   ```bash
   supabase migration new add_registration_constraints
   # edit supabase/migrations/<timestamp>_add_registration_constraints.sql
   ```

4. Apply pending migrations locally or to the linked project:

   ```bash
   supabase migration up --local
   supabase migration up --linked
   supabase db push
   ```

   The current Supabase CLI uses singular `supabase migration up`; `supabase migrations up` is not the documented command form.

### 19. No executable automated test suite is defined

**Severity:** WARNING - Testing
**Standards:** 28
**File:** `package.json:6-11`

`package.json` defines `dev`, `build`, `preview`, `clean`, and `lint`, but no `test` script or test dependency. `TEST_CASES.md` is a manual test plan, not an executable regression suite.

**Fix:** Add a small test command covering auth/profile authorization and event registration RPC behavior first, then add browser coverage for the critical registration and admin flows.

### 20. Icon-only controls lack accessible names

**Severity:** WARNING - Accessibility
**Standards:** 32
**Files:** `src/admin/components/Modal.tsx:28-34,58-64`, `src/admin/components/Pagination.tsx:69-75,130-136`, `src/admin/components/Toast.tsx:29-34`, `src/admin/components/AdminTopbar.tsx:49-55,80-86,115-122`

Close, previous, next, menu, notifications, and logout controls render icons without an accessible name in several shared components. Tooltips or visual icon meaning do not provide a reliable accessible name.

**Fix:** Add `aria-label` values and use `aria-expanded` where a control opens a panel.

### 21. Selected pagination state is visual only

**Severity:** WARNING - Accessibility
**Standards:** 34
**File:** `src/admin/components/Pagination.tsx:76-107`

The current page is styled differently but is not exposed with `aria-current="page"`. Similar navigation controls should expose their selected state instead of relying on color.

**Fix:** Add `aria-current` to the active page and use `aria-pressed` or an appropriate tab pattern for toggle-style controls.

## SECOND ROUND ADDITIONS - WARNING

### 26. Supabase client and worker are wired to legacy key names

**Severity:** WARNING - DevOps
**Standards:** 30, 36
**Files:** `src/lib/supabase.ts:56-65`, `email_worker.js:21-36`, `documentation/debugging_and_handover.md:25-30`

The browser still expects `VITE_SUPABASE_ANON_KEY`, and the worker still expects `SUPABASE_SERVICE_ROLE_KEY` with an anonymous-key fallback. These are legacy Supabase key roles/names, not the newer publishable and secret key model. The repository proves the legacy variable names and fallback code, but the ignored environment files prevent verification of the actual deployed token prefixes or whether the keys are compromised.

**Fix:** Migrate the browser configuration to the project's publishable key and the worker/Edge Functions to a secret key, rename the environment variables, remove the anonymous fallback, and update deployment secrets and documentation. Check the ignored environment and Supabase project settings before deciding whether key rotation is required.

### 27. Dashboard has a proven N+1 query for unread counts

**Severity:** WARNING - Performance
**Standards:** 23
**File:** `src/admin/sections/Dashboard.tsx:94-111`

The dashboard fetches five conversations, then runs one additional `messages` count query for each conversation inside `rawConList.map`. The page therefore performs `1 + N` message queries as the conversation list grows, even though one grouped count query can return all unread counts.

**Fix:** Fetch unread messages once and group by `conversation_id`, or expose a grouped SQL view/RPC that returns the conversation list and unread counts together.

### 28. Registration capacity display counts cancelled rows

**Severity:** WARNING - Logic
**Standards:** 20
**File:** `src/components/Registration.tsx:111-123,145-165,198-207`

The registration card counts every row returned from `event_registrations`, including `cancelled` rows. The re-registration path also treats cancelled registrations as blocking a new registration, while the database RPC excludes cancelled rows when enforcing capacity. The existing `events_with_slots` view is not used consistently, so the UI, re-registration path, and server enforcement can disagree about whether a seat is available.

**Fix:** Use one shared server-side capacity result, such as `events_with_slots` or the registration RPC, for display, re-registration, and enforcement. Define exactly which statuses consume capacity and apply that definition in every path.

### 29. Theme activation is a non-transactional two-write invariant

**Severity:** WARNING - Concurrency
**Standards:** 16, 24
**Files:** `src/admin/sections/SettingsRoles.tsx:178-218,221-301`

Applying a theme first deactivates the current theme and then activates the selected row. If the second request fails, the site has no active theme and falls back inconsistently. Concurrent admin actions can also interleave and leave multiple active rows because no database constraint enforces one active theme.

**Fix:** Use one transactional RPC or a database constraint-backed mutation that always leaves exactly one active theme. Check the final row returned by the mutation before showing success.

### 30. Several destructive admin actions have no confirmation

**Severity:** WARNING - Code Quality
**Standards:** 37
**Files:** `src/admin/sections/AnnouncementsManager.tsx:39-50,139-145`, `src/admin/sections/OfficersManager.tsx:54-59,97-102,131-143,192-200`

Announcement deletion, officer deletion, committee deletion, and the two bulk-delete buttons execute immediately. Other parts of the admin portal use `window.confirm`, so the protection is inconsistent and a misclick can permanently remove public content or directory data.

**Fix:** Require a confirmation step for every destructive action, especially bulk deletion. Keep the selected record in the confirmation state and disable duplicate submissions while the delete is pending.

### 31. Dequeued email rows can remain stuck in `processing` forever

**Severity:** WARNING - Error Handling
**Standards:** 29, 38
**Files:** `supabase/25_security_linter_fixes.sql:143-163`, `email_worker.js:55-124`, `supabase/functions/process-email-queue/index.ts:50-110`

`dequeue_emails` marks rows as `processing`, but subsequent dequeue calls only consider `pending` and retryable `failed` rows. If the worker crashes after dequeueing, those rows are never reclaimed, and there is no lease timeout or dead-letter state for repeated failures.

**Fix:** Store a lease timestamp/worker ID, reclaim expired processing rows, cap retries, and move exhausted rows to a dead-letter state with an operator-visible diagnostic.

### 32. Email triggers perform one queue insert per subscriber inside the source transaction

**Severity:** WARNING - Performance
**Standards:** 23
**Files:** `supabase/25_security_linter_fixes.sql:378-486,506-638`

Publishing an announcement or creating an event loops through every subscribed profile and executes a separate insert for each recipient before the source transaction completes. The work scales linearly with subscriber count and can make admin writes slow or fail under load.

**Fix:** Use a set-based `INSERT ... SELECT` for queue rows, move fan-out to an asynchronous job, and add a batch-level retry/dead-letter policy.

### 33. Admin search values are concatenated into raw PostgREST filters

**Severity:** WARNING - API Design
**Standards:** 3
**Files:** `src/admin/sections/RegistrationManager.tsx:43-52,86-95`, `src/admin/sections/MessagesInbox.tsx:97-131`, `src/admin/sections/UserManager.tsx:60-63`, `src/admin/sections/VerificationManager.tsx:55-59`

User-controlled search text is interpolated directly into `.or(...)` filter expressions. Characters meaningful to the PostgREST filter grammar can change the expression or force query errors. RLS still limits the underlying rows, but the admin UI accepts unvalidated query syntax at a trust boundary.

**Fix:** Escape PostgREST filter metacharacters or use separate parameterized filters supported by the client library. Add tests for commas, parentheses, quotes, percent signs, and very long search values.

### 34. Registration CSV export is vulnerable to formula injection and malformed quoting [RESOLVED]

**Severity:** WARNING - Security
**Standards:** 18
**File:** `src/admin/sections/RegistrationManager.tsx:190-205`

Profile-controlled values are placed in CSV cells without escaping embedded quotes or neutralizing formula prefixes such as `=`, `+`, `-`, and `@`. Opening the exported file in spreadsheet software can execute attacker-controlled formulas or misalign columns.

**Fix:** Apply RFC 4180 quoting to every cell and prefix dangerous formula-leading values with a single quote or tab before generating the download.

### 35. The CSP blocks the app's external PDF and IP integrations [RESOLVED]

**Severity:** WARNING - DevOps
**Standards:** 30
**Files:** `index.html:13-23`, `vercel.json:7-9`, `src/pages/BukasKabanPage.tsx:254-285`, `src/context/AuthContext.tsx:187-197`

The CSP permits Supabase and Google Fonts but not `cdnjs.cloudflare.com` for the dynamically injected PDF.js script or `api.ipify.org` in `connect-src`. The transparency PDF preview/thumbnail path and last-IP synchronization are therefore likely blocked in production, while the UI treats the integrations as available.

**Fix:** Prefer bundling PDF.js and remove the IP collection if it is not essential. If the external calls remain, add narrowly scoped CSP directives and test the deployed policy rather than relying on the meta fallback.

### 36. Edge Functions are excluded from type checking [RESOLVED]

**Severity:** WARNING - Testing
**Standards:** 28, 30
**Files:** `tsconfig.json:29`, `package.json:12`, `supabase/deno.json:1-3`, `supabase/functions/process-email-queue/index.ts:1,5`, `supabase/functions/send-ticket-email/index.ts:1`, `.github/workflows/typecheck.yml:1-22`

The project compiler explicitly excludes `supabase`, so the normal lint command does not cover the server-side execution path. Both Edge Functions previously also started with `@ts-nocheck`, hiding request payload and response-shape mistakes.

**Resolution:** Added `npm run lint:edge` using Deno, enabled Deno's npm dependency resolution, removed `@ts-nocheck`, and added a GitHub Actions type-check workflow. Authentication, queue-processing, and attendance contract tests remain a follow-up because those contracts are implemented outside these two Edge Functions.

### 37. Financial transparency falls back to fabricated mock records on read errors [RESOLVED]

**Severity:** WARNING - Data Integrity
**Standards:** 24
**File:** `src/pages/BukasKabanPage.tsx:47-132,196-235`

Any transparency query error replaces the live records with hardcoded budget and expense entries. Public users can see those values without a reliable, persistent indication that the database read failed, which can present stale or fabricated financial information as the current ledger.

**Fix:** Render an explicit unavailable/error state for production reads. Restrict mock data to an intentional development mode that is impossible to enable in production builds.

### 38. Reordering writes can leave duplicate or conflicting display orders [RESOLVED]

**Severity:** WARNING - Data Integrity
**Standards:** 16, 24
**Status:** RESOLVED in commits `cc51ee8` and `8303170`
**Files:** `src/admin/sections/OfficersManager.tsx:35-52`, `src/admin/sections/FaqManager.tsx:46-79`, `supabase/migrations/20260818105327_reorder_display_order.sql`, `supabase/migrations/20260818110806_repair_display_order_constraints.sql`

Officer and FAQ reordering issue two independent updates to swap order values. The officer path ignores both results, and either path can leave duplicate order numbers if one update fails or concurrent editors reorder the same records.

**Resolution:** Replaced the client-side swaps with admin-only transactional RPCs, serialized reorder operations with advisory locks, repaired existing duplicate values, added scoped unique indexes, and made the UI refresh only after a successful RPC.

## Things that we're done correctly

- `supabase/23_event_registration_rpc.sql:23-55` and `supabase/25_security_linter_fixes.sql:723-751` use row locks for capacity checks, avoiding the common check-then-insert race.
- `supabase/25_security_linter_fixes.sql` adds explicit empty search paths and revokes direct execution from several security-definer functions.
- `src/lib/supabase.ts:52-54,80-88` catches non-critical JWT parsing and Edge Function invocation failures.
- `src/pages/AccountPage.tsx:171-176`, `src/pages/MessagesPage.tsx`, and admin verification/user/registration views use bounded ranges or limits in reviewed list paths.
- `src/admin/sections/Dashboard.tsx:76-88` batches independent dashboard reads with `Promise.all`.
- `src/components/gallery/AdminForm.tsx:90-99,183-201` uses an allowlist, size cap, and `crypto.randomUUID()` for gallery uploads.
- `src/components/FaqSection.tsx:67-70` exposes accordion state with `aria-expanded`.
- `vercel.json:11-28` includes clickjacking, MIME-sniffing, referrer, permissions, and HSTS headers.

## Files With Zero Violations

The following files had no finding in the reviewed standards and paths; this is not a claim that runtime behavior or unreviewed dependencies are defect-free:

- `src/admin/components/EmptyState.tsx`
- `src/components/gallery/AdminForm.tsx`

## Priority Fix Roadmap

1. **P0:** Lock down profile columns, bind the registration RPC to `auth.uid()`, remove public email queue writes/dequeue grants, fix attendance writes, remove permissive gallery RLS, restrict message updates, and protect or remove both email Edge Functions.
2. **P1:** Fix profile/Auth deletion, purge scripts, legacy Supabase keys, attendance tokens, queue leases, raw errors, mock financial fallbacks, and multi-step write reporting.
3. **P2:** Add pagination/code splitting, eliminate proven N+1 and trigger fan-out, establish a real migration history, type-check Edge Functions, add automated authorization tests, and complete shared-control accessibility labeling.

## N+1 Review

Round 2 found a proven loop-contained N+1 in `src/admin/sections/Dashboard.tsx:96-103` (one unread-count query per conversation), plus trigger fan-out inserts in `supabase/25_security_linter_fixes.sql:378-486,506-638`. The earlier sequential round-trip risks in finding 14 and unbounded collection reads in finding 13 remain. Address all of these with grouped queries, set-based inserts, batching, bounded ranges, or existing RPC/view results.

*Generated by audit on 2026-08-18 against the full house checklist, Supabase key-generation standards, and heuristic N+1 analysis. This is the second audit round; production configuration and ignored environment values remain unverified.*
