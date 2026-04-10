---
title: "Commission Detail Drawer Enhancement — Computation Transparency & Activity Trail"
slug: "commission-drawer-enhancement"
created: "2026-04-09T00:00:00.000Z"
status: "implementation-complete"
stepsCompleted: [1, 2, 3, 4]
tech_stack: ["Next.js 16", "Convex", "TypeScript", "Tailwind CSS v4", "Radix UI (shadcn/ui)", "nuqs", "lucide-react"]
files_to_modify: [
  "convex/commissions.ts (EXTEND: getCommissionDetail, getAffiliateCommissions, listCommissionsPaginated; NEW: getAdminCommissionDetail)",
  "convex/audit.ts (NO CHANGES — getCommissionAuditLog used internally by getCommissionDetail)",
  "src/app/(auth)/commissions/page.tsx (EXTEND: owner drawer sections, add batchId nuqs param)",
  "src/app/portal/earnings/components/CommissionDetailDrawer.tsx (EXTEND: computation breakdown, props interface)",
  "src/app/portal/earnings/components/CommissionList.tsx (MINOR: pass-through updated commission shape)",
  "src/app/(admin)/tenants/[tenantId]/_components/RecentCommissionsTable.tsx (EXTEND: add drawer + row click handler)",
  "src/app/(auth)/payouts/batches/[batchId]/BatchDetailClient.tsx (EXTEND: add 'View Commissions' action button)",
  "src/components/shared/ActivityTimeline.tsx (EXTEND: add commission action types to icons/labels maps)",
  "src/components/shared/CommissionComputationSection.tsx (NEW: shared computation breakdown component)",
]
code_patterns: [
  "DetailRow component: { label: string, value: string } — owner drawer helper",
  "CommissionDetail extends EnrichedCommission with optional planInfo",
  "Owner drawer: Sheet + reactive useQuery(api.commissions.getCommissionDetail)",
  "Affiliate drawer: Dialog + data via props (no internal query)",
  "Admin table: data via props, no internal query, tenantId from props",
  "BatchDetailClient: client-side filtering/sorting/pagination, commissionCount already exists",
  "nuqs pattern: useQueryState → handleColumnFilterChange → query args object",
  "Effective rate resolution: affiliate.commissionOverrides.find(o => o.campaignId && o.status==='active')?.rate ?? campaign.commissionValue",
  "Batch enrichment: Promise.all(uniqueIds.map(id => ctx.db.get(id))) with Map lookup",
  "Audit logging: logCommissionAuditEvent (entityType='commission') vs logAuditEventInternal (generic)",
]
test_patterns: ["Vitest with .test.ts suffix", "Convex tests in convex/*.test.ts", "No production tests exist (placeholder only)"]
---

# Tech-Spec: Commission Detail Drawer Enhancement — Computation Transparency & Activity Trail

**Created:** 2026-04-09T00:00:00.000Z

## Overview

### Problem Statement

Both the tenant owner's commission detail drawer and the affiliate portal's commission detail dialog display only the final commission amount with no visibility into how it was calculated. Tenant owners cannot verify commission computations (rate, sale amount, overrides, recurring info), trace payout status, review the commission lifecycle, or inspect the source event metadata. Affiliates have even less context. This erodes trust and creates support burden. The admin platform-level commissions table has no detail drawer at all. The payout batch detail page lacks commission-level drill-down for reconciliation.

### Solution

Extend both the owner commission side drawer and affiliate portal dialog with four new information sections: (1) Commission Computation Breakdown showing type, rate, sale amount, override status, and recurring info; (2) Payout Batch Link to the existing batch detail page; (3) Audit Trail Timeline showing commission lifecycle events; (4) Source Event Metadata showing the payment provider event details. Add a commission detail drawer to the admin platform-level commissions table. Enhance the payout batch detail page with a drill-down to the commissions page with a pre-applied batch filter. Backend queries are extended to return computation and event data; no schema migrations required.

### Scope

**In Scope:**
- Extend `getCommissionDetail` query to return computation fields (commissionType, campaignDefaultRate, effectiveRate, isOverride, saleAmount, recurringCommission, recurringRate, recurringRateType) + audit trail entries (embedded)
- Extend `getAffiliateCommissions` query to return computation fields for affiliate portal (commissionType, effectiveRate, saleAmount)
- New `getAdminCommissionDetail` query (admin-scoped, accepts `tenantId`, returns enriched commission with computation + audit)
- Extend `listCommissionsPaginated` to support optional `batchIdFilter` parameter
- **NEW shared `CommissionComputationSection` component** — reusable across owner drawer, affiliate drawer, and admin drawer. Owner/admin variant shows full computation (type, rate, override, sale amount, recurring). Affiliate variant shows simplified (rate earned, sale amount, result) with tooltip.
- Commission Computation Breakdown section in **owner drawer** — **non-collapsible, directly below Amount Hero**
- Commission Computation Breakdown section in **affiliate portal dialog** — shows rate earned + sale amount + result, with "Rate set by program owner" tooltip. No override details.
- Payout Batch link in owner drawer (navigates to `/(auth)/payouts/batches/[batchId]`) — only shown when `batchId` is not null
- Audit Trail Timeline section in owner drawer (collapsible by default, reusing `ActivityTimeline`) — shows "Auto-approved" note when only CREATED event exists
- Source Event Metadata section in owner drawer (collapsible by default; source, transactionId, timestamp) — not rendered if `eventMetadata` is null
- Commission detail drawer for **admin** `RecentCommissionsTable` with computation breakdown + metadata + row click handler
- Extend `ActivityTimeline` component to support commission action types
- Add `batchId` nuqs param to commissions page for batch filter
- Add "View Commissions" button per payout row in batch detail — navigates to `/commissions?batchId=xxx` (tenant owners only; admin batch page is out of scope)

**Out of Scope:**
- Raw webhook payload viewer (not useful for tenant owners)
- Schema migrations (all data is query-time computed from existing tables)
- New audit log creation (logging already exists in the commission engine)
- Commission computation editing/adjustment from drawer
- Admin batch detail page changes
- New `getCommissionsByBatch` query (batch drill-down reuses commissions page with `batchIdFilter` instead)

### Edge Cases & Failure Modes

| Scenario | Behavior |
|----------|----------|
| Conversion has no `amount` (sale amount is 0 or null) | Display "N/A" for sale amount. For flat fee commissions, hide sale amount row entirely. |
| Campaign was deleted after commission creation | Display "Campaign no longer exists" label. Computation fields show "N/A". |
| Affiliate override was deleted/deactivated after commission creation | Computation breakdown shows **current** campaign settings. Add disclaimer: "Shows current campaign settings — actual rate may have differed at time of creation." |
| Recurring commission with `recurringRateType=reduced` but `recurringRate` is null | Display "50% of initial rate" to match engine default logic. |
| Recurring commission with `recurringCommission: true` but both `recurringRate` and `recurringRateType` are null | Display "Uses standard rate (no recurring config set)" — campaign has recurring enabled but no specific recurring parameters. |
| Auto-approved commission (only COMMISSION_CREATED audit event) | Audit timeline shows CREATED event + system note: "Auto-approved — no manual review events." |
| Commission has no `eventMetadata` | Source Event Metadata section is not rendered at all. |
| Commission not yet paid (no `batchId`) | Payout Batch link section is not rendered. |
| Admin commission query with wrong `tenantId` | Security check: validate commission's `tenantId` matches passed `tenantId`, throw access denied. |
| `getCommissionAuditLog` returns no results | Empty state from `ActivityTimeline`: "No activity recorded yet." |

## Context for Development

### Codebase Patterns

- `"use client"` directive required for components using hooks (useState, useQuery, useMutation)
- Client components must be wrapped in `<Suspense>` boundaries in Next.js 16
- Convex queries use `v.*` validators for all args and returns — **returns validator must match actual return exactly**
- UI built on Radix UI primitives with Tailwind CSS v4
- CSS custom properties for theming: `var(--text-heading)`, `var(--text-muted)`, `var(--bg-page)`, `var(--border)`, `var(--border-light)`, `var(--success)`, `var(--danger)`, `var(--warning)`, `var(--info)`
- `DetailRow` component: `{ label: string, value: string }` — owner drawer helper, renders label-value pairs with border separators
- `CommissionDetail extends EnrichedCommission` — owner drawer type, adds optional `planInfo`
- Owner drawer: `Sheet` + reactive `useQuery(api.commissions.getCommissionDetail, selectedCommission ? { commissionId: selectedCommission._id } : "skip")`
- Affiliate drawer: `Dialog` (not `Sheet`) + data via props (no internal query)
- Admin table: data via props, no internal query, `tenantId` from props
- `BatchDetailClient`: client-side filtering/sorting/pagination, `commissionCount` already exists on `BatchPayout`
- nuqs pattern: `useQueryState` → `handleColumnFilterChange` → query args object; page reset via `setPage(1)`
- Effective rate resolution: `affiliate.commissionOverrides?.find(o => o.campaignId === args.campaignId && o.status === "active")?.rate ?? campaign.commissionValue`
- Batch enrichment: `Promise.all(uniqueIds.map(id => ctx.db.get(id)))` with `Map` lookup
- **Two audit insert patterns**: `logCommissionAuditEvent` (entityType="commission", requires affiliateId) and `logAuditEventInternal` (generic, flexible entityType). `getCommissionAuditLog` uses `by_entity` index with `entityType: "commission"` — only catches events from the commission-specific logger.
- `calculateRecurringCommissionAmount` in `commissionEngine.ts` is **dead code** — never called. All commissions (including renewals) use the standard `campaign.commissionValue` rate. The `recurringRate`/`recurringRateType` fields on campaigns are effectively unused at runtime.

### Files to Reference

| File | Purpose | Key Lines |
| ---- | ------- | --------- |
| `convex/commissions.ts` | `getCommissionDetail` — reads commissions + affiliates + campaigns + conversions. Currently does NOT return computation fields. Uses `(commission as any)` for `transactionId` and `batchId`. | 1721-1812 |
| `convex/commissions.ts` | `getAffiliateCommissions` — uses `by_affiliate` index, batch-fetches campaigns/conversions via `Promise.all`. Does NOT return computation fields. | 560-701 |
| `convex/commissions.ts` | `listCommissionsPaginated` — manual page-based pagination (not cursor), 14 filter args, NO `batchIdFilter`. Uses `by_tenant` or `by_tenant_and_status` index. | 1459-1715 |
| `convex/commissions.ts` | `createCommissionFromConversionInternal` — logs `COMMISSION_CREATED` via `logCommissionAuditEvent` (line 292-310). Effective rate resolved inline at line 237-240. | 164-369 |
| `convex/audit.ts` | `getCommissionAuditLog` — uses `by_entity` index (`entityType: "commission"`, `entityId: commissionId`), post-filters by tenant. Returns audit entries with action, actorType, previousValue, newValue, metadata. | 340-382 |
| `convex/audit.ts` | `logCommissionAuditEvent` — internalMutation, inserts with `entityType: "commission"`, requires `affiliateId`. | 300-327 |
| `convex/payouts.ts` | `getBatchPayouts` — returns payout records enriched with affiliate data + `commissionCount` per affiliate. | 546-622 |
| `convex/payouts.ts` | `getBatchCommissionsForAffiliate` — per-affiliate only (requires both batchId AND affiliateId). Fetches ALL batch commissions via `by_batch` index, then JS-filters. | 631-713 |
| `convex/schema.ts` | `commissions` table: `by_batch` index on `batchId` alone (no tenant composite). `batchId` is `v.optional(v.id("payoutBatches"))`. | 377-402 |
| `convex/schema.ts` | `campaigns` table: `commissionType: v.string()`, `commissionValue: v.number()`, `recurringCommission: v.boolean()`, `recurringRate: v.optional(v.number())`, `recurringRateType: v.optional(v.string())`. | 170-186 |
| `convex/schema.ts` | `conversions` table: `amount: v.number()` — this is the sale amount used for percentage commission calculation. | 342-374 |
| `convex/schema.ts` | `auditLogs` table: `by_entity` index on `[entityType, entityId]`. | 431-451 |
| `src/lib/audit-constants.ts` | `COMMISSION_AUDIT_ACTIONS`: CREATED, APPROVED, DECLINED, REVERSED, STATUS_CHANGE. | 12-20 |
| `src/app/(auth)/commissions/page.tsx` | Owner drawer: Sheet (480px), Amount Hero + Commission Details + Fraud Signals sections. `DetailRow` defined at line 1043. 14 nuqs params (no `batchId`). | 784-968, 174-216, 1043-1052 |
| `src/app/portal/earnings/components/CommissionDetailDrawer.tsx` | Affiliate drawer: Dialog (500px), receives `{_id, amount, status, campaignName, createdAt, customerEmail, conversionId}` via props. No internal query. | 1-151 |
| `src/app/portal/earnings/components/CommissionList.tsx` | Parent: uses `getAffiliateCommissions` with `limit: 20`, passes `selectedCommission` (typed `any`) to drawer. No Suspense. | 1-180 |
| `src/app/(admin)/tenants/[tenantId]/_components/RecentCommissionsTable.tsx` | Admin table: receives `{commissions, isLoading, tenantId}` via props. No row click handler. No detail view. Local status config. | 1-174 |
| `src/app/(auth)/payouts/batches/[batchId]/BatchDetailClient.tsx` | Batch detail: `commissionCount` already in `BatchPayout` interface. Has "View" button + detail sheet per row. Client-side filtering. | 80-91, 494-510 |
| `src/components/shared/ActivityTimeline.tsx` | Timeline: `ActivityItem` interface, `actionIcons` map (9 affiliate/email entries), `actionLabels` map (10 entries). No commission actions. | 1-130 |

### Technical Decisions

- **No schema migrations** — all computation data is query-time computed from existing tables
- **Computation breakdown is non-collapsible** — placed directly below Amount Hero in owner drawer
- **Audit trail and Source Event are collapsible** — use existing expandable pattern from batch detail page (ChevronDown icon + `useState` toggle), NOT Radix Accordion. This matches the `showCommissions` toggle pattern already in `BatchDetailClient.tsx`.
- **Audit trail embedded in detail query** — small event count (2-4 typically), avoids N+1 round-trip
- **DB read budget per commission detail open: max 5 reads** — 1 commission + 1 affiliate + 1 campaign + 1 conversion (optional) + 1 audit query (collects from index). Acceptable for on-demand drawer opens, not in a list render.
- **Batch drill-down reuses commissions page** — `/commissions?batchId=xxx` via nuqs, extends `listCommissionsPaginated` with `batchIdFilter`. Trade-off: `batchIdFilter` is an in-memory filter on the `by_tenant` query (no composite `by_tenant_and_batch` index exists). The `by_batch` index is single-field with no tenant scoping. For a batch drill-down, expected results are small (< 500 commissions per batch), so the in-memory approach is acceptable.
- **No new `getCommissionsByBatch` query** — batch drill-down filters the existing commissions page instead
- **Admin drawer needs `getAdminCommissionDetail`** — admin auth pattern verified: uses `requireAdmin(ctx)` from `convex/admin/_helpers.ts` as first line of handler, then scopes data by `tenantId`. The query lives in `convex/admin/tenants.ts` following the existing `getTenantCommissions` pattern. Admin layout at `src/app/(admin)/layout.tsx` provides client-side role guard (`user.role !== "admin"` → redirect).
- **Affiliate portal shows simplified computation** — rate earned + sale amount + result. No override details. "Rate set by program owner" tooltip.
- **Disclaimer on historical accuracy** — computation shows current campaign settings, not snapshot at creation time
- **COMMISSION_CREATED audit already logged** — verified in `createCommissionFromConversionInternal` (line 292-310)
- **`calculateRecurringCommissionAmount` is dead code** — the recurring computation section in the drawer should still display recurring fields from the campaign config, but note that all commissions currently use the standard rate. This is informational transparency, not a recomputation.
- **Extending return validators is additive and non-breaking** — `getCommissionDetail` returns `v.union(v.object({...}), v.null())`. Adding new fields to the object is backward-compatible; existing consumers that destructure specific fields won't break.
- **Shared `CommissionComputationSection` component** — owner, affiliate, and admin drawers all need computation breakdowns. Extract a shared component with a `variant` prop (`"full"` for owner/admin, `"simplified"` for affiliate) to prevent code drift across 3 surfaces.
- **"View Commissions" on batch page is tenant-owner only** — the button navigates to `/commissions?batchId=xxx` which is under `(auth)` requiring tenant owner auth. Admin batch page changes are out of scope.

## Implementation Plan

### Tasks

#### Layer 1: Backend Extensions + Shared Component Foundation (no UI surface dependencies)

- [ ] **Task 1: Extend `ActivityTimeline` with commission action types**
  - File: `src/components/shared/ActivityTimeline.tsx`
  - Action: Add commission-related entries to the `actionIcons` map and `actionLabels` map. New actions:
    - `COMMISSION_CREATED` — icon: `PlusCircle` (var(--info)), label: "Commission Created"
    - `COMMISSION_APPROVED` — icon: `CheckCircle` (var(--success)), label: "Commission Approved"
    - `COMMISSION_DECLINED` — icon: `XCircle` (var(--danger)), label: "Commission Declined"
    - `COMMISSION_REVERSED` — icon: `RotateCcw` (var(--warning)), label: "Commission Reversed"
    - `COMMISSION_STATUS_CHANGE` — icon: `RefreshCw` (var(--info)), label: "Status Changed"
    - `commission_rejected_payment_failed` — icon: `AlertTriangle` (var(--danger)), label: "Payment Failed"
    - `commission_adjusted_upgrade` — icon: `TrendingUp` (var(--info)), label: "Commission Adjusted (Upgrade)"
     - `commission_adjusted_downgrade` — icon: `TrendingDown` (var(--warning)), label: "Commission Adjusted (Downgrade)"
     - `self_referral_detected` — icon: `ShieldAlert` (var(--danger)), label: "Self-Referral Detected"
     - `fraud_alert_email_failed` — icon: `Mail` (var(--danger)), label: "Fraud Alert Email Failed"
     - `commission_rejected_payment_pending` — icon: `Clock` (var(--warning)), label: "Payment Pending"
     - `commission_rejected_payment_unknown` — icon: `HelpCircle` (var(--warning)), label: "Payment Unknown"
  - Notes: Import icons from `lucide-react`. The fallback behavior already handles unknown actions (renders `activity.action.replace(/_/g, " ")`). No interface changes needed.

- [ ] **Task 2: Extend `getCommissionDetail` with computation fields and embedded audit trail**
  - File: `convex/commissions.ts` (function `getCommissionDetail`, line 1721)
  - Action:
    1. In the return validator's `v.object({...})`, add these new fields:
       - `commissionType: v.string()` — from `campaign.commissionType` ("percentage" or "flatFee")
       - `campaignDefaultRate: v.number()` — from `campaign.commissionValue`
       - `effectiveRate: v.number()` — resolved rate after override check
       - `isOverride: v.boolean()` — whether an affiliate-specific override was applied
       - `saleAmount: v.optional(v.number())` — from `conversion.amount` (the sale/conversion amount)
       - `recurringCommission: v.boolean()` — from `campaign.recurringCommission`
       - `recurringRate: v.optional(v.number())` — from `campaign.recurringRate`
       - `recurringRateType: v.optional(v.string())` — from `campaign.recurringRateType`
       - `auditTrail: v.array(v.object({ _id: v.id("auditLogs"), _creationTime: v.number(), action: v.string(), actorId: v.optional(v.string()), actorType: v.string(), previousValue: v.optional(v.any()), newValue: v.optional(v.any()), metadata: v.optional(v.any()) }))`
    2. In the handler, after fetching `affiliate` and `campaign` (line 1770-1771):
       - Compute `effectiveRate`: `affiliate.commissionOverrides?.find(o => o.campaignId === commission.campaignId && o.status === "active")?.rate ?? campaign.commissionValue`
       - Compute `isOverride`: check if override was found and active
       - Fetch `conversion` if `commission.conversionId` exists (already done at line 1777) — extract `conversion.amount` as `saleAmount`
    3. After all data is fetched, call audit trail query internally:
       ```typescript
       const auditLogs = await ctx.db.query("auditLogs")
         .withIndex("by_entity", q => q.eq("entityType", "commission").eq("entityId", args.commissionId))
         .order("asc").collect();
       const tenantAuditLogs = auditLogs.filter(log => log.tenantId === commission.tenantId);
       ```
       Do NOT call `getCommissionAuditLog` as a separate `ctx.runQuery` (that would be a nested query call — just inline the same logic using `ctx.db` directly within the same transaction).
     4. Return all new fields in the response object. Handle null campaign/affiliate/conversion gracefully — use `"N/A"` strings and `false` for boolean flags when data is missing.
     5. **Remove `(commission as any)` casts** — `batchId` and `transactionId` are properly defined in the schema (lines 393-394). Replace `(commission as any).batchId` with `commission.batchId` and `(commission as any).transactionId` with `commission.transactionId`. These casts were technical debt from before the schema was updated. **Also check `listCommissionsPaginated`** (lines 1621-1622) for identical `(commission as any).batchId` and `(commission as any).transactionId` casts — clean those up too for consistency.
  - Notes: This is a read-only query. **CRITICAL**: When adding new fields to the return validator, ALL existing ~20 fields must be preserved in exact order. The existing return validator has fields: `_id`, `_creationTime`, `tenantId`, `affiliateId`, `campaignId`, `conversionId`, `amount`, `status`, `eventMetadata`, `reversalReason`, `transactionId`, `batchId`, `isSelfReferral`, `fraudIndicators`, `affiliateName`, `affiliateEmail`, `campaignName`, `customerEmail`, `planInfo`, `planEvent`. Add the 9 new fields AFTER `planEvent`. Omitting any existing field causes `ReturnsValidationError`. Total DB index reads per call: 1 commission + 1 affiliate + 1 campaign + 1 conversion (optional) + 1 audit index query = max 5.

- [ ] **Task 3: Extend `getAffiliateCommissions` with computation fields**
  - File: `convex/commissions.ts` (function `getAffiliateCommissions`, line 560)
  - Action:
    1. In the return validator's inner `v.object({...})`, add:
       - `commissionType: v.string()` — from campaign
       - `effectiveRate: v.number()` — resolved rate
       - `saleAmount: v.optional(v.number())` — from conversion
     2. In the handler, the batch enrichment at lines 648-677 fetches campaigns and conversions into `campaignDocs`/`conversionDocs` arrays (via `Promise.all`), then builds `campaignNameMap` (Map<string, string> mapping ID to name) and `conversionEmailMap` (Map<string, string | undefined> mapping ID to email). **These maps only store strings, not full documents.** You need access to full campaign documents for `commissionType` and `commissionValue`. Solution: before the enrichment loop, build a new `campaignDocMap` from the already-fetched `campaignDocs` array:
        ```typescript
        const campaignDocMap = new Map(campaignDocs.filter(Boolean).map((c: any) => [c._id, c]));
        ```
        Then use it in the commission mapping:
        - `commissionType: campaignDocMap.get(c.campaignId)?.commissionType ?? "percentage"`
        - `effectiveRate: affiliate.commissionOverrides?.find(o => o.campaignId === c.campaignId && o.status === "active")?.rate ?? (campaignDocMap.get(c.campaignId)?.commissionValue ?? 0)`
        - `saleAmount: conversionEmailMap.has(c.conversionId) ? (/* need conversion amount — build a conversionDocMap from conversionDocs array, same pattern */) : undefined`
        For sale amount, build a `conversionDocMap` similarly: `const conversionDocMap = new Map(conversionDocs.filter(Boolean).map((c: any) => [c._id, c]));` then `saleAmount: conversionDocMap.get(c.conversionId)?.amount`.
     3. The affiliate override check needs `affiliate.commissionOverrides` — the affiliate is already fetched at line 595 (`ctx.db.get(args.affiliateId)`).
  - Notes: This is additive — existing fields are unchanged. Existing consumers (CommissionList, CommissionItem) only destructure specific fields and won't break.

- [ ] **Task 4: Extend `listCommissionsPaginated` with `batchIdFilter`**
  - File: `convex/commissions.ts` (function `listCommissionsPaginated`, line 1459)
  - Action:
     1. Add `batchIdFilter: v.optional(v.id("payoutBatches"))` to args validator.
     2. Add in-memory filter IMMEDIATELY after the existing `campaignIdFilter` filter (line ~1564) and BEFORE the batch enrichment step (line ~1566) — this is critical to avoid fetching enrichment data for commissions that will be filtered out:
        ```typescript
        if (args.batchIdFilter) {
          commissions = commissions.filter((c: any) => c.batchId === args.batchIdFilter);
        }
        ```
        Note: the variable at this point is `commissions` (not `filtered`). Verify the exact variable name at the insertion point.
     3. No new index needed — this is an in-memory filter on already-fetched data. Placing it before enrichment avoids unnecessary `Promise.all` DB reads on filtered-out records.
  - Notes: Trade-off: fetches up to 10,000 records then filters. Acceptable for batch drill-down where result sets are small.

- [ ] **Task 5: Create `getAdminCommissionDetail` query**
  - File: `convex/admin/tenants.ts`
  - Action:
    1. Add new query function `getAdminCommissionDetail` after the existing `getTenantCommissions` (line ~960).
    2. Args: `{ tenantId: v.id("tenants"), commissionId: v.id("commissions") }`
    3. Handler: First line is `const admin = await requireAdmin(ctx);` (import from `./_helpers`).
    4. Fetch commission via `ctx.db.get(args.commissionId)`. Validate `commission.tenantId === args.tenantId` — throw "Commission not found" on mismatch.
    5. Fetch affiliate, campaign, conversion (same pattern as `getCommissionDetail` in `convex/commissions.ts` lines 1770-1787).
     6. Compute `planEvent` field. The `formatEventType` helper is a private function in `convex/commissions.ts` (line 1317) — it maps source strings to display labels ("webhook" → "Subscription", "manual" → "Manual Entry", etc.). Since `getAdminCommissionDetail` lives in `convex/admin/tenants.ts`, it cannot import this private function. **Solution**: either (a) export `formatEventType` from `convex/commissions.ts` and import it in `convex/admin/tenants.ts`, or (b) inline the mapping directly in the admin handler:
        ```typescript
        const formatEventType = (source: string | undefined) => {
          if (source === "webhook") return "Subscription";
          if (source === "manual") return "Manual Entry";
          if (source === "api") return "API Triggered";
          return source ?? "Event";
        };
        const planEvent = `${campaign?.name ?? "Unknown"} · ${formatEventType(commission.eventMetadata?.source)}`;
        ```
     7. Fetch audit trail (same inline `by_entity` index query as Task 2).
     8. Return all enriched fields + computation fields + audit trail. The return validator must be COMPLETE (Convex has no cross-file validator sharing). Include ALL fields:
        ```typescript
        returns: v.union(
          v.object({
            _id: v.id("commissions"),
            _creationTime: v.number(),
            tenantId: v.id("tenants"),
            affiliateId: v.id("affiliates"),
            campaignId: v.id("campaigns"),
            conversionId: v.optional(v.id("conversions")),
            amount: v.number(),
            status: v.string(),
            eventMetadata: v.optional(v.object({
              source: v.string(),
              transactionId: v.optional(v.string()),
              timestamp: v.number(),
              subscriptionId: v.optional(v.string()),
            })),
            reversalReason: v.optional(v.string()),
            transactionId: v.optional(v.string()),
            batchId: v.optional(v.id("payoutBatches")),
            isSelfReferral: v.optional(v.boolean()),
            fraudIndicators: v.optional(v.array(v.string())),
            affiliateName: v.string(),
            affiliateEmail: v.string(),
            campaignName: v.string(),
            customerEmail: v.optional(v.string()),
            planInfo: v.optional(v.string()),
            planEvent: v.string(),
            // NEW computation fields
            commissionType: v.string(),
            campaignDefaultRate: v.number(),
            effectiveRate: v.number(),
            isOverride: v.boolean(),
            saleAmount: v.optional(v.number()),
            recurringCommission: v.boolean(),
            recurringRate: v.optional(v.number()),
            recurringRateType: v.optional(v.string()),
            // NEW audit trail
            auditTrail: v.array(v.object({
              _id: v.id("auditLogs"),
              _creationTime: v.number(),
              action: v.string(),
              actorId: v.optional(v.string()),
              actorType: v.string(),
              previousValue: v.optional(v.any()),
              newValue: v.optional(v.any()),
              metadata: v.optional(v.any()),
            })),
          }),
          v.null(),
        ),
        ```
     9. Export from `convex/_generated/api.ts` will auto-register.
  - Notes: Follow the exact admin query pattern from `getTenantCommissions` (line 906): `requireAdmin` → `ctx.db.get` → batch enrich → return. Admin auth is enforced at 3 layers: proxy (isAuthed), admin layout (role === "admin"), Convex query (requireAdmin).

#### Layer 2: Shared UI Component

- [ ] **Task 6: Create shared `CommissionComputationSection` component**
  - File: `src/components/shared/CommissionComputationSection.tsx` (NEW)
  - Action: Create a reusable component with two variants:
    - Props interface:
      ```typescript
      interface CommissionComputationProps {
        variant: "full" | "simplified";
        commissionType: string;          // "percentage" | "flatFee"
        effectiveRate: number;
        campaignDefaultRate?: number;    // only for "full" variant
        isOverride?: boolean;            // only for "full" variant
        saleAmount?: number | null;      // undefined = not loaded, null = no sale amount
        amount: number;                  // the final commission amount
        recurringCommission?: boolean;
        recurringRate?: number;
        recurringRateType?: string;
        currency?: string;               // ISO 4217 code, e.g. "USD" or "PHP". Defaults to "PHP".
      }
      ```
    - **Full variant** (owner/admin) renders:
      1. Section header: "Commission Computation" with optional disclaimer text below: "Shows current campaign settings — actual rate may have differed at time of creation." (rendered in `var(--text-muted)`, small text)
      2. Commission Type row: label "Type", value badge — "Percentage" (blue badge) or "Flat Fee" (green badge)
      3. Rate Applied row: label "Rate Applied", value — for percentage: `"XX%"`, for flat fee: `"₱XX.XX"` (formatted currency). If `isOverride` is true, append an amber "Custom Override" badge next to the rate. If `isOverride` is false and `campaignDefaultRate` is provided, show the default rate in muted text: `"XX% (campaign default)"`
      4. Sale Amount row (percentage only, hidden for flat fee): label "Sale Amount", value — `formatCurrency(saleAmount)` or "N/A" if null/undefined
      5. Divider line
      6. Commission row: label "Commission", value — `formatCurrency(amount)` in bold `var(--text-heading)`
       7. Recurring info row (only if `recurringCommission === true`): label "Recurring", value — show rate description based on `recurringRateType`:
          - `"same"` → "Same rate as initial"
          - `"reduced"` with `recurringRate` present → `Reduced (${recurringRate}%)`
          - `"reduced"` with `recurringRate` null → "Reduced (50% of initial)"
          - `"custom"` with `recurringRate` present → `Custom (${recurringRate}%)`
          - `"custom"` with `recurringRate` null → "Custom (same as initial)"
          - null/undefined → "Standard rate (no recurring config)"
          - any other string → fall through to `"Uses standard rate"`
      8. Campaign deleted fallback: if `commissionType` is "N/A" (sentinel from backend when campaign is missing), render "Campaign no longer exists" label instead of all computation rows.
    - **Simplified variant** (affiliate) renders:
      1. Section header: "Commission Computation"
      2. Rate Applied row: label "Rate Applied", value — `"XX%"` or `"₱XX.XX"`
      3. Sale Amount row (percentage only): label "Sale Amount", value — `formatCurrency(saleAmount)` or "N/A"
      4. Divider line
      5. Commission row: label "Commission", value — `formatCurrency(amount)` in bold
      6. Info tooltip icon (Info from lucide-react) next to the header with hover text: "Commission rate set by program owner"
    - Styling: Use existing CSS custom properties. Each row follows the `DetailRow` visual pattern (flex justify-between, label in `var(--text-muted)` 12px, value in `var(--text-heading)` 13px font-semibold). Section wrapped in `rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4` with `mt-4` spacing from previous section.
     - Use `cn()` for conditional classes. Use `formatCurrency()` from `@/lib/format` for money formatting — pass the `currency` prop as the currency argument (e.g., `formatCurrency(amount, currency)`). This defaults to ₱ (PHP) when `currency` is undefined. For the simplified (affiliate) variant, the parent should pass `currency="USD"` to match the affiliate drawer's existing amount display.
   - Notes: Do NOT use the existing `DetailRow` component — it only accepts `string` values. This component needs ReactNode values (badges, tooltips). Replicate the visual pattern inline.
   - **Export**: Use named export: `export function CommissionComputationSection({ ... }: CommissionComputationProps)` — consistent with `ActivityTimeline.tsx` pattern.
   - **Import path for formatCurrency**: `import { formatCurrency } from "@/lib/format"` — NOT `@/lib/affiliate-segments` (that file has a different signature and is not the canonical formatter).

#### Layer 3: UI Surfaces (depend on Layer 1 + Layer 2)

- [ ] **Task 7: Update owner commission drawer with all new sections**
  - File: `src/app/(auth)/commissions/page.tsx`
  - Action:
    1. **Update TypeScript interfaces**: Add new fields from Task 2 to `CommissionDetail` interface: `commissionType`, `campaignDefaultRate`, `effectiveRate`, `isOverride`, `saleAmount`, `recurringCommission`, `recurringRate`, `recurringRateType`, `auditTrail`.
    2. **Add batchId nuqs param**: Add `const [batchIdFilter, setBatchIdFilter] = useQueryState("batchId", parseAsString.withDefault(""));` after the existing nuqs params (line ~216).
     3. **Pass batchIdFilter to query**: In the `listCommissionsPaginated` args object (line ~249), add a validation guard:
        ```typescript
        // Convex IDs start with "j" — basic format validation to prevent
        // malformed URL params from breaking the entire page query.
        // If invalid, pass undefined (filter is silently ignored).
        const safeBatchId = batchIdFilter && batchIdFilter.startsWith("j") ? batchIdFilter as Id<"payoutBatches"> : undefined;
        ```
        Then in the args: `batchIdFilter: safeBatchId,`
        This prevents garbage like `?batchId=foobar` from causing a Convex runtime error that breaks the entire commissions page.
     4. **Add batchId to filter handling**: In `handleColumnFilterChange` (line ~374), add a case for `batchId`:
        ```typescript
        case "batchId":
          setBatchIdFilter((filter as any).value ?? "");
          break;
        ```
        Also in the active keys clearing section (after the switch block, ~line 406), add:
        ```typescript
        if (!activeKeys.has("batchId")) {
          setBatchIdFilter("");
        }
        ```
        In `handleClearAllFilters`, add `setBatchIdFilter("");` to the list of resets.
     5. **Show active batchId filter badge**: In the `activeFilters` useMemo (line ~293), add a condition: if `batchIdFilter`, push `{ columnKey: "batchId", label: "Batch Filter" }` to the array. **CRITICAL**: Also add `batchIdFilter` to the `useMemo` dependency array (line ~331). The existing deps are `[statusFilter, campaignFilter, searchQuery, amountMin, amountMax, dateAfter, dateBefore, affiliateSearch, customerSearch, planEventSearch]` — append `batchIdFilter`. Without this, the badge won't appear until another filter triggers a re-render (stale closure).
     6. **Update `handleRemoveFilter`** (line ~334): Add a case for removing the batchId badge:
        ```typescript
        case "batchId":
          setBatchIdFilter("");
          break;
        ```
     7. **Insert Computation Breakdown section** (NON-COLLAPSIBLE) inside the drawer body, directly after the "Amount Hero" section and BEFORE the "Commission Details" section:
       ```tsx
        {effectiveDetail && (
          <CommissionComputationSection
            variant="full"
            commissionType={effectiveDetail.commissionType ?? "N/A"}
            effectiveRate={effectiveDetail.effectiveRate ?? 0}
            campaignDefaultRate={effectiveDetail.campaignDefaultRate}
            isOverride={effectiveDetail.isOverride}
            saleAmount={effectiveDetail.saleAmount ?? null}
            amount={effectiveDetail.amount}
            recurringCommission={effectiveDetail.recurringCommission}
            recurringRate={effectiveDetail.recurringRate}
            recurringRateType={effectiveDetail.recurringRateType}
            currency="PHP"
          />
        )}
       ```
    7. **Insert Payout Batch link** inside the drawer body, after the "Commission Details" section:
       ```tsx
       {effectiveDetail?.batchId && (
         <div className="mt-4">
           <Link href={`/payouts/batches/${effectiveDetail.batchId}`} className="flex items-center gap-2 text-[13px] text-[var(--primary)] hover:underline">
             <Package className="h-4 w-4" />
             View Payout Batch
           </Link>
         </div>
       )}
       ```
     8. **Insert Audit Trail section** (COLLAPSIBLE, collapsed by default) after the Payout Batch link. Use the expandable pattern:
        - State: `const [showAuditTrail, setShowAuditTrail] = useState(false);`
        - **Reset on commission change**: Add `useEffect(() => { setShowAuditTrail(false); setShowSourceEvent(false); }, [selectedCommission?._id]);` to reset collapsible sections when the drawer opens with a different commission. This prevents stale expanded states from carrying over.
       - Header: clickable div with ChevronDown/ChevronRight icon + "Activity Timeline" label
       - Body: when expanded, render `<ActivityTimeline activities={effectiveDetail.auditTrail ?? []} />`
       - If `auditTrail` has exactly 1 entry and action is "COMMISSION_CREATED", show a system note: "Auto-approved — no manual review events."
       - Wrap in `rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4` container.
    9. **Insert Source Event Metadata section** (COLLAPSIBLE, collapsed by default) after the Audit Trail section:
       - State: `const [showSourceEvent, setShowSourceEvent] = useState(false);`
       - Only render if `effectiveDetail.eventMetadata` is not null/undefined.
       - Header: clickable div with ChevronDown/ChevronRight + "Source Event" label
       - Body: when expanded, render DetailRows for:
         - Source: `effectiveDetail.eventMetadata.source`
         - Transaction ID: `effectiveDetail.eventMetadata.transactionId ?? "N/A"`
          - Timestamp: `formatDetailDate(new Date(effectiveDetail.eventMetadata.timestamp))` — use the `formatDetailDate` function defined locally in `commissions/page.tsx` (line ~840). If it doesn't exist, use: `new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })`.
    10. Add import for `CommissionComputationSection` from `@/components/shared/CommissionComputationSection`.
    11. Add imports for `Package`, `ChevronDown`, `ChevronRight` from `lucide-react`.
    12. Add import for `Link` from `next/link`.
  - Notes: The drawer structure is: Header → Amount Hero → **Computation Breakdown (NEW)** → Commission Details → **Payout Batch Link (NEW)** → Fraud Signals → **Audit Trail (NEW, collapsible)** → **Source Event (NEW, collapsible)** → Footer (actions).

- [ ] **Task 8: Update affiliate commission drawer with computation breakdown**
  - File: `src/app/portal/earnings/components/CommissionDetailDrawer.tsx`
  - Action:
    1. **Update props interface**: Extend the `commission` prop type to include `commissionType`, `effectiveRate`, `saleAmount`.
       ```typescript
       commission: {
         _id: string; amount: number; status: string; campaignName: string;
         createdAt: number; customerEmail?: string; conversionId?: string;
         commissionType?: string; effectiveRate?: number; saleAmount?: number | null;
       } | null;
       ```
    2. **Replace raw `<button>` close X** with `<Button variant="ghost" size="icon" asChild>` (line 59-64) — fixes AGENTS.md violation.
    3. **Insert Computation Breakdown section** (NON-COLLAPSIBLE) after the amount/status header and BEFORE the "Under Review" info section:
       ```tsx
       {commission && (
          <CommissionComputationSection
            variant="simplified"
            commissionType={commission.commissionType ?? "percentage"}
            effectiveRate={commission.effectiveRate ?? 0}
            saleAmount={commission.saleAmount ?? null}
            amount={commission.amount}
            currency="USD"
          />
       )}
       ```
    4. Add import for `CommissionComputationSection` from `@/components/shared/CommissionComputationSection`.
    5. Add import for `Button` from `@/components/ui/button`.
   - Notes: The parent `CommissionList.tsx` passes `selectedCommission` (typed `any`) — no prop type changes needed there since the computation fields will be present on the query result objects. **Pre-existing issue**: `CommissionList.tsx` uses `useQuery` (line 31) but its parent `earnings/page.tsx` does NOT wrap it in `<Suspense>`. Adding query fields increases the data payload which may worsen the "Blocking Route" risk. Fix as a follow-up (not blocking for this spec).

- [ ] **Task 9: Add commission detail drawer to admin RecentCommissionsTable**
  - File: `src/app/(admin)/tenants/[tenantId]/_components/RecentCommissionsTable.tsx`
  - Action:
    1. **Update props interface**: Keep existing `Commission` interface (minimal fields for table columns). The detail query fetches full data separately.
    2. **Add state** for drawer:
       ```typescript
       const [selectedCommissionId, setSelectedCommissionId] = useState<string | null>(null);
       const [isDrawerOpen, setIsDrawerOpen] = useState(false);
       ```
    3. **Add detail query** (reactive):
       ```typescript
       const adminDetail = useQuery(
         api.admin.tenants.getAdminCommissionDetail,
         selectedCommissionId ? { tenantId, commissionId: selectedCommissionId as Id<"commissions"> } : "skip"
       );
       ```
    4. **Wire row click handler**: Add to DataTable:
       ```tsx
       <DataTable<Commission>
         // ... existing props
         onRowClick={(row) => { setSelectedCommissionId(row._id); setIsDrawerOpen(true); }}
       />
       ```
    5. **Add cursor style**: Add `cursor-pointer` to row cells or pass `rowClassName="cursor-pointer"` to DataTable if supported.
     6. **Add Sheet component** for the detail drawer (same pattern as owner drawer — Sheet from `@/components/ui/sheet`, 480px width):
        - SheetHeader: "Commission Detail" + description showing affiliateName — campaignName
        - Amount Hero: same pattern as owner drawer (large amount + status badge)
        - CommissionComputationSection (variant="full") with all computation fields from `adminDetail`, currency="PHP"
        - Commission Details section using DetailRow-style rows for: Affiliate, Campaign, Date Created
        - Source Event section (if `adminDetail.eventMetadata` exists)
        - Audit Trail section (collapsible, with ActivityTimeline)
        - **NO Payout Batch link** — the batch detail page is under `(auth)` which requires tenant owner auth; admin users would get redirected. This link is omitted from the admin drawer.
        - NO action buttons (admin cannot approve/decline tenant commissions from this view)
        - Loading skeleton while `adminDetail === undefined`
     7. **CRITICAL: Suspense boundary** — Per AGENTS.md, client components using `useQuery` MUST be wrapped in `<Suspense>`. The parent `OverviewTab` component (which imports `RecentCommissionsTable`) does NOT wrap it in `<Suspense>`. Adding `useQuery` inside `RecentCommissionsTable` without Suspense will cause the Next.js 16 "Blocking Route" error. **Solution**: Extract the admin drawer (Sheet + `useQuery` + state) into a separate component, e.g., `AdminCommissionDrawer.tsx`, placed alongside `RecentCommissionsTable.tsx`. Then in `RecentCommissionsTable`, import and render it wrapped in `<Suspense fallback={<div className="h-[300px]" />}`>`. This is the cleanest approach — the table itself doesn't change its hooks, only the new drawer is lazy-loaded.
     8. **Status badge config**: Use the owner page's `commissionStatusConfig` (from `src/app/(auth)/commissions/page.tsx`) for consistent styling. Do NOT use the local inline config from this file (it has inconsistent colors like `paid` = blue vs owner's gray). Import or copy the owner's config into the admin drawer.
     9. Add imports: `Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription` from `@/components/ui/sheet`, `Suspense`, `Skeleton`, `CommissionComputationSection`, `ActivityTimeline`, `useQuery`, `api` from `@/convex/_generated/api`, `Id` from `@/convex/_generated/dataModel`.
  - Notes: The admin drawer is read-only (no approve/decline actions). It reuses the `CommissionComputationSection` and `ActivityTimeline` shared components. The admin query is already scoped by `tenantId` via `requireAdmin`.

- [ ] **Task 10: Add "View Commissions" button to batch detail page + commissions page batchId support**
  - File: `src/app/(auth)/payouts/batches/[batchId]/BatchDetailClient.tsx`
  - Action:
    1. **Add "View Commissions" button** to the existing columns array (after the "action" column, line ~510):
       ```typescript
       {
         key: "viewCommissions",
         header: "",
         align: "right",
         cell: (row: BatchPayout) => (
           <Button
             variant="ghost"
             size="sm"
             onClick={(e) => { e.stopPropagation(); router.push(`/commissions?batchId=${row.payoutId}`); }}
           >
             View Commissions
           </Button>
         ),
       },
       ```
        Wait — the button should use `batchId` (not `payoutId`). The `batchId` is already available as a prop/param in the component. Use `router.push(\`/commissions?batchId=${batchId}\`)`.
        **Important**: This shows ALL commissions for the entire batch (across all affiliates), NOT just this affiliate's commissions. This is intentional — the batch page drill-down is for full batch reconciliation. Label could optionally be "View All Commissions" for clarity.
    2. Add import for `Button` from `@/components/ui/button` and `useRouter` from `next/navigation` (if not already imported).
  - File: `src/app/(auth)/commissions/page.tsx` (this part may already be done in Task 7 — verify)
  - Action: Ensure the `batchIdFilter` nuqs param is correctly passed to `listCommissionsPaginated` and the active filter badge shows when navigating from the batch page. When the user arrives at `/commissions?batchId=xxx`, the DataTable should show only commissions from that batch with a visible filter badge showing "Batch Filter" with an X to clear.
  - Notes: The `e.stopPropagation()` on the button click prevents the row's `onRowClick` (which opens the payout detail sheet) from also firing.

### Acceptance Criteria

- [ ] **AC 1**: Given a tenant owner opens the commission detail drawer for a percentage commission, when the drawer loads, then the Computation Breakdown section displays commission type ("Percentage"), the effective rate applied, the sale amount, a divider, and the final commission amount — all below the Amount Hero and above Commission Details.

- [ ] **AC 2**: Given a commission was created with an affiliate-specific override rate, when the owner views the commission drawer, then the Computation Breakdown shows "Custom Override" badge next to the rate, and the campaign default rate is displayed in muted text.

- [ ] **AC 3**: Given a flat fee commission, when the owner views the commission drawer, then the Sale Amount row is hidden and the rate displays as a currency amount (not percentage).

- [ ] **AC 4**: Given a commission whose campaign has been deleted, when the owner views the drawer, then the Computation Breakdown shows "Campaign no longer exists" instead of computation rows, and a disclaimer about current settings is displayed.

- [ ] **AC 5**: Given a recurring commission campaign, when the owner views the drawer, then the Computation Breakdown includes a "Recurring" row showing the rate type description (Same/Reduced/Custom).

- [ ] **AC 6**: Given an affiliate opens their commission detail dialog, when the dialog loads, then the simplified Computation Breakdown shows rate earned, sale amount, and final amount — with NO override details and an info tooltip "Commission rate set by program owner".

- [ ] **AC 7**: Given a commission that has been paid (has `batchId`), when the owner views the drawer, then a "View Payout Batch" link is rendered that navigates to `/(auth)/payouts/batches/[batchId]`.

- [ ] **AC 8**: Given a commission that has NOT been paid (no `batchId`), when the owner views the drawer, then no payout batch link is rendered.

- [ ] **AC 9**: Given a commission with audit trail events, when the owner expands the "Activity Timeline" collapsible section, then all audit events are displayed in chronological order using the ActivityTimeline component with appropriate icons and labels for commission action types.

- [ ] **AC 10**: Given an auto-approved commission (only COMMISSION_CREATED audit event), when the owner expands the Activity Timeline, then the single CREATED event is shown along with a system note "Auto-approved — no manual review events."

- [ ] **AC 11**: Given a commission with `eventMetadata`, when the owner expands the "Source Event" collapsible section, then the source, transaction ID, and timestamp are displayed.

- [ ] **AC 12**: Given a commission without `eventMetadata`, when the owner views the drawer, then the Source Event section is not rendered at all.

- [ ] **AC 13**: Given an admin user viewing a tenant's commissions table, when they click a commission row, then a detail drawer opens showing the computation breakdown, source event metadata, and audit trail — all scoped to the tenant.

- [ ] **AC 14**: Given an admin commission detail query with a `tenantId` that doesn't match the commission's `tenantId`, when the query is called, then it throws an access denied error.

- [ ] **AC 15**: Given a tenant owner viewing a payout batch detail page, when they click "View Commissions" on a payout row, then they are navigated to `/commissions?batchId=xxx` with only commissions from that batch displayed.

- [ ] **AC 16**: Given the commissions page has a `batchId` URL parameter, when the page loads, then the DataTable shows a "Batch Filter" badge in the active filters area that can be cleared.

- [ ] **AC 17**: Given the "View Commissions" button on the batch page is clicked, when the click event fires, then `e.stopPropagation()` prevents the row's detail sheet from also opening.

- [ ] **AC 18**: Given any commission detail drawer open, when all data loads successfully, then the total number of Convex DB index reads does not exceed 5 per drawer open for owner/affiliate drawers (1 commission get + 1 affiliate get + 1 campaign get + 1 conversion get + 1 auditLogs index query). For the admin drawer, `requireAdmin(ctx)` adds 1 extra read (admin user lookup) = max 6 total. Note: Convex counts each index range read as 1 read regardless of result count — a `.collect()` returning 100 documents still counts as 1 read.

- [ ] **AC 19**: Given the `getAffiliateCommissions` query returns computation fields, when the existing `CommissionList` and `CommissionItem` components render, then they continue to work without errors (backward compatibility).

- [ ] **AC 20**: Given the affiliate drawer close button, when rendered, then it uses `<Button variant="ghost" size="icon">` instead of a raw `<button>` tag (AGENTS.md compliance).

- [ ] **AC 21**: Given a commission where the affiliate's override was deactivated after commission creation, when the owner views the drawer, then the Computation Breakdown shows the current campaign default rate (not the historical override rate) and displays the disclaimer "Shows current campaign settings — actual rate may have differed at time of creation."

## Additional Context

### Dependencies

- Existing `getCommissionDetail` query (already returns enriched commission data from 4 tables)
- Existing `getCommissionAuditLog` query (already returns audit entries per commission via `by_entity` index)
- Existing `ActivityTimeline` component (needs 6+ new action type entries in icons/labels maps)
- Existing payout batch detail page at `/(auth)/payouts/batches/[batchId]/`
- Existing commissions page at `/commissions` with 14 nuqs filter params and `DataTable` infrastructure
- `by_batch` index already exists on `commissions` table (single-field index, no tenant composite)
- `by_entity` index already exists on `auditLogs` table (`[entityType, entityId]`)

### Testing Strategy

**No automated tests** — this project has no production tests (placeholder only per `test_patterns`). Manual testing is the verification method.

**Manual testing checklist (per surface):**

1. **Owner drawer** — Open 5+ commissions: percentage, flat fee, override, recurring, deleted campaign, no eventMetadata, paid (with batchId), unpaid (no batchId). Verify each section renders correctly. Expand/collapse audit trail and source event. Click payout batch link.
2. **Affiliate drawer** — Open 3+ commissions: percentage, flat fee, one with missing sale amount. Verify simplified computation renders. Verify tooltip appears. Verify close button uses `<Button>`.
3. **Admin drawer** — Navigate to a tenant's overview tab. Click 3+ commission rows. Verify detail drawer opens with computation breakdown, audit trail, source event. Verify no action buttons appear.
4. **Batch page "View Commissions"** — Open a batch detail page. Click "View Commissions" on a payout row. Verify navigation to `/commissions?batchId=xxx`. Verify the commissions page shows only batch commissions with a "Batch Filter" badge. Clear the filter and verify all commissions return.
5. **Backward compatibility** — Load the affiliate portal earnings page. Verify commissions list renders without errors. Verify the commissions page loads without errors when no `batchId` param is present.

**Edge cases to manually verify:**
- Commission with `saleAmount: null` — should show "N/A"
- Commission with deleted campaign — should show "Campaign no longer exists"
- Flat fee commission — sale amount row should be hidden
- Auto-approved commission — audit timeline should show single event + auto-approved note
- Commission with no `eventMetadata` — source event section should not render
- Commission with no `batchId` — payout batch link should not render

### Notes

- The commission amount computation logic is in `createCommissionFromConversionInternal` (line 164 of `convex/commissions.ts`) — the drawer doesn't recompute, it displays the inputs that were used
- `batchId` is already stored on commissions and already in the `getCommissionDetail` return validator — just needs to be rendered as a link
- The affiliate portal drawer receives commission data directly from the parent `CommissionList` (no separate detail query) — the parent query `getAffiliateCommissions` must be extended to include computation fields
- The commissions page already uses `nuqs` for URL-persisted filters — adding `batchId` follows the same pattern
- `getCommissionAuditLog` uses `by_entity` index which is `["entityType", "entityId"]` — it will only find entries where `entityType === "commission"`. Entries from `logAuditEventInternal` with different `entityType` values (e.g., "payment", "conversion") won't appear.
- Owner drawer's `DetailRow` only accepts `{ label: string, value: string }` — the new `CommissionComputationSection` is a separate component that renders ReactNode values (colored badges, tooltips, dividers)
- The admin `RecentCommissionsTable` uses a local inline `commissionStatusConfig` that differs from the owner page's config (e.g., `paid` uses blue vs gray). The admin drawer should use consistent styling — prefer the owner page's config or extract to shared.
- **Admin auth pattern verified**: uses `requireAdmin(ctx)` from `convex/admin/_helpers.ts` as first line of handler. Admin layout at `src/app/(admin)/layout.tsx` provides client-side role guard. The query lives in `convex/admin/tenants.ts` following the `getTenantCommissions` pattern.
- Extending `getAffiliateCommissions` return shape is additive — existing list components only destructure specific fields. Adding new computation fields won't break existing consumers.
- `commissionStatusConfig` consistency: owner drawer, admin drawer, and batch detail page each have local inline configs. Consider extracting to a shared constant (e.g., in `src/lib/commission-status.ts`) as a follow-up. Not blocking for this spec.
- **High-risk items from pre-mortem**: (1) Computation breakdown must be non-collapsible — if it's hidden behind a toggle, users will miss it. (2) Admin drawer click handler must be explicitly wired — the table currently has no row click. (3) `calculateRecurringCommissionAmount` is dead code — the drawer shows recurring config from the campaign, but at runtime all commissions use the standard rate.
- **Known limitation**: The `by_batch` index on commissions is single-field (no tenant composite). The `batchIdFilter` in `listCommissionsPaginated` is an in-memory filter. For tenants with very large commission volumes (>10K), the batch drill-down may be slow.
- **Future considerations**: (1) Extract `commissionStatusConfig` to shared constant. (2) Store `webhookId` on commissions at creation time for future raw payload linking. (3) Consider a schema migration to add `commissionType`, `effectiveRate`, and `saleAmount` directly to the `commissions` table for historical accuracy (current approach shows live data, not point-in-time).
