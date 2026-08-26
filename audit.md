# CCIS Beta-Readiness Security Audit

**Date:** 2026-08-25

**Scope:** Full non-ignored repository review: React client, Supabase migrations/RLS/RPCs, Edge Functions, deployment configuration, dependency advisories, tests, and release commands.

**Verification performed:** `npm run validate` passed (TypeScript, 17 tests, production build, and all three Edge Function checks). `npm audit --omit=dev --audit-level=high` found one high and one critical advisory. `npx supabase start` replayed the complete migration chain; `npm run test:db` passed all database security contracts against the local database on port `55322`.

---

## Overall Score

| Category | ERRORs | WARNINGs |
|----------|--------|----------|
| Security | 2 | 2 |
| Data Integrity | 1 | 0 |
| Error Handling | 2 | 1 |
| Performance | 0 | 1 |
| Testing / DevOps | 0 | 1 |
| **Total** | **5** | **5** |

---

## CRITICAL - Must Fix Before Beta

### 1. Public event listing is broken after RLS hardening

**Severity:** ERROR - Security / Availability

**Files:** `supabase/migrations/20260818151000_align_event_capacity_statuses.sql:7-21`; `supabase/migrations/20260824123000_rls_grants_and_storage.sql:107-120,255-256`; `src/components/Registration.tsx:100-118`

`events_with_slots` joins `event_registrations`. The final migration makes the view `security_invoker`, while anonymous users have neither `SELECT` privilege nor an RLS policy for `event_registrations`. The public registration page queries this view before authentication.

**Risk:** Postgres evaluates the underlying relation as `anon`; public event loading fails with an RLS/permission error. This blocks the primary event-registration entry point.

**Fix:** Expose only event capacity through a narrow public-safe view or RPC that does not reveal registrations. Alternatively, use a carefully scoped definer view. Add a database test that queries the public event feed as `anon` and confirms it exposes no registration rows.

---

## HIGH - Fix Before Beta

### 2. Support chat depends on an RPC absent from the canonical migrations

**Severity:** ERROR - API Design / Availability

**Files:** `src/pages/MessagesPage.tsx:33-47`; `src/components/SupportWidget.tsx:61-90`; `supabase/migrations/`; `supabase/legacy/27_fix_rls_recursion.sql:70-96`

Both student chat surfaces call `ensure_conversation()`, but the active migration chain has no definition or grant for that RPC; its only definition is in a legacy script. The callers only log the error, then continue with a null conversation.

**Risk:** A clean beta database cannot initialize support conversations. Students see an empty/inoperable chat instead of a recoverable error.

**Fix:** Add an authenticated `SECURITY DEFINER` `ensure_conversation()` migration that scopes to `auth.uid()`, uses the existing unique profile constraint with `INSERT ... ON CONFLICT`, pins `search_path = ''`, and grants only `authenticated`. Assert its definition and grant in `supabase/tests/security_contract.sql`.

---

### 3. Registration-ticket check-in is a read-then-write race

**Severity:** ERROR - Data Integrity / Concurrency

**Files:** `src/admin/sections/TicketScanner.tsx:525-610`; `supabase/migrations/20260825110000_scoped_event_registration_lookup.sql:1-33`

The scanner fetches a registration, checks `status`, then issues a separate direct `UPDATE`. Two scanners can both read a non-attended registration and both report successful entry.

**Risk:** Duplicate admission and inaccurate attendance. The atomic `check_in_audience()` path protects audience passes, but ordinary registration-ID scans bypass it.

**Fix:** Replace the lookup plus client update with one role-gated RPC that locks the registration row, transitions it once, and returns `was_already_attended`. Add a concurrent SQL contract test for two scans of the same ticket.

---

### 4. Scheduled email invocation records requests, not outcomes

**Severity:** ERROR - Error Handling / DevOps

**Files:** `supabase/migrations/20260824124000_scheduled_email_worker.sql:16-22,61-77`; `supabase/functions/process-email-queue/index.ts:97-125`

The cron job records `requested` immediately after asynchronous `net.http_post`. No migration reads the `pg_net` response or timeout state, and invocation status permits only request/configuration/invocation errors.

**Risk:** A bad worker URL/secret or HTTP 5xx leaves verification, ticket, and announcement email queued with no actionable database signal. The UI can report success while delivery is stalled.

**Fix:** Reconcile `pg_net` response rows and timeouts into a terminal invocation status, record only redacted status/error codes, and alert on non-2xx results or stale oldest-pending email age.

---

### 5. Public PDF rendering uses a high-severity vulnerable dependency

**Severity:** ERROR - Security

**Files:** `package.json:34`; `src/pages/BukasKabanPage.tsx:289-320,389-480`

The app ships `pdfjs-dist@3.11.174`; `npm audit --omit=dev` reports `GHSA-wgrm-67xf-hhpq`, an arbitrary-JavaScript-execution vulnerability in versions through `4.1.392`. The application renders both public report URLs and administrator-uploaded PDFs in browser workers.

**Risk:** A malicious or compromised uploaded transparency report can attack users who open its preview. The build also reports PDF.js's `eval` warning.

**Fix:** Upgrade PDF.js to a patched supported release and adapt the worker import/API as required. Add a smoke test that opens a normal PDF after the upgrade; do not rely on client MIME checks as a security boundary.

---

## MEDIUM - Fix During Beta Hardening

### 6. A hard-coded email bypasses role revocation for admin message reads

**Severity:** WARNING - Security

**File:** `supabase/migrations/20260818161000_restrict_message_read_updates.sql:51-55`

`mark_messages_read_by_admin()` authorizes `ggiojoshua2006@gmail.com` even when its database role is no longer `devcom_head` or `officer`.

**Risk:** Removing that account's role does not revoke its ability to mark every student's messages read, defeating the role system and complicating incident response.

**Fix:** Remove the email disjunct and use the database role exclusively. If a break-glass exception is required, keep it in an explicit audited allowlist with a documented expiry.

---

### 7. Client crashes leak raw details and have no production trace

**Severity:** WARNING - Error Handling / Security

**Files:** `src/components/ErrorBoundary.tsx:29-31,58-63`; `vite.config.ts:21-30`

The error boundary renders `error.message` to every user. It only sends the exception to `console.error`, while production builds remove all `console.*` calls.

**Risk:** Users can receive raw API/runtime details, while operators receive no durable error event, request correlation, route, or release identifier to investigate failures.

**Fix:** Render a generic error with a generated reference ID. Send a redacted client error event to an approved monitoring endpoint/service with route, release, and reference ID; never include tokens, profile data, request bodies, or full API responses.

---

### 8. Failed outbox expansion is neither dead-lettered nor surfaced

**Severity:** WARNING - Error Handling / Data Integrity

**Files:** `supabase/migrations/20260824121000_email_outbox_and_delivery.sql:6-16,89-95,170-173`

An expansion error records only a SQLSTATE, leaves the item `failed`, and retries while `attempts < 5`. After the fifth failure the query silently stops selecting it; there is no terminal dead-letter state, alert, or operator recovery path.

**Risk:** Announcement/event notifications can be permanently abandoned without a clear operational signal or a safe replay workflow.

**Fix:** Move exhausted rows to an observable `dead_letter` state with redacted failure code and timestamp. Monitor it and provide a privileged, idempotent replay operation after the root cause is corrected.

---

### 9. Production dependency tree contains unresolved critical `tar` advisories

**Severity:** WARNING - Security / DevOps

**Files:** `package.json:34`; `package-lock.json`

`npm audit --omit=dev --audit-level=high` reports critical `tar@6.2.1` path-traversal/read-write advisories through `pdfjs-dist -> canvas -> @mapbox/node-pre-gyp`. The repository does not itself pass untrusted archives to `tar`, so application exploitability is not proven, but the vulnerable package is present in the production install tree.

**Risk:** Build, CI, or future server-side archive handling may inherit a critical filesystem vulnerability; the dependency audit is already a failed beta security gate.

**Fix:** Upgrade or replace the PDF.js dependency chain until `npm audit --omit=dev --audit-level=high` exits cleanly. Verify the lockfile after the PDF.js upgrade rather than using a blind forced audit fix.

---

## LOW - Release Follow-up

### 10. Production build emits oversized critical-path chunks

**Severity:** WARNING - Performance

**Files:** `src/pages/AccountPage.tsx`; `src/pages/BukasKabanPage.tsx`; `src/admin/AdminApp.tsx`; `vite.config.ts:21-30`

`npm run build` passes but emits chunks of 698 KB, 872 KB, and a 1.09 MB PDF worker after minification. Vite warns for chunks over 500 KB.

**Risk:** Slow initial loads and memory pressure on campus/mobile networks, especially for the administrative and PDF surfaces.

**Fix:** Keep the existing route-level splits and lazily load PDF, QR scanner, and administration-only dependencies. Re-measure after the PDF.js update; do not add manual chunk configuration unless a route is still materially oversized.

---

## Files With Zero Violations

- `supabase/functions/process-email-queue/index.ts` - no additional sensitive-log exposure found; it validates method, content type, size, worker secret, rate limit, and external-call timeout.
- `supabase/functions/send-ticket-email/index.ts` - validates caller identity/ownership, queues idempotently, and escapes HTML ticket fields.
- `supabase/functions/delete-user/index.ts` - no new finding in this audit; authentication and server-side role checks are present.
- `supabase/functions/_shared/supabase-keys.js` - resolves server-only keys without embedding values.
- `src/lib/postgrest.ts` - existing tests cover escaping and length bounds for user-controlled PostgREST filters.

---

## Things that we're done correctly

- `supabase/migrations/20260824123000_rls_grants_and_storage.sql:6-45` clears legacy policies before defining the canonical set, then enables and forces RLS on every listed application table.
- `supabase/migrations/20260824122000_identity_workflows_and_rate_limits.sql:125-323,461-560` uses narrow profile RPCs, row locks for registration/attendance, and database-backed limits for high-impact operations.
- `supabase/migrations/20260824121000_email_outbox_and_delivery.sql:104-163,184-314` uses stable logical keys, provider idempotency keys, lease ownership, bounded dequeue batches, and service-role-only grants.
- `supabase/functions/process-email-queue/index.ts:49-59,76-109,130-185` bounds input, uses constant-time worker-secret comparison, applies a global rate limit, and gives Resend a stable idempotency key with a timeout.
- `vercel.json:3-32` sets CSP, frame, MIME-sniffing, referrer, permissions, and HSTS headers for Vercel deployments.
- No committed `.env` files or secret values were present in the non-ignored candidate files reviewed. Public `VITE_*` values are expected to be browser-visible; only the Supabase publishable key is consumed by the client.

---

## Priority Fix Roadmap

### P0 - Required before external beta access

| # | Issue | File(s) |
|---|-------|---------|
| 1 | Restore public-safe event capacity reads | `events_with_slots`, `rls_grants_and_storage.sql`, `Registration.tsx` |
| 2 | Add and test `ensure_conversation()` in the active migration chain | New migration, `security_contract.sql` |
| 3 | Make registration ticket scans atomic | New check-in RPC, `TicketScanner.tsx`, SQL contract test |
| 4 | Reconcile scheduled worker HTTP outcomes and alert on queue staleness | `scheduled_email_worker.sql` |
| 5 | Upgrade `pdfjs-dist` and clear dependency audit findings | `package.json`, `package-lock.json`, `BukasKabanPage.tsx` |

### P1 - Required for an operable beta

| # | Issue | File(s) |
|---|-------|---------|
| 6 | Remove hard-coded message-read authorization | `restrict_message_read_updates.sql` |
| 7 | Add redacted client error reporting and stop rendering raw exceptions | `ErrorBoundary.tsx` |
| 8 | Dead-letter and alert on exhausted email outbox expansion | `email_outbox_and_delivery.sql` |
| 9 | Keep fresh Supabase migration replay and all SQL contracts required in release CI | `supabase/tests/*`, CI |

### P2 - Monitor during beta

| # | Issue | File(s) |
|---|-------|---------|
| 10 | Reduce route bundles after the security upgrade | `AdminApp`, `AccountPage`, `BukasKabanPage` |

---

*Generated on 2026-08-25. Heuristic N+1/round-trip analysis was included; the key database call paths, sequential support initialization, queue workflow, and scanner mutations were reviewed. Static repository analysis and a clean local migration replay with all database security contracts completed successfully. Live Supabase catalog and deployed-function configuration remain unverified.*
