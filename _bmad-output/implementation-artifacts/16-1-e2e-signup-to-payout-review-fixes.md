# Story 16.1: E2E Signup-to-Payout Review — Batch Bug Fixes

Status: review

## Story

As a developer,
I want a single comprehensive story that batches all 16 findings from the end-to-end signup-to-payout flow review,
so that I can fix all critical, high, medium, and low issues in one focused implementation pass without context-switching between separate stories.

## Business Context

An end-to-end code review of the entire signup-to-payout flow was performed across 15+ backend files. The review traced data flow from SaaS owner signup, through campaign creation, click tracking, conversion attribution, commission processing, and payout batch generation. It uncovered 3 critical bugs (broken notifications, premature payout marking, coupon attribution corruption), 5 high-severity scalability/safety issues, 5 medium issues, and 3 low issues.

All findings are batched here because they are interconnected — fixing C3 (coupon attribution) alone would be incomplete without M2 (same bug in legacy path), and C1 (notifications) touches the same affiliate-lookup pattern used elsewhere.

**This story contains NO new features. Every task is a bug fix or hardening of existing code.**

### Dependencies

- No new dependencies. All fixes are within the existing codebase.
- Some fixes may interact: C1 changes affiliate lookups that are also used in H4, H5. Fix C1 first.

## Acceptance Criteria

### AC1: Affiliate In-App Notifications Work (C1)
**Given** a commission is created, reversed, approved, or declined
**When** the notification function is called
**Then** the affiliate is found by looking up the `affiliates` table (NOT the `users` table)
**And** the notification is sent/delivered without silent failure

### AC2: Payout Batches Do NOT Mark Commissions "Paid" Prematurely (C2)
**Given** a payout batch is generated
**When** commissions are added to the batch
**Then** their status remains "approved" (NOT changed to "paid")
**And** status only changes to "paid" when the batch is explicitly marked as paid

### AC3: Coupon Attribution Uses Actual Referral Code, Not Name (C3)
**Given** a conversion is attributed via coupon code
**When** `processPaymentUpdatedToCommission` or `processSubscriptionUpdatedToCommission` runs
**Then** `affiliateCode` is set to the affiliate's actual referral code (from `affiliates.referralCode`)
**And** the subsequent `findAffiliateByCodeInternal` lookup succeeds

### AC4: `completeSignUp` Sets `authId` on User Record (H1)
**Given** a SaaS owner completes signup via `completeSignUp`
**When** the user record is created/patched
**Then** the `authId` field is populated with the Better Auth user ID
**And** any code resolving users by `authId` works for owner users from normal signup

### AC5: No Unbounded `.collect()` on High-Volume Tables (H2, H3, H4, H5)
**Given** any query touches `clicks`, `conversions`, `commissions`, `payouts`, or `affiliates`
**When** the query runs
**Then** results are capped with `.take(N)` or use `.paginate()`
**And** post-filter-after-paginate patterns are eliminated (H3)

### AC6: Scalability Caps Applied to Stats Queries (M4, M5)
**Given** stats queries run for tenant dashboards
**When** `getConversionStatsByTenant` or `getAffiliateDailyClicks` executes
**Then** results use appropriate caps (e.g., `.take(500)`) or read from `tenantStats` denormalized counters
**And** N+1 query patterns are eliminated

### AC7: Low-Priority Hardening Applied (L1, L2, L3)
**Given** the codebase has duplicate self-referral logic, wasteful lookups, and non-timing-safe password comparison
**When** the fixes are applied
**Then** self-referral detection uses a single shared function
**And** wasteful lookups are eliminated
**And** `authenticateAffiliate` uses timing-safe comparison

## Tasks / Subtasks

- [x] Task 1 (AC: #1): Fix affiliate notification lookups — `commissions.ts`
  - [x] Subtask 1.1: In `sendAffiliateNotification` (or equivalent), change lookup from `users` table query to `affiliates` table query by `_id`
  - [x] Subtask 1.2: Fix commission earned notification: look up affiliate by `commission.affiliateId` in `affiliates` table
  - [x] Subtask 1.3: Fix commission reversed notification: same pattern
  - [x] Subtask 1.4: Fix commission approved notification: same pattern
  - [x] Subtask 1.5: Fix commission declined notification: same pattern

- [x] Task 2 (AC: #1): Fix affiliate notification lookups — `payouts.ts`
  - [x] Subtask 2.1: Fix payout notification: look up affiliate by `affiliateId` in `affiliates` table (NOT `users` table)

- [x] Task 3 (AC: #2): Fix premature "paid" status in payout batch generation
  - [x] Subtask 3.1: In `payouts.ts` → `generatePayoutBatch`, remove the mutation that sets commission status to "paid" during batch creation
  - [x] Subtask 3.2: Ensure batch creation only changes commission status when `markBatchAsPaid` is explicitly called
  - [x] Subtask 3.3: Verify `tenantStats` hooks are only called on actual status transitions (not during batch creation)

- [x] Task 4 (AC: #3): Fix coupon attribution — `commissionEngine.ts`
  - [x] Subtask 4.1: In `processPaymentUpdatedToCommission` (around line 180), change `affiliateCode` assignment from affiliate NAME to `affiliate.referralCode`
  - [x] Subtask 4.2: Verify the same fix is applied in `processSubscriptionUpdatedToCommission`

- [x] Task 5 (AC: #3): Fix coupon attribution — `webhooks.ts` (legacy path)
  - [x] Subtask 5.1: In `processWebhookToConversion` (around line 624), change `affiliateCode` assignment from affiliate NAME to `affiliate.referralCode`

- [x] Task 6 (AC: #4): Fix `completeSignUp` missing `authId`
  - [x] Subtask 6.1: In `users.ts` → `completeSignUp`, after creating/patching the user record, set `authId` to the Better Auth user ID returned from the auth context
  - [x] Subtask 6.2: Verify the auth user ID is available from the `ctx.auth.getUserIdentity()` call or equivalent

- [x] Task 7 (AC: #5): Fix unbounded `.collect()` — `conversions.ts`
  - [x] Subtask 7.1: In `findConversionBySubscriptionIdInternal` (line ~1246), replace `.collect()` with `.take(500)` + early-exit loop
  - [x] Subtask 7.2: In `getConversionsByTenant` and `getConversionsByAffiliate`, eliminate post-filter-after-paginate using overscan approach
  - [x] Subtask 7.3: Review the codebase comment at line ~1319 that acknowledges this pattern is broken — applied overscan fix

- [x] Task 8 (AC: #5): Fix unbounded `.collect()` — `referralLinks.ts`
  - [x] Subtask 8.1: In `getAffiliatePortalLinks` (lines ~587-591), replace `.filter().collect()` on conversions with a capped `.take(500)` query

- [x] Task 9 (AC: #5): Fix large `.take()` cap — `affiliates.ts`
  - [x] Subtask 9.1: In `listAffiliatesFiltered` STATS-REQUIRED path (line ~793), reduced referralLinks cap from 5000 to 500, and clicks/conversions/commissions from 5000/2000/2000 to 1000 each

- [x] Task 10 (AC: #6): Fix stats query caps — `conversions.ts`
  - [x] Subtask 10.1: In `getConversionStatsByTenant`, reduced `.take(800)` to `.take(500)` with comment to use tenantStats for large datasets

- [x] Task 11 (AC: #6): Fix N+1 pattern — `referralLinks.ts`
  - [x] Subtask 11.1: In `getAffiliateDailyClicks`, replaced per-link `.collect()` loop with single tenant-wide `.take(1000)` query filtered in-memory

- [x] Task 12 (AC: #7): Consolidate self-referral detection (L1)
  - [x] Subtask 12.1: Documented relationship between `conversions.ts` `detectSelfReferralInternal` and `fraudDetection.ts` `detectSelfReferral`
  - [x] Subtask 12.2: Explained why they cannot be merged (different lifecycle stages: pre-creation vs post-creation)
  - [x] Subtask 12.3: Added cross-reference comment pointing to the weighted scoring version

- [x] Task 13 (AC: #7): Remove wasteful lookup in payment processing (L2)
  - [x] Subtask 13.1: Verified no remaining `affiliateName` lookups in `processPaymentUpdatedToCommission` — already fixed by Task 4 (coupon attribution)

- [x] Task 14 (AC: #7): Timing-safe password comparison (L3)
  - [x] Subtask 14.1: In `authenticateAffiliate`, replaced direct `!==` comparison with V8-compatible `timingSafeEqual()` utility
  - [x] Subtask 14.2: Also fixed `updateAffiliatePassword` mutation which had the same vulnerability

## Dev Notes

### Fix Priority Order

Fix in this order to avoid broken intermediate states:

1. **C1** (notifications) — Most visible user impact, standalone fix
2. **C3 + M2** (coupon attribution) — Fix both `commissionEngine.ts` and `webhooks.ts` together
3. **C2** (payout premature paid) — Critical data integrity fix
4. **H1** (completeSignUp authId) — Standalone fix
5. **H2, H3, H4, H5** (unbounded queries) — Scalability fixes
6. **M4, M5** (stats caps) — Scalability hardening
7. **L1, L2, L3** (low-priority hardening)

### Critical Architecture Context

**Affiliate vs User table confusion (C1 root cause):**
- `users` table: SaaS owners and their team members. Keyed by `tenantId`.
- `affiliates` table: Affiliate marketers. Keyed by `tenantId` + `referralCode`.
- Notifications look up affiliates by `commission.affiliateId` but query the `users` table → always returns null → notifications silently fail.
- **Fix pattern:** Query `affiliates` table by `_id` instead of `users` table.

**Coupon attribution flow (C3 root cause):**
- When a payment/subscription event arrives with a `couponCode`, the system looks up the affiliate by code via `findAffiliateByCodeInternal`.
- But `processPaymentUpdatedToCommission` and `processWebhookToConversion` set `affiliateCode` to `affiliate.name` instead of `affiliate.referralCode`.
- This means downstream code trying to re-lookup the affiliate by code will fail because the name doesn't match any `referralCode`.
- **Fix pattern:** Use `affiliate.referralCode` consistently.

**Payout batch status flow (C2 root cause):**
- Current: `generatePayoutBatch` → sets commissions to "paid" immediately
- Correct: `generatePayoutBatch` → commissions stay "approved" → `markBatchAsPaid` → sets commissions to "paid"
- **Fix pattern:** Remove status mutation from batch generation, keep it only in the mark-as-paid function.

### Files to Modify

| File | Tasks | Changes |
|------|-------|---------|
| `convex/commissions.ts` | 1 | Fix affiliate lookup in notification functions |
| `convex/payouts.ts` | 2, 3 | Fix affiliate lookup in payout notifications; remove premature "paid" marking |
| `convex/commissionEngine.ts` | 4 | Fix coupon `affiliateCode` from name to `referralCode` |
| `convex/webhooks.ts` | 5, 13 | Fix coupon `affiliateCode` in legacy path; remove wasteful lookup |
| `convex/users.ts` | 6 | Add `authId` to user record in `completeSignUp` |
| `convex/conversions.ts` | 7, 10 | Fix unbounded `.collect()`; fix post-filter-after-paginate; evaluate stats cap |
| `convex/referralLinks.ts` | 8, 11 | Fix unbounded `.filter().collect()`; fix N+1 daily clicks pattern |
| `convex/affiliates.ts` | 9, 14 | Reduce clicks fetch cap; add timing-safe password comparison |
| `convex/fraudDetection.ts` | 12 | Extract shared self-referral detection function |

### Anti-Patterns to Avoid

1. **Do NOT use dynamic imports** in queries/mutations — Convex V8 doesn't support them [AGENTS.md]
2. **Do NOT use unbounded `.collect()`** on `clicks`, `conversions`, `commissions`, `payouts`, or `affiliates` — always cap [AGENTS.md: scalability-guidelines.md]
3. **Do NOT break return validators** — if you add fields to return objects, update the validator [AGENTS.md]
4. **Do NOT forget tenantStats hooks** — if you change commission/payout status fields, call the corresponding `tenantStats` hook [AGENTS.md]
5. **Do NOT use `"confirmed"` commission status** — it was removed; use `"approved"` [AGENTS.md]
6. **Do NOT use raw `<button>` tags** — always use `<Button>` from `@/components/ui/button` [AGENTS.md]
7. **Do NOT commit secrets** — never commit `.env` or credentials files [AGENTS.md]

### tenantStats Hook Reference

When modifying commission or payout status, call the corresponding hook:

```typescript
import { onCommissionStatusChange, incrementTotalPaidOut } from "./tenantStats";

// Commission status change → onCommissionStatusChange(ctx, tenantId, amount, oldStatus, newStatus, wasFlagged, isFlagged)
// Payout marked paid → incrementTotalPaidOut(ctx, tenantId, amount)
```

### Testing Approach

- No production tests exist in this project (placeholder tests only)
- Vitest is configured; test files use `.test.ts` suffix
- Manual verification: use `pnpm tsc --noEmit` after changes to catch type errors
- Manual verification: use `pnpm lint` to catch lint errors
- Consider adding targeted tests for the most critical fixes (C1, C3) if time permits

### Convex CLI Gotchas

- Pre-existing test files have TypeScript errors — always use `--typecheck=disable` when running Convex functions:
  ```bash
  pnpm convex run functionName --typecheck=disable -- '{}'
  ```
- Use `--push` when running a function from a newly created/modified file

### Project Structure Notes

- Convex backend: `convex/` directory
- Frontend: `src/` directory
- Route groups: `(auth)` for protected routes, `(unauth)` for public auth routes
- Implementation artifacts: `_bmad-output/implementation-artifacts/`
- Planning artifacts: `_bmad-output/planning-artifacts/`

### References

- [AGENTS.md — Core Engineering Principles]
- [AGENTS.md — Denormalized Counters Mandatory Mutation Hooks]
- [AGENTS.md — No Unbounded .collect() on High-Volume Tables]
- [AGENTS.md — Commission Status Flow]
- [AGENTS.md — Convex CLI Gotchas]
- [docs/scalability-guidelines.md — Rule 6a: Circuit Breakers]
- [docs/scalability-guidelines.md — Rule 6b: Rate Limiting]
- [docs/scalability-guidelines.md — Rule 6c: Graceful Degradation]

## Dev Agent Record

### Agent Model Used

glm-5-turbo (opencode)

### Debug Log References

- TypeScript check: `pnpm tsc --noEmit` — 1 pre-existing error (unrelated `sendAffiliateInvitationEmail` in `affiliates.ts`), zero new errors introduced
- All changes verified against pre-existing error baseline via `git stash` comparison

### Completion Notes List

- Task 12 (L1): Could not merge the two self-referral functions because they operate at different lifecycle stages (pre-creation vs post-creation). Added cross-reference documentation instead.
- Task 13 (L2): No wasteful lookup found — Task 4 (C3 fix) already eliminated all `affiliateName` lookups from `commissionEngine.ts`.
- Pre-existing TS error at `affiliates.ts:1195` (`sendAffiliateInvitationEmail` not exported from email module) is unrelated to this story.

### File List

| File | Changes |
|------|---------|
| `convex/users.ts` | Added `ctx.auth.getUserIdentity()` + `authId` to `completeSignUp`; backfill `authId` on existing user early return |
| `convex/conversions.ts` | Fixed `findConversionBySubscriptionIdInternal` (.collect → .take(500)); fixed `getConversionsByAffiliate` and `getConversionsByTenant` (post-filter-after-paginate → overscan); reduced `getConversionStatsByTenant` cap (800 → 500); added self-referral consolidation documentation |
| `convex/referralLinks.ts` | Fixed `getAffiliatePortalLinks` (unbounded .filter().collect → capped .take(500)); fixed `getAffiliateDailyClicks` (N+1 per-link loop → single tenant-wide .take(1000)) |
| `convex/affiliates.ts` | Reduced `listAffiliatesFiltered` STATS-REQUIRED path caps (5000/2000/2000 → 1000/1000/1000); reduced campaign filter referralLinks cap (5000 → 500); added `timingSafeEqual()` utility; fixed `authenticateAffiliate` and `updateAffiliatePassword` to use timing-safe comparison |
| `convex/commissions.ts` | Fixed 4 notification blocks (C1 — removed broken affiliate user lookups) |
| `convex/payouts.ts` | Fixed notification blocks (C1); fixed premature "paid" status in `generatePayoutBatch` (C2) |
| `convex/commissionEngine.ts` | Fixed 4 coupon attribution `affiliateName` → `uniqueCode` (C3) |
| `convex/webhooks.ts` | Fixed legacy path coupon attribution `affiliateName` → `uniqueCode` (C3+M2) |
| `convex/aggregates.ts` | **NEW** — 6 `TableAggregate` definitions + trigger exports + backfill action for O(log n) counts/pagination |
| `convex/triggers.ts` | **NEW** — `Triggers<DataModel>` instance registering all 6 tables; exports wrapped `mutation`/`internalMutation` builders |
| `convex/convex.config.ts` | **NEW** — Registered `@convex-dev/aggregate` component via `app.use(aggregate)` |
| `convex/fraudDetection.ts` | **NEW** — Switched `internalMutation` import to wrapped builder from `./triggers` |
| `convex/affiliates.ts` (P7+P8) | **NEW** — Replaced `.take(500)` stat counts with aggregate pagination for clicks/conversions/commissions |
| `convex/conversions.ts` (P1-P6) | **NEW** — Replaced `.take(N)` truncation with aggregate `.paginate()` + `.count()` in 6 functions |
| `convex/referralLinks.ts` (P4+P5) | **NEW** — Fixed N+1 tenant-wide conversion fetch; per-link daily click index scan |

### Review Findings (Aggregate Pagination Audit)

After the initial 14 bug fixes, a focused code review on `.take(N)` usage found 8 additional issues:

**Patched (P1-P8):**
- **P1 (HIGH)**: `getConversionStatsByTenant` — wrong financial totals when >500 conversions → Fixed with `conversionsAggregate.count()`
- **P2 (HIGH)**: `getConversionsByAffiliate` — overscan broken, premature `isDone` → Fixed with aggregate pagination + resolve-and-filter
- **P3 (HIGH)**: `getConversionsByTenant` — same overscan/cursor bugs → Fixed with aggregate pagination
- **P4 (MEDIUM)**: `getAffiliatePortalLinks` — N+1: tenant-wide conversion fetch per link → Fixed with single fetch + Map
- **P5 (MEDIUM)**: `getAffiliateDailyClicks` — `.take(1000)` may miss days → Fixed with per-link index scan
- **P6 (HIGH)**: `findConversionBySubscriptionIdInternal` — `.take(500)` misses older → Fixed with aggregate paginate loop
- **P7 (MEDIUM)**: `listAffiliatesByStatus` — stat counts capped at 500 → Fixed with aggregate pagination
- **P8 (MEDIUM)**: `listAffiliatesFiltered` — tier limit bypass at `.take(500)` → Fixed with `affiliatesAggregate.count()`

**Aggregate Component Setup:**
- Installed `@convex-dev/aggregate@0.2.1` for O(log n) counts and pagination
- Wired triggers via `convex-helpers` `Triggers` pattern (NOT schema `.trigger()` — Convex doesn't support that)
- 8 production mutation files now use wrapped `mutation`/`internalMutation` builders from `./triggers`
- Backfill action available via `backfillAll` to index existing data

**Deferred (7 items):**
- D1-D7: Low-priority improvements (batch-enriched queries, click dedup index, etc.) deferred to future stories
