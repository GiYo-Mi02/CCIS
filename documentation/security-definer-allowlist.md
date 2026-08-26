# SECURITY DEFINER RPC allowlist

Last reviewed: 2026-08-25

This allowlist documents every `public` SECURITY DEFINER function intentionally executable by the `authenticated` API role. These functions run with elevated database privileges, so each must pin `search_path`, derive the caller from `auth.uid()` or the database-backed role helper, validate all identifiers, and expose only the minimum required result.

## Identity and self-service

- `ensure_user_profile()` — creates or returns only the caller's profile after allowlist and tombstone checks.
- `update_student_profile(text, smallint, text, text, text, text, boolean, text, text, text)` — updates the caller's allowed student fields; privileged columns are rejected.
- `record_privacy_consent(text)` — records the caller's consent version and timestamp.
- `submit_profile_for_verification(text, smallint, text, text)` — submits the caller's completed profile.
- `resubmit_for_verification()` — returns the caller's rejected profile to the pending workflow.
- `set_email_preferences(boolean)` — updates only the caller's subscription preference.
- `issue_attendance_pass(boolean)` — issues or rotates only the caller's attendance credential.
- `is_account_deletion_tombstoned()` — checks only the caller's identity tombstone state.
- `get_user_role()` — returns the current caller's database-backed role for RLS and server authorization.

## Messaging and dashboard

- `ensure_conversation()` — creates or returns the caller's support conversation.
- `mark_conversation_messages_read_by_student(uuid)` — marks only messages in the caller's conversation as read by the student.
- `mark_messages_read_by_admin(uuid[])` — allows the authorized message team to mark the supplied message IDs as read.
- `get_dashboard_unread_counts()` — returns role-filtered aggregate counts without exposing message bodies or profiles.

## Registration and verification

- `register_for_event(uuid, uuid)` — registers the caller, or an authorized registration coordinator, while enforcing capacity and queueing one ticket email.
- `check_in_audience(uuid, text)` — validates a server-issued attendance token and atomically records event attendance.
- `resolve_attendance_pass(text)` — returns only the identity fields required by the scanner; it never returns the reusable token.
- `check_in_registration(uuid)` — validates a registration ticket and atomically records attendance.
- `list_pending_verifications(text, integer, integer)` — returns the minimum pending-verification projection to DevCom and registration coordinators.
- `list_registration_admin_rows(text, uuid, integer, integer)` — returns a paginated registration projection and aggregate counts to authorized registration staff.
- `admin_approve_user(uuid)` — approves a pending profile and queues its notification after a role and rate-limit check.
- `admin_reject_user(uuid, text)` — rejects a pending profile and queues its escaped reason after a role and rate-limit check.

## Restricted DevCom operations

- `activate_theme(uuid, text, text, text, text)` - atomically activates the requested theme after verifying the DevCom role.
- `swap_faq_order(uuid, text)` - reorders an FAQ after verifying the DevCom or content-committee role.
- `swap_officer_order(uuid, text)` - reorders an officer after verifying the DevCom role.

- `list_loadtest_account_ids()` — returns only IDs matching the documented load-test cleanup rules to the DevCom head.
- `list_pending_account_deletions(integer)` — returns bounded deletion work to the DevCom head.

Any new authenticated SECURITY DEFINER function requires a migration, a behavior-level database test, an entry in this allowlist, and a reviewer-confirmed reason that RLS or an invoker function cannot safely implement the workflow.
