# Story 17.16: Scheduled Payout Cron Job

Status: done

## Story

As a system,
I want a daily cron job that checks which tenants have scheduled payouts due today,
So that auto-payouts run on the configured schedule without manual intervention.

## Acceptance Criteria

1. **AC1:** Cron runs daily, checks tenants with `payoutSchedule.payoutDayOfMonth` matching today
2. **AC2:** Only processes active tenants with Stripe Connect configured
3. **AC3:** Gathers eligible commissions: approved, not in batch, processing days elapsed, affiliate provider-enabled, above minimum amount
4. **AC4:** Skips tenants with no eligible commissions (no batch, no email)
5. **AC5:** Generates batch and sends transfers within available balance (sorted ascending)
6. **AC6:** Failures logged in errorLogs, does not block other tenants
7. **AC7:** All tenants skipped = no alert (normal operation)
8. **AC8:** TypeScript compilation passes

## Tasks / Subtasks

- [x] Task 1: Add cron job definition to cronDispatcher.ts (AC: #1)
  - [x] 1.1 Add "scheduled-payouts" entry with 24h interval
  - [x] 1.2 Add handler case in executeHandler

- [x] Task 2: Create internal queries/mutations (V8 runtime) (AC: #3)
  - [x] 2.1 `_getStripeEnabledTenants` — lists tenants with stripeAccountId
  - [x] 2.2 `_getEligibleCommissions` — approved, no batch, processing days elapsed
  - [x] 2.3 `_generateBatch` — aggregates by affiliate, filters provider-enabled, creates batch + payouts

- [x] Task 3: Create action orchestrator (Node.js runtime) (AC: #1-#7)
  - [x] 3.1 `runScheduledPayouts` — scans tenants, delegates to per-tenant processing
  - [x] 3.2 `_sendBatchTransfers` — balance check + sequential transfers via circuit breaker

- [x] Task 4: Verify compilation (AC: #8)

## Dev Notes

Split into two files to respect Convex runtime constraints:
- `scheduledPayouts.ts` (`"use node"`) — actions only (Stripe SDK, dynamic imports)
- `scheduledPayoutsQueries.ts` (no directive) — internal queries/mutations (V8 runtime, ctx.db access)

### Key Decisions

**`_creationTime` as proxy for `approvedAt`**: Commissions schema doesn't have `approvedAt`. Using `_creationTime` since most commissions are created with "approved" status directly from webhook processing.

**Balance-limited partial send**: Same pattern as bulk send (17.12) — sorts by amount ascending, sends within available balance. No warning email for insufficient balance in this story (deferred to 17.17).

**Per-tenant error isolation**: Each tenant's processing is wrapped in try/catch. One tenant's failure doesn't block others. Errors are logged to errorLogs.

**Audit trail**: Uses `actorType: "system"` and `trigger: "scheduled_cron"` metadata to distinguish from manual operations.

### Files Modified

| File | Description |
|------|-------------|
| `convex/cronDispatcher.ts` | Added scheduled-payouts cron job definition |
| `convex/scheduledPayouts.ts` | Action orchestrator for scheduled payouts |
| `convex/scheduledPayoutsQueries.ts` | Internal queries/mutations for tenant scanning and batch generation |

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Completion Notes List

- Cron runs every 5 minutes via dispatcher, but only processes tenants once per day (due date match)
- `_getStripeEnabledTenants` uses `.filter()` on tenants query — only tenants with stripeAccountId
- `_generateBatch` filters affiliates by `payoutProviderEnabled`, `payoutProviderAccountId`, and `minimumPayoutAmount`
- `_sendBatchTransfers` reuses `withStripeCircuitBreaker` and `_markPayoutProcessing` from Stories 17.11-17.12
- TypeScript: zero new errors

### File List

| File | Action | Description |
|------|--------|-------------|
| `convex/cronDispatcher.ts` | Modified | Added scheduled-payouts cron definition |
| `convex/scheduledPayouts.ts` | Created | Action orchestrator |
| `convex/scheduledPayoutsQueries.ts` | Created | Internal queries/mutations |

### Change Log

| Date | Change |
|------|--------|
| 2026-04-21 | Implemented Story 17.16: Scheduled payout cron job |
