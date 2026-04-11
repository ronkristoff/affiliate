---
title: "Platform Admin Reports & Query Builder"
slug: "admin-reports-query-builder"
created: "2026-04-10"
status: "ready-for-dev"
stepsCompleted: [1, 2, 3, 4]
tech_stack: ["Next.js 16 (App Router)", "Convex 1.32", "TypeScript 5.9", "Tailwind CSS v4", "Radix UI", "nuqs", "Vitest 4.1", "convex-test"]
files_to_modify: ["convex/schema.ts", "convex/queryBuilder.ts", "convex/tenantStats.ts", "convex/crons.ts", "src/proxy.ts", "src/app/(admin)/_components/AdminSidebar.tsx", "src/app/(admin)/tenants/page.tsx", "src/app/(admin)/tenants/[tenantId]/_components/TenantTabs.tsx", "src/app/(admin)/audit/page.tsx", "src/app/(admin)/revenue/page.tsx", "src/app/(admin)/revenue/RevenueDashboard.tsx", "src/components/query-builder/TableSelector.tsx", "src/components/query-builder/FilterBuilder.tsx", "src/components/query-builder/AggregationBuilder.tsx", "src/components/query-builder/ResultsTable.tsx", "src/components/query-builder/TemplateGallery.tsx", "src/components/query-builder/SavedQueriesList.tsx", "src/components/query-builder/SaveQueryDialog.tsx", "src/components/query-builder/QueryExportButton.tsx", "src/components/query-builder/types.ts", "src/hooks/useQueryBuilder.ts"]
code_patterns: ["convex-new-function-syntax", "requireAdmin-rbac", "date-range-validator", "pagination-opts-validator", "tenantstats-hook-pattern", "suspense-boundary-wrapper", "filtertabs-component", "nuqs-url-state", "fadein-staggered-animation", "pagetopbar-component", "fetch-once-dashboard", "lazy-tab-loading", "post-filter-truncation-warning", "audit-log-insert-pattern", "cron-registration-pattern", "backfill-batch-processing"]
test_patterns: ["vitest-globals", "convex-test-backend", "frontend-unit-no-rendering"]
elicitation_completed: true
---

# Tech-Spec: Platform Admin Reports & Query Builder

**Created:** 2026-04-10

## Overview

### Problem Statement

Platform Admins have no cross-tenant visibility into affiliate performance, commission trends, fraud signals, or campaign metrics. The existing `/reports` pages at `(auth)/reports/` are tenant-scoped — every query filters by the authenticated user's `tenantId`. The admin currently must click into each tenant individually to gather platform-wide intelligence. Additionally, there's no ad-hoc query capability for admin-specific tables (`tenants`, `tenantStats`, `billingHistory`, `auditLogs`), leaving the platform admin unable to ask arbitrary business questions across the platform.

### Solution

Rather than creating a new Reports section with 4+ sub-pages (which would bloat the admin sidebar to 10+ items), **enhance existing admin pages** with cross-tenant analytics and create a **standalone Admin Query Builder** as a separate tool:

1. **Enhanced existing admin pages** — Add cross-tenant KPI/leaderboard to `/tenants`, fraud radar aggregation to `/audit`, and affiliate metrics to `/revenue`. All dashboard queries use a new `platformStats` singleton table (updated incrementally via hooks + hourly correction cron) for instant KPI loads. Detail views use capped `.paginate()` on indexed tables.
2. **Standalone Admin Query Builder** — A separate Convex module (`convex/admin/queryBuilder.ts`) with admin-only table whitelist, isolated saved query storage, and shared UI components from `src/components/query-builder/` via backward-compatible additive props.

### Scope

**In Scope:**
- **New `platformStats` singleton table** — Pre-aggregated platform-wide KPIs. Updated via hourly full recalculation cron (V1). Incremental hook updates deferred to P2.
- **New `adminSavedQueries` + `adminQueryExports` tables** — Isolated storage for admin query builder.
- **`tenantStats.lastSyncedAt` field addition** — Staleness detection.
- **Enhance `/tenants`** — Add "Platform Analytics" tab with cross-tenant KPIs + tenant leaderboard.
- **Enhance `/audit`** — Add fraud radar aggregation section.
- **Enhance `/revenue`** — Add affiliate metrics from `platformStats`.
- **Standalone Admin Query Builder** at `/query-builder` — Separate Convex module, admin-only tables, 500-row cap, export audit logging, PII warnings.
- **Shared utils extraction** — `convex/queryBuilder/_utils.ts` (~500 lines of pure logic).
- **Admin sidebar + proxy** — Add `/query-builder` nav item and route protection.

**Out of Scope:**
- New `/reports` route group or separate Reports section in sidebar
- Modifying existing tenant-scoped reports or tenant query builder
- Real-time streaming, scheduled delivery, external BI export
- Health/Settings pages, affiliate portal reports, shared-with-admins feature (P2)

## Context for Development

### Codebase Patterns

**Convex Backend:**
- **Convex new function syntax** — `query({ args, returns, handler })` pattern. Validators required on all functions.
- **Admin RBAC** — `requireAdmin(ctx)` from `convex/admin/_helpers.ts` (lines 70-92): `betterAuthComponent.getAuthUser(ctx)` + users lookup + `role === "admin"`. MUST be server-side in every admin QB function.
- **`readTenantStats`** — Also in `_helpers.ts` (lines 37-61). Returns `TenantStatsData` with null-safe defaults for 13 fields.
- **No unbounded `.collect()`** — High-volume tables: `.take(N)`, `.paginate()`, or `tenantStats`.
- **tenantStats hooks** — 9 plain async functions called from mutations: `updateAffiliateCount`, `onCommissionCreated`, `onCommissionStatusChange`, `incrementTotalPaidOut`, `onOrganicConversionCreated`, `incrementTotalConversions`, `onCommissionAmountChanged`, `onLeadCreated`, `onLeadConverted`.
- **Cron pattern** — `crons.interval("name", {hours: N}, internal.module.function, {})` in `convex/crons.ts`. Must export default.
- **Audit logging** — `ctx.db.insert("auditLogs", { action, entityType, entityId, actorId, actorType, tenantId?, metadata? })`.
- **QB extraction targets** from `convex/queryBuilder.ts` (~500 lines): `projectToColumns`, `applyFilters`, `applyAggregations`, `applyGroupBy`, `paginateRows`, validators, types, metadata constants. Functions requiring ctx (`fetchTableRows`, `applyJoins`) stay in main files.
- **Tenant QB data flow**: `fetchTableRows(primary, tenantId, MAX_ROWS)` → dateRange filter → `applyFilters` → `applyJoins` → `applyAggregations`/`applyGroupBy` → `projectToColumns` → `paginateRows`. All joins in-memory. Pagination is array-offset.
- **Tenant QB row limit**: 5000. Admin QB uses 500 (cross-tenant = larger datasets).

**Frontend:**
- **Suspense boundaries** — Client components with hooks MUST be wrapped in `<Suspense>`. Pattern: inner content component + outer wrapper with Suspense + skeleton fallback.
- **Admin layout** — `(admin)` route group, dark sidebar (`w-[240px]`, `bg-[#0e1333]`), content `px-8 pt-6 pb-8`. Role check in `layout.tsx` via `useQuery(api.auth.getCurrentUser)` + `useEffect` redirect.
- **TenantTabs pattern** — `FilterTabs` from `@/components/ui/FilterTabs`, tab type union, state synced to URL.
- **FadeIn** — Staggered delays (0, 80, 120, 160ms).
- **PageTopbar** — Title + breadcrumb on all admin pages.
- **URL state** — Tenants uses raw `URLSearchParams`. Audit uses `nuqs`. Revenue has none.
- **Fetch-once** — Revenue dashboard: no real-time subscription on aggregate data. `isLoading` derived from `metrics === undefined`.
- **Lazy tab loading** — Conditional `useQuery` gated by active tab state.
- **Button motion** — Built into `<Button>` component. Never use raw `<button>`.
- **QB components** — 15 in `src/components/query-builder/`. All admin additions are additive optional props.

### Files to Reference

| File | Purpose | Key Lines |
| ---- | ------- | --------- |
| `convex/schema.ts` | DB schema | `tenantStats` L648-694, `auditLogs` L450-470, `savedQueries` L698-710, `queryExports` L713-724 |
| `convex/queryBuilder.ts` | Tenant QB (1432 lines) | Whitelist L10-158, validators L164-210, executeQuery L265-464, saved queries L586-843, pure utils L935-1397 |
| `convex/queryBuilderExport.ts` | Tenant QB export (111 lines) | Dual-path CSV, owner/manager auth |
| `convex/tenantStats.ts` | Denormalized counters (755 lines) | 9 hooks, `getOrCreateStats` L21-83, `by_tenant` index |
| `convex/admin/_helpers.ts` | Admin auth (122 lines) | `requireAdmin` L70-92, `readTenantStats` L37-61 |
| `convex/crons.ts` | Cron registration (87 lines) | 9 active crons, interval/weekly pattern |
| `convex/admin/tenants.ts` | Admin tenant queries | `searchTenants`, `getPlatformStats`, `getTenantDetails` |
| `convex/admin/audit.ts` | Admin audit queries | `listAllAuditLogs` (paginated), filter queries |
| `convex/admin/subscriptions.ts` | Admin revenue queries | `getPlatformRevenueMetrics`, `getRecentSubscriptionActivity` |
| `src/app/(admin)/tenants/page.tsx` | Tenants list (584 lines) | 14 URL-synced state vars, hybrid pagination |
| `src/app/(admin)/tenants/[tenantId]/_components/TenantTabs.tsx` | Tabs (49 lines) | `FilterTabs`, tab type union, `buildTabs()` |
| `src/app/(admin)/audit/page.tsx` | Audit log (548 lines) | 3x MultiSelect, nuqs, FilterPillBar |
| `src/app/(admin)/revenue/page.tsx` | Revenue (54 lines) | Delegates to RevenueDashboard (466 lines) |
| `src/app/(admin)/revenue/RevenueDashboard.tsx` | Revenue dashboard (466 lines) | MetricCard, formatCurrency, PHP locale — needs `affiliateMetrics` prop |
| `src/app/(admin)/_components/AdminSidebar.tsx` | Navigation (189 lines) | 6 nav items, inline SVGs, startsWith active |
| `src/app/(auth)/reports/query-builder/page.tsx` | Tenant QB page (reference) | Reference implementation for admin QB page structure |
| `src/proxy.ts` | Route protection (141 lines) | `adminRoutes` array L25 |
| `src/hooks/useQueryBuilder.ts` | QB state (418 lines) | `QueryConfig` type, undo/redo, URL sync via `?q=` base64 |
| `src/components/query-builder/` | 15 QB UI components | See Codebase Patterns section for per-component details |

### Technical Decisions

**ADR 1: QB Backend — Separate Module + Shared Utils**
- Extract ~500 lines of pure logic to `convex/queryBuilder/_utils.ts`: `projectToColumns`, `applyFilters`, `applyAggregations`, `applyGroupBy`, `paginateRows`, shared sub-patterns (`buildGroupKey`, `carryForwardFields`, `flattenJoinedData`, `computeAggregation`), validators, types, metadata constants.
- `fetchTableRows` and `applyJoins` stay in main files (require Convex ctx).
- Both `convex/queryBuilder.ts` and `convex/admin/queryBuilder.ts` import from shared utils.

**ADR 2: Admin Saved Query Storage — Separate Tables**
- `adminSavedQueries`: no tenantId, compound unique name+createdBy, `by_created_by` index.
- `adminQueryExports`: no tenantId, `by_expires_at` index. Actually used (unlike current `queryExports`).

**ADR 3: Dashboard Data — Hybrid with platformStats Singleton**
- `platformStats`: one doc keyed by `key: "platform"`. Fields: totalMRR, totalActiveAffiliates, totalCommissions, totalClicks, totalConversions, totalFraudSignals, activeTenantCount, totalPendingCommissions, totalApprovedCommissions, totalPaidOut, lastUpdatedAt.
- Leaderboard: `.paginate()` on `tenantStats`, top 50-100.

**ADR 4: platformStats Updates — Cron-Only (V1), Two-Tier (P2)**
- **V1**: Hourly cron recalculates from all tenantStats rows. Simple, no hook modifications needed.
- **P2 enhancement**: Extend tenantStats hooks with `ctx.db.patch` delta updates for near-real-time KPIs. Deferred because (a) realistic scale (50-100 tenants/year) doesn't need sub-hourly updates, (b) hook modifications across 9 functions add significant risk, (c) the cron correction mechanism is already sufficient for accuracy.

**ADR 5: Page Architecture — Enhance Existing**
- `/tenants`: Platform Analytics tab (KPIs + leaderboard).
- `/audit`: Fraud Radar section.
- `/revenue`: Affiliate metrics cards.
- `/query-builder`: standalone nav item.

**ADR 6: Component Sharing — Additive Props**
- All admin additions are optional props. No existing contracts change.

**ADR 7: Admin QB Row Limit — 500**
- Hard cap on all queries. Joined-result cap (not per-table). No auto-refresh.

**ADR 8: New Tenant Backfill — Batch Processing**
- Cron discovers missing tenantStats, batches of 10-20, `ctx.scheduler.runAfter()` chaining.

**ADR 9: Admin QB Whitelist — 16 Tables**
- Admin-only (7): `tenants`, `tenantStats`, `billingHistory`, `tierConfigs`, `tierOverrides`, `adminNotes`. (Note: `impersonationSessions` and `performanceMetrics` excluded — they don't exist in schema yet.)
- Shared with tenant QB but expanded (1): `auditLogs` — tenant QB has 5 columns; admin QB adds `tenantId`, `actorId`, `metadata`, `affiliateId`, `targetId` columns.
- Tenant-scoped with tenantId filter (8): `affiliates`, `campaigns`, `clicks`, `conversions`, `commissions`, `payouts`, `payoutBatches`.
- Defined as typed constant `ADMIN_QUERY_TABLES` matching existing `QUERY_TABLES` pattern in tenant QB.

## Implementation Plan

### Tasks

#### Phase 1: Foundation (Schema + Utils Extraction)

- [ ] **Task 1: Add schema tables and fields**
  - File: `convex/schema.ts`
  - Action: Add three new tables and one field:
    1. `platformStats` table: `{ key: v.string(), totalMRR: v.number(), totalActiveAffiliates: v.number(), totalCommissions: v.number(), totalClicks: v.number(), totalConversions: v.number(), totalFraudSignals: v.number(), activeTenantCount: v.number(), totalPendingCommissions: v.number(), totalApprovedCommissions: v.number(), totalPaidOut: v.number(), lastUpdatedAt: v.number() }` with index `by_key: ["key"]`
    2. `adminSavedQueries` table: `{ name: v.string(), description: v.optional(v.string()), queryConfig: v.string(), createdBy: v.id("users"), createdAt: v.number(), updatedAt: v.number() }` with indexes `by_created_by: ["createdBy"]` and `by_name_and_creator: ["name", "createdBy"]`
    3. `adminQueryExports` table: `{ createdBy: v.id("users"), storageFileId: v.id("_storage"), fileName: v.string(), totalRows: v.number(), status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")), createdAt: v.number(), expiresAt: v.number() }` with indexes `by_created_by: ["createdBy"]` and `by_expires_at: ["expiresAt"]`
    4. Add `lastSyncedAt: v.optional(v.number())` field to existing `tenantStats` table (optional = backward-compatible, no migration needed)
  - Notes: Run `pnpm convex deploy` after. The `lastSyncedAt` field addition is backward-compatible since it's optional.

- [ ] **Task 2: Extract shared query builder utils**
  - File: `convex/queryBuilder/_utils.ts` (NEW), `convex/queryBuilder.ts` (MODIFY)
  - Action:
    1. Create `convex/queryBuilder/_utils.ts` as an internal module (not registered in Convex — just a shared TypeScript module)
    2. Move these pure functions from `queryBuilder.ts` to `_utils.ts`:
       - `projectToColumns` (L935-1036, ~101 lines)
       - `applyFilters` (L1094-1156, ~62 lines)
       - `applyAggregations` (L1206-1318, ~112 lines)
       - `applyGroupBy` (L1321-1368, ~47 lines)
       - `paginateRows` (L1370-1397, ~27 lines)
    3. Extract shared sub-patterns into helper functions in `_utils.ts`:
       - `buildGroupKey(row, groupBy)` — the `groupBy.map().join("|||")` pattern used identically in both `applyAggregations` (L1248) and `applyGroupBy` (L1328)
       - `carryForwardFields(firstRow, groupedColumns, aggregatedColumns?)` — first-row carry-forward + `_joined_*` flattening, **consolidating the duplicated logic** at `applyAggregations` L1280-1288 and `applyGroupBy` L1353-1361
       - `computeAggregation(values, fn, rowCount)` — COUNT/SUM/AVG/MIN/MAX switch, eliminating duplication at `applyAggregations` L1219-1239 and L1293-1312
    4. **Refactor** `applyAggregations` and `applyGroupBy` to both call `buildGroupKey`, `carryForwardFields`, and `computeAggregation` — removing all inline duplication
    4. Move validators to `_utils.ts`: `filterOperatorValidator`, `filterValidator`, `joinValidator`, `aggregationValidator`
    5. Move types to `_utils.ts`: `ColumnType`, `ColumnDef`, `TableDef`
    6. Move metadata constants to `_utils.ts`: `OPERATORS_BY_TYPE`, `VALID_OPERATORS`, `VALID_AGGREGATIONS`
    7. In `queryBuilder.ts`: replace all moved code with `import { ... } from "./queryBuilder/_utils"`
    8. Verify: existing tenant QB page at `/reports/query-builder` still functions identically
  - Notes: This is the highest-risk task. Test thoroughly. The `_utils.ts` file uses standard TypeScript module syntax, not Convex function registration.

#### Phase 2: platformStats Module

- [ ] **Task 3: Create platformStats backend module**
  - File: `convex/admin/platformStats.ts` (NEW)
  - Action: Create module with these functions:
     1. `getAggregatePlatformKPIs` (query): Read `platformStats` by `key: "platform"`. If not found, return all zeros. Returns full stats document. Named to avoid collision with existing `api.admin.tenants.getPlatformStats` in `convex/admin/tenants.ts`.
     2. `recalculatePlatformStats` (internalMutation): Iterate ALL `tenantStats` rows via `.paginate()` with batch size 100. **Query raw `tenantStats` documents directly** (NOT via `readTenantStats` helper which only exposes 13 of 30+ fields). Sum all counter fields including: `affiliatesActive`, `commissionsPendingCount`, `commissionsPendingValue`, `commissionsConfirmedThisMonth`, `commissionsConfirmedValueThisMonth`, `commissionsReversedThisMonth`, `commissionsFlagged`, `totalPaidOut`, `totalClicksThisMonth`, `totalConversionsThisMonth`, `organicConversionsThisMonth`. **Handle orphaned stats**: for each tenantStats doc, check if its tenant still exists via `ctx.db.get(tenantId)`. If tenant deleted, skip (or delete the orphaned stats doc). Upsert `platformStats` document. Set `lastUpdatedAt`. Called by hourly cron.
     3. `getTenantLeaderboard` (query): Args `{ paginationOpts, sortBy: v.optional(v.union(v.literal("mrr"), v.literal("affiliates"), v.literal("commissions"), v.literal("conversions"))) }`. Query `tenantStats` with `.paginate()`. Default sort by MRR descending. Returns `{ page, isDone, continueCursor }`.
   - Notes: `requireAdmin(ctx)` on all public functions. Use `paginationOptsValidator` from `convex/server`. Leaderboard max 100 rows via pagination. No incremental hooks in V1 — cron-only updates.

#### Phase 2b: platformStats Cron + Backfill (V1 — No Incremental Hooks)

- [ ] **Task 4: [DEFERRED TO P2] Add platformStats delta updates to tenantStats hooks**
  - File: `convex/tenantStats.ts` (MODIFY)
  - Action: See P2 spec for incremental `updatePlatformDeltas(ctx, deltas)` helper and 9 hook modifications.
  - Notes: Deferred from V1 because: (a) realistic scale doesn't need sub-hourly KPI updates, (b) hook modifications across 9 functions add significant regression risk, (c) hourly cron is sufficient for V1 accuracy.

- [ ] **Task 5: Set lastSyncedAt in existing tenantStats functions**
  - File: `convex/tenantStats.ts` (MODIFY)
  - Action:
    1. In `getOrCreateStats` (L21-83): When creating or resetting a stats document, set `lastSyncedAt: Date.now()`
    2. In `backfillStats`: Set `lastSyncedAt: Date.now()` on every stats document processed
    3. In all hook functions: Optionally update `lastSyncedAt` on each call (or only on month-rollover)
  - Notes: Minimal change. Just add `lastSyncedAt: Date.now()` to the existing `ctx.db.patch()` or `ctx.db.insert()` calls.

- [ ] **Task 6: Register platformStats crons**
  - File: `convex/crons.ts` (MODIFY)
  - Action: Add two new cron jobs:
    1. Hourly platformStats recalculation: `crons.interval("recalculate-platform-stats", { hours: 1 }, internal.admin.platformStats.recalculatePlatformStats, {})`
    2. New tenant backfill: `crons.interval("backfill-new-tenant-stats", { hours: 4 }, internal.tenantStats.discoverAndBackfillNewTenants, {})`
  - Notes: Follow existing cron pattern exactly. Must add the `discoverAndBackfillNewTenants` internalAction in Task 8.

- [ ] **Task 7: Create new tenant batch backfill**
  - File: `convex/tenantStats.ts` (MODIFY)
  - Action: Add `discoverAndBackfillNewTenants` internalAction:
    1. Query tenants with `.paginate({ numItems: 200, cursor: args.cursor })` — cap at 200 per batch to avoid unbounded `.collect()` even on the low-volume tenants table
    2. For each tenant, check if `tenantStats` exists via `withIndex("by_tenant")`
    3. Collect up to **10** tenants missing stats (reduced from 20 to stay within function timeout)
    4. Process batch: backfill each tenant's stats via `ctx.runMutation(internal.tenantStats.backfillStats, { tenantId })`
    5. Add timeout guard: if approaching 20 seconds elapsed (use `Date.now()` check), stop and schedule next batch
    6. If more remain, schedule next batch: `ctx.scheduler.runAfter(0, internal.tenantStats.discoverAndBackfillNewTenants, { cursor: continueCursor })`
    7. Accept optional `cursor` arg from previous invocation
  - Notes: Uses `"use node"` directive for Node.js runtime (needed for `ctx.scheduler`). Reduced batch to 10 to avoid function timeout when `backfillStats` is slow per-tenant.

#### Phase 3: Admin Query Builder Backend

- [ ] **Task 8: Create admin query builder backend**
  - File: `convex/admin/queryBuilder.ts` (NEW)
  - Action: Create the admin query builder module with these functions:
     0. Define `ADMIN_QUERY_TABLES: Record<string, TableDef>` typed constant matching existing `QUERY_TABLES` pattern. Tables: `tenants`, `tenantStats`, `billingHistory`, `auditLogs`, `tierConfigs`, `tierOverrides`, `adminNotes` (7 admin-only), `affiliates`, `campaigns`, `clicks`, `conversions`, `commissions`, `payouts`, `payoutBatches` (8 tenant-scoped). Each table has full column definitions. `auditLogs` includes expanded columns (`tenantId`, `actorId`, `metadata`, `affiliateId`, `targetId`) not in tenant version.
     1. `getTableMetadata` (query): Return `ADMIN_QUERY_TABLES` + suggested joins. Call `requireAdmin(ctx)`. Returns `{ tables, suggestedJoins }`.
     2. `executeQuery` (query): Same processing pipeline as tenant QB but:
        - Call `requireAdmin(ctx)` instead of `getAuthenticatedUser`
        - Admin table whitelist from `ADMIN_QUERY_TABLES` (16 tables)
        - When querying tenant-scoped tables: if no `tenantId` filter provided, query across ALL tenants (no `withIndex("by_tenant")` filter)
        - Hard `.take(500)` cap (not 5000)
        - Log warning when querying high-volume tables without tenantId filter
        - Count-first: before executing, estimate total result size via `tenantStats` counters or table scan, include in response
        - Import shared utils from `convex/queryBuilder/_utils`
    3. `getDistinctColumnValues` (query): Same as tenant version but with admin auth + admin tables + optional tenantId filter.
    4. `saveQuery` (mutation): Insert into `adminSavedQueries`. `requireAdmin(ctx)`. Set `createdBy` from admin user.
    5. `listSavedQueries` (query): Query `adminSavedQueries` by `by_created_by` index. `requireAdmin(ctx)`.
    6. `updateSavedQuery` (mutation): Update by `by_name_and_creator` compound. Only creator can update.
    7. `deleteSavedQuery` (mutation): Delete by document ID. Only creator can delete.
    8. `estimateQueryComplexity` (query): Same as tenant version but WITH auth check (fix the tenant QB's auth-less version).
    9. `cleanupExpiredAdminExports` (internalMutation): Delete expired exports from `adminQueryExports` table. Mirror tenant version.
  - Notes: Import `requireAdmin` from `./admin/_helpers`. Import shared utils from `../queryBuilder/_utils`. `fetchTableRows` and `applyJoins` are implemented locally (they need Convex ctx).

- [ ] **Task 9: Create admin query builder export**
  - File: `convex/admin/queryBuilderExport.ts` (NEW)
  - Action: Create admin export module:
    1. `exportAdminQueryBuilderCSV` (action): Same dual-path as tenant export (≤5k base64, >5k Convex storage). Auth: `requireAdmin(ctx)`. Insert record into `adminQueryExports` table (fixing the tenant QB's unused table pattern). Log export to `auditLogs` with action `"admin_query_export"`, metadata including table names, row count, column names.
    2. `getAdminExportDownloadUrl` (action): Auth + `ctx.storage.getUrl()`.
  - Notes: `"use node"` directive required. Export audit logging is critical for PII tracking.

#### Phase 4: Admin Query Builder Frontend

- [ ] **Task 10: Update useQueryBuilder hook for admin mode**
  - File: `src/hooks/useQueryBuilder.ts` (MODIFY)
  - Action:
    1. Add `UseQueryBuilderOptions` interface: `{ isAdminMode?: boolean; targetTenantId?: string; fixedFilters?: QueryConfig["filters"]; maxRowLimit?: number }`
    2. Change signature: `useQueryBuilder(options?: UseQueryBuilderOptions)`
    3. When `options.isAdminMode`: set `maxRowLimit` default to 500 (instead of 100). Disable URL sync (admin queries are ephemeral).
    4. When `options.fixedFilters`: exclude them from cascade cleanup in `setTables()`. Include them in `resetConfig()`.
    5. Maintain full backward compatibility: `useQueryBuilder()` with no args works identically to current behavior.
  - Notes: Existing tenant QB passes no args → no behavior change.

- [ ] **Task 11: Add optional admin props to QB UI components**
  - Files: `src/components/query-builder/TableSelector.tsx`, `FilterBuilder.tsx`, `AggregationBuilder.tsx`, `ResultsTable.tsx`, `TemplateGallery.tsx`, `SavedQueriesList.tsx`, `SaveQueryDialog.tsx`, `QueryExportButton.tsx` (ALL MODIFY)
  - Action: For each component, add ONLY the specific optional props identified in the investigation:
    1. `TableSelector`: Add `isAdminMode?: boolean`, `availableTables?: string[]`
    2. `FilterBuilder`: Add `tenantId?: string`, `fixedFilters?: Filter[]`
    3. `AggregationBuilder`: Add `extraGroupByOptions?: Array<{ table: string; column: string; label: string }>`
    4. `ResultsTable`: Add `isAdminMode?: boolean`, `onRowClick?: (row) => void`
    5. `TemplateGallery`: Add `extraTemplates?: Template[]`
    6. `SavedQueriesList`: Add `isAdminMode?: boolean`, `showMetadata?: boolean`
    7. `SaveQueryDialog`: Add `isAdminMode?: boolean`
    8. `QueryExportButton`: Add `isAdminMode?: boolean`
    9. `types.ts`: Add `AdminTemplate` type extending `Template` with optional `piiWarning?: boolean`
  - Notes: All props are optional. When not provided, components behave identically. No existing prop contracts change.

- [ ] **Task 12: Create admin query builder page**
  - File: `src/app/(admin)/query-builder/page.tsx` (NEW)
  - Action:
    1. Create page following admin Suspense pattern (outer wrapper + inner content)
    2. Import and configure `useQueryBuilder({ isAdminMode: true, maxRowLimit: 500 })`
    3. Use admin-specific Convex queries: `api.admin.queryBuilder.getTableMetadata`, `api.admin.queryBuilder.executeQuery`, `api.admin.queryBuilder.listSavedQueries`, etc.
    4. Reuse existing QB components with admin props:
       - `TemplateGallery extraTemplates={adminTemplates}` — 5 pre-built admin templates
       - `TableSelector isAdminMode availableTables={adminTables}`
       - `FilterBuilder` (with optional tenantId filter)
       - `ResultsTable isAdminMode onRowClick={handleRowClick}`
       - `SavedQueriesList isAdminMode showMetadata`
       - `SaveQueryDialog isAdminMode`
       - `QueryExportButton isAdminMode`
    5. Add prominent "⚠️ Platform Admin — All Tenant Data" badge at top
    6. Add "Contains PII" warning on export dialog when query includes email/name fields
    7. Add count-first truncation warning: when `totalRows > resultRows`, show "⚠️ Showing 500 of ~{totalRows} results"
    8. Follow existing tenant QB page structure as reference (`src/app/(auth)/reports/query-builder/page.tsx`)
    9. Create custom `AdminQueryBuilderSkeleton` for Suspense fallback
  - Notes: The tenant QB page at `src/app/(auth)/reports/query-builder/page.tsx` is the reference implementation. Admin version differs only in: Convex query targets, table whitelist, row limit (500), admin badge, and PII/export warnings.

- [ ] **Task 13: Define admin query builder templates**
  - File: `src/app/(admin)/query-builder/page.tsx` (in Task 12) or `src/components/query-builder/adminTemplates.ts` (NEW)
  - Action: Create 5 pre-built query templates:
    1. **Top 10 Tenants by MRR**: Tables: `tenants`, `tenantStats`. Join: tenants→tenantStats. Columns: tenant name, MRR, affiliate count. Sort: MRR desc. Limit: 10.
     2. **Fraud Rate by Tenant**: Tables: `tenantStats`. Columns: tenantId, commissionsFlagged, commissionsPendingCount, commissionsConfirmedThisMonth, commissionsReversedThisMonth. Fraud rate derived as `commissionsFlagged / (commissionsPendingCount + commissionsConfirmedThisMonth + commissionsReversedThisMonth)`. Aggregation: grouped by tenantId. Limit: 50.
    3. **Commission Volume Trends (30 days)**: Tables: `commissions`. Columns: status, amount, createdAt. Date range: last 30 days. Aggregation: COUNT + SUM by status. Group by status.
    4. **Affiliate Growth by Plan**: Tables: `tenants`, `affiliates`. Columns: tenant name, plan, affiliate count. Aggregation: COUNT by plan. Limit: 50.
    5. **Audit Activity Heatmap**: Tables: `auditLogs`. Columns: action, actorType, createdAt. Date range: last 30 days. Aggregation: COUNT by action.
  - Notes: Templates use the same `QueryConfig` type. Include proper join definitions for cross-table templates.

#### Phase 5: Enhanced Admin Pages

- [ ] **Task 14: Add Platform Analytics view to /tenants**
  - File: `src/app/(admin)/tenants/page.tsx` (MODIFY)
  - Action:
    1. Add view toggle state: `activeView: "tenants" | "analytics"` (synced to URL via `?view=analytics` in the existing `useEffect` that syncs state to URL)
    2. Add view toggle UI: **NOT** FilterTabs (those are for tenant detail). Use two toggle buttons (similar to FilterPills pattern) in the top bar area: "Tenant List" / "Platform Analytics"
    3. **Extract tenant list into a sub-component `TenantListContent`**: Move ALL 14 URL-synced state variables and their associated `useEffect` hooks into a new `TenantListContent` component that only renders when `activeView === "tenants"`. This prevents the analytics view from triggering tenant-list state effects or URL parameter conflicts. The wrapper page only manages `activeView` and conditionally renders either `<TenantListContent />` or `<PlatformAnalyticsContent />`.
    4. Create `PlatformAnalyticsContent` component (lazy-loaded, conditional `useQuery`):
        a. Fetch `api.admin.platformStats.getAggregatePlatformKPIs` → KPI cards (Total MRR, Active Affiliates, Total Commissions, Total Fraud Signals, Active Tenants)
        b. Fetch `api.admin.platformStats.getTenantLeaderboard` → sortable table (Tenant Name, MRR, Affiliates, Commissions, Conversions, Clicks)
        c. Show staleness warning if `platformStats.lastUpdatedAt` > 2 hours ago
        d. Use `MetricCard` component (from revenue page) for KPIs
        e. Use existing `DataTablePagination` for leaderboard
    5. Create `PlatformAnalyticsSkeleton` for Suspense fallback
    6. Existing tenant list behavior is UNCHANGED when `activeView === "tenants"`
  - Notes: Tab content only fetches data when selected (lazy loading). Follow fetch-once pattern. No real-time subscriptions on KPIs.

- [ ] **Task 15: Add Fraud Radar section to /audit**
  - File: `src/app/(admin)/audit/page.tsx` (MODIFY)
  - Action:
    1. Add new Convex query `api.admin.audit.getPlatformFraudSummary` (in `convex/admin/audit.ts`):
       - Args: `{ paginationOpts }` 
       - Query `tenantStats` with `.paginate()`, filter where `commissionsFlagged > 0`
       - Return: `{ tenantId, tenantName, commissionsFlagged, totalCommissions, fraudRate }`
    2. Add "Fraud Radar" section above the existing audit log list (conditionally rendered):
       a. Summary KPI: total flagged commissions across platform (from `platformStats`)
       b. Table of tenants with fraud signals, sorted by `fraudRate` descending
       c. Each row links to `/tenants/[tenantId]?tab=overview` for drill-down
    3. Add a visual separator between Fraud Radar and audit log sections
  - Notes: Fraud Radar reads from `tenantStats` (pre-computed), not from raw `commissions` table. No unbounded queries.

- [ ] **Task 16: Add affiliate metrics to /revenue**
  - File: `src/app/(admin)/revenue/page.tsx` (MODIFY), `src/app/(admin)/revenue/RevenueDashboard.tsx` (MODIFY)
  - Action:
    1. Add `api.admin.platformStats.getAggregatePlatformKPIs` as a second query in the page
    2. Pass platform stats to `RevenueDashboard` component via a NEW prop: `affiliateMetrics?: { totalCommissions: number; totalPaidOut: number; pendingCommissions: number; totalConversions: number } | null`
    3. Add a new card row in `RevenueDashboard` (only rendered if `affiliateMetrics` is not null):
        a. "Total Platform Commissions" (from `affiliateMetrics.totalCommissions`)
        b. "Total Paid Out" (from `affiliateMetrics.totalPaidOut`)
        c. "Pending Commissions" (from `affiliateMetrics.pendingCommissions`)
        d. "Total Conversions" (from `affiliateMetrics.totalConversions`)
    4. Use distinct prop names (`affiliateMetrics`) to avoid collision with existing `metrics` prop from `getPlatformRevenueMetrics`
    5. Use same `MetricCard` component and `formatCurrency` helper as existing cards
    6. Add to skeleton fallback
  - Notes: Minimal change — just 4 more MetricCards using already-fetched platformStats data.

#### Phase 6: Navigation + Route Protection

- [ ] **Task 17: Add sidebar nav item and route protection**
  - Files: `src/app/(admin)/_components/AdminSidebar.tsx` (MODIFY), `src/proxy.ts` (MODIFY)
  - Action:
    1. In `AdminSidebar.tsx`: Add new nav item to `adminNavItems` array AFTER "Revenue" and BEFORE "Tier Config":
       `{ href: "/query-builder", label: "Query Builder", icon: <Database SVG inline> }`
        Use a database/table icon (inline SVG matching existing style: `w-[18px] h-[18px]`, stroke-based)
     2. In `src/proxy.ts`: Add `"/query-builder"` to the `adminRoutes` array
     3. **Improve sidebar active matching**: Change from `pathname.startsWith(item.href)` to precise matching: `pathname === item.href || pathname.startsWith(item.href + "/")` — prevents `/query-builder` from matching `/query-builders` or future routes that start with `/query-builder`
  - Notes: The improved matching should be applied to ALL existing nav items too (not just the new one) for consistency, but the new item is the only one at risk currently.

- [ ] **Task 18: Add getPlatformFraudSummary query**
  - File: `convex/admin/audit.ts` (MODIFY)
  - Action: Add new query:
    ```typescript
    export const getPlatformFraudSummary = query({
      args: { paginationOpts: paginationOptsValidator },
      returns: v.object({ page: v.array(v.object({ ... })), isDone: v.boolean(), continueCursor: v.string().nullable() }),
      handler: async (ctx, args) => {
        const admin = await requireAdmin(ctx);
        // Query tenantStats where commissionsFlagged > 0, join with tenants for name
        // Paginate, sort by fraudRate desc
        // Return paginated results
      }
    });
    ```
  - Notes: Uses `tenantStats` (pre-computed), no raw commission table scan. Join with `tenants` for tenant name.

#### Phase 7: Polish + Cleanup

- [ ] **Task 19: Verify and test full integration**
  - Files: All modified files
  - Action:
    1. Run `pnpm dev` and verify no build errors
    2. Verify tenant QB at `/reports/query-builder` still works identically (regression check)
    3. Verify admin QB at `/query-builder` loads, shows admin badge, templates work, query executes with 500-row cap
    4. Verify Platform Analytics tab on `/tenants` shows KPIs and leaderboard
    5. Verify Fraud Radar section on `/audit` shows fraud summary
    6. Verify affiliate metrics on `/revenue` show commission data
    7. Verify admin sidebar shows "Query Builder" nav item
    8. Verify `/query-builder` is protected (redirects non-admins)
    9. Verify export creates audit log entry
    10. Verify PII warning appears on export when email/name fields are selected
  - Notes: Manual smoke test. No automated tests required per project convention (placeholder tests only exist).

### Acceptance Criteria

- [ ] **AC 1**: Given a platform admin user, when they navigate to `/tenants?view=analytics`, then they see platform-wide KPIs (Total MRR, Active Affiliates, Total Commissions, Fraud Signals, Active Tenants) and a tenant leaderboard table sortable by MRR/affiliates/commissions/conversions.
- [ ] **AC 2**: Given a platform admin user, when they navigate to `/audit`, then they see a Fraud Radar section above the audit log listing tenants with fraud signals sorted by fraud rate.
- [ ] **AC 3**: Given a platform admin user, when they navigate to `/revenue`, then they see additional metric cards for Total Platform Commissions, Total Paid Out, Pending Commissions, and Total Conversions.
- [ ] **AC 4**: Given a platform admin user, when they navigate to `/query-builder`, then they see the admin query builder with a "⚠️ Platform Admin — All Tenant Data" badge and 5 pre-built admin templates.
- [ ] **AC 5**: Given an admin using the query builder, when they select admin-only tables (tenants, tenantStats, auditLogs, etc.), then those tables appear in the table selector and their columns are available for filtering and aggregation.
- [ ] **AC 6**: Given an admin executing a cross-tenant query without tenantId filter, when the result exceeds 500 rows, then they see a truncation warning "⚠️ Showing 500 of ~{N} results" and no auto-refresh occurs.
- [ ] **AC 7**: Given an admin saving a query, when they save with a name that already exists for their user, then the save succeeds (same name allowed for different admins via compound uniqueness name+createdBy).
- [ ] **AC 8**: Given an admin exporting query results containing email/name fields, when they click export, then a "Contains PII" warning appears in the export dialog before proceeding.
- [ ] **AC 9**: Given an admin exporting query results, when the export completes, then an entry is logged in `auditLogs` with action "admin_query_export" including table names, row count, and timestamp.
- [ ] **AC 10**: Given a non-admin user, when they navigate to `/query-builder`, then they are redirected to `/sign-in` (route protection).
- [ ] **AC 11**: Given the tenant query builder at `/reports/query-builder`, when a tenant user accesses it, then it functions identically to before (no regression from shared utils extraction).
- [ ] **AC 12**: Given `platformStats` has not been updated in >2 hours, when the Platform Analytics tab is loaded, then a staleness warning is displayed.
- [ ] **AC 13**: Given a new tenant is created, when the backfill cron runs (every 4 hours), then the new tenant's `tenantStats` are created and `platformStats` is updated.
- [ ] **AC 14**: Given an admin query builder export, when the export completes, then a record is created in `adminQueryExports` table (unlike the tenant QB which never writes to its exports table).

## Additional Context

### Dependencies

- **Task 2** (utils extraction) must complete before **Task 8** (admin QB backend) — both import from `_utils.ts`
- **Task 1** (schema) must complete before **Tasks 3-9** (all backend modules) — tables must exist
- **Task 3** (platformStats module) must complete before **Tasks 14-16** (enhanced admin pages) — pages call platformStats queries
- **Task 8** (admin QB backend) must complete before **Task 12** (admin QB page) — page calls backend queries
- **Task 10** (hook update) + **Task 11** (component props) must complete before **Task 12** (admin QB page)
- **Task 18** (fraud summary query) must complete before **Task 15** (fraud radar UI)
- **Task 4** is deferred to P2 — no V1 dependencies

### Testing Strategy

**Manual Testing (primary — project has no production tests):**
- Regression: Verify tenant QB `/reports/query-builder` works after utils extraction
- Admin QB: Execute all 5 templates, verify results, verify 500-row cap
- Admin QB: Save/load/delete queries, verify isolation from tenant saved queries
- Admin QB: Export with PII fields → verify warning + audit log
- Platform Analytics: Verify KPIs match platformStats, verify leaderboard pagination
- Fraud Radar: Verify fraud summary shows flagged tenants
- Route protection: Verify non-admin redirect on `/query-builder`

**Unit Tests (MANDATORY for _utils.ts extraction):**
- `convex/queryBuilder/_utils.ts` — Pure functions, testable in Vitest without Convex. **These tests are required** because the utils extraction is the highest-risk task (breaks tenant QB if done wrong):
  - `applyFilters` — all 12 operators, AND/OR logic, edge cases (null values, empty arrays)
  - `applyAggregations` — COUNT/SUM/AVG/MIN/MAX with and without GROUP BY
  - `applyGroupBy` — group key generation, count accuracy
  - `buildGroupKey` — multi-column grouping, null handling
  - `paginateRows` — offset pagination, isDone/continueCursor correctness
  - `projectToColumns` — column selection, alias resolution
- Test file: `convex/queryBuilder/_utils.test.ts`

### Risk Mitigations

1. **Cross-tenant data leak** — `requireAdmin(ctx)` server-side in every admin function. Separate Convex module.
2. **Database overload** — 500-row hard cap. No auto-refresh. Joined-result cap (not per-table).
3. **Stale KPIs** — Hourly cron recalculates from all tenantStats. Staleness warning shown when >2 hours old. P2 would add incremental hooks for sub-hourly accuracy.
4. **Component regression** — All admin props are optional and additive. Tenant QB defaults unchanged.
5. **Saved query leakage** — Separate `adminSavedQueries` table. Zero cross-contamination.
6. **Export PII** — Warning dialog + audit log entry on every export.
7. **platformStats drift** — Hourly correction cron recalculates from all tenantStats.
8. **Utils extraction breaks tenant QB** — Extract ONLY pure functions (no ctx). Test tenant QB after.
9. **New tenant gaps** — Batch backfill cron every 4 hours. `lastSyncedAt` field for detection.
10. **Tenant deletion during query** — Not an issue (Convex transactional consistency).

### Notes

- Builds on `tech-spec-owner-reports-p0-p1.md` (ready-for-dev) and `tech-spec-query-builder-custom-reports.md` (complete).
- War room decision to enhance existing pages avoids sidebar bloat and reduces scope significantly.
- `platformStats` singleton eliminates `.collect()` on tenantStats for KPIs — single-doc fetch scales infinitely.
- Two-tier update strategy balances near-real-time accuracy with long-term correctness.
- Admin QB has 16 whitelisted tables (7 admin-only + 1 shared with expanded columns + 8 tenant-scoped). Tenant QB has 8 tables. `auditLogs` is shared but admin version has additional columns.
- **Task 4 (incremental platformStats hooks) deferred to P2** — V1 uses cron-only updates. This reduces V1 backend risk significantly (no hook modifications needed across 9 functions).
- Current `queryExports` table is never written to by tenant QB. Admin QB should actually use its export tracking table (design decision ADR 2).
- `estimateQueryComplexity` in tenant QB has no auth check — admin version fixes this.
- Revenue page currently has no chart library despite Tremor being in stack. Admin analytics can use Tremor if charts are added later.
