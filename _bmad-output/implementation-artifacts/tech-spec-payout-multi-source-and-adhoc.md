---
title: "Payout Multi-Source Support & Ad-Hoc Manual Recording"
slug: "payout-multi-source-and-adhoc"
created: "2026-03-21"
status: "ready-for-dev"
stepsCompleted: [1, 2, 3, 4]
tech_stack: ["Convex 1.32.0", "Next.js 16.1.0", "TypeScript 5.9.3", "Tailwind CSS 4.1.16", "Vitest", "convex-test"]
files_to_modify: ["convex/schema.ts", "convex/payouts.ts", "convex/payouts.test.ts", "convex/audit.ts", "convex/tenantStats.ts", "src/lib/audit-constants.ts", "src/app/(auth)/payouts/PayoutsClient.tsx", "src/app/(auth)/payouts/history/PayoutHistoryClient.tsx", "src/app/(auth)/affiliates/[id]/page.tsx"]
code_patterns: ["Convex new function syntax with v.* validators", "Denormalized counters via tenantStats", ".take(N) capped reads", "Static imports only in queries/mutations", "idempotent mutations with guard clauses", "audit logging via internal.audit.logPayoutAuditEvent", "useQuery/useMutation with Suspense wrappers", "toast notifications via sonner"]
test_patterns: ["vitest + convexTest", "testModules mock pattern for auth", "setupTestData helper for tenant/user/affiliate fixture", "describe/it structure per AC", "mutation + query assertion pairs"]
---

# Tech-Spec: Payout Multi-Source Support & Ad-Hoc Manual Recording

**Created:** 2026-03-21

## Overview

### Problem Statement

The current payout system only supports a single manual flow (generate batch → mark paid). There's no concept of payment source (SaligPay vs manual), no mixed-batch support, no ad-hoc manual payouts, and no status enum — making it impossible for Alex to clearly track which payouts are automated vs manual, and impossible to record one-off manual payments to affiliates.

### Solution

Add `paymentSource` to payouts/batches, introduce a proper status union, support SaligPay-initiated payouts (mocked), allow mixed batches, and enable ad-hoc manual payout recording outside the batch flow.

### Scope

**In Scope:**
- `paymentSource` field on payouts table (`"saligpay" | "manual"`)
- `paymentMethod` snapshot on each payout record
- Status union: `"pending" | "processing" | "paid" | "failed"`
- SaligPay-initiated payouts (mocked mutation with scheduled completion)
- Mixed batches (each payout in a batch has its own `paymentSource`)
- Ad-hoc manual payouts (standalone, outside batch flow)
- UI updates: combined source+method column, status colors (processing/failed), ad-hoc payout entry on affiliate detail page
- Stale method warning when affiliate changes payout method after payout creation
- CSV export with new source/method columns

**Out of Scope:**
- Real SaligPay API integration (mock only)
- Refund/reversal flow
- Failed payout recovery/retry flow (V2 — see Notes)
- Affiliate-side payout preferences
- Webhook handling for SaligPay status updates
- Stale-processing timeout detection (future)
- Individual payout status filtering query (future)

## Context for Development

### Codebase Patterns

- **Convex new function syntax** with `v.*` validators on all args/returns
- **Denormalized counters** via `tenantStats` for aggregate stats — never scan tables
- **`.take(N)` capped reads** on unbounded tables (1MB transaction limit): payouts `.take(500)`
- **Static imports only** — no dynamic imports in queries/mutations (V8 runtime)
- **`"use client"` + Suspense** boundaries for Convex hook components (Next.js 16)
- **MetricCard** canonical for all stat cards — never inline stat card markup
- **Button motion** built into base component — no inline animation classes
- **Audit logging** for all payout lifecycle events via `internal.audit.logPayoutAuditEvent`
- **Idempotent mutations** with guard clauses (e.g., `if (payout.status === "paid") return current state`)
- **Toast notifications** via `sonner` for user feedback
- **Auth mocking in tests** via `testModules` pattern with `vi.fn()` for `betterAuthComponent.getAuthUser`

### Files to Reference

| File | Purpose | Key Details |
| ---- | ------- | ----------- |
| `convex/schema.ts` L350-371 | Payouts + PayoutBatches tables | Current schema to modify. `payouts.status` is `v.string()`, `batchId` is required. `payoutBatches.status` is `v.string()` |
| `convex/schema.ts` L194-235 | Affiliates table | `payoutMethod` is `v.optional(v.object({ type: v.string(), details: v.string() }))` — live method used for snapshot |
| `convex/schema.ts` L16-36 | Tenants table | `saligPayCredentials` with `mode`, `mockMerchantId` — used to check if SaligPay connected |
| `convex/payouts.ts` L44-209 | `generatePayoutBatch` | Creates batch + payouts. No `paymentSource`, no `paymentMethod` snapshot |
| `convex/payouts.ts` L360-433 | `getBatchPayouts` | Reads `affiliate.payoutMethod` live — must switch to payout snapshot |
| `convex/payouts.ts` L544-668 | `markPayoutAsPaid` | Sets `status: "paid"`, idempotent. Reads `payout.batchId` without null-check at L569, L604, L632, L634 |
| `convex/payouts.ts` L679-805 | `markBatchAsPaid` | Bulk marks pending at L707, then unconditionally sets batch to `"completed"` at L777 |
| `convex/payouts.ts` L813-846 | `getBatchPayoutStatus` | Counts paid/pending via in-memory filter. `total = payouts.length` |
| `convex/tenantStats.ts` L221-230 | `incrementTotalPaidOut` | Called on mark-paid. Must also be called for ad-hoc and SaligPay completion |
| `convex/audit.ts` | `logPayoutAuditEvent` | Centralized audit mutation. Accepts `action` string |
| `convex/tenants.ts` L567-660 | SaligPay connection | `getSaligPayConnectionStatus`, `connectMockSaligPay` — check tenant's SaligPay state |
| `src/lib/audit-constants.ts` | Audit action constants | `PAYOUT_AUDIT_ACTIONS` — needs expansion for new actions |
| `src/app/(auth)/payouts/PayoutsClient.tsx` | Main payouts page (1321 lines) | Batch generation, batch detail, mark-paid dialog. No source badges, no ad-hoc |
| `src/app/(auth)/payouts/history/PayoutHistoryClient.tsx` | Payout history | Batch list + detail. No source awareness |
| `src/app/(auth)/affiliates/[id]/page.tsx` | Affiliate detail page | Shows affiliate info, performance, commissions — ad-hoc payout entry point |
| `convex/payouts.test.ts` | Existing tests (2702 lines) | `convexTest` + `testModules` + `setupTestData` pattern |

### Technical Decisions

1. **`paymentSource` on payouts, not batches** — Each payout carries its own source. Batch gets summary counts (`saligPayCount`, `manualCount`).
2. **`paymentMethod` snapshot on payout** — Affiliate's method snapshotted at creation. `getBatchPayouts` reads from snapshot, not live affiliate. Staleness computed server-side in `getBatchPayouts` (avoids N+1 queries).
3. **`status` union migration** — `v.string()` → `v.union(v.literal("pending"), v.literal("processing"), v.literal("paid"), v.literal("failed"))` on both tables. Existing data is safe.
4. **`batchId` becomes optional** — Ad-hoc payouts have `batchId: undefined`. `by_batch` index naturally excludes them. All existing code paths that read `payout.batchId` MUST add null-guards (F1, F2, F10). New queries use `by_tenant_and_adhoc` index.
5. **SaligPay mock flow** — `initiateSaligPayPayout` sets `"processing"`. Scheduled `mockSaligPayPayoutCompletion` transitions to `"paid"` (or `"failed"`). Double-credit guards in both directions (F2, F8). `shouldFail` is internal-only (F18).
6. **`failedReason` field** — Optional string on payouts, populated when SaligPay fails.
7. **New indexes** — `by_tenant_and_source` on `["tenantId", "paymentSource"]`. `by_tenant_and_adhoc` on `["tenantId", "isAdHoc"]`.
8. **Audit constants expansion** — Add `AD_HOC_PAYOUT_CREATED`, `PAYOUT_PROCESSING`, `PAYOUT_FAILED`, `PAYOUT_PAID_SALIGPAY`.
9. **Combined source+method column in UI** — Display payment source and method in a single column (e.g., "⚡ GCash" / "✋ BPI Transfer").
10. **Ad-hoc entry on affiliate detail page** — "Record Manual Payment" button where affiliate context is already loaded.
11. **`processingStartedAt` field** — Timestamp set when payout enters `processing` state. Enables future stale-processing timeout.
12. **`incrementTotalPaidOut` is MANDATORY** — Every payment completion path MUST call this. `totalPaidOut` conflates commission-backed and ad-hoc amounts — this is by design. Add `adHocPaidOut` counter if reconciliation needed (F20).
13. **Shared batch completion helper** — `shouldCompleteBatch(batchId)` checks ALL payouts are `["paid", "failed"]` — no `pending` AND no `processing`. Used by both `markPayoutAsPaid` and `markBatchAsPaid` (F3, F16).
14. **`isAdHoc` uses `v.optional(v.literal(true))`** — Can only be `true` or `undefined`. No `false` state avoids three-state trap (F13).

## Implementation Plan

### Shared Helpers (new file)

#### Task 0: Backend — Shared `shouldCompleteBatch` helper
- File: `convex/payouts.ts` (add at top, before mutations)
- Action: Create shared internal helper function:
  ```typescript
  // Shared helper: determine if all payouts in a batch are settled (paid or failed).
  // Used by markPayoutAsPaid, markBatchAsPaid, and mockSaligPayPayoutCompletion.
  // F3/F16: prevents premature batch completion while SaligPay payouts are in-flight.
  async function shouldCompleteBatch(ctx: any, batchId: Id<"payoutBatches">): Promise<boolean> {
    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_batch", (q: any) => q.eq("batchId", batchId))
      .take(500);
    return payouts.every((p: any) => p.status === "paid" || p.status === "failed");
  }
  ```
- Notes: This is NOT a Convex function — it's a plain async helper used within mutations. It centralizes the batch completion logic that was duplicated and buggy in two places (L636 and L777).

### Tasks

#### Task 1: Schema — Update `payouts` table
- File: `convex/schema.ts`
- Action:
  - Change `status: v.string()` → `status: v.union(v.literal("pending"), v.literal("processing"), v.literal("paid"), v.literal("failed"))`
  - Change `batchId: v.id("payoutBatches")` → `batchId: v.optional(v.id("payoutBatches"))`
  - Add `paymentSource: v.union(v.literal("saligpay"), v.literal("manual"))`
  - Add `paymentMethod: v.optional(v.object({ type: v.string(), details: v.string() }))` — snapshot of affiliate's method
  - Add `failedReason: v.optional(v.string())`
  - Add `isAdHoc: v.optional(v.literal(true))` — true for standalone payouts, undefined for batched (F13: no false state)
  - Add `processingStartedAt: v.optional(v.number())` — timestamp when payout enters processing state
  - Add index: `.index("by_tenant_and_source", ["tenantId", "paymentSource"])`
  - Add index: `.index("by_tenant_and_adhoc", ["tenantId", "isAdHoc"])`
  - Add code comment on `by_batch` index: `// WARNING: Payouts with batchId=undefined (ad-hoc) will NOT appear in this index. Use by_tenant_and_adhoc for ad-hoc payouts.`
- Notes: Convex schema changes are additive. `isAdHoc` uses `v.literal(true)` to avoid three-state trap — only `true` or `undefined` (F13). The `by_tenant_and_adhoc` index correctly excludes `undefined` docs from Convex indexes.

#### Task 2: Schema — Update `payoutBatches` table
- File: `convex/schema.ts`
- Action:
  - Change `status: v.string()` → `status: v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"))`
  - Add `saligPayCount: v.optional(v.number())` — count of SaligPay-initiated payouts in batch
  - Add `manualCount: v.optional(v.number())` — count of manual payouts in batch
- Notes: Batch status lifecycle: `pending` → `processing` → `completed`. `"processing"` means at least one payout is being processed via SaligPay. `saligPayCount`/`manualCount` are denormalized and must be kept in sync when payout sources change (F17).

#### Task 3: Audit Constants — Add new payout actions
- File: `src/lib/audit-constants.ts`
- Action: Add to `PAYOUT_AUDIT_ACTIONS`:
  - `AD_HOC_PAYOUT_CREATED: "ad_hoc_payout_created"`
  - `PAYOUT_PROCESSING: "payout_processing"` (SaligPay initiated)
  - `PAYOUT_FAILED: "payout_failed"` (SaligPay failure)
  - `PAYOUT_PAID_SALIGPAY: "payout_paid_saligpay"` (SaligPay completion)
- Notes: Existing actions remain unchanged.

#### Task 4: Backend — Update `generatePayoutBatch` mutation
- File: `convex/payouts.ts`
- Action:
  - In the payout insert loop (L157), add `paymentSource: "manual"`, `paymentMethod: affiliate.payoutMethod` (snapshot), `isAdHoc: undefined`
  - After all payouts created, compute `manualCount: validAffiliates.length`, `saligPayCount: 0`
  - Patch batch with `saligPayCount` and `manualCount`
- Notes: `paymentMethod` from `affiliate.payoutMethod` already fetched in L109-126.

#### Task 5: Backend — Update `markPayoutAsPaid` mutation (F1, F2, F3)
- File: `convex/payouts.ts`
- Action:
  - **F1/F2: Add ad-hoc early return at the top of handler** — BEFORE any batch logic:
    ```typescript
    // F1: Ad-hoc payouts have no batch. Return simplified response.
    if (!payout.batchId) {
      return {
        payoutId: payout._id,
        batchStatus: null,
        remainingPending: null,
      };
    }
    ```
  - Add `paymentSource: v.optional(v.union(v.literal("saligpay"), v.literal("manual")))` to args
  - In the patch (L582), set `paymentSource: args.paymentSource ?? "manual"` if the payout doesn't already have one
  - Add idempotency for `"processing"` status: if `payout.status === "processing"`, allow transition to `"paid"` (SaligPay completion path)
  - Keep existing idempotency: if `status === "paid"`, return current state
  - **F3: Replace batch auto-completion logic at L632-641** — use shared `shouldCompleteBatch(ctx, payout.batchId)` instead of `remainingPending === 0`. Only patch batch to `"completed"` if helper returns true.
  - **Update return type** to make `batchStatus` and `remainingPending` nullable: `batchStatus: v.nullable(v.string())`, `remainingPending: v.nullable(v.number())`. This accommodates ad-hoc payouts where these fields don't apply (F2).
- Notes: The early return for ad-hoc payouts prevents `payout.batchId` null dereference at L569, L604, L632, L634. The `shouldCompleteBatch` helper prevents premature completion when SaligPay payouts are `processing` (F3).

#### Task 6: Backend — Update `markBatchAsPaid` mutation (F4, F11, F16)
- File: `convex/payouts.ts`
- Action:
  - **F4: Add source-based filter** — change the pending filter at L707 from:
    ```typescript
    const pendingPayouts = payouts.filter((p) => p.status === "pending");
    ```
    to:
    ```typescript
    const pendingManualPayouts = payouts.filter(
      (p) => p.status === "pending" && (p.paymentSource === "manual" || !p.paymentSource)
    );
    ```
    This ensures SaligPay-sourced payouts (even if somehow still pending) are NOT marked paid.
  - Set `paymentSource: "manual"` only on payouts that don't already have one
  - **F11: Remove single paymentReference** — do NOT apply `args.paymentReference` to all payouts. Each payout keeps its own reference (or none). Remove the `paymentReference` arg or make it optional metadata only (stored on the batch, not individual payouts).
  - **F16: Use shared `shouldCompleteBatch`** for batch completion at L777-780. Only set `status: "completed"` if the helper returns true.
- Notes: F4 directly addresses AC3. The source-based filter ensures "Mark All as Paid" only affects manual-source payouts. Removing single paymentReference (F11) prevents overwriting individual payout references in mixed batches.

#### Task 7: Backend — Update `getBatchPayouts` query (F12)
- File: `convex/payouts.ts`
- Action:
  - In the enrichment loop (L410-433), replace `affiliate.payoutMethod` with `payout.paymentMethod` (the snapshot)
  - **F12: Compute `isMethodStale` server-side** — compare `payout.paymentMethod?.type` with `affiliate.payoutMethod?.type` in the enrichment loop, include `isMethodStale: boolean` in the return object. This avoids N+1 queries on the frontend — the data arrives pre-computed.
  - Add `paymentSource: payout.paymentSource` and `failedReason: payout.failedReason ?? undefined` to return object
  - Update return validator to include `paymentSource`, `failedReason`, `isMethodStale`
- Notes: Staleness computed server-side eliminates the N+1 concern (F12). The existing `Promise.all` loop already fetches affiliate records — just add the comparison there.

#### Task 8: Backend — Update `getBatchPayoutStatus` query (F9)
- File: `convex/payouts.ts`
- Action:
  - Add `processing` count and `failed` count alongside existing `paid` and `pending`
  - **F9: Progress bar** — `total` stays `payouts.length`. Frontend computes progress as `(paid + failed) / total` — accounts for all terminal states. Return all four counts explicitly.
  - Update return validator to include `processing` and `failed`
- Notes: `total = paid + pending + processing + failed` (always). Progress bar shows `paid / total` for completion, with `processing + failed` as "non-completed but resolved."

#### Task 9: Backend — Update `getPayoutBatches` query
- File: `convex/payouts.ts`
- Action:
  - Add `saligPayCount` and `manualCount` to the page mapping
  - Update return validator
- Notes: Fields from Task 2, just expose them.

#### Task 10: Backend — New `createAdHocPayout` mutation (F5, F19, F20)
- File: `convex/payouts.ts`
- Action: Create new mutation:
  - Args: `affiliateId: v.id("affiliates")`, `amount: v.number()`, `paymentReference: v.optional(v.string())`, `note: v.optional(v.string())`
  - Verify affiliate belongs to current tenant and is active
  - **F5: Validate `amount > 0 && amount <= 1_000_000`** — upper bound prevents phantom money recording
  - **F19: Idempotency check** — query for existing ad-hoc payout with same `affiliateId` + `paymentReference` + `paidAt` within last 24 hours (86400000ms). If duplicate found, return existing payout without creating new one.
  - Create payout record with: `paymentSource: "manual"`, `status: "paid"`, `paidAt: Date.now()`, `batchId: undefined`, `isAdHoc: true`, `paymentMethod: affiliate.payoutMethod` (snapshot), `paymentReference: args.paymentReference`
  - **F20: `incrementTotalPaidOut(ctx, tenantId, args.amount)`** — mandatory counter update. NOTE: `totalPaidOut` conflates commission-backed and ad-hoc amounts. This is by design — Alex needs a single "total money sent" number. If reconciliation against commissions is needed later, add a separate `adHocPaidOut` counter.
  - Schedule payout notification email
  - Log audit event: `action: "ad_hoc_payout_created"`
  - Return: `{ payoutId, affiliateName, amount }`
- Notes: The 24-hour dedup window on `paymentReference` (F19) prevents double-click duplicates. Client-side debounce on the submit button adds a second layer. Upper bound of ₱1M (F5) is a reasonable per-transaction cap — bulk payouts should use the batch flow.

#### Task 11: Backend — New `initiateSaligPayPayout` mutation (F17, F18)
- File: `convex/payouts.ts`
- Action: Create new mutation:
  - Args: `payoutId: v.id("payouts")` — **F18: NO `shouldFail` in public API** — removed from public args
  - Verify payout belongs to current tenant and status is `"pending"`
  - Verify tenant has SaligPay credentials (`tenant.saligPayCredentials` exists)
  - Verify `payout.batchId` exists (ad-hoc payouts cannot be sent via SaligPay)
  - Set payout: `status: "processing"`, `paymentSource: "saligpay"`, `processingStartedAt: Date.now()`
  - **F17: Update batch counts atomically** — `ctx.db.patch(batchId, { manualCount: (batch.manualCount ?? 1) - 1, saligPayCount: (batch.saligPayCount ?? 0) + 1, status: "processing" })`
  - Schedule `internal.payouts.mockSaligPayPayoutCompletion` via `ctx.scheduler.runAfter(3000, ...)` — pass `shouldFail: false` hardcoded
  - Log audit event: `action: "payout_processing"`
  - Return: `{ payoutId, status: "processing" }`
- Notes: `shouldFail` removed from public API (F18) — it's a mock control that should never be exposed to users. The scheduled completion always attempts success. For testing failure path, call `mockSaligPayPayoutCompletion` directly in tests with `shouldFail: true`. Batch count update (F17) keeps `saligPayCount`/`manualCount` accurate when payout source changes.

#### Task 11b: Backend — New `_testFailSaligPayPayout` internalMutation (F18)
- File: `convex/payouts.ts`
- Action: Create new `internalMutation` for testing only:
  - Args: `payoutId: v.id("payouts")`
  - Verify payout is `"processing"` and `paymentSource === "saligpay"`
  - Set `status: "failed"`, `failedReason: "SaligPay processing failed (test)"`
  - Log audit: `action: "payout_failed"`
  - Return: `v.null()`
- Notes: This internal-only mutation replaces the `shouldFail` public arg (F18). Tests call this directly via `t.run()` instead of exposing a dangerous public parameter.

#### Task 12: Backend — New `mockSaligPayPayoutCompletion` internal mutation (F2, F8, F21)
- File: `convex/payouts.ts`
- Action: Create new `internalMutation`:
  - Args: `payoutId: v.id("payouts")`, `shouldFail: v.optional(v.boolean())`
  - Get payout, verify it's `"processing"`
  - **F2: Double-credit guard** — `if (payout.status !== "processing") return null` — handles manual-pay-during-window AND mock-completion-first-then-manual (F8)
  - **F21: Use `payout.tenantId` NOT `args.tenantId`** — derive tenant from the document itself, not the caller argument. Makes the internal mutation self-contained.
  - If `shouldFail`:
    - Set `status: "failed"`, `failedReason: "SaligPay processing failed (mock)"`
    - Check batch completion via `shouldCompleteBatch` — if true, set batch to `"completed"`
    - Log audit: `action: "payout_failed"`
  - If success:
    - Set `status: "paid"`, `paidAt: Date.now()`, `paymentReference: "SALIGPAY-MOCK-{timestamp}"`
    - **MANDATORY: `incrementTotalPaidOut(ctx, payout.tenantId, payout.amount)`** — use `payout.tenantId` (F21)
    - Schedule payout notification email
    - Check batch completion via `shouldCompleteBatch` — if true, set batch to `"completed"`
    - Log audit: `action: "payout_paid_saligpay"`
  - Return: `v.null()`
- Notes: Self-contained internal mutation (F21) — no dependency on caller-provided tenantId. Uses shared `shouldCompleteBatch` helper for batch completion logic.

#### Task 13: Backend — New `getAdHocPayouts` query
- File: `convex/payouts.ts`
- Action: Create new query:
  - Args: `paginationOpts: paginationOptsValidator`
  - Use `by_tenant_and_adhoc` index: `q.eq("tenantId", tenantId).eq("isAdHoc", true)`
  - `.paginate(args.paginationOpts)` for native Convex pagination
  - Enrich with affiliate name/email
  - Return: paginated array with `payoutId`, `affiliateName`, `affiliateEmail`, `amount`, `status`, `paymentSource`, `paymentMethod`, `paymentReference`, `paidAt`, `createdAt`
- Notes: Uses `by_tenant_and_adhoc` index. `isAdHoc` can only be `true` or `undefined` (F13), so the index query is clean.

#### Task 14: Frontend — Update `PayoutsClient.tsx` (batch detail + source badges)
- File: `src/app/(auth)/payouts/PayoutsClient.tsx`
- Action:
  - **Combined source+method column**: `{source_icon} {method_type}` in one cell
    - `⚡ GCash` (blue badge) — SaligPay source
    - `✋ BPI Transfer` (gray badge) — Manual source
    - **Stale method warning**: Use server-provided `isMethodStale` field — if true, show yellow warning dot + tooltip on the cell
  - **Status badges**:
    - `pending`: amber badge
    - `processing`: blue badge with `Loader2` spinning icon
    - `paid`: green badge
    - `failed`: red badge with `XCircle` + tooltip showing `failedReason`
  - **"Mark All as Paid" button**: Only enabled if all pending payouts in batch have `paymentSource !== "saligpay"` — SaligPay payouts must use their own flow
  - **Single "Mark Paid" action**: Show only if `paymentSource === "manual"` (or undefined for legacy)
  - **New "Send via SaligPay" action**: Show if `paymentSource === "manual"` and tenant has SaligPay connected
  - **Update BatchStatusBadge**: Handle `"processing"` status for batches
- Notes: Icons: `Zap`, `Hand`, `XCircle`, `Loader2`, `AlertTriangle`. Combined column keeps column count at 5 for mobile.

#### Task 15: Frontend — Add "Record Manual Payment" on affiliate detail page (F19)
- File: `src/app/(auth)/affiliates/[id]/page.tsx`
- Action:
  - Add "Record Manual Payment" button in header actions
  - Dialog: Amount (required, min 1, max 1,000,000), Payment Reference (optional), Note (optional)
  - **F19: Client-side debounce** — disable submit button on click, re-enable after mutation resolves or errors. Prevents double-click.
  - On submit: call `createAdHocPayout` with current `affiliateId`
  - On success: toast + close dialog
  - Warning if no payout method configured
- Notes: Client-side debounce (F19) + server-side dedup (Task 10) = double protection against duplicate payouts.

#### Task 16: Frontend — Add ad-hoc payouts section to `PayoutsClient.tsx`
- File: `src/app/(auth)/payouts/PayoutsClient.tsx`
- Action:
  - New section below batch history (or tab): "Manual Payments (Ad-Hoc)"
  - Use `getAdHocPayouts` query
  - Columns: Affiliate, Amount, Method (combined badge), Reference, Date
  - Empty state: "No manual payments recorded. Record payments from an affiliate's detail page."
- Notes: View-only section. Entry point is affiliate detail page (Task 15).

#### Task 17: Frontend — Update `PayoutHistoryClient.tsx`
- File: `src/app/(auth)/payouts/history/PayoutHistoryClient.tsx`
- Action:
  - Batch list: source summary badges from `saligPayCount`/`manualCount`
  - Batch detail: combined source+method column (same as Task 14)
  - Status filter: add "Processing" and "Failed" options
  - Status badges: handle `processing` and `failed`
- Notes: Minimal changes.

#### Task 19: Backend — Update CSV export with new columns (F7)
- File: `convex/payouts.ts` (update `generatePayoutCsv` helper or wherever CSV is generated)
- Action:
  - Add `paymentSource` column (values: "saligpay" / "manual")
  - Add `isAdHoc` column (values: "Yes" / blank for batched)
  - Add `failedReason` column (blank if none)
- Notes: F7 was a gap — CSV test checklist mentioned "verify source column included" but no task covered it. This task closes that gap.

#### Task 18: Tests — Backend tests for all new/updated mutations
- File: `convex/payouts.test.ts`
- Action: Add `describe` blocks:
  - **"Schema migration"**: New fields work on insert/query
  - **"Task 4: generatePayoutBatch"**: `paymentSource: "manual"`, `paymentMethod` snapshot, `isAdHoc: undefined`, batch counts correct
  - **"Task 5: markPayoutAsPaid"**:
    - processing→paid transition
    - **F1: Ad-hoc early return** — call on ad-hoc payout (batchId=undefined), verify simplified response with null batchStatus
    - Idempotency: already-paid returns current state
    - **F3: Batch not completed while processing** — initiate SaligPay on one payout, then mark another paid — verify batch stays "processing"
  - **"Task 6: markBatchAsPaid"**:
    - **F4: Source-based filtering** — batch with 2 manual + 1 saligpay-processing → only 2 marked paid, saligpay untouched
    - **F16: Batch not completed with in-flight** — mark-all on batch with processing payout → batch stays "processing"
    - Batch counts not overwritten for saligpay payouts
  - **"Task 7: getBatchPayouts"**: snapshot not live, `isMethodStale` computed correctly
  - **"Task 8: getBatchPayoutStatus"**: all four counts (paid, pending, processing, failed) correct
  - **"Task 10: createAdHocPayout"**:
    - Happy path
    - **F5: Amount > 1,000,000 rejected**
    - **F19: Dedup** — create two with same paymentReference within 24h → second returns existing
    - Tenant isolation
    - `totalPaidOut` incremented
  - **"Task 11: initiateSaligPayPayout"**:
    - Happy path: processing, saligpay source, processingStartedAt, batch to processing
    - **F17: Batch counts updated** — saligPayCount +1, manualCount -1
    - No credentials: throws
    - **F18: shouldFail NOT in public args** — verify mutation doesn't accept it
    - Ad-hoc payout (no batchId): throws error
  - **"Task 11b: _testFailSaligPayPayout"**: sets failed + failedReason
  - **"Task 12: mockSaligPayPayoutCompletion"**:
    - Success: paid, totalPaidOut incremented (F21: using payout.tenantId), batch completes
    - Failure: failed + failedReason, batch completes if all settled
    - **F2: Double-credit** — manual pay during window → completion skips
    - **F8: Reverse double-credit** — completion fires first → manual mark-paid hits idempotency guard
  - **"Task 13: getAdHocPayouts"**: native pagination, only isAdHoc=true
- Notes: For scheduled mutations, call internal mutation directly via `t.run()`. Test both directions of double-credit guard (F2 + F8).

### Acceptance Criteria

- [ ] AC1: Given confirmed unpaid commissions, when batch generated → payouts have `paymentSource: "manual"`, `paymentMethod` snapshot, `isAdHoc: undefined`, `status: "pending"`, batch counts correct.

- [ ] AC2: Given pending manual payout, when marked paid → `status: "paid"`, `paidAt` set, optional `paymentReference`.

- [ ] AC3: Given mixed batch (manual + saligpay-processing), when "Mark All as Paid" → only manual-source pending payouts marked paid; SaligPay payouts unchanged. Batch NOT completed if processing payouts remain.

- [ ] AC4: Given pending payout + SaligPay connected, when "Send via SaligPay" → `status: "processing"`, `paymentSource: "saligpay"`, `processingStartedAt` set, batch to `"processing"`, batch counts updated.

- [ ] AC5: Given processing SaligPay payout, when mock completion fires (success) → `status: "paid"`, `totalPaidOut` incremented (using `payout.tenantId`), email scheduled, batch auto-completes when all settled.

- [ ] AC6: Given processing SaligPay payout, when mock completion fires (failure) → `status: "failed"`, `failedReason` set.

- [ ] AC7: Given already-paid payout, when mark-paid attempted → returns current state (idempotency).

- [ ] AC8: Given processing payout manually paid during mock window, when mock fires → skips without double-credit (forward guard).

- [ ] AC9: Given mock completion fires first, then manual mark-paid attempted → idempotency guard returns current state (reverse guard).

- [ ] AC10: Given active affiliate, when ad-hoc payout created → `status: "paid"`, `batchId: undefined`, `isAdHoc: true`, `totalPaidOut` incremented, audit logged. Duplicate with same paymentReference within 24h returns existing record.

- [ ] AC11: Given ad-hoc and batched payouts, `getAdHocPayouts` returns only `isAdHoc: true` with native pagination.

- [ ] AC12: Given batch payout detail, `paymentMethod` from snapshot, `isMethodStale` server-computed.

- [ ] AC13: Given payout history, batches show source counts.

- [ ] AC14: Given any payout table, combined source+method badge + status badge displayed.

- [ ] AC15: Given stale method, yellow warning indicator on method cell.

- [ ] AC16: Given CSV download, `paymentSource`, `isAdHoc`, `failedReason` columns included.

## Additional Context

### Dependencies

- **SaligPay credential check**: `tenant.saligPayCredentials` must exist for `initiateSaligPayPayout`
- **Email notification**: `internal.emails.sendPayoutSentEmail` — called from ad-hoc creation and SaligPay completion
- **tenantStats**: `incrementTotalPaidOut` — **MANDATORY** on all payment completion paths. `totalPaidOut` conflates commission-backed and ad-hoc amounts (by design — F20). Add `adHocPaidOut` counter if reconciliation needed later.
- **Audit system**: `internal.audit.logPayoutAuditEvent` — no changes needed

### Testing Strategy

**Unit Tests (convex-test):**
- Each mutation/query gets its own `describe` block
- `setupTestData` helper for fixtures
- Tenant isolation on every mutation
- Status lifecycle transitions
- Idempotency on mark-paid
- **Double-credit guards both directions** (F2 forward + F8 reverse)
- **Source-based filtering in markBatchAsPaid** (F4)
- **Ad-hoc dedup** (F19)
- **Batch count updates** (F17)
- Native pagination via `by_tenant_and_adhoc` index
- Snapshot correctness (not live data)

**Manual Testing Checklist:**
1. Generate batch → source=manual, method snapshot, isAdHoc=undefined, counts correct
2. Batch detail → combined source+method badges (✋ MethodName)
3. Mark single paid → status transitions, toast, audit
4. Mark all paid → only manual affected, batch stays processing if SaligPay in-flight
5. Send via SaligPay → processing, spinning icon, processingStartedAt, batch counts updated
6. Wait 3s → auto-completion to paid
7. Test failure via `_testFailSaligPayPayout` → failed + failedReason
8. Record ad-hoc from affiliate detail → creation, counter, email
9. Double-click ad-hoc → dedup prevents duplicate
10. View ad-hoc section → only ad-hoc shown
11. Stale method warning → yellow indicator after affiliate method change
12. CSV → source column included

### Notes

- **F1/F2/F10: `batchId` null safety** — `markPayoutAsPaid` has early return for ad-hoc (no batchId). `markBatchAsPaid` and `getBatchPayouts` use `by_batch` index which naturally excludes ad-hoc. All direct `payout.batchId` accesses guarded. No schema-level enforcement (Convex limitation) — rely on code discipline and code comments.
- **F3/F16: Shared batch completion helper** — `shouldCompleteBatch()` centralized in Task 0. Both `markPayoutAsPaid` and `markBatchAsPaid` use it. Prevents premature completion while SaligPay payouts are in-flight.
- **F4: markBatchAsPaid source filter** — Changed from status-only filter to status+source filter. "Mark All as Paid" now truly only affects manual-source payouts per AC3.
- **F5: Ad-hoc amount cap** — ₱1,000,000 per single ad-hoc payout. Bulk payouts use batch flow. Not a revenue limit — a sanity check.
- **F6 (Deferred): Failed payout recovery** — V2 consideration. No failed→pending retry or manual recovery button in V1. To recover, Alex creates a new ad-hoc payout (loses original commission linkage). Document as known limitation.
- **F7: CSV task** — Added Task 19 to close the gap.
- **F11: Single paymentReference removed** — `markBatchAsPaid` no longer applies one reference to all payouts. Each payout keeps its own.
- **F12: Server-side staleness** — `getBatchPayouts` computes `isMethodStale` in the enrichment loop. No extra queries needed.
- **F13: isAdHoc two-state** — `v.optional(v.literal(true))` — only `true` or `undefined`. No `false` possible.
- **F14 (Deferred): Individual payout status filtering** — No query to find all failed/processing payouts across batches. V2 addition.
- **F15 (Deferred): Stale-processing monitoring** — `processingStartedAt` enables future cron job. No monitoring in V1.
- **F17: Batch count sync** — `initiateSaligPayPayout` atomically patches batch counts when source changes. Counts are accurate.
- **F18: shouldFail internal-only** — Removed from public `initiateSaligPayPayout` args. Added `_testFailSaligPayPayout` internalMutation for tests.
- **F19: Ad-hoc dedup** — 24-hour window on `paymentReference` uniqueness + client-side debounce. Double protection.
- **F20: totalPaidOut semantic drift accepted** — By design. `totalPaidOut` = all money sent to affiliates regardless of source. Add `adHocPaidOut` counter if reconciliation needed.
- **F21: payout.tenantId over args.tenantId** — `mockSaligPayPayoutCompletion` derives tenant from the payout document itself. Self-contained, no caller dependency.
- **Future: SaligPay real API** — Scaffolding ready. Replace scheduled mock with webhook HTTP endpoint.
- **Future: Refund/reversal** — Add `"refunded"` to status union. Schema extends cleanly.
- **Future: Ad-hoc on affiliate portal** — Admin-only in V1. Data model supports future exposure.
