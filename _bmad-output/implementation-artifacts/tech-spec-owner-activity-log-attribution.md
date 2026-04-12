---
title: "SaaS Owner Activity Log & Attribution Investigation Hub"
slug: "owner-activity-log-attribution"
created: "2026-04-12"
status: "implementation-complete"
stepsCompleted: [1, 2, 3, 4, 5]
reviewed: "2026-04-12"
tech_stack: ["Next.js 16.1", "Convex 1.35", "TypeScript 5.9", "Tailwind CSS 4.1", "Radix UI", "React 19.2", "Better Auth 1.5"]
files_to_modify:
  - "convex/schema.ts"
  - "convex/clicks.ts"
  - "convex/conversions.ts"
  - "convex/commissionEngine.ts"
  - "convex/commissions.ts"
  - "convex/audit.ts"
  - "src/app/(auth)/activity-log/page.tsx"
  - "src/app/(auth)/activity-log/ActivityLogClient.tsx"
  - "src/app/(auth)/activity-log/components/EntityStoryDrawer.tsx"
  - "src/app/(auth)/activity-log/components/AuditLogEntry.tsx"
  - "src/components/shared/Sidebar.tsx"
  - "src/components/shared/ActivityTimeline.tsx"
  - "src/lib/audit-constants.ts"
code_patterns:
  - "Paginated Convex queries with paginationOptsValidator"
  - "Tenant-scoped queries via getAuthenticatedUser(ctx)"
  - "FilterTabs component for action type filtering"
  - "auditLogs direct insert pattern: ctx.db.insert('auditLogs', {...})"
  - "Internal mutations for audit logging (logAuditEventInternal, logCommissionAuditEvent, logPayoutAuditEvent)"
  - "ActivityTimeline component with actionIcons and actionLabels lookup maps"
  - "Actor name enrichment pattern (join users table in query handler)"
  - "Payout audit tab pattern: FilterTabs + paginated list + expandable metadata details"
  - "Non-fatal audit writes: try/catch wrapping so audit failures never break business logic"
test_patterns: ["Vitest with convex test setup", "Mock Convex ctx for mutation testing", "Test files use .test.ts suffix", "No production tests exist (placeholder only)"]
---

# Tech-Spec: SaaS Owner Activity Log & Attribution Investigation Hub

**Created:** 2026-04-12
**Reviewed:** 2026-04-12 (adversarial review — 21 findings addressed)

## Overview

### Problem Statement

SaaS owners (Alex) have no dedicated page to investigate what happened to a specific commission, payout, affiliate, or click. Audit data exists in the `auditLogs` table for commission lifecycle, payout events, and affiliate status changes — but there's no unified investigation hub, and critical decision points in the tracking pipeline are invisible. When an affiliate asks "Why was I only paid for 2 of my 5 commissions?" or "I sent 100 clicks but only got 2 conversions — what happened?", Alex currently has to manually piece together the story across multiple pages, and for click/conversion questions, the data simply doesn't exist as audit records.

### Solution

Build a new `/activity-log` page in the SaaS owner dashboard that provides a unified, filterable feed of all tenant audit events. Simultaneously, add audit trail logging to the click tracking and conversion attribution pipelines so that click deduplication, conversion matching, and attribution decisions are recorded. Wire it all together with an "Entity Story View" that lets Alex trace the full journey from click → conversion → commission for any entity. Note: the chain stops at commission because payouts are linked to affiliates, not individual commissions (see Technical Decision #3).

### Scope

**In Scope:**
- **Activity Log Page** (`/activity-log`):
  - Universal feed of all tenant audit events (commissions, payouts, affiliates, security, clicks, conversions, attribution decisions)
  - Entity type filter tabs (All, Commissions, Payouts, Affiliates, Clicks & Conversions, Security)
  - Action type filter dropdown
  - Date range filter (Last 7 days, 30 days, 90 days, Custom)
  - Clickable entity IDs → open entity story drawer
  - "Explain this" expand on any log entry → full metadata in human-readable form
  - Mobile-responsive layout

- **Click & Conversion Audit Trail Logging** (new backend):
  - Log click events to `auditLogs` when: click is tracked, click is deduplicated/rejected
  - Log conversion events to `auditLogs` when: conversion status changed, subscription status changed, legacy conversion created
  - Log attribution decisions: which click was matched to which conversion and why, or why no match was found
  - New `entityType` values: `"click"`, `"conversion"`, `"attribution"`

- **Attribution Trail / Entity Story View**:
  - Entity Story View component: given any entity ID, show chronological timeline of all related events
  - Chain resolution: click → conversion → commission (forward) or commission → conversion → click (reverse)
  - Payouts are NOT chain-resolvable from commissions (payouts link to affiliates, not commissions)
  - Manual commissions (no conversion) and organic conversions (no click) handled with graceful degradation

- **Infrastructure:**
  - Two new compound indexes on `auditLogs` for efficient filtered queries
  - New unified Convex query `audit.listTenantAuditLogs` (paginated, indexed filtering)
  - New `audit.getEntityStory` query to fetch all related audit entries for any entity
  - Hardcoded `KNOWN_AUDIT_ACTIONS` list for frontend filter dropdown (no runtime scan)
  - Sidebar navigation entry under "Program" section
  - Extend `ActivityTimeline` with new action icons/labels
  - Extend action constants in `audit-constants.ts`

**Out of Scope:**
- Webhook decision audit trail logging (separate future feature)
- Export to CSV (future enhancement)
- Admin-side changes (admin already has `/audit`)
- New database tables (using existing `auditLogs` table — only adding indexes)
- Changes to the affiliate portal (SaaS owner-facing only)
- Modifications to the commission engine business logic (only adding audit logging calls)
- Commission→payout chain navigation (payouts lack commissionId foreign key — architectural limitation)

## Context for Development

### Codebase Patterns

**Audit Logging Pattern (backend):**
- Generic events: use `internal.audit.logAuditEventInternal` (tenantId, action, entityType, entityId, actorId?, actorType, previousValue?, newValue?, metadata?)
- Commission events: use `internal.audit.logCommissionAuditEvent` (requires commissionId + affiliateId)
- Payout events: use `internal.audit.logPayoutAuditEvent` (entityType is caller-specified: "payouts" or "payoutBatches")
- Security events: use `internal.audit.logSecurityEvent` (auto-resolves actor from auth)
- Inline direct insert: `ctx.db.insert("auditLogs", {...})` used in tenants.ts, clicks.ts, circuitBreakers.ts
- Actor types: `"user"`, `"system"`, `"webhook"`, `"unauthenticated"`
- **Non-fatal audit writes** (new pattern for this feature): All audit log insertions in Tasks 2-10 MUST be wrapped in try/catch. Audit logs are informational — a failed audit insert must NEVER break the underlying business operation (click tracking, conversion creation, commission generation).

**Frontend Audit Display Pattern:**
- Payout audit tab in `PayoutsClient.tsx` is the reference implementation
- Uses `<FilterTabs>` component with action-type tabs
- Paginated via `paginationOptsValidator` (20 items per page)
- Each entry shows: icon, action label, entity type badge, timestamp, actor name, metadata preview
- Expandable `<details>` block for raw metadata JSON
- Three states: loading skeletons, empty state, populated list with pagination buttons
- Commission detail drawer uses `<ActivityTimeline>` with `actionIcons` and `actionLabels` lookup maps

**Action String Convention:**
- ~90% of existing actions use `lower_snake_case` (e.g., `click_recorded`, `payout_batch_generated`, `affiliate_approved`)
- Commission actions are the exception: `UPPER_SNAKE_CASE` (e.g., `COMMISSION_CREATED`, `COMMISSION_APPROVED`) — legacy decision, do not change
- New click/conversion/attribution actions MUST follow `lower_snake_case` for consistency

**Existing Audit Gaps (12 decision points with NO audit logging):**
1. `clicks.ts` function `trackClickInternal` — Duplicate click detected (returns early, no log)
2. `commissionEngine.ts` function `processPaymentUpdatedToCommission` — No attribution data → organic
3. `commissionEngine.ts` function `processPaymentUpdatedToCommission` — Affiliate invalid/inactive → organic
4. `commissionEngine.ts` function `processPaymentUpdatedToCommission` — Referral link not found → organic
5. `commissionEngine.ts` function `processPaymentUpdatedToCommission` — No campaign → commission skipped
6. `commissions.ts` function `createCommissionFromConversionInternal` — Campaign cannot earn → null
7. `commissions.ts` function `createCommissionFromConversionInternal` — Campaign not found → null
8. `commissions.ts` function `createCommissionFromConversionInternal` — Affiliate not found → null
9. `conversions.ts` function `createConversion` — Legacy path has zero audit logging
10. `conversions.ts` function `updateConversionStatus` — No audit logging
11. `conversions.ts` function `updateConversionSubscriptionStatusInternal` — No audit logging
12. `commissionEngine.ts` function `processPaymentUpdatedToCommission` — Click matching result not logged

**Critical architectural constraint:** Each of these gaps exists in 3 copies (one per event type: `payment.updated`, `subscription.created`, `subscription.updated`). The commission engine has a "3-copy waterfall" pattern where the same attribution logic is duplicated across three internal actions.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `convex/schema.ts:451-471` | `auditLogs` table definition. **CHANGES NEEDED:** Add two compound indexes (Task 0) |
| `convex/audit.ts` | All audit logging mutations and queries. Add new queries + action constants |
| `convex/clicks.ts` function `trackClickInternal` | Click tracking + dedup. Add audit log for duplicate clicks |
| `convex/conversions.ts` functions `createConversion`, `updateConversionStatus`, `updateConversionSubscriptionStatusInternal` | Add audit logging |
| `convex/commissionEngine.ts` functions `processPaymentUpdatedToCommission`, `processSubscriptionCreatedEvent`, `processSubscriptionUpdatedEvent` | Add attribution audit at 4 decision points × 3 copies each |
| `convex/commissions.ts` function `createCommissionFromConversionInternal` | Add audit logs at 3 early-return points |
| `src/app/(auth)/activity-log/page.tsx` | NEW — Activity Log page |
| `src/app/(auth)/activity-log/ActivityLogClient.tsx` | NEW — Main client component |
| `src/app/(auth)/activity-log/components/EntityStoryDrawer.tsx` | NEW — Entity story drawer |
| `src/app/(auth)/activity-log/components/AuditLogEntry.tsx` | NEW — Individual log entry component |
| `src/components/shared/Sidebar.tsx` | Add nav entry |
| `src/components/shared/ActivityTimeline.tsx` | Extend icons/labels |
| `src/lib/audit-constants.ts` | Add action constants |
| `src/app/(auth)/payouts/PayoutsClient.tsx` | Reference implementation for audit display |

### Technical Decisions

1. **Schema changes: two compound indexes added** — The original "no schema changes" decision was incorrect. Efficient filtered queries require compound indexes. Adding `by_tenant_entity [tenantId, entityType]` and `by_tenant_created [tenantId, _creationTime]` to `auditLogs`. No field changes — only indexes. This is a backward-compatible schema change (Convex auto-indexes new writes, old documents remain queryable via existing indexes).
2. **Commission→payout chain is NOT resolvable** — Payouts are linked to affiliates via `affiliateId`, not to individual commissions. There is no `commissionId` on the `payouts` table. The entity story chain resolves: click → conversion → commission (forward) or commission → conversion → click (reverse). Payouts are shown only when viewing an entity of type `"payouts"` or `"payoutBatches"` directly. When viewing a commission, the entity story shows a "Payouts are tracked per affiliate, not per commission" informational note instead of a chain link.
3. **New action strings follow `lower_snake_case`** — Consistent with 90%+ of existing actions. Commission actions (`UPPER_SNAKE_CASE`) are the legacy exception — do not change them.
4. **Non-fatal audit writes** — All audit log insertions MUST be wrapped in try/catch. In Convex, a failed write in a mutation rolls back ALL writes in that mutation. If an audit insert fails (e.g., validation error), it would roll back the business insert too (conversion, commission, etc.). This is unacceptable — audit logs are informational, not critical. The try/catch ensures the business operation always succeeds even if the audit log fails.
5. **`listTenantAuditLogs` uses indexed filtering** — Uses `by_tenant_entity` index when `entityType` is provided (not post-filtering). Uses `by_tenant_created` for date range filtering. Falls back to `by_tenant` with `.paginate()` for "All" tab. No `.take()` cap on the base query — pagination handles result set size.
6. **`getActivityLogActionTypes` is a hardcoded list** — No runtime scan of auditLogs. A `KNOWN_AUDIT_ACTIONS` constant array is defined in `audit.ts` containing all known action strings. The query simply returns this list. This is deterministic, O(1), and always complete.
7. **Shared attribution audit helper** — A new `logAttributionDecision` internal mutation in `audit.ts` centralizes attribution audit logging. Commission engine tasks call this helper instead of inline inserts, ensuring all 3 copies stay consistent.
8. **Actor name enrichment handles deleted actors** — When enriching audit log entries with actor names, if the actor user record is not found (deleted user), display `"Deleted User"` as the actor name. Do not skip or error on missing actors.
9. **Entity story edge cases** — Manual commissions (no conversion/click) show only commission audit logs with a "No attribution chain — manual commission" note. Organic conversions (no click) show conversion + commission logs with "No click data — organic attribution" note.
10. **ActivityTimeline compatibility assessed first** — Task 16a assesses the existing `ActivityTimeline` API surface before extending. If the component needs structural changes to support the new action types, those changes are made in that task.

## Implementation Plan

### Tasks

#### Phase 0: Backend — Schema & Foundation

- [ ] Task 0: Add compound indexes to auditLogs
  - File: `convex/schema.ts`
  - Action: Add two new indexes to the `auditLogs` table definition:
    ```typescript
    .index("by_tenant_entity", ["tenantId", "entityType"])
    .index("by_tenant_created", ["tenantId", "_creationTime"])
    ```
  - Notes: These are backward-compatible additions. No data migration needed. Convex auto-indexes new writes. The `by_tenant_entity` index enables efficient entity type filtering without post-filtering. The `by_tenant_created` index enables efficient date range queries.

- [ ] Task 0a: Add all audit action constants (backend)
  - File: `convex/audit.ts`
  - Action: Add constant objects for ALL new action types plus the `KNOWN_AUDIT_ACTIONS` hardcoded list. This MUST be done before Phase 2 tasks so they can reference the constants.
    ```typescript
    export const CLICK_AUDIT_ACTIONS = {
      RECORDED: "click_recorded",
      DEDUPLICATED: "click_deduplicated",
    } as const;

    export const CONVERSION_AUDIT_ACTIONS = {
      RECORDED: "conversion_recorded",
      RECORDED_SELF_REFERRAL: "conversion_recorded_self_referral",
      ORGANIC: "organic_conversion_recorded",
      STATUS_CHANGED: "conversion_status_changed",
      SUBSCRIPTION_STATUS_CHANGED: "conversion_subscription_status_changed",
      CREATED_LEGACY: "conversion_created_legacy",
    } as const;

    export const ATTRIBUTION_AUDIT_ACTIONS = {
      NO_DATA: "attribution_no_data",
      AFFILIATE_INVALID: "attribution_affiliate_invalid",
      REFERRAL_LINK_NOT_FOUND: "attribution_referral_link_not_found",
      NO_CAMPAIGN: "attribution_no_campaign",
      CLICK_MATCHED: "attribution_click_matched",
      NO_MATCHING_CLICK: "attribution_no_matching_click",
    } as const;

    export const COMMISSION_ENGINE_ACTIONS = {
      CREATION_SKIPPED: "commission_creation_skipped",
    } as const;

    // Hardcoded list for frontend filter dropdown — NO runtime scan
    export const KNOWN_AUDIT_ACTIONS: string[] = [
      // Commission
      "COMMISSION_CREATED", "COMMISSION_APPROVED", "COMMISSION_DECLINED",
      "COMMISSION_REVERSED", "COMMISSION_STATUS_CHANGE",
      "commission_creation_skipped", "commission_adjusted",
      // Payout
      "payout_batch_generated", "payout_marked_paid", "batch_marked_paid",
      // Affiliate
      "affiliate_approved", "affiliate_rejected", "affiliate_suspended",
      "affiliate_reactivated", "affiliate_registered", "affiliate_bulk_approved",
      "affiliate_bulk_rejected",
      // Click
      "click_recorded", "click_deduplicated",
      // Conversion
      "conversion_recorded", "conversion_recorded_self_referral",
      "organic_conversion_recorded", "conversion_status_changed",
      "conversion_subscription_status_changed", "conversion_created_legacy",
      // Attribution
      "attribution_no_data", "attribution_affiliate_invalid",
      "attribution_referral_link_not_found", "attribution_no_campaign",
      "attribution_click_matched", "attribution_no_matching_click",
      // Security
      "security_unauthorized_access_attempt", "security_cross_tenant_query",
      "security_cross_tenant_mutation", "security_authentication_failure",
      // Email
      "email_scheduling_failed", "fraud_alert_email_failed",
      // Fraud
      "self_referral_detected", "fraud_signal_dismissed",
    ];
    ```
  - Notes: This single task defines ALL constants upfront. Phase 2 tasks reference these constants instead of hardcoding strings. The `KNOWN_AUDIT_ACTIONS` list powers the frontend filter dropdown without any runtime DB scan.

- [ ] Task 0b: Create shared attribution audit helper
  - File: `convex/audit.ts`
  - Action: Create a new internal mutation `logAttributionDecision` that centralizes attribution audit logging for the commission engine:
    ```typescript
    export const logAttributionDecision = internalMutation({
      args: {
        tenantId: v.id("tenants"),
        action: v.string(), // must be one of ATTRIBUTION_AUDIT_ACTIONS
        eventId: v.string(),
        metadata: v.optional(v.object({
          eventType: v.optional(v.string()),
          reason: v.optional(v.string()),
          affiliateCode: v.optional(v.string()),
          referralCode: v.optional(v.string()),
          conversionId: v.optional(v.string()),
          referralLinkId: v.optional(v.string()),
          matchedClickId: v.optional(v.string()),
          matchedClickAge: v.optional(v.number()),
          attributionWindowDays: v.optional(v.number()),
        })),
      },
      handler: async (ctx, args) => { /* insert into auditLogs */ },
    });
    ```
  - Notes: This helper ensures all 3 copies of the attribution waterfall (payment.updated, subscription.created, subscription.updated) use the same audit logging pattern. Future changes to attribution audit format only need to be made here. Commission engine tasks call `internal.audit.logAttributionDecision(...)` instead of inline inserts. Wrap the `ctx.db.insert` in try/catch so audit failures don't break the webhook processing pipeline.

#### Phase 1: Backend — Click & Conversion Audit Trail Logging

- [ ] Task 1: Add click dedup audit logging
  - File: `convex/clicks.ts` function `trackClickInternal`
  - Action: In the duplicate click branch (where `existing` is found and the function returns `{ clickId: existing._id, isNew: false }`), add an audit log insert with action `CLICK_AUDIT_ACTIONS.DEDUPLICATED`, entityType `"click"`, entityId = existing._id, actorType `"system"`, metadata `{ dedupeKey: args.dedupeKey, ipAddress: args.ipAddress, existingClickId: existing._id }`. Wrap in try/catch — if audit insert fails, still return the dedup result.
  - Notes: Use `ctx.db.insert("auditLogs", {...})` direct insert pattern (same as the existing `click_recorded` log). The try/catch is critical here — the caller (HTTP action) handles the 500 error from the mutation, but a dedup click should still return successfully even if the audit log fails.

- [ ] Task 2: Add conversion audit logging to legacy `createConversion`
  - File: `convex/conversions.ts` function `createConversion`
  - Action: After the `ctx.db.insert("conversions", {...})` call, add a try/catch wrapped audit log insert. Use action `CONVERSION_AUDIT_ACTIONS.CREATED_LEGACY`, entityType `"conversion"`, entityId = conversionId, actorType `"system"`, metadata `{ affiliateId: args.affiliateId, amount: args.amount, campaignId: args.campaignId }`. Use `internal.audit.logAuditEventInternal`. If the audit insert fails, log to console.error but do NOT throw — the conversion was already created successfully.
  - Notes: This is the legacy/simple conversion creation path. The main `createConversionWithAttribution` already has audit logging. The try/catch ensures the conversion is never rolled back due to an audit failure.

- [ ] Task 3: Add audit logging to `updateConversionStatus`
  - File: `convex/conversions.ts` function `updateConversionStatus`
  - Action: Before the `ctx.db.patch(conversion._id, {...})` call, add a try/catch wrapped audit log. Use action `CONVERSION_AUDIT_ACTIONS.STATUS_CHANGED`, entityType `"conversion"`, entityId = conversion._id, actorType `"user"`, previousValue `{ status: conversion.status }`, newValue `{ status: args.status }`. Resolve actor from `getAuthenticatedUser(ctx)`. If audit fails, log error but proceed with the status change.
  - Notes: Follow the same non-fatal pattern. The status change is the critical operation — audit is secondary.

- [ ] Task 4: Add audit logging to `updateConversionSubscriptionStatusInternal`
  - File: `convex/conversions.ts` function `updateConversionSubscriptionStatusInternal`
  - Action: Add a try/catch wrapped audit log insert. Use action `CONVERSION_AUDIT_ACTIONS.SUBSCRIPTION_STATUS_CHANGED`, entityType `"conversion"`, entityId = conversionId, actorType `"system"`. **Payload specification:**
    - `previousValue`: `{ subscriptionStatus: oldSubscriptionStatus }`
    - `newValue`: `{ subscriptionStatus: args.subscriptionStatus }`
    - `metadata`: `{ conversionId, trigger: args.trigger ?? "unknown", planId: args.planId ?? null }`
    If audit fails, log error but proceed with the subscription status change.
  - Notes: The `trigger` field identifies what caused the status change (renewal, cancellation, upgrade, downgrade). The `planId` provides context about which plan was involved. This structured payload ensures consistent investigation data.

#### Phase 2: Backend — Commission Engine Attribution Audit Logging

- [ ] Task 5: Add audit logging for "no attribution data → organic" decision
  - File: `convex/commissionEngine.ts` functions `processPaymentUpdatedToCommission`, `processSubscriptionCreatedEvent`, `processSubscriptionUpdatedEvent`
  - Action: In all three functions, where the code falls through to `createOrganicConversion` due to no attribution data, call `internal.audit.logAttributionDecision` with action `ATTRIBUTION_AUDIT_ACTIONS.NO_DATA`, eventId, and metadata `{ eventType, reason: "No attribution data in webhook payload" }`. Wrap the call in try/catch — audit failure must not break webhook processing.
  - Notes: All 3 copies MUST be updated. Use the shared helper from Task 0b. The eventId is the webhook event's unique identifier.

- [ ] Task 6: Add audit logging for "affiliate invalid/inactive → organic" decision
  - File: `convex/commissionEngine.ts` (same 3 functions as Task 5)
  - Action: Where `findAffiliateByCodeInternal` returns null or affiliate is not active, call `internal.audit.logAttributionDecision` with action `ATTRIBUTION_AUDIT_ACTIONS.AFFILIATE_INVALID`, eventId, metadata `{ eventType, affiliateCode, reason: "affiliate not found" | "affiliate not active" }`. Wrap in try/catch.
  - Notes: Same 3-copy pattern. Use the shared helper.

- [ ] Task 7: Add audit logging for "referral link not found → organic" decision
  - File: `convex/commissionEngine.ts` (same 3 functions)
  - Action: Where `getReferralLinkByCodeInternal` returns null, call `internal.audit.logAttributionDecision` with action `ATTRIBUTION_AUDIT_ACTIONS.REFERRAL_LINK_NOT_FOUND`, eventId, metadata `{ eventType, referralCode }`. Wrap in try/catch.
  - Notes: Same 3-copy pattern. Use the shared helper.

- [ ] Task 8: Add audit logging for "no campaign → commission skipped" decision
  - File: `convex/commissionEngine.ts` (same 3 functions)
  - Action: Where `referralLink.campaignId` is falsy (conversion created but no commission generated), call `internal.audit.logAttributionDecision` with action `ATTRIBUTION_AUDIT_ACTIONS.NO_CAMPAIGN`, eventId, metadata `{ eventType, conversionId, referralLinkId }`. Wrap in try/catch.
  - Notes: Same 3-copy pattern. Use the shared helper.

- [ ] Task 9: Add audit logging for commission creation failures
  - File: `convex/commissions.ts` function `createCommissionFromConversionInternal`
  - Action: At the three early-return points ("campaign cannot earn", "campaign not found", "affiliate not found"), add try/catch wrapped audit log entries. Use action `COMMISSION_ENGINE_ACTIONS.CREATION_SKIPPED`, entityType `"commission"`, entityId = conversionId, actorType `"system"`. **Metadata specification:**
    ```typescript
    metadata: {
      reason: "campaign_cannot_earn" | "campaign_not_found" | "affiliate_not_found",
      campaignId: args.campaignId,
      affiliateId: args.affiliateId,
      conversionId: args.conversionId,
    }
    ```
  - Notes: The `reason` field in metadata preserves diagnostic value — the action name is generic but the metadata explains WHY. Wrap in try/catch — a failed audit log must not prevent the conversion from being created.

- [ ] Task 10: Add audit logging for click matching result
  - File: `convex/commissionEngine.ts` (same 3 functions)
  - Action: After the `findRecentClickInternal` call, call `internal.audit.logAttributionDecision` with action `ATTRIBUTION_AUDIT_ACTIONS.CLICK_MATCHED` (if click found) or `ATTRIBUTION_AUDIT_ACTIONS.NO_MATCHING_CLICK` (if no click found). Metadata: `{ eventType, matchedClickId, matchedClickAge: click ? (Date.now() - click._creationTime) : null, attributionWindowDays: campaign.cookieDuration }`. Wrap in try/catch.
  - Notes: Same 3-copy pattern. Use the shared helper. This is the key attribution decision for the investigation hub.

#### Phase 3: Backend — New Queries

- [ ] Task 11: Create `listTenantAuditLogs` unified query
  - File: `convex/audit.ts`
  - Action: Create a new public query `listTenantAuditLogs` with args: `{ paginationOpts, entityType?: string, action?: string, affiliateId?: Id<"affiliates">, startDate?: number, endDate?: number, entityId?: string }`.
    - **When `entityType` is provided:** Use `by_tenant_entity` index with `q.eq("tenantId", tenantId).eq("entityType", entityType)`. Apply additional post-filters (action, affiliateId, entityId) and date range on `_creationTime`. Use `.paginate(paginationOpts)`.
    - **When `entityType` is NOT provided (All tab):** Use `by_tenant_created` index with `q.eq("tenantId", tenantId)`. Apply date range bounds on `_creationTime`. Apply post-filters (action, affiliateId, entityId). Use `.paginate(paginationOpts)`.
    - **Enrichment:** For each entry, if `actorId` exists, look up the user via `ctx.db.get(actorId)`. If user not found (deleted), set `actorName: "Deleted User"`. If no actorId, set `actorName: actorType === "system" ? "System" : actorType === "webhook" ? "Webhook" : "Unknown"`.
    - **Returns:** `{ page, isDone, continueCursor, pageStatus, splitCursor }` — each page entry includes all audit log fields plus `actorName`.
  - Notes: Uses compound indexes for efficient filtering (addresses post-filtering bug). No `.take()` cap — pagination handles result set size. Post-filters (action, affiliateId, entityId) are applied via `.filter()` within the indexed query, which Convex evaluates server-side before pagination.

- [ ] Task 12: Create `getEntityStory` query
  - File: `convex/audit.ts`
  - Action: Create a new public query `getEntityStory` with args: `{ entityType: string, entityId: string }`. Returns all audit log entries for the entity chain.
    - **Chain resolution by entity type:**
      - `"click"`: Fetch click record. Find conversion via `conversions` table query with `by_click` index. Find commission via `commissions` table query with conversionId. Collect audit logs for click, conversion, commission using `by_entity` index.
      - `"conversion"`: Fetch conversion record. Get clickId if present. Find commission. Collect audit logs for conversion, click (if any), commission.
      - `"commission"`: Fetch commission record. Get conversionId. From conversion, get clickId if present. Collect audit logs for commission, conversion, click (if any). **Show note:** "Payouts are tracked per affiliate, not per commission — view Payouts page for payout history."
      - `"payouts"` or `"payoutBatches"`: Return only the payout's own audit logs via `by_entity`. No chain resolution.
      - `"affiliate"`: Use `by_affiliate` index to get all affiliate-related logs.
    - **Edge cases:**
      - Manual commission (no conversionId): Show only commission logs with informational note "No attribution chain — manual commission."
      - Organic conversion (no clickId): Show conversion + commission logs with note "No click data — organic attribution."
      - Chain break (conversion exists but no matching commission): Show available logs with note "No commission found for this conversion."
    - **Dedup:** Collect all entries, deduplicate by `_id`, sort chronologically ascending.
    - **Tenant scoping:** Verify the root entity belongs to the authenticated user's tenant. If not, throw 403.
  - Notes: Each chain step uses `.take(50)` via `by_entity` index. Worst case: 150 reads (3 entity types × 50). Acceptable for a detail view. Uses `.take()` not `.collect()` per AGENTS.md scalability guidelines.

- [ ] Task 13: Create `getActivityLogActionTypes` query
  - File: `convex/audit.ts`
  - Action: Create a new public query `getActivityLogActionTypes` with args: `{}`. Returns `v.array(v.string())`. **Implementation: Simply return `KNOWN_AUDIT_ACTIONS` constant array.** No database scan.
  - Notes: This is O(1), deterministic, and always complete. If new action types are added to the codebase in the future, `KNOWN_AUDIT_ACTIONS` must be updated. This is a conscious trade-off: a stale action list (missing 1-2 new actions) is far better than a non-deterministic, slow, incomplete runtime scan.

#### Phase 4: Frontend — Activity Log Page

- [ ] Task 14: Add activity log action constants and labels to frontend
  - File: `src/lib/audit-constants.ts`
  - Action: Import and re-export backend action constants (`CLICK_AUDIT_ACTIONS`, `CONVERSION_AUDIT_ACTIONS`, `ATTRIBUTION_AUDIT_ACTIONS`, `COMMISSION_ENGINE_ACTIONS`). Also add a comprehensive `AUDIT_ACTION_LABELS: Record<string, string>` map that maps ALL known action strings to human-readable labels. Include all existing actions (affiliate, commission, payout, click, conversion, attribution, security, tenant, user, email, billing, fraud). Example entries:
    ```typescript
    "click_deduplicated": "Click Deduplicated",
    "attribution_no_data": "No Attribution Data",
    "attribution_click_matched": "Click Matched to Conversion",
    "commission_creation_skipped": "Commission Skipped",
    "conversion_status_changed": "Conversion Status Changed",
    // ... etc
    ```
  - Notes: This map is what the frontend uses to display friendly names. Unknown actions fall back to the raw string with underscores replaced by spaces and title-cased.

- [ ] Task 15: Assess and extend ActivityTimeline compatibility
  - File: `src/components/shared/ActivityTimeline.tsx`
  - Action: **First**, read the current `ActivityTimeline` component API (props interface, actionIcons map structure, actionLabels map structure, rendering logic). **Assess compatibility** — does the component support the new action types without structural changes? If the component needs changes (e.g., new prop for metadata rendering, new prop for entity ID clickability), make those changes here. **Then**, extend `actionIcons` and `actionLabels` maps with new entries:
    - Click: `click_deduplicated` (amber Copy icon), `click_recorded` (blue MousePointer icon)
    - Conversion: `conversion_status_changed` (RefreshCw), `conversion_subscription_status_changed` (RefreshCw), `conversion_created_legacy` (PlusCircle)
    - Attribution: `attribution_no_data` (AlertTriangle/amber), `attribution_affiliate_invalid` (AlertTriangle/amber), `attribution_referral_link_not_found` (AlertTriangle/amber), `attribution_no_campaign` (AlertTriangle/amber), `attribution_click_matched` (CheckCircle/green), `attribution_no_matching_click` (XCircle/red)
    - Payout: `payout_batch_generated` (PlusCircle/blue), `payout_marked_paid` (CheckCircle/green), `batch_marked_paid` (CheckCircle/green)
    - General: `commission_creation_skipped` (XCircle/red)
  - Notes: If structural changes are needed, ensure they don't break existing usages in the payout audit tab and commission detail drawer. Test both pages after changes.

- [ ] Task 16: Add Activity Log to sidebar navigation
  - File: `src/components/shared/Sidebar.tsx`
  - Action: Add a new nav item to `STATIC_NAV_ITEMS.program` array, after the Payouts entry and before the Insights divider. Use a clock-with-checkmark icon. **Role gating:** This item is visible to all authenticated users with roles `"owner"` and `"admin"` (standard tenant-scoped access — no special permission needed since the backend query enforces tenant isolation). No badge count.
    ```typescript
    {
      href: "/activity-log",
      label: "Activity Log",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    ```

- [ ] Task 17: Create AuditLogEntry component
  - File: `src/app/(auth)/activity-log/components/AuditLogEntry.tsx`
  - Action: Create a reusable `"use client"` component. Props: `{ log: AuditLogEntryType, onEntityClick?: (entityType: string, entityId: string) => void }`. Renders:
    - **Left column:** Color-coded icon based on action type (use actionIcons lookup). Background circle with semantic color: green (positive), amber (neutral/warning), red (negative/skipped), blue (informational).
    - **Center column:** Human-readable action label (from AUDIT_ACTION_LABELS, fallback to formatted raw string), entity type badge (small pill with muted background), entity ID (truncated to 12 chars, clickable → calls `onEntityClick`), actor name (from enriched `actorName` field, or "System" / "Webhook" / "Deleted User"), relative timestamp.
    - **Right column:** Expand/collapse chevron icon.
    - **Expandable section:** When expanded, render metadata as human-readable key-value pairs. Handle known shapes: `amount` → currency formatted ("$45.00"), `reason` → text string, `count`/`affiliateCount` → number, `status` → colored badge, `affiliateName`/`campaignName` → text. Unknown metadata keys → raw JSON in a `<pre>` block.
  - Notes: Follow the payout audit entry rendering pattern from `PayoutsClient.tsx`. Use `cn()` for conditional classes. Use `Intl.NumberFormat` for currency formatting.

- [ ] Task 18: Create EntityStoryDrawer component
  - File: `src/app/(auth)/activity-log/components/EntityStoryDrawer.tsx`
  - Action: Create a `"use client"` drawer/sheet component. Props: `{ open: boolean, onClose: () => void, entityType: string, entityId: string }`. Features:
    - **Header:** Entity type badge + truncated entityId + copy-to-clipboard button.
    - **Chain navigation bar:** When the entity has a chain (click → conversion → commission), show horizontal pills: `[Click] → [Conversion] → [Commission]`. Current entity is highlighted/active. Other entities are clickable — clicking navigates to that entity's story (updates `entityType` and `entityId` props).
    - **Commission note:** When viewing a commission, show informational text below chain nav: "Payouts are tracked per affiliate. Visit the Payouts page to view payout history."
    - **Edge case notes:** Show contextual notes for manual commissions ("No attribution chain — manual commission"), organic conversions ("No click data — organic attribution"), and chain breaks ("No commission found for this conversion").
    - **Timeline:** Use `ActivityTimeline` component to render audit entries from `api.audit.getEntityStory`.
    - **Loading state:** Skeleton timeline (3-4 skeleton rows) while data loads.
    - **Error state:** Retry button + error message.
    - **Empty state:** "No activity recorded for this entity" with appropriate icon.
  - Notes: Use the Radix Sheet component (same pattern as commission detail drawer). Wrap the inner content in `<Suspense>` with the skeleton fallback. Chain navigation updates the query by changing `entityType`/`entityId` — the component re-fetches automatically via Convex reactivity.

- [ ] Task 19: Create ActivityLogClient component
  - File: `src/app/(auth)/activity-log/ActivityLogClient.tsx`
  - Action: Create the main `"use client"` component. Features:
    - **Filter bar** (horizontal on desktop, stacked on mobile):
      - Entity type tabs: "All", "Commissions", "Payouts", "Affiliates", "Clicks & Conversions", "Security" — implemented via `<FilterTabs>` component. Active tab sets `entityType` filter. Default: "All".
      - Action type dropdown: `<Select>` populated from `KNOWN_AUDIT_ACTIONS` constant (via `api.audit.getActivityLogActionTypes`). Optional — defaults to "Any Action". Searchable within dropdown.
      - Date range selector: Button group with "7 days", "30 days", "90 days", "All time". Default: "30 days". Sets `startDate`/`endDate` filter.
      - Filters are combinable: entity type + action + date range can all be active simultaneously.
    - **Feed:** Uses `api.audit.listTenantAuditLogs` query with current filters. Renders each entry via `AuditLogEntry` component. Cursor-based pagination with "Newest" (reset cursor) and "Older" (use continueCursor) buttons. 20 items per page.
    - **Entity story:** Clicking entity ID or "Explain this" button on any entry opens `EntityStoryDrawer`.
    - **States:**
      - Loading: 5 skeleton rows matching the audit entry layout (icon + 3 text lines each).
      - Empty: Clock icon + "No activity recorded in this period" + suggestion to adjust filters.
      - Error: AlertTriangle icon + "Failed to load activity" + "Retry" button.
      - Populated: Scrollable list with pagination.
  - Notes: Use `useMemo` for the computed query args object to prevent unnecessary re-renders. Use `useState` for each filter independently. Use `PageTopbar` for page header. Mobile breakpoint at 768px for stacked filter layout.

- [ ] Task 20: Create Activity Log page
  - File: `src/app/(auth)/activity-log/page.tsx`
  - Action: Create a server component page. Wrap `ActivityLogClient` in `<Suspense>` with a skeleton fallback that matches the loaded layout:
    - Skeleton filter bar: 5 rectangular skeleton pills (matching FilterTabs)
    - Skeleton dropdown: 1 rectangular skeleton
    - Skeleton date buttons: 3 small rectangular skeletons
    - Skeleton list: 5 skeleton rows (each with circle + 3 text lines)
  - Notes: Follow the Suspense boundary pattern from AGENTS.md. The `PageTopbar` with title "Activity Log" and description "Track all changes across your affiliate program" renders immediately (not inside Suspense).

#### Phase 5: Testing

- [ ] Task 21: Add critical path tests
  - File: `convex/audit.test.ts` (new), `convex/clicks.test.ts` (extend if exists)
  - Action: Create test file `convex/audit.test.ts` with tests for:
    1. `listTenantAuditLogs` returns only tenant-scoped results (verify cross-tenant isolation)
    2. `getEntityStory` resolves the click → conversion → commission chain correctly
    3. `getEntityStory` handles manual commission (no conversion) gracefully — returns only commission logs
    4. `getEntityStory` handles organic conversion (no click) gracefully — returns conversion + commission logs
    5. `getActivityLogActionTypes` returns the hardcoded list (no DB scan)
  - Notes: Use Vitest with mock Convex ctx. Follow the project's existing test file patterns. These tests cover the most critical correctness paths. Commission engine audit logging (Tasks 5-10) is tested via manual testing since the commission engine has complex dependencies that are difficult to mock.

### Acceptance Criteria

- [ ] AC 1: Given a SaaS owner is authenticated, when they navigate to `/activity-log`, then they see a paginated feed of all audit events for their tenant, sorted newest first, with entity type filter tabs and a 30-day default date range.
- [ ] AC 2: Given the Activity Log page is loaded, when the user selects the "Commissions" filter tab, then only commission-related audit events are displayed using the `by_tenant_entity` index.
- [ ] AC 3: Given the Activity Log page is loaded, when the user selects a date range filter (e.g., "Last 7 days"), then only audit events within that date range are displayed.
- [ ] AC 4: Given the Activity Log page is loaded, when the user clicks an entity ID in any log entry, then the Entity Story Drawer opens showing the full chronological timeline for that entity.
- [ ] AC 5: Given the Entity Story Drawer is open for a commission with a linked conversion and click, then the chain navigation shows "Click → Conversion → Commission" with clickable links, and the current entity is highlighted.
- [ ] AC 6: Given the Entity Story Drawer is open for a commission, then an informational note is displayed: "Payouts are tracked per affiliate. Visit the Payouts page to view payout history."
- [ ] AC 7: Given the Entity Story Drawer is open for a manual commission (no conversion), then only commission audit logs are shown with a "No attribution chain — manual commission" note.
- [ ] AC 8: Given the Entity Story Drawer is open for an organic conversion (no click), then conversion and commission logs are shown with a "No click data — organic attribution" note.
- [ ] AC 9: Given a duplicate click is received, when `trackClickInternal` processes it, then an audit log entry with action `"click_deduplicated"` is created with the dedupeKey and existing click ID in metadata, even if the click dedup succeeds.
- [ ] AC 10: Given a webhook arrives with no attribution data, when the commission engine processes it, then an audit log entry with action `"attribution_no_data"` is created, and the organic conversion is still created successfully even if the audit insert fails.
- [ ] AC 11: Given a webhook arrives with a valid affiliate code, when click matching runs, then an audit log entry with action `"attribution_click_matched"` (or `"attribution_no_matching_click"`) is created with the matched click ID and attribution window info.
- [ ] AC 12: Given a conversion status is changed via `updateConversionStatus`, when the mutation executes, then an audit log entry with action `"conversion_status_changed"` is created with previous and new status values, and the status change succeeds even if the audit insert fails.
- [ ] AC 13: Given a commission creation is skipped (e.g., campaign cannot earn), when `createCommissionFromConversionInternal` returns null, then an audit log entry with action `"commission_creation_skipped"` is created with metadata `{ reason: "campaign_cannot_earn", campaignId, affiliateId, conversionId }`.
- [ ] AC 14: Given the Activity Log page is loaded on mobile, when the viewport is narrow (< 768px), then the filter bar stacks vertically and the audit entries adapt to single-column layout.
- [ ] AC 15: Given the user expands the metadata section of any audit log entry, when the metadata contains an `amount` field, then it is displayed as a currency-formatted value (e.g., "$45.00").
- [ ] AC 16: Given an unauthenticated user, when they attempt to access `/activity-log`, then they are redirected to the sign-in page.
- [ ] AC 17: Given a SaaS owner on Tenant A, when they view the Activity Log, then they see ONLY audit events for Tenant A — no cross-tenant data is visible.
- [ ] AC 18: Given an audit log entry where the actor has been deleted, when the entry is rendered, then the actor name displays "Deleted User" instead of an error or blank.
- [ ] AC 19: Given a new tenant with zero audit logs, when the Activity Log page loads, then an empty state is displayed with "No activity recorded in this period" and a suggestion to adjust date filters.
- [ ] AC 20: Given filters are active (entity type + action + date range), when the user paginates, then pagination works correctly on the filtered result set (not the full unfiltered set).

## Additional Context

### Dependencies

- **No new packages required** — All UI components (Sheet, Button, Skeleton, FilterTabs, Select) already exist in the project.
- **Schema migration required** — Two new compound indexes on `auditLogs` (backward-compatible, no data migration).
- **Internal mutation imports** — Tasks 1-10 need `import { internal } from "./_generated/api"` and `internal.audit.logAttributionDecision` or `internal.audit.logAuditEventInternal`.
- **`getAuthenticatedUser` import** — Tasks 11, 12 need `import { getAuthenticatedUser } from "./tenantContext"`.
- **Existing commission engine logic is NOT modified** — Only audit log insertions (wrapped in try/catch) are added at decision points. The business logic flow remains identical.

### Testing Strategy

**Manual Testing (required — covers complex integration paths):**

1. **Click dedup audit:** Use tracking endpoint with same IP/code within same hour. Verify `click_deduplicated` appears in `/activity-log`. Verify the original click still works.
2. **Non-fatal audit:** Temporarily break an audit insert (e.g., pass invalid data). Verify the business operation (conversion creation) still succeeds. Verify console.error is logged.
3. **Commission lifecycle:** Trigger payment webhook, approve commission, decline another. Verify full trail in entity story drawer.
4. **Attribution decisions:** Send webhooks with: (a) missing attribution data, (b) invalid affiliate code, (c) valid attribution with click match. Verify each decision is logged with correct metadata.
5. **Entity story chain:** Open entity story for commission with known click→conversion→commission chain. Verify chain navigation shows all 3 entities and clicking each navigates correctly.
6. **Entity story edge cases:** View manual commission (no chain), organic conversion (no click), commission with no matching payout. Verify informational notes appear.
7. **Filter combination:** Select "Commissions" tab + "Last 7 days" + specific action. Verify all 3 filters work together. Verify pagination works on filtered results.
8. **Deleted actor:** Create audit entry, delete the actor user, verify "Deleted User" appears in feed.
9. **Cross-tenant isolation:** As Tenant A user, verify no Tenant B events visible.
10. **Mobile responsiveness:** Test on narrow viewport — verify stacked filters, single-column layout.

**Unit Tests (covers query correctness):**

1. `convex/audit.test.ts` — `listTenantAuditLogs` returns only tenant-scoped results
2. `convex/audit.test.ts` — `getEntityStory` resolves click→conversion→commission chain
3. `convex/audit.test.ts` — `getEntityStory` handles manual commission (no conversion)
4. `convex/audit.test.ts` — `getEntityStory` handles organic conversion (no click)
5. `convex/audit.test.ts` — `getActivityLogActionTypes` returns hardcoded list

### Notes

**High-risk items:**
- **Commission engine 3-copy waterfall** — Tasks 5-10 require identical changes in 3 functions. Task 0b mitigates this by providing a shared helper, but the insertion points themselves must be found and called in all 3 copies. If one copy is missed, that event type's audit trail will have gaps. This is flagged as known tech debt — a future refactor should extract the shared waterfall logic into a single internal function.
- **Schema index addition** — Task 0 adds compound indexes. In Convex, adding indexes is instantaneous and backward-compatible. However, existing documents won't be queryable via the new indexes until they are re-indexed (Convex handles this automatically). No manual migration needed.

**Known limitations:**
- **Audit logs are append-only** — No correction mechanism. Incorrect entries cannot be deleted (by design).
- **No real-time push** — Standard Convex polling (~1s delay). Acceptable for an investigation tool.
- **Metadata rendering is best-effort** — Known metadata shapes render as human-readable values. Unknown shapes fall back to JSON.
- **Commission→payout chain is architecturally impossible** — Payouts lack commissionId. This is a data model limitation that would require a schema redesign to fix (out of scope).

**Future considerations:**
- **Refactor 3-copy waterfall** — Extract shared attribution logic from `commissionEngine.ts` into a single internal function. This would eliminate the 3-copy maintenance burden.
- **Webhook decision audit logging** — Log webhook processing decisions (process/reject/quarantine) to complete full pipeline visibility.
- **Export to CSV** — For accounting teams.
- **Affiliate-facing audit** — Scoped audit view for the affiliate portal.
- **Audit log retention** — Cron job to archive old entries at scale.
