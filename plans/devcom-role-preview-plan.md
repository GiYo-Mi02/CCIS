## Goal

Let a signed-in DevCom Head preview the admin portal as each supported role, with the same navigation and section visibility, without changing the authenticated profile, JWT claims, database role, or RLS permissions.

## Source Of Truth

- User request: DevCom Head role simulation/impersonation
- `src/types/database.ts`: canonical client role union and labels
- `supabase/migrations/20260818100000_baseline_prerequisites.sql`: `profiles.role` constraint
- `supabase/migrations/20260831105207_restrict_profile_role_management.sql`: server-side role-management boundary

## Non-Goals

- Do not change `profiles.role`, `auth.users.raw_app_meta_data`, JWTs, or RLS policies.
- Do not let preview mode perform writes or claim that a DevCom session has reduced backend privileges.
- Do not build account/session impersonation, audit-log infrastructure, or new database objects.

## Execution Order

## PR Stacking Strategy

```text
main -> devcom-role-preview
```

Create one focused branch from `main`; this is a frontend-only change and should remain below the repository's preferred small-PR size.

## Linear Sub-Issue Tracking

Create sub-issues from this plan when ready.

### 1. Centralize Admin Section Access

- Add `src/admin/roleAccess.ts` with the supported admin sections and one `canAccessAdminSection(role, section)` function, derived from the existing `AdminApp` and sidebar checks.
- Use the canonical `UserRole` and `ADMIN_ROLES` from `src/types/database.ts`; remove the unused, conflicting admin-only `UserRole`/`officer_readonly` declarations from `src/types.ts` rather than introducing another role list.

### 2. Add DevCom-Only Preview State

- Extend `src/admin/AdminContext.tsx` with an in-memory `previewRole` and actions to select and clear it; only a real `devcom_head` may set it, and selecting a role must return the user to the dashboard if the current section is unavailable.
- Render a clearly labelled preview selector and persistent read-only banner in `src/admin/components/AdminTopbar.tsx`; the selector stays available while previewing so DevCom Head can exit the mode.

### 3. Apply Preview To The Admin Shell

- Update `src/admin/AdminApp.tsx`, `src/admin/components/AdminSidebar.tsx`, `src/admin/sections/Dashboard.tsx`, and `src/admin/sections/MessagesInbox.tsx` to use the effective preview role for UI visibility and access checks.
- While `previewRole` is active, block admin-panel form submissions and click actions at the shell boundary and mark the content as preview-only; retain real authentication data for identity display and backend calls so preview mode cannot alter authorization.

### 4. Verify Role Boundaries

- Add `tests/admin-role-preview.test.ts` for the access matrix: student has no admin access; each coordinator sees only its existing sections; officer gets dashboard/messages; DevCom Head gets all sections; preview selection is DevCom-only.
- Run `npm run lint`, `npm run test`, `npm run build`, `npm run check:bundle`, and `npm run test:db` to confirm the preview has not changed existing RLS or server-side role management.

## Acceptance Criteria

- DevCom Head can select `student`, `officer`, `comm_content`, `comm_registration`, or `comm_photobooth` and immediately see the matching portal navigation, including the no-admin-access state for Student.
- Preview is visually persistent, can be exited without reload, and cannot be activated by another role.
- Preview mode cannot submit an admin UI mutation and never changes profile/JWT role data.
- Direct URLs to unavailable sections fall back to the preview dashboard.
- Existing server-side role-management and RLS tests pass unchanged.
