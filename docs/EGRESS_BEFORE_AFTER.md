# Egress Before and After Model

## Measurement status

“Before” values are production measurements captured read-only on 2026-08-28. “After” values below are enforced code ceilings or target models. Production after-measurements remain unavailable until the separately approved Storage conversion and reference update are complete.

| Surface | Before | Implemented target or ceiling | Expected reduction |
| --- | ---: | ---: | ---: |
| 23 officer objects | 106,646,006 bytes | 2,826,240 bytes at 120 KiB average | 97.35% |
| 23 officer hard ceiling | 106,646,006 bytes | 7,065,600 bytes at 300 KiB each | at least 93.38% |
| 15 banners | 14.37 MiB | about 7.32 MiB at 500 KiB target | about 49% |
| 3 patch thumbnails | 6.74 MiB | 450 KiB at 150 KiB target | about 93.5% |
| Public PDF on initial list | thumbnail only | thumbnail at most 200 KiB | full 23.03 MiB deferred |

Officer cold-transfer model:

| Complete loads | Current originals | 120 KiB target | Hard ceiling |
| ---: | ---: | ---: | ---: |
| 50 | 5.33 GB | 141 MB | 353 MB |
| 200 | 21.33 GB | 565 MB | 1.41 GB |
| 500 | 53.32 GB | 1.41 GB | 3.53 GB |
| 1,700 | 181.30 GB | 4.80 GB | 12.01 GB |

The Officers UI now fetches its data only when the organization tab opens, uses lazy images with intrinsic dimensions, and does not render unrelated route media. The gallery reveals 24 cards at a time, uses the first additional image as a card thumbnail when available, renders only the active and adjacent hero slides, and loads full media in the detail view.

New versioned uploads use `max-age=31536000, immutable` through the Supabase Storage client. The exact served `Cache-Control` response must be captured after deployment because CDN response normalization is outside the repository.

## API and Realtime delta

- Removed the global unfiltered student navigation message channel.
- Removed the global admin-sidebar message channel and verification polling/RPC.
- Restricted `list_pending_verifications` to `VerificationManager`.
- Deferred Account-page conversation/message requests until its Messages tab is active.
- Deferred Info Hub officer/committee queries until the organization tab is active.
- Replaced message `select('*')` calls with explicit projections and 30-row student pagination.
- Added a five-minute authenticated-profile cache with in-flight request deduplication.
- Student chat opens one filtered INSERT channel only while visible and online, then unregisters/removes it.
- Admin inbox retains one screen-scoped INSERT channel because authorized staff need all conversation activity; it is removed while hidden/offline or unmounted.

## Required after capture

After an approved rollout, run the audit, inspect Network payloads with a cold cache, repeat with a warm cache, confirm no Storage `info()` fan-out, and record actual object sizes and page transfer here. Do not substitute target values for measured results.
