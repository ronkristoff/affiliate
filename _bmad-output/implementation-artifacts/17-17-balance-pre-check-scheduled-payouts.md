# Story 17.17: Balance Pre-Check for Scheduled Payouts

Status: done

## Story

As a system,
I want to verify the tenant's provider balance covers the total batch amount before generating a batch,
So that no transfers are attempted when funds are insufficient.

## Acceptance Criteria

1. **AC1:** Before generating a batch, cron checks tenant's Stripe balance via circuit breaker
2. **AC2:** If balance < total batch amount, NO batch is generated and NO transfers are attempted
3. **AC3:** Warning email sent to SaaS Owner with available/needed/shortfall amounts
4. **AC4:** Error log entry created with `skipped_insufficient_balance` reason
5. **AC5:** If balance covers total, batch is created and transfers initiated normally
6. **AC6:** TypeScript compilation passes (zero new errors)

## Tasks / Subtasks

- [x] Task 1: Add `_checkBalanceForBatch` action (AC: #1)
  - [x] 1.1 Accepts tenantId, stripeAccountId, totalAmount
  - [x] 1.2 Uses `withStripeCircuitBreaker` to fetch balance
  - [x] 1.3 Returns `{ sufficient, available, needed, shortfall }`

- [x] Task 2: Add `_sendInsufficientBalanceEmail` action (AC: #3)
  - [x] 2.1 Fetches tenant owner email via internal query
  - [x] 2.2 Sends HTML email with available/needed/shortfall breakdown
  - [x] 2.3 Non-fatal — email failure doesn't block processing

- [x] Task 3: Add `_getTenantForEmail` internal query (AC: #3)
  - [x] 3.1 Fetches tenant name + owner email from users table

- [x] Task 4: Integrate balance check into `runScheduledPayouts` (AC: #1-#5)
  - [x] 4.1 Insert balance check after gathering eligible commissions, before batch generation
  - [x] 4.2 If insufficient: log error, send email, skip to next tenant (no batch)
  - [x] 4.3 If sufficient: proceed to batch generation and transfers as before

- [x] Task 5: Verify compilation (AC: #6)

## Dev Notes

### Key Decisions

**Balance check placement**: Inserted between commission gathering and batch generation. This ensures we don't create a batch (with side effects like `batchId` on commissions) when we can't pay.

**Circuit breaker on balance check**: Uses `withStripeCircuitBreaker` for the `getBalance` call. If the breaker trips or Stripe returns an error, we treat it as insufficient balance (safe default — don't attempt payouts).

**Error log with metadata**: The `skipped_insufficient_balance` entry includes `tenantId`, `reason`, `available`, `needed`, and `shortfall` as structured metadata for dashboard filtering.

**Email format**: Simple HTML with branded colors matching the project's design system. Uses Philippine Peso (₱) formatting.

### Files Modified

| File | Description |
|------|-------------|
| `convex/scheduledPayouts.ts` | Added `_checkBalanceForBatch`, `_sendInsufficientBalanceEmail`, balance check + error log in `runScheduledPayouts` |
| `convex/scheduledPayoutsQueries.ts` | Added `_getTenantForEmail` internal query |

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Completion Notes List

- `_checkBalanceForBatch` returns `sufficient: false` on any Stripe error (circuit breaker / API failure) — conservative default
- Error log uses `severity: "warning"` and `source: "scheduledPayouts"` consistent with existing patterns
- `_getTenantForEmail` finds the first owner-role user for the tenant — follows existing pattern from other email senders
- TypeScript: zero new errors (only pre-existing TS7022/7023/7024 from `as any` casts)

### File List

| File | Action | Description |
|------|--------|-------------|
| `convex/scheduledPayouts.ts` | Modified | Added balance pre-check, email action, error logging |
| `convex/scheduledPayoutsQueries.ts` | Modified | Added `_getTenantForEmail` query |

### Change Log

| Date | Change |
|------|--------|
| 2026-04-21 | Code review: fixed `_getTenantForEmail` to filter by owner role (was fetching any user) |
| 2026-04-21 | Implemented Story 17.17: Balance pre-check for scheduled payouts |
