# Story 17.15: Payout Filter by Payment Source

Status: done

## Story

As a SaaS Owner,
I want to filter payouts by payment source (All / Manual / SaligPay / Stripe),
So that I can focus on specific payout types in the payouts table.

## Acceptance Criteria

1. **AC1:** "Source" column added to batch detail payouts table showing Manual / SaligPay / Stripe
2. **AC2:** Select filter on Source column with options: Manual, SaligPay, Stripe
3. **AC3:** Filter shows only matching payouts
4. **AC4:** Unfiltered shows all payouts regardless of source

## Tasks / Subtasks

- [x] Task 1: Add paymentSource to query return (AC: #1)
  - [x] 1.1 Add `paymentSource` field to `getBatchPayouts` return validator
  - [x] 1.2 Include `payout.paymentSource` in handler return object
  - [x] 1.3 Add `paymentSource` to `BatchPayout` interface

- [x] Task 2: Add Source column with filter (AC: #1-#4)
  - [x] 2.1 Add "Source" column with Manual/SaligPay/Stripe badges
  - [x] 2.2 Add select filter with Manual/SaligPay/Stripe options
  - [x] 2.3 Add `paymentSource` case to `filteredPayouts` useMemo

- [x] Task 3: Verify compilation

## Dev Notes

Simple UI-only story. The `paymentSource` field already exists on payouts (set by provider flows). Just needed to expose it in the query and add a filter column.

### Key Decisions

**Column name "Source"**: Kept short to fit alongside existing columns. Full labels in badges.

**"Manual" = no paymentSource**: Payouts without a `paymentSource` are considered manual (paid via mark-as-paid with bank transfer, etc.).

**Badge colors**: Stripe = indigo, SaligPay = purple, Manual = muted text. Distinct from status badge colors (green/amber/red/blue).

### Files Modified

| File | Description |
|------|-------------|
| `convex/payouts.ts` | Added `paymentSource` to `getBatchPayouts` return |
| `src/app/(auth)/payouts/batches/[batchId]/BatchDetailClient.tsx` | Added Source column, filter, interface field |

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Completion Notes List

- paymentSource was already on the payout document, just not returned by the query
- Filter logic handles "none" value for manual payouts (no paymentSource set)
- TypeScript: zero new errors

### File List

| File | Action | Description |
|------|--------|-------------|
| `convex/payouts.ts` | Modified | Added paymentSource to getBatchPayouts return |
| `src/app/(auth)/payouts/batches/[batchId]/BatchDetailClient.tsx` | Modified | Added Source column, filter, interface |

### Change Log

| Date | Change |
|------|--------|
| 2026-04-21 | Implemented Story 17.15: Payout filter by payment source |
