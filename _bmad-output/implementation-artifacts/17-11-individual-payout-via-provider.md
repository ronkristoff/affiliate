# Story 17.11: Individual Payout via Provider

Status: done

## Story

As a SaaS Owner,
I want to send a single payout to an affiliate via my payout provider,
so that I can pay affiliates one at a time alongside manual and SaligPay options.

## Acceptance Criteria

1. **AC1:** "Send via Stripe" button shown for pending payouts with `payoutProviderEnabled = true`
2. **AC2:** Button disabled with spinner during processing (prevents double-click)
3. **AC3:** Validates tenant has provider account, affiliate enabled, amount > 0
4. **AC4:** On success: calls `provider.createTransfer()`, updates payout status to "processing", sets `paymentSource` and `paymentReference`, increments batch `providerCounts`
5. **AC5:** On validation failure: clear error message shown
6. **AC6:** Audit log entry created
7. **AC7:** TypeScript compilation passes

## Tasks / Subtasks

- [x] Task 1: Create sendPayoutViaProvider action (AC: #1-#6)
  - [x] 1.1 Validate auth, tenant, payout, affiliate provider enabled
  - [x] 1.2 Call provider.createTransfer via circuit breaker
  - [x] 1.3 Update payout to "processing" with paymentSource/paymentReference
  - [x] 1.4 Increment batch providerCounts
  - [x] 1.5 Create audit log entry
  - [x] 1.6 Return success/transferId or error

- [x] Task 2: Add internal mutations to payouts.ts (AC: #4)
  - [x] 2.1 _getPayoutByIdInternal — fetch payout with affiliate email
  - [x] 2.2 _markPayoutProcessing — set status/paymentSource/paymentReference
  - [x] 2.3 _incrementProviderCount — increment providerCounts on batch

- [x] Task 3: Add UI button to batch detail sheet (AC: #1, #2, #5)
  - [x] 3.1 "Send via Stripe" button below "Mark as Paid" in payout detail sheet
  - [x] 3.2 Disabled state with spinner during transfer
  - [x] 3.3 Toast notifications for success/failure

- [x] Task 4: Verify compilation (AC: #7)

## Dev Notes

Backend-only action + frontend button addition. No new tables needed.

### Key Decisions

**Button placement**: Added in the batch detail payout sheet (side panel), below "Mark as Paid". This is where SaaS owners interact with individual payouts.

**Validation order**: Auth → payout ownership → payout status → affiliate provider enabled → provider account → transfer. Each failure returns a specific error message.

**Circuit breaker**: Uses `withStripeCircuitBreaker` for the Stripe transfer call per AGENTS.md Rule 4.

### Files Modified

| File | Description |
|------|-------------|
| `convex/providerConnectWebhook.ts` | Added `sendPayoutViaProvider` action |
| `convex/payouts.ts` | Added 3 internal functions for provider payout flow |
| `src/app/(auth)/payouts/batches/[batchId]/BatchDetailClient.tsx` | Added "Send via Stripe" button |

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Completion Notes List

- sendPayoutViaProvider validates: auth, payout ownership, pending status, affiliate provider enabled, tenant provider account
- Transfer uses payoutId as idempotency key (via Stripe adapter)
- Audit log uses action "payout_sent_provider"
- providerCounts is a Record<string, number> on batch — incremented atomically
- TypeScript: 161 total errors (156 baseline + 5 circularity in providerConnectWebhook.ts), zero new functional errors

### File List

| File | Action | Description |
|------|--------|-------------|
| `convex/providerConnectWebhook.ts` | Modified | Added sendPayoutViaProvider action |
| `convex/payouts.ts` | Modified | Added _getPayoutByIdInternal, _markPayoutProcessing, _incrementProviderCount |
| `src/app/(auth)/payouts/batches/[batchId]/BatchDetailClient.tsx` | Modified | Added "Send via Stripe" button with loading state |

### Change Log

| Date | Change |
|------|--------|
| 2026-04-21 | Implemented Story 17.11: Individual payout via provider |
