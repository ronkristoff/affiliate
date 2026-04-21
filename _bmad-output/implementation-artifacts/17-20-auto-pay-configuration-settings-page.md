# Story 17.20: Auto-Pay Configuration Settings Page

Status: done

## Story

As a SaaS Owner,
I want a settings page where I can enable/disable auto-pay and configure the payout schedule,
So that I can control when and how affiliates are paid automatically.

## Acceptance Criteria

1. **AC1:** Page at `/settings/payouts` displays payout schedule fields pre-populated from `tenant.payoutSchedule`
2. **AC2:** Fields: Enable Auto-Pay toggle, Payout Day (1-28), Processing Days, Minimum Amount, Schedule Note
3. **AC3:** Changes saved via `updatePayoutSchedule` mutation
4. **AC4:** Confirmation dialog when toggling auto-pay ON
5. **AC5:** Payout Day validates 1-28
6. **AC6:** Page only visible to authenticated SaaS Owner role
7. **AC7:** TypeScript compilation passes

## Tasks / Subtasks

- [x] Task 1: Add `updatePayoutSchedule` mutation in tenants.ts (AC: #3, #5)
  - [x] 1.1 Args: payoutSchedule object with optional fields
  - [x] 1.2 Auth + permission check (settings:manage)
  - [x] 1.3 Validate payoutDayOfMonth 1-28, minimumAmount >= 0, processingDays 0-90
  - [x] 1.4 Merge with existing schedule, patch tenant, audit log

- [x] Task 2: Create `/settings/payouts` page (AC: #1, #2, #4, #6)
  - [x] 2.1 Auto-pay toggle with confirmation dialog
  - [x] 2.2 Payout day number input (1-28)
  - [x] 2.3 Processing days number input (0-90)
  - [x] 2.4 Minimum amount currency input
  - [x] 2.5 Optional schedule note textarea
  - [x] 2.6 Next payout date display
  - [x] 2.7 Stripe Connect warning banner when not connected
  - [x] 2.8 Save button with loading state

- [x] Task 3: Add nav link in SettingsNav (AC: #6)
  - [x] 3.1 "Payout Settings" with Wallet icon

- [x] Task 4: Verify compilation (AC: #7)

## Dev Notes

### Key Decisions

**Toggle = schedule exists**: Auto-pay is considered "enabled" when `payoutSchedule.payoutDayOfMonth` is set. Toggling OFF clears the entire schedule (sets all fields to undefined). Toggling ON uses the configured values.

**Confirmation dialog**: Only shown when enabling. Warns about balance sufficiency. Uses `AlertDialog` from shadcn/ui.

**Stripe Connect warning**: When tenant doesn't have `stripeAccountId`, shows amber warning banner and disables the toggle. Auto-pay requires Stripe.

**Initialization pattern**: Uses `initialized` flag to set state from query result once (avoids re-initializing on every render).

### Files Modified

| File | Description |
|------|-------------|
| `convex/tenants.ts` | Added `updatePayoutSchedule` mutation |
| `src/app/(auth)/settings/payouts/page.tsx` | New settings page |
| `src/components/settings/SettingsNav.tsx` | Added Payout Settings nav link |

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Completion Notes List

- `getTenantPayoutSchedule` query already existed (line 1870) — reused for the settings page
- Mutation follows same permission/auth pattern as `updateTenantBranding`
- Server-side validation for all numeric fields
- TypeScript: zero new errors

### File List

| File | Action | Description |
|------|--------|-------------|
| `convex/tenants.ts` | Modified | Added `updatePayoutSchedule` mutation |
| `src/app/(auth)/settings/payouts/page.tsx` | Created | Payout settings page |
| `src/components/settings/SettingsNav.tsx` | Modified | Added nav link |

### Change Log

| Date | Change |
|------|--------|
| 2026-04-21 | Implemented Story 17.20: Auto-pay configuration settings page |
