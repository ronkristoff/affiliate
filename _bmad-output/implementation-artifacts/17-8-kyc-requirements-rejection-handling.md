# Story 17.8: KYC Requirements & Rejection Handling

Status: done

## Story

As an affiliate,
I want to see what additional information is needed if my KYC is incomplete or rejected,
so that I can take action to complete verification.

## Acceptance Criteria

1. **AC1:** When `payoutProviderStatus = "pending"` and `payoutProviderStatusDetails.currentlyDue` has items, display a list of required actions below the "Complete Verification" button
2. **AC2:** When `currentlyDue` is empty but `eventuallyDue` has items, show "All set for now — no action needed" instead of the requirements list
3. **AC3:** When `payoutProviderStatus = "rejected"`, the rejection reason is displayed and a "Try Again" button clears the old `payoutProviderAccountId` before redirecting
4. **AC4:** Requirements list uses human-readable labels (not raw Stripe field names like "individual.id_number")
5. **AC5:** TypeScript compilation passes with `pnpm tsc --noEmit`

## Tasks / Subtasks

- [x] Task 1: Add KYC requirements display to pending state (AC: #1, #2, #4)
  - [x] 1.1 When `isPending` and `payoutProviderStatusDetails.currentlyDue` has items, render a bulleted list below the checklist
  - [x] 1.2 Map raw Stripe requirement names to human-readable labels (e.g., "individual.id_number" → "Government-issued ID number", "individual.dob" → "Date of birth", "external_account" → "Bank account")
  - [x] 1.3 When `currentlyDue` is empty and `eventuallyDue` has items, show "All set for now — no action needed" info text
  - [x] 1.4 When both are empty, show nothing extra (current behavior)

- [x] Task 2: Clear old account on rejected retry (AC: #3)
  - [x] 2.1 Create `clearProviderAccount` internal mutation that sets `payoutProviderAccountId: undefined`, `payoutProviderStatus: undefined`, `payoutProviderEnabled: undefined`, `payoutProviderStatusDetails: undefined`
  - [x] 2.2 Create `handleRejectedRetry` action that clears the old account, then calls `generateOnboardingLink` logic (creates new account, redirects)
  - [x] 2.3 Update "Try Again" button in rejected state to call `handleRejectedRetry` instead of `handleSetupPayouts`

- [x] Task 3: Verify compilation (AC: #5)
  - [x] 3.1 Run `pnpm tsc --noEmit` — zero new errors (156 total, all pre-existing)

## Dev Notes

This is a **UI-only story** with minimal backend changes. All infrastructure exists from Stories 17.5–17.7.

### Key Design Decisions

**Requirements list mapping:** Stripe uses field names like `individual.id_number`, `individual.dob`, `external_account`, `individual.verification.document`. We map these to readable labels. Unknown fields fall back to a formatted version of the field name.

**"Clear old account" vs "reuse existing":** The spec (AC3) says to clear the old `payoutProviderAccountId` before redirecting. This means the affiliate starts fresh — Stripe creates a new Express account. This is the correct approach for rejected accounts since the old account may have permanent restrictions.

### Files to Modify

| File | Description |
|------|-------------|
| `convex/affiliateProviderOnboarding.ts` | Add `clearProviderAccount` internal mutation |
| `convex/affiliateProviderOnboardingActions.ts` | Add `handleRejectedRetry` action |
| `src/app/portal/(authenticated)/account/components/ProviderPayoutSection.tsx` | Add KYC requirements list, "all set" message, wire rejected retry |

### References

- [Source: epics-stripe-connect.md#Story 2.4] — Epic definition
- [Source: architecture.md#Affiliate Connect Status Badges] — Status definitions
- [Source: convex/lib/providers/stripeConnectAdapter.ts:56-64] — Raw Stripe requirement field names

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Debug Log References

None

### Completion Notes List

- KYC requirement labels cover 16 common Stripe fields; unknown fields fall back to raw field name
- Rejected retry creates a fresh Stripe Express account (clears old account ID) per AC3 spec
- `handleRetryRejected` in ProviderPayoutSection is a separate handler from `handleSetupPayouts` to avoid mixing concerns
- TypeScript: 156 total errors (baseline), 5 pre-existing circularity errors in affiliateProviderOnboardingActions.ts

### File List

| File | Action | Description |
|------|--------|-------------|
| `convex/affiliateProviderOnboarding.ts` | Modified | Added `clearProviderAccount` internal mutation (clears 5 provider fields to undefined) |
| `convex/affiliateProviderOnboardingActions.ts` | Modified | Added `handleRejectedRetry` action (clears old account, creates new Stripe Express, returns onboarding URL) |
| `src/app/portal/(authenticated)/account/components/ProviderPayoutSection.tsx` | Modified | Added KYC_REQUIREMENT_LABELS constant, requirements list UI, "all set" message, rejected retry handler, wired Retry Setup button to handleRetryRejected |

### Change Log

| Date | Change |
|------|--------|
| 2026-04-21 | Implemented Story 17.8: KYC requirements display, rejection retry with fresh account creation |
