# Database Schema and Security

This document describes the canonical Supabase contract. Only `supabase/migrations/` is deployable; historical manual SQL is archived under `supabase/legacy/` and must not be executed against an environment.

## Security model

The browser is untrusted. Row Level Security is enabled and forced on every application table, and privileged decisions use the current role in `public.profiles` through `get_user_role()`. JWT role claims are secondary defense only and are never the sole authorization source for privileged RPCs.

Student profile edits, consent, verification submission, notification preferences, attendance-pass issuance, event registration, and attendance scans use separate server-owned RPCs. Students cannot directly update profile or message rows.

Institutional access is enforced in the database. Student identities must end in `@umak.edu.ph`; the documented developer exceptions are stored in the private `internal.admin_bypass_emails` table.

## Primary tables

### `profiles`

Stores private account, student, verification, subscription, ban, and attendance-pass fields. Owners and explicitly authorized council staff can read profiles. Only the DevCom Head receives direct profile `UPDATE`; ordinary student changes use `update_student_profile()` and privileged fields use dedicated workflow RPCs.

### `committees` and `officers`

Public council-directory data. Anyone may read published directory rows; only the DevCom Head may change them. Officer display order is unique within term and organization and is changed atomically.

### `faqs` and `announcements`

Public content tables. Anonymous users see active FAQs and published announcements only. DevCom and Content Committee roles manage content. Publishing creates one transactional outbox record; recipient expansion occurs asynchronously.

### `events` and `event_registrations`

Events are publicly readable. Registration rows are private to the registrant and Registration Committee staff. `register_for_event()` verifies institutional identity, approval and ban state, locks the event before checking capacity, handles the unique registration constraint, and queues one idempotent participant email.

Canonical capacity fields are:

- `registered_count`: active registrations reported by `events_with_slots`.
- `slots_left`: remaining capacity, or `NULL` for unlimited events.

### `conversations`, `messages`, `concerns`, and `concern_replies`

Students can access only their own support records. Staff access is limited to operational messaging roles. Message content and ownership cannot be rewritten through direct `UPDATE`; the read-state RPCs change only their intended boolean fields.

### `email_queue`

Not accessible to browser roles. Every producer supplies a stable `logical_key`, protected by a partial unique index. The service-role worker claims rows with leases and `FOR UPDATE SKIP LOCKED`, sends through a provider idempotency key, and records `sent`, `failed`, `dead_letter`, or `delivery_unknown` outcomes.

### `gallery_items`

Canonical fields are `title`, `description`, `category`, `posted_by`, `image_url`, `thumbnails`, `aspect_ratio`, `featured`, and ownership/timestamps. Fresh databases do not create the obsolete `frame_id` or `index_label` fields. Existing projects retain them until live data inventory confirms they can be dropped safely.

### `theme_settings`

Uses `preset_name`, `primary_color`, `accent_color`, `canvas_color`, and `is_active`. Activation is atomic and permits only one active theme.

## Storage boundary

The following buckets contain intentionally published assets and are public:

- `gallery-images`
- `banners`
- `bukas-kaban-reports`
- `patch-thumbnails`
- `patch-videos`

Draft or restricted media belongs in the private `ccis-private-drafts` bucket and must be delivered with signed URLs. All writes require an authorized council role.

## Email processing

`pg_cron` invokes the queue worker once per minute using a dedicated secret stored in Vault. The browser cannot invoke the worker. Configuration and invocation failures are recorded in `internal.email_worker_invocations` without storing recipient data or provider response bodies.

Content publishing writes one `internal.email_outbox` row in the source transaction. The worker expands recipients in bounded batches, preventing subscriber fan-out from slowing or rolling back the originating content write.

## Verification

CI performs all of the following:

1. Replays the complete migration chain from an empty local Supabase database.
2. Asserts RLS/FORCE RLS, policies, grants, function search paths, storage visibility, indexes, and obsolete function removal.
3. Runs gallery, message, attendance, and authorization behavior tests.
4. Type-checks the application and Edge Functions, runs unit tests, and builds the production bundle.
