# Story 17.14: Retry Failed Provider Payouts

Status: review

## Story

As a SaaS Owner,
I want to retry a failed provider payout without creating a duplicate transfer,
So that I can recover from transient failures.

## Acceptance Criteria

1. **AC1:** Retry only works on payouts with `status = "failed"` and `paymentSource = "stripe"`
2. **AC2:** Idempotency key (payoutId) prevents duplicate transfers
3. **AC3:** Verifies payout exists, belongs to correct tenant, and has status "failed"
4. **AC4:** On success: payout status updates to "processing"
5. **AC5:** Audit log entry created with action "payout_retry_provider"
6. **AC6:** On failure: clear error message shown
7. **AC7:** Retry button disabled while retry in progress
8. **AC8:** TypeScript compilation passes

## Tasks / Subtasks

- [x] Task 1: Create retryPayoutViaProvider action (AC: #1-#6)
  - [x] 1.1 Validate auth, tenant, payout ownership
  - [x] 1.2 Validate payout status === "failed" (reject pending/processing/paid)
  - [x] 1.3 Validate affiliate provider enabled
  - [x] 1.4 Call provider.createTransfer via circuit breaker (idempotency key = payoutId)
  - [x] 1.5 Update payout to "processing" with paymentSource/paymentReference
  - [x] 1.6 Create audit log entry with action "payout_retry_provider"
  - [x] 1.7 Return success/transferId or error

- [x] Task 2: Update UI with dedicated retry handler (AC: #7)
  - [x] 2.1 Add `retryViaProvider` useAction hook
  - [x] 2.2 Add `isRetryingViaProvider` state
  - [x] 2.3 Add `handleRetryViaProvider` handler with toast notifications
  - [x] 2.4 Wire retry button to dedicated handler (not sendPayoutViaProvider)
  - [x] 2.5 Revert sendPayoutViaProvider to pending-only validation

- [x] Task 3: Verify compilation (AC: #8)

## Dev Notes

Story 17.13 added a basic retry button that reused `sendPayoutViaProvider`. This story replaces that with a dedicated action that has proper failed-only validation and distinct audit logging.

### Key Decisions

**Dedicated action vs. parameter**: Created `retryPayoutViaProvider` as a separate action rather than adding a `retry` parameter to `sendPayoutViaProvider`. This keeps each action's validation simple and produces distinct audit log actions.

**Reuses `createTransfer`**: Like the original send, the retry calls `provider.createTransfer` with the same idempotency key (payoutId). If the original transfer actually succeeded at Stripe but the webhook was lost, the idempotency key prevents a duplicate charge.

**Separate loading state**: `isRetryingViaProvider` is independent from `isSendingViaProvider` so both buttons can coexist without interfering.

### Files Modified

| File | Description |
|------|-------------|
| `convex/providerConnectWebhook.ts` | Added `retryPayoutViaProvider` action, reverted `sendPayoutViaProvider` to pending-only |
| `src/app/(auth)/payouts/batches/[batchId]/BatchDetailClient.tsx` | Added dedicated retry handler with separate loading state |

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Completion Notes List

- `retryPayoutViaProvider` validates: auth, payout ownership, status === "failed", affiliate provider enabled
- Reuses `createTransfer` with same idempotency key — safe for "succeeded but webhook lost" scenarios
- Audit action is "payout_retry_provider" (distinct from "payout_sent_provider")
- `sendPayoutViaProvider` reverted to pending-only — cleaner separation of concerns
- TypeScript: zero new errors

### File List

| File | Action | Description |
|------|--------|-------------|
| `convex/providerConnectWebhook.ts` | Modified | Added retryPayoutViaProvider action |
| `src/app/(auth)/payouts/batches/[batchId]/BatchDetailClient.tsx` | Modified | Added dedicated retry handler |

### Change Log

| Date | Change |
|------|--------|
| 2026-04-21 | Implemented Story 17.14: Retry failed provider payouts |
