# AGENTS.md

## Project Overview

CCIS is the centralized website and student portal for the University of Makati College of Computing and Information Sciences.

The application includes:

* Public announcements, events, FAQs, officers, galleries, and transparency reports
* Google OAuth and email authentication
* Student profiles
* Event registration and QR attendance
* Student-to-administrator chat
* Concerns and replies
* Administrative content management
* Email queues and scheduled workers
* Supabase Storage for public and private files

## Technology Stack

* React 19
* TypeScript 5
* Vite 6
* Tailwind CSS 4
* Supabase PostgreSQL
* Supabase Auth
* Supabase Storage
* Supabase Realtime
* Supabase Edge Functions using Deno
* pg_cron
* Resend
* Vercel
* npm

Supabase production project:

```text
Project name: CCIS-Website
Project reference: aecrmddgsnnxtemyikqu
Region: ap-southeast-2
```

Never hardcode the project URL, project reference, publishable key, database URL, service-role key, Resend key, webhook URLs, or other credentials in application source.

## Important Directories

```text
src/                         React application
public/                      Static public assets
scripts/                     Maintenance and validation scripts
tests/                       TypeScript application tests
supabase/config.toml         Local Supabase configuration
supabase/functions/          Deno Edge Functions
supabase/migrations/         Database migrations
supabase/tests/              PostgreSQL and RLS tests
supabase/release_checks/     Database release checks
supabase/legacy/             Historical Supabase files
documentation/               Project documentation
.agents/skills/              Additional agent skills and instructions
```

Read `README.md`, `package.json`, applicable files under `.agents/skills/`, and existing migrations before implementing changes.

## Setup and Commands

Use Node 22 for all Node and npm commands. Prefer `nvm use 22`:

```bash
if command -v nvm >/dev/null 2>&1; then
  nvm use 22
elif command -v node >/dev/null 2>&1; then
  node --version
  # If this is not Node 22, report that Node 22 is required before continuing.
else
  # Report that Node 22 must be installed before continuing.
fi
```

If `nvm` is absent, do not silently continue with another Node version. Check
`node --version`; if Node is absent or is not major version 22, report that the
user must install or activate Node 22.

Install the exact dependencies from the lockfile:

```bash
npm ci
```

Start development:

```bash
npm run dev
```

Run TypeScript checking:

```bash
npm run lint
```

Run application tests:

```bash
npm run test
```

Create a production build:

```bash
npm run build
```

Check the production bundle:

```bash
npm run check:bundle
```

Validate Edge Functions:

```bash
npm run lint:edge
```

Run the normal application validation suite:

```bash
npm run test:all
```

Run the complete validation suite:

```bash
npm run validate
```

Do not report completion unless the relevant validation commands pass. If a command cannot run because a required service or environment variable is unavailable, report the exact limitation.

## Database Tests

Database tests use `SUPABASE_DB_URL`. Never print this value.

Available database tests include:

```bash
npm run test:security-contract
npm run test:public-content-rls
npm run test:profile-least-privilege
npm run test:gallery-rls
npm run test:messages-rls
npm run test:attendance-rpc
npm run test:email-queue-recovery
npm run test:registration-checkin-rpc
npm run test:email-worker-outcomes
npm run test:client-error-events
npm run test:db
```

For the local PostgreSQL test workflow on Windows:

```bash
npm run test:db:local-postgres
```

Database changes that affect RLS, roles, registrations, attendance, messages, profiles, email queues, or public content must include or update the appropriate database tests.

## Supabase CLI Workflow

Use the installed Supabase CLI when available. If the `supabase` command is
absent, check the project-pinned fallback with `npx supabase` before reporting
that the CLI is unavailable:

```bash
if command -v supabase >/dev/null 2>&1; then
  SUPABASE="supabase"
elif npx supabase --version >/dev/null 2>&1; then
  SUPABASE="npx supabase"
else
  # Report that neither the Supabase CLI nor the npx fallback is available.
fi

$SUPABASE --version
$SUPABASE --help
$SUPABASE db --help
$SUPABASE migration --help
$SUPABASE functions --help
```

Link the project only when it is not already linked:

```bash
$SUPABASE link --project-ref aecrmddgsnnxtemyikqu
```

Create migrations using the CLI:

```bash
$SUPABASE migration new descriptive_migration_name
```

Do not manually invent migration timestamps.

Before preparing a database change:

1. Inspect existing migrations and production schema.
2. Confirm the current table, column, policy, constraint, index, function, trigger, and view definitions.
3. Create a new migration.
4. Test locally or against an approved development environment.
5. Run relevant RLS and application tests.
6. Run database linting and advisors when available.
7. Review the generated diff.
8. Document rollback steps.
9. Request approval before pushing to production.

Do not rewrite old migrations that may already have been applied. Add a new forward migration.

Never reset, repair, reseed, or push the production database without explicit approval.

## Database Safety

All exposed application tables must have RLS enabled.

Authorization rules:

* Never use `user_metadata` for authorization.
* Use database-owned records or `app_metadata`.
* `TO authenticated` alone is not sufficient authorization.
* Ownership policies must compare the current user with the row owner.
* UPDATE policies must use appropriate `USING` and `WITH CHECK`.
* Optimize repeated `auth.uid()` expressions with `(select auth.uid())` only when behavior remains equivalent.
* Do not add `SECURITY DEFINER` merely to bypass permission errors.
* Protected functions must validate the caller.
* Do not expose privileged functions through the public schema without a clear authorization requirement.
* Views exposed through the Data API should use `security_invoker=true` when applicable.
* Never disable RLS to solve an application error.

Before consolidating RLS policies, test the behavior of:

* Anonymous users
* Students
* Record owners
* Officers
* Committee roles
* Administrative roles
* DevCom Head

Do not drop indexes solely because an advisor labels them unused. Statistics may have reset.

Before removing a duplicate index, confirm that it is not backing a primary key, unique constraint, or foreign key requirement.

## Storage Safety

Do not manually insert, update, or delete rows in `storage.objects`.

Use the supported Supabase Storage API for files.

Never automatically delete original production files during an optimization migration. Use this process:

1. Generate an inventory.
2. Optimize the file.
3. Upload it under a new versioned path.
4. Verify the new object.
5. Update database references.
6. Verify the application.
7. Save an old-to-new manifest.
8. Keep the original until deletion is explicitly approved.

Private files must not be moved into public buckets.

Service-role credentials may only be used in protected server-side scripts or Edge Functions.

## Media and Egress Requirements

The application is being prepared for approximately 1,700 students. Supabase Free cached egress is a major constraint.

Existing officer photographs are several megabytes each and must not be served directly at their original size.

Media targets:

| Asset             | Recommended target | Hard maximum |
| ----------------- | -----------------: | -----------: |
| Officer portrait  |          80–150 KB |       300 KB |
| Gallery thumbnail |          50–120 KB |       200 KB |
| Gallery image     |         150–350 KB |       600 KB |
| Event banner      |         200–500 KB |         1 MB |
| Patch thumbnail   |          50–150 KB |       300 KB |

Requirements:

* Resize images before upload.
* Prefer WebP or AVIF.
* Correct image orientation.
* Remove unnecessary metadata.
* Preserve aspect ratio.
* Use versioned or hashed filenames.
* Use long-lived caching for versioned assets:

```text
public, max-age=31536000, immutable
```

* Add explicit image width and height.
* Use lazy loading.
* Use thumbnails for cards and lists.
* Load full-resolution media only when requested.
* Do not preload hidden carousel images.
* Do not preload large PDFs.
* Paginate or virtualize long media lists.
* Reject oversized uploads.
* Do not perform a separate Storage metadata request for every rendered image.

The Officers page must not reproduce the previous payload of more than 100 MB. Its initial media transfer should preferably remain below 3 MB.

## Chat and Realtime Requirements

Realtime is used for `conversations` and `messages`.

Do not initialize chat for every visitor on every page.

Required behavior:

* Open a Realtime connection only when chat needs it.
* Do not create a conversation during an ordinary page load.
* Create or ensure a conversation when the user opens chat or sends the first message.
* Use only one channel per active conversation.
* Filter subscriptions to the required conversation or user.
* Unsubscribe during component cleanup.
* Disconnect on logout.
* Prevent duplicate subscriptions during rerenders.
* Paginate message history.
* Avoid simultaneous polling and Realtime for the same data.
* Cache the authenticated profile.
* Avoid repeated `select('*')` queries.
* Administrative RPCs must run only on authorized administrative screens.

The application must remain usable when more than 200 students are registered, even though the Free plan allows only 200 simultaneous Realtime connections.

## Edge Functions

Current Edge Functions include:

```text
process-email-queue
send-ticket-email
delete-user
report-client-error
```

Edge Function requirements:

* Validate authentication and authorization.
* Keep privileged secrets server-side.
* Use small request and response payloads.
* Validate all request bodies.
* Use idempotency for email and deletion workflows.
* Prevent duplicate email delivery.
* Limit retries.
* Do not log tokens, complete email content, personal information, or secrets.
* Pin dependencies and preserve Deno lockfiles.
* Update `npm run lint:edge` when adding a new Edge Function.

The `ccis-email-worker` cron job currently runs every minute. Changes must preserve queue recovery, duplicate-send protection, and failure handling.

## Frontend Standards

* Follow existing React and TypeScript patterns.
* Preserve the current visual design unless a visual change is required.
* Keep components focused and reusable.
* Avoid new global state when local state or an existing provider is sufficient.
* Prevent duplicate network requests caused by effects or rerenders.
* Clean up timers, event listeners, and Realtime channels.
* Use explicit TypeScript types.
* Do not use `any` unless no reasonable alternative exists and the reason is documented.
* Keep accessibility behavior intact.
* Preserve loading, empty, error, and offline states.
* Do not expose Supabase privileged credentials through `VITE_` variables.

## Change Management

Before editing:

1. Check the Git status.
2. Preserve unrelated user changes.
3. Inspect the affected code and tests.
4. Identify the smallest safe implementation.
5. Document database and Storage risks.

During implementation:

* Make focused changes.
* Do not perform unrelated refactors.
* Do not silently change authorization behavior.
* Do not add unrequested dependencies.
* Pin newly added dependencies.
* Update the lockfile.
* Add tests for bug fixes and behavioral changes.

After implementation:

1. Run relevant targeted tests.
2. Run `npm run validate`.
3. Run database tests when database behavior changed.
4. Review the final diff.
5. Confirm no secrets were added.
6. Report remaining risks and manual actions.

## Production Restrictions

Do not perform any of the following without explicit approval:

* Push database migrations to production
* Deploy Edge Functions
* Deploy the frontend
* Delete Storage objects
* Replace production media references
* Reset or restore the database
* Modify production Auth users
* Change billing or plan settings
* Disable RLS
* Rotate keys
* Change OAuth settings
* Change Vercel environment variables

Prepare and verify the change first, then present the deployment commands and request approval.

## Definition of Done

A task is complete only when:

* The requested implementation exists.
* The application builds successfully.
* Type checking passes.
* Relevant tests pass.
* Edge Functions pass Deno validation when affected.
* Database migrations are forward-only and tested.
* RLS behavior is verified when affected.
* No secrets are exposed.
* Storage changes preserve original files until approved.
* Egress-related changes include before-and-after measurements.
* Documentation and rollback instructions are provided.
* Remaining risks and production steps are clearly reported.
