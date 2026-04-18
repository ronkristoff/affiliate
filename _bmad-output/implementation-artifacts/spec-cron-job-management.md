---
title: 'Platform Admin Cron Job Management'
type: 'feature'
created: '2026-04-18'
status: 'done'
baseline_commit: 'a519fd1'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Cron jobs are hardcoded in `convex/crons.ts` with no visibility into execution history, no runtime control over intervals, and no way to enable/disable individual jobs without a code change and redeploy.

**Approach:** Replace the 8 static cron registrations with a config-driven dispatcher pattern. A `cronConfigs` table stores each job's enabled flag, interval, and metadata. A single lightweight dispatcher cron runs every 5 minutes, checks which jobs are due, and schedules them via `ctx.scheduler.runAfter(0, ...)`. A `cronExecutions` table logs every run (status, duration, result summary). A new admin page at `/cron-jobs` provides the UI for viewing history, toggling enabled/disabled, and editing intervals.

## Boundaries & Constraints

**Always:**
- All admin-only queries/mutations MUST call `requireAdmin(ctx)` before any DB read/write
- Execution logging MUST happen inside each job handler (not in the dispatcher) so failures are captured even when the job throws
- The dispatcher MUST be idempotent — if a job is already scheduled and not yet complete, do not schedule it again
- The `cronConfigs` table MUST be seeded on first deploy via a startup check (not a migration)
- All existing 8 cron handlers remain unchanged — only their invocation method changes

**Ask First:**
- Dispatcher polling interval (proposed: 5 minutes — acceptable for all current hourly/daily jobs)

**Never:**
- Do not modify existing cron handler logic (rateLimit, tenants, billingLifecycle, etc.)
- Do not use `ctx.scheduler.runAfter` with non-zero delays for scheduling (always 0 for immediate dispatch)
- Do not expose cronConfigs or cronExecutions to non-admin roles

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Disable a cron job | Admin toggles `enabled=false` in UI | Job skipped on next dispatcher check; no execution logged | N/A |
| Enable a previously disabled job | Admin toggles `enabled=true` | Job scheduled on next dispatcher check if interval has elapsed | N/A |
| Edit interval to smaller value | Admin changes from 24h to 1h | Job runs on next dispatcher check (since `lastFinishedAt + 1h < now`) | N/A |
| Job handler throws error | Handler raises exception | Execution logged with `status: "failed"`, `error` field populated; `lastFinishedAt` still updated so dispatcher doesn't retry immediately | Error captured in cronExecutions row |
| Dispatcher runs while job is in-flight | `lastFinishedAt` not yet updated | Dispatcher skips job (not yet due) — no duplicate scheduling | N/A |
| Two admin tabs toggle same job | Concurrent mutation | Last write wins; no corruption — Convex serializes mutations | N/A |
| Seed on fresh deploy | No `cronConfigs` documents exist | All 8 jobs inserted with current hardcoded values, `enabled: true` | Seed is idempotent (checks before insert) |
| View execution history | Admin opens `/cron-jobs` | Paginated list of recent executions, filterable by job name and status | N/A |

</frozen-after-approval>

## Code Map

- `convex/schema.ts` -- Add `cronConfigs` and `cronExecutions` tables
- `convex/crons.ts` -- Replace 8 static crons with single dispatcher cron + seed logic
- `convex/cronDispatcher.ts` -- NEW: Dispatcher logic, execution logging wrapper, admin queries/mutations
- `src/app/(admin)/cron-jobs/page.tsx` -- NEW: Admin page shell with Suspense
- `src/app/(admin)/cron-jobs/_components/CronJobsClient.tsx` -- NEW: Main client component (config table + history table)
- `src/app/(admin)/_components/AdminSidebar.tsx` -- Add "Cron Jobs" nav item
- `src/proxy.ts` -- Add `/cron-jobs` to `adminRoutes` array

## Tasks & Acceptance

**Execution:**
- [x] `convex/schema.ts` -- Add `cronConfigs` table (name, handlerRef, enabled, intervalHours, description, lastFinishedAt, lastScheduledAt, extraArgs) and `cronExecutions` table (jobName, status, startedAt, finishedAt, durationMs, resultSummary, error) with appropriate indexes
- [x] `convex/cronDispatcher.ts` -- Create dispatcher: (a) `seedCronConfigs` internalAction to insert all 8 jobs if not present, (b) `dispatchDueJobs` internalAction called by the 5-min cron to find due jobs and schedule them via `ctx.scheduler.runAfter(0, ...)`, (c) `executeJob` wrapper that runs the actual job handler, logs execution to `cronExecutions`, updates `lastFinishedAt` on `cronConfigs`, (d) admin queries: `listCronConfigs`, `listCronExecutions` (paginated), `getCronStats` (summary counts), (e) admin mutations: `toggleCronEnabled`, `updateCronInterval`
- [x] `convex/crons.ts` -- Replace all 8 static `crons.interval()` calls with single 5-minute dispatcher cron that calls `seedCronConfigs` then `dispatchDueJobs`; remove commented-out tier-overrides cron
- [x] `src/app/(admin)/cron-jobs/page.tsx` -- Create admin page with Suspense wrapper and skeleton fallback, following existing admin page pattern (bg-[var(--bg-canvas)], PageTopbar)
- [x] `src/app/(admin)/cron-jobs/_components/CronJobsClient.tsx` -- Build client component with: (a) config cards/list showing job name, status badge (enabled/disabled), interval, last run time, next estimated run; toggle switch for enable/disable; inline edit for interval; (b) execution history table below with pagination, filterable by job name and status (success/failed); relative timestamps via date-fns
- [x] `src/app/(admin)/_components/AdminSidebar.tsx` -- Add "Cron Jobs" nav item with clock/schedule icon between "User Timeline" and "Settings"
- [x] `src/proxy.ts` -- Add `"/cron-jobs"` to `adminRoutes` array

**Acceptance Criteria:**
- Given all 8 cron configs are seeded with `enabled: true`, when the dispatcher runs, then each due job is scheduled and executed with a success entry in `cronExecutions`
- Given an admin disables a cron job, when the dispatcher runs, then that job is skipped and no execution is logged
- Given an admin changes a job's interval from 24h to 1h, when the dispatcher runs, then the job is scheduled if `lastFinishedAt + 1h < now`
- Given a job handler throws, when execution completes, then a `cronExecutions` row with `status: "failed"` and the error message is created
- Given the admin opens `/cron-jobs`, when the page loads, then they see all 8 jobs with their current status, interval, and last run time
- Given the admin scrolls to the execution history section, when they filter by status "failed", then only failed executions are shown

## Review Findings

- [x] [Review][Patch] executeJob doesn't check `config.enabled` after schedule [cronDispatcher.ts:148] — Between scheduler.runAfter and execution, admin could disable the job. executeJob queries config but never checks `config.enabled`, so a disabled job still runs.
- [x] [Review][Patch] Stale-scheduled path resets `lastFinishedAt` unnecessarily [cronDispatcherHelpers.ts:155-157] — `_tryScheduleJob` stale path resets both `lastScheduledAt` AND `lastFinishedAt` to undefined, but `_resetStuckScheduled` correctly only resets `lastScheduledAt`. Clearing `lastFinishedAt` makes the job immediately "due" again after the stale window.
- [x] [Review][Patch] "Load more" replaces results instead of appending [CronJobsClient.tsx:272,480-482] — `setCursor` triggers a new `useQuery` that replaces the entire `executions` array. Previous page results are lost; user only sees the latest page.
- [x] [Review][Patch] Status filter applied client-side after server pagination [cronAdmin.ts:78-83] — `listCronExecutions` paginates first then filters by status in JS. `isDone` and `continueCursor` reflect the unfiltered state, causing incorrect "no more results" or truncated results when filtering.
- [x] [Review][Patch] `formatInterval` doesn't show days [CronJobsClient.tsx:47-51] — 24h+ intervals show "Every 168 hours" instead of "Every 7 days".
- [x] [Review][Patch] Native `<select>` elements violate AGENTS.md [CronJobsClient.tsx:393-419] — Two filter dropdowns use raw `<select>` instead of Radix Select as required by project conventions.
- [x] [Review][Patch] Aggregate bounds use string `"\uffff"` for numeric sort key [cronAdmin.ts:101-111] — Sort key is `[status, _creationTime]` where `_creationTime` is a number. Using `"\uffff"` as the upper bound for the numeric element may produce incorrect counts.
- [x] [Review][Defer] seedCronConfigs runs 8 upserts every 5 min unnecessarily [cronDispatcher.ts:88-100] — deferred, pre-existing design. Low impact: only 8 lightweight upserts, most are no-ops after initial seed.

## Spec Change Log

## Design Notes

**Dispatcher pattern over static crons:** Convex's `cronJobs()` API creates fixed-interval schedules at deploy time — intervals cannot be changed at runtime. The dispatcher pattern uses a single 5-minute polling cron that reads `cronConfigs` and schedules due jobs via `ctx.scheduler.runAfter(0, fn, args)`. This gives full runtime control over intervals and enable/disable without redeployment.

**Duplicate scheduling prevention:** Each `cronConfig` tracks `lastScheduledAt`. The dispatcher only schedules a job if `lastScheduledAt` is null or `lastFinishedAt >= lastScheduledAt` (meaning the previous run completed). This prevents stacking multiple runs when a job takes longer than the polling interval.

**Execution logging lives in the wrapper, not the dispatcher:** The `executeWithLogging` wrapper runs the actual handler inside try/catch, measures duration, and writes to `cronExecutions` regardless of success/failure. This ensures the dispatcher itself stays lightweight and failure-free.

## Verification

**Commands:**
- `pnpm tsc --noEmit` -- expected: no type errors
- `pnpm lint` -- expected: no lint errors

## Suggested Review Order

**Architecture: Config-driven dispatcher pattern**

- Entry point — single 5-min cron replaces 8 static crons
  [`crons.ts:6`](../../convex/crons.ts#L6)

- Job definitions seeded on first deploy (idempotent insert)
  [`cronDispatcher.ts:14`](../../convex/cronDispatcher.ts#L14)

**Atomic scheduling — race condition prevention**

- Read+check+write in single mutation prevents duplicate scheduling
  [`cronDispatcherHelpers.ts:67`](../../convex/cronDispatcherHelpers.ts#L67)

- Stale-job detection resets stuck configs after 10min timeout
  [`cronDispatcherHelpers.ts:87`](../../convex/cronDispatcherHelpers.ts#L87)

- Scheduler failure rolls back lastScheduledAt to prevent permanent stuck state
  [`cronDispatcher.ts:133`](../../convex/cronDispatcher.ts#L133)

**Execution logging with idempotency**

- Initial status "running" prevents ghost "success" records on crash
  [`cronDispatcherHelpers.ts:131`](../../convex/cronDispatcherHelpers.ts#L131)

- Recent-execution check prevents double-run on Convex action retry
  [`cronDispatcher.ts:164`](../../convex/cronDispatcher.ts#L164)

- Handler dispatch via switch on handlerRef (actions vs mutations correctly separated)
  [`cronDispatcher.ts:220`](../../convex/cronDispatcher.ts#L220)

**Admin queries and mutations**

- All admin functions gated by requireAdmin(ctx)
  [`cronAdmin.ts:22`](../../convex/cronAdmin.ts#L22)

- Server-side filtering by jobName before pagination, client-side status filter after
  [`cronAdmin.ts:70`](../../convex/cronAdmin.ts#L70)

**Schema**

- cronConfigs table with by_name index for config lookup
  [`schema.ts:877`](../../convex/schema.ts#L877)

- cronExecutions table with compound index for filtered pagination
  [`schema.ts:900`](../../convex/schema.ts#L900)

**Frontend — admin UI**

- Config cards with toggle, interval picker, and relative timestamps
  [`CronJobsClient.tsx:97`](../../src/app/(admin)/cron-jobs/_components/CronJobsClient.tsx#L97)

- Execution history with cursor-based "load more" and status filters
  [`CronJobsClient.tsx:330`](../../src/app/(admin)/cron-jobs/_components/CronJobsClient.tsx#L330)

**Peripherals**

- Sidebar nav item added between User Timeline and Settings
  [`AdminSidebar.tsx:73`](../../src/app/(admin)/_components/AdminSidebar.tsx#L73)

- Route protection via proxy.ts adminRoutes
  [`proxy.ts:25`](../../src/proxy.ts#L25)
