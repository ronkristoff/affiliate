# Deferred Work

## Deferred from: code review of tech-spec-replace-cron-jobs-with-aggregates (2026-04-18)

- **Fan-out scalability in `getAggregatePlatformKPIs`** — 6+ aggregate calls per tenant in a query. At 100+ tenants, this becomes 600+ O(log n) calls per admin page load. Spec acknowledges in Task 1.1 performance note. For early production (<100 tenants) this is acceptable. At scale, consider caching with TTL or a `DirectAggregate` for platform-wide totals.
- **`tenantStats` still needed for `lastDegradedAt`** — `getStats()` still reads `lastDegradedAt` from tenantStats. This is a single timestamp field that can't be aggregated. Future story: consider a DirectAggregate or separate mechanism to track this.
- **Expired-but-unread notifications inflate badge count** — The `notificationsByReadAggregate` counts ALL `isRead=false` regardless of `expiresAt`. Between daily cleanup runs, the badge may show more unread than the list displays. Future improvement: mark notifications as read on expiry instead of deleting them.

## Deferred from: one-shot spec-commission-by-flag-aggregate (2026-04-18)

- **Leaderboard pagination gap with filtered tenants** — `getTenantLeaderboard()` paginates `tenants` then filters out `deleted`/`cancelled`, which can produce empty pages with `isDone: false`. Acceptable for early production (few deleted tenants). Fix: use a filtered index or pre-compute a cursor skip mechanism at scale.
- **N+1 aggregate queries in leaderboard** — 5 aggregate calls per tenant per page load. At 20 tenants/page = 100 calls. Acceptable for early production; at scale consider caching or a `DirectAggregate` for leaderboard metrics.
