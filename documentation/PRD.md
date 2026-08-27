## Problem Statement

CCIS students and council officers need a single, institutional platform for authoritative council information, student identity and account workflows, event participation, attendance, support, media, transparency, and operational administration. Without a centralized platform, event capacity, participant verification, attendance records, announcements, support conversations, and council content are fragmented, harder to secure, and costly to operate.

The platform must let students use their institutional identity to access relevant council services while protecting private records. Council staff need role-appropriate operational tooling that keeps public content, event workflows, communications, and administrative records consistent without exposing privileged capabilities to unauthorized users.

## Solution

Provide a web-based CCIS Student Council Centralized Platform with a public student portal, authenticated student self-service, a role-restricted DevCom dashboard, and asynchronous email operations.

The public portal presents council information, announcements, events, FAQs, media, transparency resources, and privacy information. Authenticated institutional users complete consent and profile verification, manage their profiles and notification preferences, register for eligible events, access event and attendance passes, and contact council support.

Authorized staff use the dashboard to manage published council content, events, registrations, attendance, student verification, users, directory information, and visual settings according to their assigned role. Database-enforced authorization, scoped server workflows, and a transactional email outbox protect sensitive data and keep operational actions reliable.

## User Stories

1. As a prospective CCIS student, I want to browse the council portal without an account, so that I can learn about the council and its services.
2. As a student, I want to view current council announcements, so that I do not miss deadlines, events, or results.
3. As a student, I want to filter and open announcements, so that I can quickly find the full details relevant to me.
4. As a student, I want to see upcoming academic and council events in a calendar, so that I can plan my participation.
5. As a student, I want to distinguish priority events and deadlines from general activities, so that I can prioritize urgent commitments.
6. As a student, I want to view council officers, committees, responsibilities, and historical terms, so that I know who represents me and where to direct concerns.
7. As a student, I want to search frequently asked questions, so that I can resolve common concerns without waiting for support.
8. As a student, I want to access council media, gallery content, transparency reports, and published video content, so that I can engage with council activities and review public records.
9. As a university student, I want to sign in with an authorized institutional identity, so that student-facing services are limited to the intended community.
10. As a new student, I want to provide privacy consent and complete my profile, so that the council has the information needed to serve me responsibly.
11. As a student awaiting approval, I want to see my verification status, so that I understand which services are available and what happens next.
12. As a student, I want to update only my own permitted profile details, so that my data stays accurate without allowing privileged account changes.
13. As a student, I want to manage email notification preferences, so that I control whether I receive council updates.
14. As an approved and eligible student, I want to register for an event once, so that I receive my place without duplicate entries.
15. As an event participant, I want to see whether capacity remains, so that I can make an informed registration decision.
16. As an event participant, I want to receive a durable event pass after registration, so that I can present it at the event.
17. As a student, I want to access a personal attendance pass, so that authorized staff can identify me at applicable activities.
18. As a student, I want to contact the council through a private support conversation, so that I can request help without exposing my messages to other students.
19. As a student, I want to see support replies and read status promptly, so that I know when the council has responded.
20. As a content officer, I want to create, schedule, publish, pin, edit, and retire public announcements and FAQs, so that students receive accurate information.
21. As an authorized event operator, I want to create and manage events with capacity, category, time, location, and registration settings, so that the public calendar and registration flow remain accurate.
22. As registration staff, I want to review event registrations and export operational lists, so that I can prepare for and manage attendance.
23. As registration staff, I want to scan an event ticket or attendance pass and receive a clear attendance outcome, so that check-in is quick and duplicate scans are handled safely.
24. As verification staff, I want to review and decide student verification submissions within my authorized scope, so that eligible students receive timely access.
25. As authorized council staff, I want to respond to student support conversations, so that inquiries are resolved by the appropriate operational team.
26. As the DevCom Head, I want to manage roles, bans, account lifecycle operations, officers, committees, and platform settings, so that the platform remains governed and maintainable.
27. As an authorized media administrator, I want to manage gallery and published media content, so that public assets remain relevant and appropriate.
28. As an authorized administrator, I want to activate a single council visual theme, so that the public portal presents a coherent, current identity.
29. As a subscribed student, I want to receive relevant announcement and event emails without duplicates, so that I stay informed without being spammed.
30. As an operator, I want email delivery to be processed asynchronously with recoverable outcomes, so that publishing and registration do not fail or stall because of email-provider delays.
31. As a platform maintainer, I want database authorization to be enforced independently of the browser, so that UI changes cannot grant access to protected records or workflows.
32. As an incoming DevCom officer, I want documented setup, deployment, and recovery expectations, so that the platform can be safely handed over between council terms.

## Implementation Decisions

- Deliver the product as a React single-page application with public, student-authenticated, and staff-administration experiences.
- Use Supabase Authentication for session management and institutional identity enforcement.
- Use PostgreSQL as the system of record, with row-level security forced on application data and database functions as the authority for privileged workflows.
- Use dedicated server-owned workflows for student profile updates, privacy consent, verification submission and decisions, notification preferences, attendance-pass issuance, event registration, attendance scanning, and account deletion.
- Persist roles and verification status on the student profile; authorize each staff capability according to a defined role matrix rather than trusting client state.
- Treat public content, council directory information, public events, gallery assets, reports, and published media as read-only public resources; restrict all writes to designated council roles.
- Enforce event capacity and one-registration-per-student atomically at the database layer.
- Use an event registration identifier for participant tickets, status transitions, and staff attendance verification.
- Record attendance as registered or walk-in only through an authorized server workflow that handles duplicate scans safely.
- Keep student messages, concerns, profiles, registrations, verification records, and email queue data private to their owners and authorized operational staff.
- Use realtime updates for time-sensitive public content and support conversations where the underlying database contract permits them.
- Store public published media in designated public storage buckets and private drafts in a restricted bucket delivered through signed URLs.
- Apply an active dynamic theme globally while allowing only one theme configuration to be active at a time.
- Write announcement and event email requests transactionally to an outbox, expand them in bounded batches, and process queue rows with leases, idempotency keys, and explicit delivery outcomes.
- Run hosted email processing on a schedule with secrets stored outside browser-accessible configuration; retain a local development fallback only for local development.
- Preserve clear operational documentation for environment configuration, deployment, email delivery, and council handover.

## Testing Decisions

- Test externally observable behavior, authorization boundaries, and durable contracts rather than component implementation details.
- Keep TypeScript type checks, application unit tests, production builds, and Edge Function static checks as required validation.
- Keep database security and behavior contracts for row-level security, grants, privileged-function hardening, storage visibility, event registration, attendance, gallery access, messaging, and account workflows.
- Replay the canonical migration chain against a clean database before validating database contracts, so the deployed schema remains reproducible.
- Test critical student workflows: institutional access, profile and consent actions, verification state, notification preferences, event registration, ticket issuance, attendance, and private messaging.
- Test critical staff workflows: role-scoped content management, verification decisions, event administration, registration access, attendance scans, support handling, and account lifecycle actions.
- Test email producers and processing for idempotency, recoverable failures, and separation of browser access from worker authority.
- Retain static and behavior coverage for routing, PostgREST query construction, ticket scanning, privacy access, key handling, and development worker coordination.

## Out of Scope

- Replacing Supabase with a custom backend or introducing a separate mobile application.
- Building a generalized learning-management system, student-information system, or university-wide portal.
- Processing payments, collecting organization fees, or implementing financial accounting beyond publication of approved transparency resources.
- Supporting identities outside the institutional community except explicitly governed administrative allowlist exceptions.
- Replacing the council's external email provider, QR generation provider, or deployed hosting platform.
- New product features proposed in historical documentation, including calendar-feed subscriptions, waitlists, image-optimization pipelines, and broad client-side query-cache adoption.

## Further Notes

- This PRD defines the intended current platform scope. It does not convert the current audit findings into scope requirements.
- Follow-up implementation work must reconcile the role matrix with both dashboard visibility and database permissions, particularly for verification, event management, registrations, and profile access.
- Canonical migrations must include every database object required by the supported application workflows, including support conversation creation, ordering, and realtime behavior.
- Administrative routes should be linkable and preserve their intended mode without being normalized to the public route.
- Ban enforcement must apply the same expiry semantics across login, attendance, event eligibility, and notification delivery.
- Operational and test documentation must describe the current canonical queue/outbox workflow and current schema rather than archived legacy contracts.