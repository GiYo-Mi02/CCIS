# Production release checklist for Audit (2)

Last reviewed: 2026-08-25
Branch reviewed: `additionalFixes` at `12b2d5a62c14372fcd1fdb2e441d5c0623bdcfef`
Status: local remediation and database replay passed; merge and production deployment are not authorized.

## Local gates

- Run `npm.cmd ci` from a clean checkout.
- Run `npm.cmd run validate`.
- When Docker/Podman is available, run `supabase db reset` followed by `npm.cmd run test:db`.
- When Docker/Podman is unavailable on Windows with PostgreSQL 18 installed, run `npm.cmd run test:db:local-postgres`. This replays the application migrations and all seven SQL suites in a temporary, self-cleaning cluster. It deliberately skips only `20260824124000_scheduled_email_worker.sql`, which requires Supabase-owned `pg_net`, `pg_cron`, and Vault extensions.
- Run `npx.cmd --yes supabase@2.115.0 db push --linked --dry-run --skip-vault --dns-resolver https` and verify that only reviewed forward migrations are pending.
- Confirm the generated production bundle passes `npm.cmd run check:bundle`.
- Confirm GitHub Validation and CodeQL pass on the exact final commit, not an earlier commit.

Latest local evidence on 2026-08-25: TypeScript, 22 unit/static tests, the production build, bundle budget, and all three Deno Edge Function checks passed; the standalone PostgreSQL migration replay and seven SQL suites passed; the linked dry run succeeded and listed only `20260825044618_production_release_readiness_fixes.sql`; the production build passed without the former PDF.js `eval("require")` warning. A clean local `npm.cmd ci` attempt could not remove native binaries held by the already-running Vite development server; dependencies were restored without stopping that user process, so clean-install proof remains assigned to final-commit GitHub CI.

## Hosted configuration gates

These steps require explicit production authorization and must not be performed as part of an ordinary code review.

1. Copy `supabase/functions/hosted-secrets.example` to an ignored file, replace every placeholder, and obtain explicit production approval. Run `scripts/deploy-hosted-functions.ps1 -SecretsEnvFile <ignored-file> -ConfirmProduction`; the script refuses examples/placeholders and deploys `process-email-queue`, `delete-user`, and `send-ticket-email` with the JWT settings in `supabase/config.toml`.
2. The deployment script configures Edge Function secrets named `EMAIL_WORKER_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_ORIGIN`. Never place their values in Git, `VITE_*`, logs, screenshots, or review comments.
3. Run the operator template in `supabase/setup_vault_secret.sql` with a dedicated worker secret and the deployed worker URL. The Vault and Edge worker-secret values must match.
4. Apply the reviewed forward migration. Do not edit or replay already-applied migration files.
5. Run `powershell -File scripts/check-hosted-release.ps1`. It checks names and status only and does not print secret values.
6. Review every `delivery_unknown` email row against the provider dashboard. Mark a row for retry only after confirming the provider did not accept it.
7. Re-run Supabase security and performance advisors. Authenticated SECURITY DEFINER warnings are acceptable only when they match `documentation/security-definer-allowlist.md`; all other new warnings block release.

## Authentication decision gate

Leaked-password protection is unavailable on the current Supabase plan while password authentication remains enabled. Before production approval, the owner must choose one of these supported outcomes:

- Upgrade and enable leaked-password protection, then test password sign-in and recovery; or
- prepare and approve a separate OAuth-only change that removes password sign-in, sign-up, and recovery from both the UI and hosted Auth settings.

This repository does not silently choose or apply either production authentication change.

## Acceptance gates

- In an anonymous browser, verify FAQs, published announcements, the active theme, committee subteams, and featured photobooth items load without a 401.
- With a registration-coordinator account, verify pending profiles and registration lists load, private profile fields are absent, and both audience and participant ticket scans work.
- With a student account, complete Google OAuth and confirm the session appears without refreshing.
- Publish one controlled announcement or event and confirm one provider-accepted email, one queue completion, and no duplicate delivery.
- Test account deletion through the deployed `delete-user` function using a disposable account.
- Verify the production CSP in the browser response headers and confirm no request to `api.ipify.org` occurs.

## Stop conditions

Do not merge if any local test, final-commit CI job, hosted readiness check, authentication decision, or acceptance gate is incomplete. Do not claim production readiness from source inspection alone.
