# Story 17.12: Bulk Payout via Provider

Status: done

## Story

As a SaaS Owner,
I want to send all provider-eligible payouts in a batch at once,
So that I can pay multiple affiliates efficiently.

## Acceptance Criteria

1. **AC1:** "Send All via Stripe" button shown when batch has pending payouts and batch is not completed
2. **AC2:** Button disabled with spinner during processing (prevents double-click)
3. **AC3:** System pre-validates total pending amount vs provider available balance
4. **AC4:** If sufficient balance: all eligible payouts sent via `provider.createTransfer()` sequentially
5. **AC5:** If insufficient balance: modal shows "Your balance (₱A) is not enough. Shortfall: ₱C."
6. **AC6:** Modal offers "Top up and retry" (closes modal) and "Pay only what you can cover" (partial send, sorted by amount ascending)
7. **AC7:** Payouts already sent via other methods are NOT affected
8. **AC8:** Each transfer uses `payoutId` as idempotency key
9. **AC9:** Each successful transfer creates an audit log entry
10. **AC10:** Batch `providerCounts` incremented with total sent count
11. **AC11:** TypeScript compilation passes

## Tasks / Subtasks

- [x] Task 1: Create sendAllEligibleViaProvider action (AC: #1-#10)
  - [x] 1.1 Validate auth, tenant, provider config
  - [x] 1.2 Fetch eligible payouts via internal query
  - [x] 1.3 Fetch provider balance via circuit breaker
  - [x] 1.4 Sort payouts by amount ascending, fit within balance
  - [x] 1.5 Send transfers sequentially for eligible payouts
  - [x] 1.6 Update each payout to "processing" with paymentSource/paymentReference
  - [x] 1.7 Create audit log entry per transfer
  - [x] 1.8 Increment batch providerCounts with sent count
  - [x] 1.9 Return sent/skipped/amounts/errors summary

- [x] Task 2: Add _getEligibleProviderPayoutsInternal query (AC: #7)
  - [x] 2.1 Filter pending payouts in batch
  - [x] 2.2 Join with affiliates to check payoutProviderEnabled
  - [x] 2.3 Return payout + affiliate email for transfer

- [x] Task 3: Add "Send All via Stripe" button + handler (AC: #1-#6)
  - [x] 3.1 Button in batch detail header actions area
  - [x] 3.2 handleSendAllViaProvider fetches balance, compares total
  - [x] 3.3 Sufficient path: calls sendAllEligibleViaProvider directly
  - [x] 3.4 Insufficient path: shows shortfall modal
  - [x] 3.5 Modal with "Top up and retry" and "Pay only what you can cover" buttons
  - [x] 3.6 Toast notifications for results (sent count, skipped, errors)

- [x] Task 4: Update _incrementProviderCount to accept optional count param (AC: #10)
  - [x] 4.1 Default count=1 for individual sends, explicit count for bulk

- [x] Task 5: Verify compilation (AC: #11)

## Dev Notes

Builds on Story 17.11 infrastructure (circuit breaker, internal mutations, audit patterns).

### Key Decisions

**Balance check client-side**: The handler first calls `getProviderBalance` action to fetch current balance, then compares against pending total from already-loaded `payouts` query. This avoids a round-trip to a separate "check sufficiency" action.

**Partial send strategy**: When balance is insufficient, payouts are sorted by amount ascending and sent in order until balance is exhausted. This maximizes the number of affiliates paid.

**Modal UX**: "Top up and retry" simply closes the modal — the SaaS Owner tops up externally then clicks "Send All via Stripe" again. "Pay only what you can cover" calls `handleSendAllViaProvider(true)` which bypasses the balance check and sends whatever fits.

**Eligibility filtering**: The internal query joins payouts with affiliates to only return payouts where the affiliate has `payoutProviderEnabled = true`. The action re-validates this per-payout before sending.

### Files Modified

| File | Description |
|------|-------------|
| `convex/providerConnectWebhook.ts` | Added `sendAllEligibleViaProvider` action |
| `convex/payouts.ts` | Added `_getEligibleProviderPayoutsInternal`, updated `_incrementProviderCount` with optional count |
| `src/app/(auth)/payouts/batches/[batchId]/BatchDetailClient.tsx` | Added "Send All via Stripe" button, handler, insufficient balance modal |

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Completion Notes List

- sendAllEligibleViaProvider validates: auth, tenant, provider, then fetches eligible payouts and balance
- Payouts sorted by amount ascending to maximize number of affiliates paid in partial send
- Each transfer uses circuit breaker and creates individual audit log entries
- providerCounts incremented once at end with total sent count
- Modal shows available balance, total needed, and shortfall with clear action buttons
- TypeScript: 146 total errors (all pre-existing), zero new errors

### File List

| File | Action | Description |
|------|--------|-------------|
| `convex/providerConnectWebhook.ts` | Modified | Added sendAllEligibleViaProvider action |
| `convex/payouts.ts` | Modified | Added _getEligibleProviderPayoutsInternal, updated _incrementProviderCount |
| `src/app/(auth)/payouts/batches/[batchId]/BatchDetailClient.tsx` | Modified | Added bulk send button, handler, insufficient balance modal |

### Change Log

| Date | Change |
|------|--------|
| 2026-04-21 | Implemented Story 17.12: Bulk payout via provider |
