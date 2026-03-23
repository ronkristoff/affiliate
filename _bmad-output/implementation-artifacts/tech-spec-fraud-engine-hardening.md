---
title: "Fraud Engine Hardening"
slug: "fraud-engine-hardening"
created: "2026-03-23"
status: "completed"
stepsCompleted: [1, 2, 3, 4]
tech_stack: ["Convex 1.32", "TypeScript 5.9", "Vitest"]
files_to_modify: ["convex/schema.ts", "convex/fraudDetection.ts", "convex/fraudSignals.ts", "convex/affiliates.ts", "convex/dashboard.ts", "convex/tenantStats.ts", "convex/fraudSignals.test.ts", "src/components/affiliate/FraudSignalsSection.tsx", "src/app/(auth)/affiliates/[id]/page.tsx", "docs/fraud-detection.md"]
code_patterns: ["internalQuery/internalMutation", "embedded array on affiliate doc", "RBAC with hasPermission()", "audit logging with securityEvent:true", "tenantStats denormalized counters with mutation hooks", "new Convex function syntax with validators"]
test_patterns: ["vitest unit tests with simulated logic", "given/when/then ACs", "no Convex runtime tests"]
---

# Tech-Spec: Fraud Engine Hardening

**Created:** 2026-03-23

## Overview

### Problem Statement

The fraud engine has 10 active issues identified during multi-agent code review, deep investigation, and adversarial review:

1. **Unbounded `.collect()`** in `isConversionSelfReferred` (`fraudDetection.ts` L196) — violates scalability guidelines
2. **Duplicate fraud signals** — `addSelfReferralFraudSignal` has no dedup guard, while `addFraudSignalInternal` does (inconsistency)
3. **Signal index race condition** — `dismissFraudSignal`, `suspendAffiliateFromFraudSignal`, `markFraudSignalReviewed` all use array index which shifts if signals are added between read and write
4. **Single-signal threshold** — any 1 match triggers detection (`fraudDetection.ts` L120), causing false positives on shared networks (PH/SEA co-working spaces, cafés)
5. **Dashboard type mismatch** — `dashboard.ts` L320+L324 use `"self_referral_detected"` but actual stored type is `"selfReferral"` — fraud signals NEVER appear in dashboard activity feed
6. **`backfillStats` double-counts** — `tenantStats.ts` L237-242 increments `commissionsFlagged` for both `fraudIndicators` and `isSelfReferral` independently on the same commission
7. **`backfillStats` misattributes approved as reversed** — `tenantStats.ts` L231-235 counts `status === "approved"` as `commissionsReversedThisMonth` (approved ≠ reversed per status flow)
8. **`isConversionSelfReferred` is dead code** — exported from `fraudDetection.ts` L184 but never called anywhere
9. **`getAffiliateFraudSignals` drops `commissionId`** — return validator at `fraudSignals.ts` L71-82 doesn't include `commissionId`, so frontend can't display which commission a signal relates to
10. **Test coverage gaps** — only simulated logic tests exist; no tests for weighted scoring, dedup, signal ID lookup, or backfill logic

### Solution

Fix critical query bounds (#1), remove dead code (#8), add dedup guard (#2), replace array-index with stable signal ID (#3), introduce weighted scoring (#4), fix dashboard type string (#5), fix both backfillStats bugs (#6, #7), fix return validator (#9), update frontend callers (#3), and expand unit test coverage (#10).

### Scope

**In Scope:**
- Add `signalId` field to fraud signals schema (backward compatible)
- Remove dead code (`isConversionSelfReferred` function) — also fixes unbounded `.collect()`
- Add dedup guard to `addSelfReferralFraudSignal` (check type + commissionId + severity)
- Add `signalId` to all signal creation points, persist `totalScore` in signal details
- Replace array-index dismissal/suspension with signalId lookup in `fraudSignals.ts`
- Fix `getAffiliateFraudSignals` return validator to include `commissionId`
- Update frontend callers to pass `signalId` instead of `signalIndex`
- Implement weighted scoring system for self-referral detection (configurable weights + threshold)
- Fix dashboard type string mismatch at L320 AND L324
- Fix both `backfillStats` bugs (double-counting + approved-as-reversed misattribution)
- One-time migration action to assign signalIds to legacy fraud signals
- Expand unit test coverage for all new/changed logic
- Update `docs/fraud-detection.md` with new behavior

**Out of Scope:**
- Standalone `fraudSignals` table migration (future spec — embedded array stays for now)
- New fraud signal types (bot traffic, IP anomaly)
- Periodic re-scanning cron job
- IP history tracking on affiliates
- Unbounded `.collect()` fixes in `admin/tenants.ts` (separate scope)
- Convex integration/runtime tests (simulated logic only for this spec)

## Context for Development

### Codebase Patterns

- **Convex function syntax**: New syntax with `query({ args, returns, handler })` — always include validators
- **Internal functions**: `internalQuery`/`internalMutation` for private functions, imported via `internal` from `_generated/api`
- **Fraud signals**: Embedded array on `affiliates` table (`affiliate.fraudSignals[]`), no standalone table
- **Schema**: `convex/schema.ts` L191-200 defines `fraudSignals` with fields: `type`, `severity`, `timestamp`, `details?`, `reviewedAt?`, `reviewedBy?`, `reviewNote?`, `commissionId?`
- **RBAC**: `hasPermission(role, "affiliates:manage")` from `convex/permissions.ts`
- **Audit logging**: `ctx.db.insert("auditLogs", { ... })` on all security events with `securityEvent: true`
- **tenantStats**: Denormalized counters with mandatory mutation hooks. `onCommissionCreated` (L365) and `onCommissionStatusChange` (L400) handle `commissionsFlagged` counter
- **Scalability**: No unbounded `.collect()` on high-volume tables — always `.take(N)`, `.first()`, or `.paginate()`
- **Tests**: Vitest with `.test.ts` suffix; currently simulated logic tests only (no Convex runtime). Tests simulate functions in isolation and validate input/output

### Files to Reference

| File | Lines | Purpose | Key Functions |
| ---- | ----- | ------- | ------------- |
| `convex/schema.ts` | 585 | DB schema | `affiliates.fraudSignals` (L191-200) |
| `convex/fraudDetection.ts` | 271 | Self-referral detection, signal recording | `detectSelfReferral` (L41), `addSelfReferralFraudSignal` (L132), `isConversionSelfReferred` (L184, dead code) |
| `convex/fraudSignals.ts` | 477 | Signal queries, dismissal, suspension, RBAC | `getAffiliateFraudSignals` (L66), `dismissFraudSignal` (L187), `suspendAffiliateFromFraudSignal` (L300), `markFraudSignalReviewed` (L445) |
| `convex/affiliates.ts` | 2819 | Affiliate management, fraud signal internal | `addFraudSignalInternal` (L2775), `setAffiliateStatus` (L1398), `suspendAffiliate` (L1484) |
| `convex/commissions.ts` | 1481+ | Commission creation with fraud detection | `createCommissionFromConversionInternal` (L164) — caller of `detectSelfReferral` |
| `convex/dashboard.ts` | 739 | Dashboard activity feed | Fraud signal filter at L320, activity creation at L324 |
| `convex/tenantStats.ts` | 551 | Denormalized counters | `backfillStats` (L191) |
| `convex/fraudSignals.test.ts` | 650 | Existing unit tests | Simulated logic for filter, sort, validation, RBAC, audit |
| `src/components/affiliate/FraudSignalsSection.tsx` | ~300 | Frontend fraud signals component | `onDismissSignal` prop at L54 |
| `src/app/(auth)/affiliates/[id]/page.tsx` | ~200 | Affiliate detail page | `handleDismissFraudSignal` at L80-82 |
| `docs/fraud-detection.md` | 177 | Fraud detection docs | Detection signals, flow, schema fields |

### Technical Decisions

1. **Weighted scoring**: Signal weights — `email_match=3`, `ip_match=3`, `ip_subnet_match=1`, `device_match=2`, `payment_method_match=2`, `payment_processor_match=2`. Detection threshold: `>=3` points. Email match alone triggers (3pts). IP subnet alone does NOT trigger (1pt). IP subnet + device match triggers (1+2=3pts). Reduces false positives from shared networks while catching real self-referrals.

2. **Signal ID**: Add optional `signalId: v.optional(v.string())` to schema. Generate as `sig_${Date.now()}_${Math.random().toString(36).slice(2, 11)}` (prefix `sig_` prevents accidental collision with other IDs, 11-char random suffix provides ~64 bits of entropy). All signal creation points must call this. Lookup functions (dismiss, suspend, mark) switch from array index to signalId. A one-time `migrateFraudSignalIds` internalAction assigns signalIds to legacy signals with idempotency guard (skip signals that already have signalId).

3. **Persist totalScore**: The `totalScore` is included in the fraud signal's `details` JSON alongside `matchedIndicators`, `commissionId`, and `detectedAt`. This ensures historical signals are auditable — future investigators can see what score and threshold triggered detection, even if weights are later tuned.

4. **Dedup strategy**: Before adding a fraud signal in `addSelfReferralFraudSignal`, check if a signal with the same `type` + `commissionId` + `severity` already exists. This fully aligns with the existing dedup pattern in `addFraudSignalInternal` (affiliates.ts L2791-2802).

5. **tenantStats confirmed correct**: Investigation confirmed `commissionsFlagged` is correctly maintained during commission creation and reversal via existing hooks. The chargeback finding from Party Mode is a non-issue. Only `backfillStats` has real bugs (double-counting + approved-as-reversed).

6. **Dead code removal**: `isConversionSelfReferred` (fraudDetection.ts L184-210) is exported but never called. Removing it also eliminates the unbounded `.collect()` at L196.

### Cross-File Dependency Map

```
schema.ts → defines fraudSignals shape (add signalId)
    ↓
fraudDetection.ts → weighted scoring, dedup, signalId, persist totalScore
    ↓
commissions.ts → caller of detectSelfReferral (destructure updated return)
    ↓
affiliates.ts → generates signalId in all signal creation points
    ↓
fraudSignals.ts → lookups by signalId, return validator includes commissionId
    ↓
FraudSignalsSection.tsx → passes signalId instead of signalIndex
affiliates/[id]/page.tsx → passes signalId instead of signalIndex
    ↓
dashboard.ts → fix type string at L320 AND L324
tenantStats.ts → fix double-counting + approved-as-reversed
fraudSignals.test.ts → tests for all changes
docs/fraud-detection.md → documentation update
```

## Implementation Plan

### Tasks

- [x] **Task 1: Add signalId to fraudSignals schema**
  - File: `convex/schema.ts`
  - Action: Add `signalId: v.optional(v.string())` field to the `fraudSignals` object definition at L191-200, after the existing `commissionId` field (L199)
  - Notes: Optional field ensures backward compatibility. Existing signals without signalId remain valid.

- [x] **Task 2: Weighted scoring, dedup guard, signalId, totalScore persistence, dead code removal**
  - File: `convex/fraudDetection.ts`
  - Actions:
    1. **Add `"use node";`** directive at top of file (needed for Task 5 migration action in same file)
    2. **Add constants** at top of file (after imports, before functions):
       ```typescript
       const SIGNAL_WEIGHTS: Record<string, number> = {
         email_match: 3,
         ip_match: 3,
         ip_subnet_match: 1,
         device_match: 2,
         payment_method_match: 2,
         payment_processor_match: 2,
       };
       const SELF_REFERRAL_THRESHOLD = 3;
       ```
    3. **Add `generateSignalId()` helper function** (before `detectSelfReferral`):
       ```typescript
       function generateSignalId(): string {
         return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
       }
       ```
    4. **Modify `detectSelfReferral`** (L41-126):
       - Change returns validator to include `totalScore: v.number()`
       - Replace L120 `const isSelfReferral = matchedIndicators.length >= 1;` with:
         ```typescript
         const totalScore = matchedIndicators.reduce(
           (sum, indicator) => sum + (SIGNAL_WEIGHTS[indicator] ?? 1), 0
         );
         const isSelfReferral = totalScore >= SELF_REFERRAL_THRESHOLD;
         ```
       - Update return to include `{ isSelfReferral, matchedIndicators, totalScore }`
       - Update console.log at L122 to include `totalScore`
    5. **Modify `addSelfReferralFraudSignal`** (L132-178):
       - Add dedup guard BEFORE L169 (`fraudSignals.push`), matching `addFraudSignalInternal` pattern (type + commissionId + severity):
         ```typescript
         const isDuplicate = fraudSignals.some(
           (s) => s.type === "selfReferral"
             && s.commissionId === args.commissionId
             && s.severity === "high"
         );
         if (isDuplicate) {
           console.log(`Duplicate self-referral signal skipped for affiliate ${args.affiliateId}`);
           return null;
         }
         ```
       - Add `signalId: generateSignalId()` to the fraudSignal object at L157-166
       - Include `totalScore` and `SELF_REFERRAL_THRESHOLD` in the `details` JSON:
         ```typescript
         details: JSON.stringify({
           matchedIndicators: args.matchedIndicators,
           commissionId: args.commissionId,
           detectedAt: new Date().toISOString(),
           totalScore: args.totalScore,
           threshold: SELF_REFERRAL_THRESHOLD,
         }),
         ```
       - Add `totalScore: v.optional(v.number())` to the args validator
    6. **Remove `isConversionSelfReferred`** (L184-210): Delete entire function. Dead code with unbounded `.collect()`.
  - Notes: This task addresses findings #1, #2, #4, #8. The `"use node";` directive is safe here — the existing `internalQuery` and `internalMutation` functions are V8-runtime and unaffected by this directive (it only enables Node.js APIs for `action` functions in the same file).

- [x] **Task 3: Generate signalId in all signal creation points in affiliates.ts**
  - File: `convex/affiliates.ts`
  - Actions:
    1. **Add `generateSignalId()` helper** near top of file:
       ```typescript
       function generateSignalId(): string {
         return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
       }
       ```
    2. **Modify `addFraudSignalInternal`** (L2775-2819): Add `signalId: generateSignalId()` to the new signal object at L2805-2814.
    3. **Modify `setAffiliateStatus`** (L1398-1406): Add `signalId: generateSignalId()` to the fraud signal push at L1400-1405.
    4. **Modify `suspendAffiliate`** (L1484-1493): Add `signalId: generateSignalId()` to the fraud signal push at L1486-1491.
  - Notes: All signal creation paths generate signalId. `setAffiliateStatus` and `suspendAffiliate` push `manual_suspension` signals without dedup — acceptable since manual suspensions are infrequent and intentional.

- [x] **Task 4: Switch fraudSignals.ts from array index to signalId lookup, fix return validator**
  - File: `convex/fraudSignals.ts`
  - Actions:
    1. **Update `FraudSignal` interface** (L51-59): Add `signalId?: string` and `commissionId?: string` fields.
    2. **Add `findSignalBySignalId` helper** (after the interface, before functions):
       ```typescript
       function findSignalBySignalId(
         signals: FraudSignal[],
         signalId: string
       ): { index: number; signal: FraudSignal } | null {
         for (let i = 0; i < signals.length; i++) {
           if (signals[i].signalId === signalId) {
             return { index: i, signal: signals[i] };
           }
         }
         return null;
       }
       ```
    3. **Modify `getAffiliateFraudSignals`** (L66-179):
       - Add `signalId: v.optional(v.string())` AND `commissionId: v.optional(v.id("commissions"))` to the return object validator (fixes F11 — commissionId was silently dropped)
       - Add `signalId` and `commissionId` to the return mapping at L168-177
       - **Do NOT attempt lazy migration** — this is a read-only query. Legacy signals without signalId are returned as-is (signalId will be undefined). The migration action (Task 5) handles assignment.
    4. **Modify `dismissFraudSignal`** (L187-292):
       - Change args: replace `signalIndex: v.number()` with `signalId: v.string()`
       - Replace L234 bounds check and L238 index access with:
         ```typescript
         const found = findSignalBySignalId(fraudSignals, args.signalId);
         if (!found) {
           throw new Error("Fraud signal not found");
         }
         const { index: signalIndex, signal } = found;
         ```
       - Update audit log `additionalInfo` to include `signalId=${args.signalId}`
    5. **Modify `suspendAffiliateFromFraudSignal`** (L300-386):
       - Change args: replace `signalIndex: v.optional(v.number())` with `signalId: v.optional(v.string())`
       - Replace L351 index access with `findSignalBySignalId` lookup
       - Update audit log accordingly
    6. **Modify `markFraudSignalReviewed`** (L445-477):
       - Change args: replace `signalIndex: v.number()` with `signalId: v.string()`
       - Replace L461 bounds check and L466 index access with `findSignalBySignalId` lookup
  - Notes: API changes are coordinated with Task 6 (frontend updates).

- [x] **Task 5: Create one-time migration action for legacy signalIds**
  - File: `convex/fraudDetection.ts` (already has `"use node";` from Task 2)
  - Action: Add `migrateFraudSignalIds` internalAction at end of file:
    ```typescript
    export const migrateFraudSignalIds = internalAction({
      args: { tenantId: v.optional(v.id("tenants")) },
      returns: v.object({ migrated: v.number(), skipped: v.number(), tenantsProcessed: v.number() }),
      handler: async (ctx, args) => {
        let migrated = 0;
        let skipped = 0;
        let tenantsProcessed = 0;

        // If tenantId provided, process only that tenant; otherwise process all
        // Paginate through affiliates using .take(50) per batch (smaller batch = less risk of timeout)
        // For each batch: read signals, assign signalIds to any without one, patch affiliate
        // Idempotency guard: only assign signalId if signal.signalId === undefined
        // Track counts, process until no more affiliates with legacy signals
        // Log progress every 100 affiliates to aid debugging if timeout occurs

        return { migrated, skipped, tenantsProcessed };
      },
    });
    ```
  - Implementation details:
    - Add a companion `internalQuery` (e.g., `getAffiliatesWithLegacySignals`) that queries affiliates with fraud signals lacking signalId — use `.take(50)` per batch (smaller than default to avoid action timeouts on large tenants)
    - **Idempotency guard**: only assign signalId if `signal.signalId === undefined` — safe to re-run
    - **Per-tenant support**: optional `tenantId` arg allows running migration tenant-by-tenant for large deployments (`npx convex run migrateFraudSignalIds --args '{"tenantId":"..."}'`)
    - Process in batches until no more affiliates with legacy signals
    - Log progress every 100 affiliates to aid debugging if timeout occurs
  - Notes: Run **before** deploying backend/frontend code changes (see Deployment Sequence below). Safe to re-run due to idempotency guard. For tenants with 1000+ affiliates, run per-tenant to avoid action timeouts.

- [x] **Task 6: Update frontend callers to use signalId, handle transition state**
  - Files: `src/components/affiliate/FraudSignalsSection.tsx`, `src/app/(auth)/affiliates/[id]/page.tsx`
  - Actions:
    1. **`FraudSignalsSection.tsx`** (L54):
       - Change prop type from `onDismissSignal?: (signalIndex: number, note?: string) => Promise<void>` to `onDismissSignal?: (signalId: string, note?: string) => Promise<void>`
       - Update all internal calls to `onDismissSignal` to pass `signal.signalId` instead of the array index
       - **Handle transition state**: If `signal.signalId` is `undefined` (legacy signal not yet migrated), render the dismiss button as **disabled** with a tooltip "Signal pending migration" instead of throwing an error. This prevents user confusion during the migration window.
    2. **`affiliates/[id]/page.tsx`** (L80-82):
       - Change `handleDismissFraudSignal` parameter from `signalIndex: number` to `signalId: string`
       - Update the `dismissFraudSignal` call at L82: replace `signalIndex` with `signalId`
  - Notes: These are the ONLY two frontend files that reference `signalIndex`. The disabled-button transition state ensures the UI degrades gracefully if migration hasn't run yet.

- [x] **Task 7: Fix dashboard type string mismatch**
  - File: `convex/dashboard.ts`
  - Actions:
    1. At L320, change `signal.type !== "self_referral_detected"` to `signal.type !== "selfReferral"`
    2. At L324, change `type: "self_referral_detected"` to `type: "self_referral_detected"` — **KEEP AS-IS**. This is the activity type, not the signal type. Activity types are a separate taxonomy used by the dashboard feed. The filter at L320 compares against the signal's type (which is `"selfReferral"`), while L324 defines what type string the activity object gets. These are intentionally different — the activity type `"self_referral_detected"` is what the frontend dashboard uses to render the activity icon and title.
  - Notes: Only L320 needs to change. L324 is the activity feed's own type taxonomy, not a comparison against signal types. Changing L324 would break the frontend dashboard rendering.

- [x] **Task 8: Fix both backfillStats bugs**
  - File: `convex/tenantStats.ts`
  - Actions:
    1. **Fix double-counting** at L237-242: Replace two separate `if` blocks with single check:
       ```typescript
       // Before (double-counts):
       if (c.fraudIndicators && c.fraudIndicators.length > 0) {
         commissionsFlagged++;
       }
       if (c.isSelfReferral === true) {
         commissionsFlagged++;
       }

       // After (correct — matches onCommissionCreated logic):
       if ((c.fraudIndicators && c.fraudIndicators.length > 0) || c.isSelfReferral === true) {
         commissionsFlagged++;
       }
       ```
    2. **Fix approved-as-reversed misattribution** at L231-235: Change `status === "approved"` to `status === "reversed"`:
       ```typescript
       // Before (wrong — approved ≠ reversed):
       } else if (c.status === "approved") {
         if (c._creationTime >= monthStart) {
           commissionsReversedThisMonth++;
           commissionsReversedValueThisMonth += c.amount;
         }
       }

       // After (correct):
       } else if (c.status === "reversed") {
         if (c._creationTime >= monthStart) {
           commissionsReversedThisMonth++;
           commissionsReversedValueThisMonth += c.amount;
         }
       }
       ```
  - Notes: Bug #1 (double-counting) means backfilled `commissionsFlagged` is higher than real-time. Bug #2 (approved-as-reversed) means backfilled `commissionsReversedThisMonth` includes non-reversed commissions. Both bugs compound — backfilled stats diverge from real-time stats. After fixing, re-run backfill to correct existing data.

- [x] **Task 9: Update documentation**
  - File: `docs/fraud-detection.md`
  - Actions:
    1. Update "Detection Signals" table: Add "Weight" column showing point values for each signal type
    2. Update threshold description from "ANY 1 match = self-referral detected" to "Weighted score >= 3 points = self-referral detected"
    3. Add examples of what triggers vs. what doesn't:
       - `email_match` alone → 3pts → TRIGGERS
       - `ip_subnet_match` alone → 1pt → does NOT trigger
       - `ip_subnet_match + device_match` → 3pts → TRIGGERS
    4. Add `signalId` to the `fraudSignals[]` Entry Structure table
    5. Add `totalScore` and `threshold` to the details JSON example
    6. Add note about dedup behavior: "Duplicate signals (same type + commissionId + severity) are skipped"
    7. Update "Limitations" section: Remove "Single signal threshold" since it's now weighted
    8. Add "signalId" to schema fields tables for `affiliates`
    9. Add note: "totalScore is persisted in signal details for audit trail — enables retroactive re-evaluation if weights change"

- [x] **Task 10: Expand unit tests**
  - File: `convex/fraudSignals.test.ts`
  - Actions: Add new test suites at end of file:

    **Suite 1: Weighted Scoring**
    - Simulate `detectSelfReferral` scoring logic with same `SIGNAL_WEIGHTS` and `SELF_REFERRAL_THRESHOLD`
    - Test: `email_match` alone → score=3 → triggers
    - Test: `ip_match` alone → score=3 → triggers
    - Test: `ip_subnet_match` alone → score=1 → does NOT trigger
    - Test: `device_match` alone → score=2 → does NOT trigger
    - Test: `ip_subnet_match + device_match` → score=3 → triggers
    - Test: `ip_subnet_match + payment_method_match` → score=3 → triggers
    - Test: empty indicators → score=0 → does NOT trigger
    - Test: all indicators → high score → triggers

    **Suite 2: Dedup Guard**
    - Simulate dedup check from `addSelfReferralFraudSignal` (type + commissionId + severity)
    - Test: same type + commissionId + severity → skip (return null)
    - Test: same type + commissionId, different severity → allow
    - Test: same type, different commissionId → allow
    - Test: empty existing signals → allow

    **Suite 3: Signal ID Generation**
    - Simulate `generateSignalId()` helper
    - Test: generates non-empty string prefixed with `sig_`
    - Test: generates unique values across 1000 iterations (all unique)
    - Test: format matches `sig_timestamp_randomstring` pattern

    **Suite 4: Signal ID Lookup**
    - Simulate `findSignalBySignalId` helper
    - Test: finds signal by signalId, returns correct index and signal
    - Test: returns null for non-existent signalId
    - Test: returns null for empty signals array
    - Test: handles signals without signalId (returns null — not matched)

    **Suite 5: Backfill Counting**
    - Simulate `backfillStats` counting logic
    - Test: commission with fraudIndicators only → counts 1
    - Test: commission with isSelfReferral only → counts 1
    - Test: commission with BOTH → counts 1 (not 2)
    - Test: commission with neither → counts 0

    **Suite 6: Backfill Reversed Status**
    - Simulate `backfillStats` reversed counting logic
    - Test: `status === "reversed"` within month → counts as reversed
    - Test: `status === "approved"` within month → does NOT count as reversed
    - Test: `status === "reversed"` outside month → does NOT count

  - Notes: Follow existing simulated logic pattern. Each test function simulates the logic in isolation.

### Acceptance Criteria

- [ ] **AC 1**: Given an affiliate and conversion with matching email only, when self-referral detection runs, then `isSelfReferral=true` and `totalScore=3` (email_match weight)
- [ ] **AC 2**: Given an affiliate and conversion with matching IP subnet only (no other matches), when self-referral detection runs, then `isSelfReferral=false` and `totalScore=1` (below threshold of 3)
- [ ] **AC 3**: Given an affiliate and conversion with matching IP subnet AND device fingerprint, when self-referral detection runs, then `isSelfReferral=true` and `totalScore=3` (1+2=3)
- [ ] **AC 4**: Given `addSelfReferralFraudSignal` is called twice for the same affiliate with the same `commissionId`, type `"selfReferral"`, and severity `"high"`, when the second call runs, then no duplicate signal is created (returns null)
- [ ] **AC 5**: Given `addSelfReferralFraudSignal` is called with different `commissionId` values, when both calls run, then two separate fraud signals are created
- [ ] **AC 6**: Given a fraud signal with a `signalId`, when `dismissFraudSignal` is called with that `signalId`, then the correct signal is marked as reviewed
- [ ] **AC 7**: Given `dismissFraudSignal` is called with a `signalId` that does not exist, when the mutation runs, then it throws "Fraud signal not found"
- [ ] **AC 8**: Given a new fraud signal is created via any creation path, when the signal is read back, then it contains a non-empty `signalId` string
- [ ] **AC 9**: Given `getAffiliateFraudSignals` returns signals, when a signal has a `commissionId`, then `commissionId` is included in the response (not silently dropped)
- [ ] **AC 10**: Given a self-referral fraud signal is created, when the signal's `details` JSON is parsed, then it contains `totalScore`, `threshold`, `matchedIndicators`, `commissionId`, and `detectedAt`
- [ ] **AC 11**: Given the dashboard activity feed query runs, when fraud signals exist with `type: "selfReferral"`, then they appear in the activity feed
- [ ] **AC 12**: Given `backfillStats` processes a commission with both `fraudIndicators` (non-empty) and `isSelfReferral=true`, when the backfill runs, then `commissionsFlagged` increments by exactly 1
- [ ] **AC 13**: Given `backfillStats` processes a commission with `status === "approved"`, when the backfill runs, then it does NOT count as `commissionsReversedThisMonth`
- [ ] **AC 14**: Given `isConversionSelfReferred` existed in `fraudDetection.ts`, when the changes are complete, then the function is removed and no other file references it
- [ ] **AC 15**: Given the `migrateFraudSignalIds` action is run twice, when legacy fraud signals exist without `signalId`, then all are assigned unique signalIds on first run and second run skips all (idempotent)
- [ ] **AC 16**: Given the frontend `FraudSignalsSection.tsx` calls `onDismissSignal`, when a user dismisses a signal, then `signalId` (not `signalIndex`) is passed to the backend mutation
- [ ] **AC 17**: Given all weighted scoring test cases (AC 1-3 plus edge cases), when the test suite runs, then all tests pass
- [ ] **AC 18**: Given a legacy fraud signal without `signalId` (migration not yet run), when rendered in `FraudSignalsSection`, then the dismiss button is disabled with a "pending migration" tooltip (no error thrown)

## Additional Context

### Dependencies

- No new npm packages required
- Schema change: add optional `signalId` field to `fraudSignals` object (backward compatible)
- **Frontend coordination required** (Task 6): Two files must be updated in lockstep with backend API changes:
  - `src/components/affiliate/FraudSignalsSection.tsx` L54 — prop type change + transition state
  - `src/app/(auth)/affiliates/[id]/page.tsx` L80-82 — handler and mutation call

### Deployment Sequence

Deploying backend (signalId API) and frontend (signalId callers) simultaneously creates a broken window where legacy signals can't be dismissed. The recommended deployment order avoids this:

| Step | Action | Why |
|------|--------|-----|
| **1. Schema deploy** | Deploy `convex/schema.ts` (Task 1) | Adds optional `signalId` field — fully backward compatible, no code changes yet |
| **2. Run migration** | Run `migrateFraudSignalIds` (Task 5) | Assigns signalIds to ALL legacy signals before any API changes. Run per-tenant for large deployments. Verify with: `npx convex run fraudDetection:migrateFraudSignalIds` |
| **3. Backend deploy** | Deploy Tasks 2-4, 7-8 (all Convex files) | API switches to signalId, weighted scoring goes live. All signals already have signalIds from Step 2 — no broken dismiss. |
| **4. Frontend deploy** | Deploy Task 6 (FraudSignalsSection, page.tsx) | Frontend switches to signalId. Transition-state disabled button is a safety net but shouldn't be needed if Step 2 completed. |
| **5. Tests + docs** | Deploy Tasks 9-10 (tests, documentation) | Non-breaking, can deploy anytime. |

**Rollback plan**: If Step 3 causes issues, revert backend to previous deployment. Frontend (Step 4) should also revert since it sends signalId which the old backend doesn't accept. The migration (Step 2) is harmless — signalIds are ignored by old code.

### Testing Strategy

- Expand existing `convex/fraudSignals.test.ts` with 6 new test suites (see Task 10)
- All tests follow simulated logic pattern (no Convex runtime)
- Use given/when/then structure for all acceptance criteria
- Run `pnpm vitest run convex/fraudSignals.test.ts` to verify
- **Known limitation**: Simulated tests validate logic correctness but not Convex runtime behavior (schema validation, transaction isolation, pagination). Convex integration tests are a future investment.

### Notes

- **Deferred: Standalone fraudSignals table.** The embedded array approach works for current scale but will hit the 1MB Convex document limit at ~thousands of signals per affiliate. Plan a migration spec when tenant scale demands it. Trigger criterion: when any tenant averages >100 signals per affiliate.
- **False positive reduction**: Weighted scoring is calibrated for PH/SEA market where shared networks (cafés, co-working) are common. An IP subnet match alone (1pt) won't trigger — needs a second signal like device match (2pt) to reach threshold.
- **Device fingerprint reliability**: `device_match` (2pts) relies on browser/client-provided fingerprints which vary in consistency. Two users on identical Chrome/Mac setups in the same office may produce similar fingerprints. Combined with `ip_subnet_match` (1pt), this triggers detection (3pts) — a potential false positive for shared-office scenarios. If FP rates are higher than expected post-deployment, consider raising `device_match` weight to 3 or raising the threshold to 4.
- **Detection is point-in-time, not historical**: The system stores only `lastLoginIp` and `lastDeviceFingerprint` — a single snapshot. If an affiliate's IP or device changes legitimately between login and purchase, the comparison may miss or falsely match. A full IP/device history would reduce both false positives and false negatives but is deferred (see Out of Scope).
- **Weights are per-platform, not per-tenant**: The `SIGNAL_WEIGHTS` and `SELF_REFERRAL_THRESHOLD` constants apply to all tenants. A Manila-based agency (dense shared networks) and a US-based SaaS (distributed remote affiliates) have fundamentally different false-positive profiles. **Future feature**: Per-tenant weight configuration stored in tenant settings, with sensible defaults.
- **Backward compatibility**: Weighted scoring changes detection behavior for new commissions only. Existing flagged commissions are not retroactively re-evaluated. New threshold applies forward-only.
- **totalScore persistence**: Score and threshold are stored in the fraud signal's `details` JSON. This enables audit trail and future retroactive re-evaluation if weights are tuned.
- **Migration timing**: Run `migrateFraudSignalIds` BEFORE deploying backend/frontend code (see Deployment Sequence). The migration is idempotent — safe to re-run. For large tenants, use per-tenant mode.
- **Dashboard L324 decision**: Activity type `"self_referral_detected"` (with underscores) is intentionally kept at L324 — it's the dashboard feed's own type taxonomy, not a comparison against signal types. Only the filter at L320 (which compares against the signal's actual type) is changed.
- **Admin tenants.ts unbounded collects**: Found during investigation but out of scope — file has multiple unbounded `.collect()` calls (L52-55, L91-92, L677-680, L695-699). Address in a separate admin-focused hardening spec.
- **`generateSignalId` duplication**: The helper is defined in both `fraudDetection.ts` and `affiliates.ts` (Convex queries/mutations can't share code via dynamic imports). A future refactor could extract it to a shared utility file that both files import statically.
- **`"use node";` on fraudDetection.ts**: Adding this directive enables Node.js APIs (needed for migration action) but is safe for existing `internalQuery`/`internalMutation` functions — they run in V8 regardless of the directive.
- **Affiliate transparency (future)**: Currently affiliates (Jamie persona) cannot see their fraud score or reason for flagging from the affiliate portal. The `totalScore` and `matchedIndicators` are stored in signal details but only visible to the SaaS Owner. A future spec should add affiliate-facing fraud signal details with explanation text and an appeal mechanism.
- **SaaS Owner weight tuning (future)**: Alex persona may want to adjust detection sensitivity per-campaign or per-tenant. The current constant-based weights don't support this. A future spec should add a tenant-level configuration for weights and threshold.

## Review Notes

- Adversarial review completed
- Findings: 15 total, 3 fixed (F1, F9, F15), 12 skipped
- Resolution approach: auto-fix
- F1 (Critical): Added `MAX_ITERATIONS = 10000` guard to migration while loop
- F9 (Medium): Corrected entropy comment from "~64 bits" to "~58 bits"
- F15 (Low): Fixed import ordering in affiliates.ts (function was before import statement)
- Skipped findings: F2/F8/F10/F11/F13 were noise or pre-existing; F3/F4/F5/F6/F7 are valid concerns documented as intentional design decisions or future features; F12/F14 are acceptable for current scope
