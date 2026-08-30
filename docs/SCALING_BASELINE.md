# CCIS Supabase Scaling Baseline

Captured from the linked `CCIS-Website` project (`aecrmddgsnnxtemyikqu`) and refreshed at 2026-08-28 05:44 UTC through read-only SQL and advisor endpoints. No production record, object, policy, migration, function, secret, or schedule was changed.

## Executive baseline

| Metric | Current value |
| --- | ---: |
| Database size | 23.65 MiB (24,800,403 bytes) |
| Auth users | 49 |
| Storage objects | 62 |
| Storage size | 150.50 MiB (157,810,734 bytes) |
| Officer originals | 23 objects, 101.71 MiB |
| Average officer original | 4.42 MiB (4.64 decimal MB) |
| Largest officer original | 5.65 MiB |
| Banner objects | 15 objects, 14.37 MiB |
| Patch thumbnails | 3 objects, 6.74 MiB |
| Public PDF | 23.03 MiB (24.14 decimal MB) |
| Objects with one-hour cache | 62 of 62 |
| Realtime publication tables | `conversations`, `messages` |
| Active cron | `ccis-email-worker`, every minute |

## Storage inventory

| Bucket | Visibility | Objects | Total | Average | Maximum |
| --- | --- | ---: | ---: | ---: | ---: |
| `banners` | Public | 15 | 14.37 MiB | 981 KiB | 4.19 MiB |
| `bukas-kaban-reports` | Public | 2 | 23.12 MiB | 11.56 MiB | 23.03 MiB |
| `gallery-images` | Public | 42 | 106.28 MiB | 2.53 MiB | 5.65 MiB |
| `patch-thumbnails` | Public | 3 | 6.74 MiB | 2.25 MiB | 2.56 MiB |
| `ccis-private-drafts` | Private | 0 | 0 B | 0 B | 0 B |
| `patch-videos` | Public | 0 | 0 B | 0 B | 0 B |

Folder totals explain the dominant payload:

| Bucket/folder | Objects | Total |
| --- | ---: | ---: |
| `gallery-images/officers` | 23 | 101.71 MiB |
| `gallery-images/student-achievements` | 9 | 2.12 MiB |
| `gallery-images/student-council` | 10 | 2.45 MiB |
| `banners/events` | 12 | 11.04 MiB |
| `banners/announcements` | 3 | 3.33 MiB |
| `patch-thumbnails/(root)` | 3 | 6.74 MiB |
| `bukas-kaban-reports/(root)` | 2 | 23.12 MiB |

Every existing object reports `cacheControl=max-age=3600`. None currently has the intended one-year immutable policy.

## Referenced surface payloads

The reference audit matches database URL fields to `storage.objects` metadata. It counts only matched Supabase objects and does not fetch file bodies.

| Surface | URL references | Matched objects | Referenced bytes per complete load | Largest object |
| --- | ---: | ---: | ---: | ---: |
| Officers | 41 | 22 | 99.99 MiB | 5.65 MiB |
| Events | 6 | 6 | 7.25 MiB | 4.19 MiB |
| Announcements | 1 | 1 | 1.02 MiB | 1.02 MiB |
| Gallery main images | 8 | 8 | 1.76 MiB | 322 KiB |
| Gallery additional images | 5 | 5 | 1.01 MiB | 326 KiB |
| Patch thumbnails | 3 | 3 | 6.74 MiB | 2.56 MiB |
| Transparency-report PDF | 1 | 1 | 23.03 MiB | 23.03 MiB |
| Transparency-report thumbnail | 1 | 1 | 93 KiB | 93 KiB |

There are 41 officer rows, but only 22 current URL references matched hosted Storage objects; the folder contains 23 officer objects. The migration utility must therefore inventory references and objects separately, preserve unmatched/external URLs, and flag the extra object instead of deleting it.

## Officer egress model

This model uses the complete 23-object officer folder (106,646,006 bytes) once per user. It is a conservative cold-cache/full-page-transfer estimate, not a monthly traffic forecast.

| Complete loads | Current raw transfer | Target at 120 KB average | Reduction |
| ---: | ---: | ---: | ---: |
| 50 | 5.33 GB | 138 MB | 97.4% |
| 200 | 21.33 GB | 552 MB | 97.4% |
| 500 | 53.32 GB | 1.38 GB | 97.4% |
| 1,700 | 181.30 GB | 4.69 GB | 97.4% |

The optimized target is 23 × 120 KB = 2.76 MB for the full set. Initial rendering will page or incrementally reveal a smaller subset, keeping initial officer media below 3 MiB even before warm-cache benefits.

## API and Realtime baseline

Static inspection found no explicit frontend Storage `info()` call. Existing `getPublicUrl()` calls construct URLs locally. The reported `/storage/v1/object/info/...` traffic therefore requires browser Network/initiator capture; the implementation must add development request/resource telemetry and a browser assertion rather than guessing its origin.

The live Realtime publication contains `public.conversations` and `public.messages`. Current source opens unfiltered global `messages` channels in navigation/admin chrome and additional scoped channels in chat surfaces. Opening student chat can therefore coexist with multiple channels. Ordinary page loads also query conversation/unread state and can invoke `ensure_conversation` while chat is closed.

## Email-worker baseline

`ccis-email-worker` is active on `* * * * *`, approximately 43,200 scheduled invocations in a 30-day month. The refreshed live queue snapshot contains 93 `pending`, 15 `processing`, and 100 `sent` rows. Source already uses an internal worker secret, batch dequeue, provider idempotency keys, bounded delivery outcome RPCs, and aggregate response data; the remaining work is to verify retry/dead-letter behavior and reduce empty invocations without weakening delivery or authentication.

## Database advisor baseline

The performance advisor returned 62 notices:

| Notice | Count | Planned treatment |
| --- | ---: | --- |
| RLS auth init-plan | 12 | Replace row-wise auth calls only where semantics are identical; cover with role tests. |
| Unindexed foreign keys | 9 | Add verified useful supporting indexes. |
| Multiple permissive policies | 27 | Consolidate only equivalent policy pairs; do not broaden access. |
| Duplicate indexes | 4 | Drop only confirmed redundant non-constraint indexes with rollback SQL. |
| Unused indexes | 10 | Observe and document; do not drop from one snapshot. |

The security advisor also reports 3 RLS-enabled internal tables with no policies, 23 authenticated executable `SECURITY DEFINER` functions, and leaked-password protection disabled. Many functions are intentionally purpose-limited APIs and require contract review rather than blanket revocation. These security notices are documented separately from the 62 requested performance notices.

## Reproducing the audit

Use a local or approved read-only database connection; never paste the URL into source or logs:

```powershell
$env:SUPABASE_DB_URL = '<approved read-only connection string>'
npx.cmd tsx scripts/audit-supabase-usage.ts
```

Add `--json` for machine-readable output. The script starts a read-only transaction, issues only `SELECT` statements, rolls back, prints aggregates and hashed object identifiers, and never prints the connection string, original filenames, or user records.

## Validation boundary

This baseline is confirmed current for the capture timestamp. Actual post-optimization sizes, CDN response headers, page transfer, and advisor deltas cannot be claimed until the local implementation is tested and the separately approved production migration/object-reference workflow has run.
