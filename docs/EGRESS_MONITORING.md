# CCIS Egress Monitoring Runbook

## Where to monitor

Open the Supabase Dashboard, select the CCIS organization, then open **Usage**. Review the project breakdown for database, Storage, Realtime, Auth, and Edge Functions. Use the current billing-cycle window and compare it with the previous seven days before treating a single spike as a trend.

Cached egress is data served from a cache or CDN edge. Uncached egress is data read from the origin. Both consume network allowance, but a long-lived immutable asset should produce fewer origin reads and more browser-cache hits. A `304` still has request overhead; a browser memory/disk-cache hit is preferable for an unchanged versioned object.

## Storage request investigation

1. Open **Logs Explorer** for the project.
2. Select Storage/API gateway logs and the incident time range.
3. Group or filter by request path, status, user agent, referrer, and cache status when available.
4. Exclude signed query values, tokens, and user identifiers from exported reports.
5. Sort public object identifiers by request count and join them with the redacted inventory from `npm run audit:supabase-usage`.
6. Estimate transfer as `request count x object bytes`. Keep cached and uncached estimates separate.
7. For `/storage/v1/object/info` traffic, capture the browser Network **Initiator** stack. The repository has no direct Storage `info()` call, so the initiator is required before changing code.

Inspect API routes by normalized endpoint, not full query string. Watch `/rest/v1/messages`, `/rest/v1/conversations`, chat RPCs, public feeds, and Edge Function invocations. Review Realtime peak connections and channel join/leave activity separately from registered-user count.

## Development telemetry

Development builds expose no public dashboard. In the browser console, run:

```js
globalThis.__CCIS_DEV_TELEMETRY__?.snapshot()
```

The snapshot contains normalized Supabase API call counts, duplicate calls within two seconds, slow calls over one second, media bytes observed per pathname, and active Realtime channel count. It never records authorization headers, keys, query values, response bodies, or email contents. The wrapper is not installed when `import.meta.env.DEV` is false.

Cross-origin resources may report zero transfer bytes unless the response exposes Resource Timing headers. Confirm uncertain values in the browser Network panel.

## Weekly checks

- Record cached and uncached egress used and projected at cycle end.
- Review the ten most-requested public objects and their byte sizes.
- Confirm new officer assets are at most 300 KB, banners at most 1 MB, and patch thumbnails at most 300 KB.
- Confirm versioned assets have a one-year immutable cache directive.
- Check Realtime peak connections, joins, and unexpected global message subscriptions.
- Check Edge Function invocation totals, email queue depth, dead letters, and cron-to-worker request ratio.
- Run the read-only audit and compare database size, Storage totals, Auth count, publication tables, and schedules.
- Review database advisors. Observe unused indexes over multiple weeks; do not drop them from one snapshot.

## Thresholds

- **50%:** record the growth driver and projected cycle-end usage; verify caching and large-object counts.
- **75%:** pause nonessential media publishing, optimize newly identified large public objects, and review daily.
- **90%:** open an incident, restrict optional uploads, investigate hotlinking/bots, and prepare an approved static/CDN cutover for public assets.
- **100%:** preserve authentication and core records, disable only nonessential high-egress public media through a reviewed application change, and escalate plan/billing decisions. Never weaken RLS or expose private files.

## Unexpected-spike response

1. Record the start time, metric, project, and rate of increase.
2. Compare Storage, database, Realtime, and Edge Function graphs.
3. Use logs to identify the endpoint/object and user-agent/referrer distribution.
4. Check for a newly published large file, cache-busting URL, broken `srcset`, hotlinking, scraper, or retry loop.
5. Reproduce only in local/staging when possible; do not load-test production without approval.
6. Apply the smallest reversible mitigation, then verify usage slope and application behavior.
7. Preserve evidence and document the rollback.

Hotlinking indicators include high public-object traffic with few page requests, unfamiliar referrers, repetitive user agents, broad object enumeration, and traffic concentrated on one large asset. Bot mitigation must not block legitimate campus users and must be coordinated with available hosting/CDN controls.
