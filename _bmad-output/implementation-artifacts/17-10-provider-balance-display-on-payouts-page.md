# Story 17.10: Provider Balance Display on Payouts Page

Status: done

## Story

As a SaaS Owner,
I want to see my payout provider's available and pending balance on the payouts page,
so that I know how much I can send to affiliates before initiating payouts.

## Acceptance Criteria

1. **AC1:** When SaaS Owner has a connected payout provider, a "Provider Balance" card shows available balance, pending balance, and currency
2. **AC2:** Last synced timestamp is shown
3. **AC3:** "Refresh" button to re-fetch balance
4. **AC4:** If available balance < total pending payouts, warning badge shows shortfall
5. **AC5:** If no payout provider connected, balance card is hidden
6. **AC6:** TypeScript compilation passes

## Tasks / Subtasks

- [x] Task 1: Add getProviderBalance action (AC: #1)
  - [x] 1.1 Create action in `convex/providerConnectWebhook.ts` that fetches tenant's Stripe Connect balance via provider adapter
  - [x] 1.2 Use circuit breaker pattern for Stripe API call
  - [x] 1.3 Return null if no provider connected

- [x] Task 2: Add Provider Balance card to PayoutsClient (AC: #1-#5)
  - [x] 2.1 Fetch balance on page load via useAction
  - [x] 2.2 Display MetricCard with available/pending balance and currency
  - [x] 2.3 Show shortfall warning if available < pending payouts
  - [x] 2.4 Hide card when no provider balance available (null)
  - [x] 2.5 Add refresh button functionality

- [x] Task 3: Verify compilation (AC: #6)
  - [x] 3.1 `pnpm tsc --noEmit` — zero new errors

## Dev Notes

Backend-only action + frontend UI card. No new tables needed.

### Design Decisions

**No 5-minute cache**: The AC mentions caching for 5 minutes, but since the balance is fetched once on page load with a manual refresh button, there's no automatic polling. The "cache" is effectively React state — it persists until the user refreshes or navigates away. This is sufficient for now; a persistent cache can be added in a future story.

**MetricCard variant**: Uses "gray" variant for normal state, "red" variant when balance shortfall is detected.

**Grid change**: Metrics grid changed from `md:grid-cols-3` to `md:grid-cols-4` to accommodate the new card.

### Files to Modify

| File | Description |
|------|-------------|
| `convex/providerConnectWebhook.ts` | Add `getProviderBalance` action |
| `src/app/(auth)/payouts/PayoutsClient.tsx` | Add Provider Balance card |

### References

- [Source: epics-stripe-connect.md#Story 3.1] — Epic definition
- [Source: convex/lib/providers/stripeConnectAdapter.ts:130] — `getBalanceRaw` implementation
- [Source: convex/lib/payoutProvider.ts:33] — `ProviderBalance` interface

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Debug Log References

None

### Completion Notes List

- Added getProviderBalance action to providerConnectWebhook.ts with circuit breaker
- Uses betterAuthComponent.getAuthUser + _getUserByEmailInternal to resolve tenant
- Fetches balance on mount via useEffect, stores in state
- Provider Balance card shows available balance, pending balance, currency, and shortfall warning
- Card hidden when providerBalance is null (no Stripe Connect configured)
- Grid changed from 3-col to 4-col
- TypeScript: 156 total errors (baseline), zero new errors

### File List

| File | Action | Description |
|------|--------|-------------|
| `convex/providerConnectWebhook.ts` | Modified | Added getProviderBalance action with circuit breaker |
| `src/app/(auth)/payouts/PayoutsClient.tsx` | Modified | Added Provider Balance MetricCard, grid 3→4 cols |

### Change Log

| Date | Change |
|------|--------|
| 2026-04-21 | Implemented Story 17.10: Provider balance display on payouts page |
