---
title: "Platform Admin Reports & Query Builder"
slug: "admin-reports-query-builder"
created: "2026-04-10"
status: "in-progress"
stepsCompleted: [1]
tech_stack: ["Next.js 16 (App Router)", "Convex 1.32", "TypeScript 5.9", "Tailwind CSS v4", "Radix UI", "Tremor (@tremor/react)", "Vitest 4.1", "convex-test"]
files_to_modify: []
code_patterns: []
test_patterns: []
elicitation_completed: true
---

# Tech-Spec: Platform Admin Reports & Query Builder

**Created:** 2026-04-10

## Overview

### Problem Statement

Platform Admins have no cross-tenant visibility into affiliate performance, commission trends, fraud signals, or campaign metrics. The existing `/reports` pages at `(auth)/reports/` are tenant-scoped — every query filters by the authenticated user's `tenantId`. The admin currently must click into each tenant individually to gather platform-wide intelligence. Additionally, there's no ad-hoc query capability for admin-specific tables (`tenants`, `tenantStats`, `billingHistory`, `auditLogs`), leaving the platform admin unable to ask arbitrary business questions across the platform.

### Solution

Rather than creating a new Reports section with 4+ sub-pages (which would bloat the admin sidebar to 10+ items), **enhance existing admin pages** with cross-tenant analytics and create a **standalone Admin Query Builder** as a separate tool:

1. **Enhanced existing admin pages** — Add cross-tenant KPI/leaderboard tabs to `/tenants`, fraud radar aggregation to `/audit`, and affiliate metrics to `/revenue`. All dashboard queries use a new `platformStats` singleton table (updated incrementally via hooks + hourly correction cron) for instant KPI loads. Detail views use capped `.paginate()` on indexed tables.
2. **Standalone Admin Query Builder** — A separate Convex module (`convex/admin/queryBuilder.ts`) with admin-only table whitelist, isolated saved query storage, and shared UI components from `src/components/query-builder/` via backward-compatible additive props.

### Scope

**In Scope:**
- **New `platformStats` singleton table** — Pre-aggregated platform-wide KPIs (totalMRR, totalActiveAffiliates, totalCommissions, totalClicks, totalConversions, totalFraudSignals, activeTenantCount, lastUpdatedAt). Updated incrementally via `tenantStats` hooks (real-time) + hourly full recalculation cron (correction).
- **New `adminSavedQueries` + `adminQueryExports` tables** — Isolated storage for admin query builder (separate from tenant `savedQueries`/`queryExports`). Compound uniqueness: name + createdBy.
- **`tenantStats.lastSyncedAt` field addition** — Staleness detection for individual tenant stats. Dashboard surfaces warnings for tenants < 7 days old or with stale counters.
- **Enhance `/tenants`** — Add "Platform Analytics" tab with cross-tenant KPIs (from `platformStats`) and tenant leaderboard (ranked by revenue, affiliate count, conversion rates via `.paginate()` on `tenantStats`, top 50-100). Tab content lazy-loaded via conditional `useQuery`.
- **Enhance `/audit`** — Add "Fraud Radar" aggregation view showing platform-wide fraud signals clustered by tenant with drill-down. Uses capped `.paginate()` on indexed tables.
- **Enhance `/revenue`** — Add affiliate-related metrics from `platformStats` (total platform-wide commissions, top-performing tenants by affiliate revenue). Charts use fetch-once pattern (no real-time subscriptions).
- **Standalone Admin Query Builder** at `/query-builder` with:
  - Separate `convex/admin/queryBuilder.ts` with shared utils extracted to `convex/queryBuilder/_utils.ts`
  - Admin-only table whitelist: `tenants`, `tenantStats`, `billingHistory`, `auditLogs`, `tierConfigs`, `tierOverrides`, `adminNotes`, `impersonationSessions`, `performanceMetrics`
  - Tenant-scoped tables accessible with `tenantId` as selectable filter: `affiliates`, `campaigns`, `clicks`, `conversions`, `commissions`, `payouts`, `payoutBatches`
  - Hard `.take(500)` cap on all queries — no auto-refresh on results
  - Joined-result `.take(500)` cap (not per-table) — logs warning for cross-tenant queries on high-volume tables
  - Count-first truncation pattern: estimate total result size before executing, show "⚠️ Showing 500 of ~{N} results" warning
  - Server-side `assertPlatformAdmin(ctx)` — never trust client-side role flags
  - Separate `adminSavedQueries` + `adminQueryExports` tables for storage isolation
  - Compound uniqueness on saved queries: name + createdBy
  - SavedQueriesList shows metadata: createdBy, updatedAt
  - Backward-compatible component props — admin features are additive (`adminMode?: boolean`, `adminTemplates?: Template[]`), never replace tenant QB defaults
  - Pre-built query templates: Top 10 Tenants by MRR, Fraud Rate by Tenant, Commission Volume Trends (30 days), Affiliate Growth by Plan, Audit Activity Heatmap
  - Prominent "⚠️ Platform Admin — All Tenant Data" badge in the UI
  - Export audit logging: all admin query exports logged to `auditLogs` with who/what/when
  - "Contains PII" warning on export dialog when query includes email/name fields
- Admin sidebar update: add `/query-builder` as a standalone nav item
- Route protection in `src/proxy.ts` for `/query-builder`
- CSV export support for admin query builder results (reuse existing async export pattern with Convex storage)
- Backfill cron for new tenants — batch processing (10-20 tenants per action invocation) with `ctx.scheduler.runAfter()` chaining for follow-up batches
- **Shared utils extraction** — `convex/queryBuilder/_utils.ts` (internal module) containing core query execution logic (join resolution, filter application, aggregation, pagination). Both `convex/queryBuilder.ts` and `convex/admin/queryBuilder.ts` import from here.

**Out of Scope:**
- New `/reports` route group or separate Reports section in sidebar
- Modifying existing tenant-scoped reports (`(auth)/reports/`) or tenant query builder
- Real-time streaming updates for admin dashboards
- Scheduled/automated report delivery
- Export to external BI tools (Metabase, Tableau, etc.)
- Health (`/health`) and Settings (`/admin-settings`) pages — separate concern
- Affiliate portal reports — separate user persona
- "Shared with Admins" feature for saved queries (P2)

## Context for Development

### Codebase Patterns

- **Convex new function syntax** — All queries/mutations use `query({ args, returns, handler })` pattern
- **Validators required** — ALL functions must have `args` and `returns` validators
- **Admin RBAC** — `assertPlatformAdmin(ctx)` from `convex/admin/_helpers.ts` — shared admin role verification. MUST be called server-side in every admin QB function — never trust client-side `isAdmin` props
- **Date range pattern** — Shared `dateRangeValidator = v.optional(v.object({ start: v.number(), end: v.number() }))` and `useDateRange` hook
- **Pagination pattern** — `paginationOptsValidator` from `convex/server`; returns `{ page, isDone, continueCursor }`
- **Export pattern** — Actions with `"use node"` directive, return base64-encoded CSV; async export via Convex storage for large datasets
- **Suspense boundaries** — Client components using hooks MUST be wrapped in `<Suspense>` with skeleton fallbacks
- **Button motion** — All buttons use `<Button>` from `@/components/ui/button` with built-in `btn-motion` CSS
- **No unbounded `.collect()`** — High-volume tables must use `.take(N)`, `.paginate()`, or read from `tenantStats`
- **tenantStats hooks** — Mutations changing status on `affiliates`, `commissions`, or `payouts` MUST call corresponding `tenantStats` hook functions
- **Admin layout pattern** — `(admin)` route group with `AdminSidebar`, role check `user.role === "admin"`, redirect for non-admins
- **Tenant detail tab pattern** — `src/app/(admin)/tenants/[tenantId]/` uses tabbed layout via `TenantTabs.tsx` with 7 tabs — new analytics tab follows same pattern
- **Query builder component reuse** — 15 components in `src/components/query-builder/` (TableSelector, ColumnSelector, FilterBuilder, JoinBuilder, AggregationBuilder, ResultsTable, QueryPreviewSentence, SavedQueriesList, SaveQueryDialog, ShareQueryDialog, QueryExportButton, TemplateGallery, WizardFlow, skeletons, types)
- **Shared query builder utils** — Core query execution logic (join resolution, filter application, aggregation, pagination) extracted to `convex/queryBuilder/_utils.ts` (internal module) — both tenant QB and admin QB import from here
- **Lazy tab loading** — Dashboard analytics tabs use conditional `useQuery` gated by active tab state. Tab content only fetched when selected.
- **Fetch-once dashboard charts** — Tremor charts on revenue/analytics pages fetch data on mount with explicit refresh button. No real-time Convex subscriptions on aggregate data to prevent chart thrashing.
- **Post-filter truncation warning** — Existing pattern from owner reports: when result set exceeds cap, display warning banner "Showing N of ~M results. Add filters to narrow."
- **Audit logging pattern** — `ctx.db.insert("auditLogs", { action, entityType, entityId, actorId, actorType, tenantId, metadata })` — used for impersonation, subscription changes, etc. Reuse for admin query exports.
- **Batch cron processing** — `ctx.scheduler.runAfter(0, internalFunction, args)` for chaining batch invocations. Process 10-20 items per invocation to stay within function limits.

### Files to Reference

| File | Purpose |

(To be populated during Step 2 — Deep Investigation)

### Technical Decisions

**ADR 1: Query Builder Backend — Separate Module with Shared Utils**
- Extract core query execution logic (join resolution, filter application, aggregation, pagination) into `convex/queryBuilder/_utils.ts` (internal)
- Both `convex/queryBuilder.ts` and `convex/admin/queryBuilder.ts` import from shared utils
- Whitelists, auth checks, and saved query storage remain separate per module
- Rationale: Isolated security boundary, shared maintainability, independent deployment

**ADR 2: Admin Saved Query Storage — Separate Tables**
- New `adminSavedQueries` table (mirrors `savedQueries` schema) for admin query configurations
- New `adminQueryExports` table (mirrors `queryExports` schema) for admin export tracking
- Zero cross-contamination possible with tenant saved queries
- Compound uniqueness: `name` + `createdBy` — same name allowed for different admins
- SavedQueriesList shows metadata: `createdBy`, `updatedAt` for disambiguation
- Rationale: Schema duplication cost is trivial (~10 fields), security benefit is significant

**ADR 3: Dashboard Data Strategy — Hybrid with platformStats Singleton**
- New `platformStats` singleton table (one row) stores pre-aggregated platform-wide totals
- Dashboard KPIs read `platformStats` — single document fetch, zero table scans
- Tenant leaderboard uses `.paginate()` on `tenantStats` (indexed), top 50-100 only
- Detail views (fraud radar drill-down, trend time-series) use capped `.paginate()` on indexed tables
- Admin query builder always uses `.take(500)` cap regardless of filters
- `tenantStats` gets `lastSyncedAt` field for staleness detection — dashboard surfaces warnings for tenants < 7 days old
- Rationale: Single-doc KPIs scale infinitely; leaderboard bounded by pagination; detail views bounded by caps

**ADR 4: platformStats Update Strategy — Two-Tier (Incremental + Correction)**
- **Real-time (hooks)**: Existing `tenantStats` hooks (`updateAffiliateCount`, `onCommissionCreated`, etc.) also update `platformStats` with deltas — keeps dashboard current within seconds
- **Correction (cron)**: Hourly cron does full recalculation from all `tenantStats` rows — corrects any drift from missed incremental updates
- Rationale: Incremental gives near-real-time; cron ensures long-term accuracy. A single missed update permanently skews delta-based totals — the correction cron prevents this.

**ADR 5: Report Page Architecture — Enhance Existing, Don't Create New Section**
- Add "Platform Analytics" tab to existing `/tenants` page (cross-tenant KPIs + leaderboard)
- Add fraud radar aggregation to existing `/audit` page
- Add affiliate metrics to existing `/revenue` page
- Admin query builder is standalone `/query-builder` nav item (a tool, not a report page)
- Rationale: Avoids sidebar bloat (would be 10+ items with new section), fits existing mental model ("Tenants page has everything about tenants"), lighter scope

**ADR 6: Component Sharing — Backward-Compatible Additive Props**
- Admin features passed via optional props: `adminMode?: boolean`, `adminTemplates?: Template[]`, `adminTableWhitelist?: string[]`
- When `adminMode` is not set or `false`, components behave exactly as they do today for tenant QB
- No existing tenant QB behavior changes — admin is an additive layer
- Rationale: Refactoring shared components broke tenant QB in the past; additive props prevent regression

**ADR 7: Dashboard Rendering Performance**
- Analytics tabs: lazy-loaded via conditional `useQuery` gated by active tab state
- Revenue/analytics charts: fetch-once pattern, no real-time Convex subscriptions on aggregate data
- Explicit refresh button for chart data re-fetch
- Rationale: Tremor re-renders are expensive with real-time subscriptions on aggregate data

**ADR 8: New Tenant Backfill — Batch Processing**
- Cron discovers tenants missing `tenantStats`, processes in batches of 10-20 per action invocation
- `ctx.scheduler.runAfter()` chains follow-up batches
- Rationale: Avoids single monolithic backfill that could timeout; stays within Convex function limits

## Implementation Plan

### Tasks

(To be generated during Step 3)

### Acceptance Criteria

(To be generated during Step 3)

## Additional Context

### Dependencies

- `convex/queryBuilder/_utils.ts` extraction must be done first (both QB modules depend on it)
- Existing `tenantStats` denormalized counters must be populated for all tenants (via `backfillStats` migration)
- `tenantStats` schema needs `lastSyncedAt` field addition (schema migration)
- New tables: `platformStats`, `adminSavedQueries`, `adminQueryExports` (schema additions)
- Existing query builder components must accept new optional props without breaking tenant QB
- Admin query builder route must be added to `src/proxy.ts` protection list
- `platformStats` hooks must be added to existing `tenantStats` hook functions
- Hourly correction cron for `platformStats` must be registered in `convex/crons.ts`

### Testing Strategy

(To be generated during Step 3)

### Risk Mitigations (from Pre-mortem + What-If Analysis)

1. **Cross-tenant data leak prevention** — Server-side `assertPlatformAdmin(ctx)` in every admin QB function. Never trust client-side role flags. Separate Convex module = separate auth gate.
2. **Database nuke prevention** — Hard `.take(500)` cap enforced in admin QB execution engine. Joined-result cap (not per-table). No auto-refresh on query builder results UI. Count-first truncation warning pattern.
3. **Stale dashboard KPIs** — `platformStats` updated via two-tier strategy (incremental hooks + hourly correction cron). `tenantStats.lastSyncedAt` for individual tenant staleness. Warnings surfaced for tenants < 7 days old.
4. **Shared component regression** — Admin props are additive and optional. Tenant QB behavior is the default path. No existing prop contracts change.
5. **Saved query leakage** — Separate `adminSavedQueries` and `adminQueryExports` tables. Zero cross-contamination possible by design. Compound uniqueness (name + createdBy).
6. **Export PII exposure** — "Contains PII" warning on export dialog when query includes email/name fields. All exports logged to `auditLogs` with who/what/when (reuse existing audit pattern).
7. **platformStats drift** — Incremental hooks can miss updates. Hourly correction cron does full recalculation from all `tenantStats` rows to correct drift.
8. **Tenant deletion during query** — Not an issue. Convex queries are transactional reads with consistent snapshots. No partial results possible.
9. **New tenant backfill gaps** — Batch processing cron discovers tenants missing `tenantStats` and processes in batches. `lastSyncedAt` field identifies gaps. Warnings surface for recently onboarded tenants.

### Notes

- This spec builds on top of existing patterns from `tech-spec-owner-reports-p0-p1.md` (status: ready-for-dev) and `tech-spec-query-builder-custom-reports.md` (status: implementation-complete).
- The admin query builder is architecturally separate from the tenant query builder — different Convex module, different table whitelist, different saved query storage, but shared core utils.
- The war room decision to enhance existing pages (instead of creating a new Reports section) significantly reduces scope while better fitting the admin navigation UX.
- The `platformStats` singleton eliminates the need to `.collect()` all `tenantStats` rows for KPI display — a single document fetch scales infinitely.
- The two-tier update strategy (incremental + correction) balances near-real-time accuracy with long-term correctness for `platformStats`.
