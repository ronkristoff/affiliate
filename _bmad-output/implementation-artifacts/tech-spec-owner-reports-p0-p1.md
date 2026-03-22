---
title: "P0 & P1 Owner Reports — Scalable Reports Module"
slug: "owner-reports-p0-p1"
created: "2026-03-22"
status: "ready-for-dev"
stepsCompleted: [1, 2, 3, 4, "adversarial-review"]
tech_stack: ["Next.js 16 (App Router)", "Convex 1.32", "TypeScript 5.9", "Tailwind CSS v4", "Radix UI", "Tremor (@tremor/react)", "Vitest 4.1", "convex-test"]
files_to_modify: ["convex/schema.ts", "convex/reports.ts", "convex/reportsExport.ts", "convex/tenantStats.ts", "convex/payouts.ts", "convex/fraudSignals.ts", "convex/fraudDetection.ts", "convex/commissions.ts", "src/app/(auth)/reports/layout.tsx", "src/app/(auth)/reports/page.tsx", "src/app/(auth)/reports/affiliates/page.tsx", "src/app/(auth)/reports/campaigns/page.tsx", "src/app/(auth)/reports/commissions/page.tsx", "src/app/(auth)/reports/payouts/page.tsx", "src/app/(auth)/reports/funnel/page.tsx", "src/app/(auth)/reports/fraud/page.tsx", "src/hooks/useDateRange.ts", "src/components/ui/DataTable.tsx", "src/components/shared/Sidebar.tsx"]
code_patterns: ["convex-new-function-syntax", "rbac-authenticated-user", "date-range-validator", "pagination-opts-validator", "tenantstats-read-for-summary", "status-approved-confirmed-equivalence", "trend-bucket-aggregation", "period-over-period-comparison", "export-base64-csv-action", "suspense-boundary-wrapper", "datatable-url-state-hook"]
test_patterns: ["vitest-globals", "convex-test-backend", "frontend-unit-no-rendering"]
---

# Tech-Spec: P0 & P1 Owner Reports — Scalable Reports Module

**Created:** 2026-03-22

## Overview

### Problem Statement

The SaaS Owner ("Alex") currently has 3 report pages (Program Summary, Campaign Performance, Affiliate Performance) but they lack critical business views: commission aging/payout tracking, conversion funnel analysis, fraud visibility, and campaign ROI comparison. Additionally, ALL existing report queries use unbounded `.collect()` on high-volume tables (`clicks`, `conversions`, `commissions`), which violates scalability guidelines and will crash at scale.

Alex's daily use case is narrow — he opens the app for ~90 seconds and needs to see: (1) how much does he owe? (2) is anything suspicious? (3) are his top affiliates still performing? The current reports require too many clicks to answer these questions.

### Solution

1. **Fix scalability first (Phase 1)** — Refactor all existing report queries to use `.paginate()` or capped `.take()` calls. Add new composite time-range indexes on `clicks`, `conversions`, and `commissions` for efficient date-range filtering.
2. **Upgrade navigation** — Replace card-grid nav with horizontal sub-nav bar in a shared `reports/layout.tsx`. Category grouping: 💰 Financial (Commissions, Payouts, Funnel) | 📊 Performance (Affiliates, Campaigns) | 🛡️ Risk (Fraud).
3. **Enhance home page as "morning glance"** — Use `tenantStats` for pre-computed counter windows: "This Month", "Last Month", "Last 3 Months". No arbitrary date range — only fixed preset windows that `tenantStats` serves without table scans. Surface "amounts owed", "fraud flags", "top performer changes" directly on `/reports`.
4. **Enhance 2 existing report pages (Phase 2a — P0)** — Add affiliate segments to Affiliate Performance, add ROI metrics and side-by-side comparison to Campaign ROI.
5. **Add new report pages (Phase 2b — P0 first, then P1)** — Commission & Payout Summary, Payout History & Trends, Conversion Funnel, Fraud & Risk Dashboard. Ship P0s first, validate usage before building P1s.

### Scope

**In Scope:**
- Scalability fix for ALL existing report queries in `convex/reports.ts` (eliminate unbounded `.collect()`)
- Add composite time-range indexes on `clicks` (`by_tenant_and_creationTime`), `conversions` (`by_tenant_and_creationTime`), and `commissions` (`by_tenant_and_creationTime`) in `convex/schema.ts` for efficient date-range-filtered pagination
- Add `by_tenant_flagged` index on `commissions` for fraud report (F1 fix)
- Shared `reports/layout.tsx` for horizontal sub-nav bar with category grouping
- "Morning glance" enhancements on `/reports` home page — uses `tenantStats` with preset selector (This Month / Last Month / Last 3 Months). No arbitrary date range on home page.
- Extend `tenantStats` with `lastMonth*` and `last3Months*` counter fields for the preset selector
- Post-filter truncation warning banner on sub-report pages when data may be incomplete
- Compute affiliate segments client-side from table data to prevent count divergence
- New `/reports/commissions` page — Commission & Payout Summary with status aging buckets
- New `/reports/payouts` page — Payout History & Trends with batch-level detail
- New `/reports/funnel` page — Conversion Funnel per affiliate (Clicks → Conversions → confirmed Commissions only)
- New `/reports/fraud` page — Fraud & Risk Dashboard with flagged commissions and fraud signals
- Enhanced `/reports/affiliates` — Add affiliate segments (Top Performers, Rising Stars, Needs Attention, Inactive)
- Enhanced `/reports/campaigns` — Add cost-efficiency metrics (cost per conversion, conv. efficiency) and side-by-side comparison mode
- CSV export support for all new report pages (generate up to 10k rows, count first to warn if truncated)
- "Needs Attention" alert banner on `/reports` home page
- Update `Sidebar.tsx` to surface report sub-pages
- Run `backfillStats` migration on existing tenants after deployment

**Out of Scope:**
- Referral Source Analysis report (P2)
- Broadcast Email Performance report (P2)
- Customer LTV / Cohort Report (P2 — needs subscription event tracking)
- Scheduled/Email Reports (P2 — needs scheduling infrastructure)
- Affiliate portal reports (separate user persona)
- Real-time streaming updates for reports
- Cross-tenant fraud visibility for Platform Admin (future consideration)

## Context for Development

### Codebase Patterns

- **Convex new function syntax** — All queries/mutations use `query({ args, returns, handler })` pattern
- **Validators required** — ALL functions must have `args` and `returns` validators
- **RBAC pattern** — `getAuthenticatedUser(ctx)` + role check (`owner`/`manager` for sensitive data)
- **Date range pattern** — Shared `dateRangeValidator = v.optional(v.object({ start: v.number(), end: v.number() }))` and `useDateRange` hook (syncs to URL via `?range=30d` or `?start=...&end=...`)
- **Pagination pattern** — `paginationOptsValidator` from `convex/server` used throughout; returns `{ page, isDone, continueCursor }`
- **Export pattern** — Actions in `convex/reportsExport.ts` with `"use node"` directive, return base64-encoded CSV; RBAC check via `betterAuthComponent.getAuthUser(ctx)`
- **Suspense boundaries** — Client components using hooks MUST be wrapped in `<Suspense>` with skeleton fallbacks
- **Button motion** — All buttons use `<Button>` from `@/components/ui/button` with built-in `btn-motion` CSS
- **Status inconsistency** — `"approved"` and `"confirmed"` are used interchangeably for commission statuses; `"reversed"` and `"declined"` also equivalent. Always check both.
- **No unbounded `.collect()`** — High-volume tables (`clicks`, `conversions`, `commissions`, `payouts`, `affiliates`) must use `.take(N)`, `.paginate()`, or read from `tenantStats`
- **tenantStats hooks** — Mutations changing status on `affiliates`, `commissions`, or `payouts` MUST call corresponding `tenantStats` hook functions
- **Convex index behavior** — `_creationTime` is implicitly appended to all Convex indexes. Explicitly including `_creationTime` in composite indexes (e.g., `["tenantId", "_creationTime"]`) enables efficient time-range pagination with `.order("desc")` followed by post-filter on `item._creationTime >= startDate`.
- **Data access two-tier pattern** — Home page "morning glance" reads from `tenantStats` (current-month counters, zero table scans, no date range). All sub-report pages use capped `.take()` queries on composite time-range indexes. This separation is critical because `tenantStats` resets on month boundaries and cannot support arbitrary date ranges.
- **Post-filter pagination pattern** — For date-range queries: `.withIndex("by_tenant_and_creationTime", q => q.eq("tenantId", tenantId)).order("desc").take(5000)` then filter `item._creationTime >= startDate && item._creationTime <= endDate` in JavaScript. This works because `.order("desc")` returns newest first — if 5000 items are collected and none match the date range, the range has no data.
- **Post-filter data truncation warning** — The `.take(5000)` cap means old date ranges may silently lose data (e.g., querying 6 months ago with `.order("desc").take(5000)` returns the 5000 newest items which are all recent). When the post-filter result is significantly smaller than expected (< 80% of `.take()` cap), the frontend should display a warning: "Showing X of ~Y estimated records. Narrow the date range for more accurate data." This is a known trade-off — the alternative is unbounded queries which crash at scale. **Implementation**: Each sub-report query returns `totalEstimated: number` alongside the results. The frontend compares `results.length / totalEstimated < 0.8` to trigger the warning banner. `totalEstimated` is computed as `collectedCount * (filteredCount / collectedCount)` if filteredCount > 0, else `collectedCount`.
- **Trend bucket pattern** — Daily (<30 days) or weekly (>30 days) time-bucket aggregation exists in `reports.ts` lines 523-564 and 1161-1202
- **Period-over-period pattern** — Previous period calculation: `previousStartDate = startDate - periodLength` used in `getCampaignSummaryMetrics`, `getAffiliateSummaryMetrics`, `getProgramSummaryMetrics`
- **DataTable component** — Full-featured `DataTable<T>` (747 lines) with typed columns, column-level filtering (Text, Select, NumberRange, DateRange), sorting, row selection, bulk actions. Paired with `DataTablePagination`, `FilterChips`, `SearchField`, `useDataTableUrlState` hook.
- **Chart library: Tremor (`@tremor/react`)** — Tailwind-native dashboard chart library. Wraps Recharts internally. Provides `BarChart`, `LineChart`, `AreaChart`, `DonutChart` with pre-styled components matching our design system. Custom brand colors (`#10409a`, `#1659d6`) passed via `color` prop. Covers 96% of chart needs across all 6 report pages.
- **Funnel visualization: Hand-rolled CSS/Tailwind** — No chart library has a good funnel component. CSS stepped horizontal bars with decreasing widths, labels, and conversion rate percentages between steps. Pure Tailwind utility classes, no library dependency.
- **Existing hand-rolled SVG charts** — `AffiliateTrendChart` (224 lines) and `CampaignTrendChart` (183 lines) should be **replaced with Tremor `AreaChart`** during enhancement for consistency. Remove the old SVG components after migration.

### Files to Reference

| File | Purpose | Key Details |
| ---- | ------- | ----------- |
| `convex/schema.ts` | Database schema | All tables, indexes, field definitions. Commission statuses: pending/confirmed/approved/reversed/declined/paid |
| `convex/reports.ts` | Existing report queries | 1589 lines, ALL use unbounded `.collect()`. 8 query functions + 2 export data helpers. Needs full refactor. |
| `convex/reportsExport.ts` | CSV export actions | 3 export actions with `"use node"`. Auth via `betterAuthComponent.getAuthUser`. RBAC: owner/manager only. |
| `convex/tenantStats.ts` | Denormalized counters | 14 counters: affiliate counts by status, commission pending/confirmed/reversed/flagged counts+values, totalPaidOut, pendingPayoutTotal+Count. `getStats` query for reading. |
| `convex/payouts.ts` | Payout queries/mutations | `getPayoutBatches` (paginated), `getBatchPayouts`, `getPendingPayoutTotal` (reads tenantStats). `generatePayoutBatch`, `markPayoutAsPaid`. |
| `convex/fraudSignals.ts` | Fraud signal queries | `getAffiliateFraudSignals` (filtered/sorted), `dismissFraudSignal`, `suspendAffiliateFromFraudSignal`, `getFraudSignalStats` (counts by severity/review). Signal types: selfReferral, botTraffic, ipAnomaly, manual_suspicion. Severity: low/medium/high. |
| `convex/fraudDetection.ts` | Self-referral detection | `detectSelfReferral` (compares email, IP/subnet, device, payment method), `addSelfReferralFraudSignal`. |
| `convex/commissions.ts` | Commission queries/mutations | `listPendingCommissions` (paginated, `by_tenant_and_status`). Status filter maps "confirmed" → `["confirmed", "approved"]`. 1862 lines. |
| `src/app/(auth)/layout.tsx` | Auth layout with sidebar | Client component + Suspense. Sidebar via `<Sidebar />` (240px fixed). ImpersonationBanner. Uses `api.auth.getCurrentUser`. |
| `src/components/shared/Sidebar.tsx` | Sidebar navigation | `NavItem[]` with href, label, icon, badge. Reports nav item exists. |
| `src/app/(auth)/reports/page.tsx` | Reports home page | 4 MetricCards (MRR, Clicks, Conversions, Commissions) + 2 nav cards + Top Affiliates table. Uses `useDateRange`, `CampaignFilterDropdown`, `DateRangeSelector`. |
| `src/app/(auth)/reports/affiliates/page.tsx` | Affiliate report page | PerformanceTable, MetricsSummary, DetailView. Uses `useDataTableUrlState` for URL-synced pagination. |
| `src/app/(auth)/reports/campaigns/page.tsx` | Campaign report page | PerformanceTable, MetricsSummary, DetailView, TrendChart, FilterDropdown. Export CSV support. |
| `src/app/(auth)/reports/affiliates/components/AffiliateDetailView.tsx` | Affiliate detail panel | Props: `{ affiliateId, dateRange, onClose, canViewSensitiveData }`. Shows metrics grid, commission breakdown, trend chart, campaign breakdown table. |
| `src/app/(auth)/reports/campaigns/components/CampaignDetailView.tsx` | Campaign detail modal | Props: `{ data, isLoading, onClose, canViewSensitiveData }`. Shows metrics, trend chart, commission breakdown bar, top 5 affiliates table. |
| `src/app/(auth)/reports/affiliates/components/AffiliateTrendChart.tsx` | SVG trend chart (to replace) | Hand-rolled SVG (600x200). Props: `{ data: TrendDataPoint[], showCommissions?, className? }`. |
| `src/app/(auth)/reports/campaigns/components/CampaignTrendChart.tsx` | SVG trend chart (to replace) | Hand-rolled SVG (100x40). Props: `{ trendData: TrendDataPoint[], className? }`. |
| `src/components/ui/DataTable.tsx` | Reusable data table | `DataTable<T>` with `TableColumn<T>`. Column-level filters, sorting, row selection, bulk actions. 747 lines. |
| `src/components/ui/DataTablePagination.tsx` | Table pagination | `DataTablePagination`, `DataTablePaginationCompact`, `DEFAULT_PAGE_SIZE` (20), `PaginationState`. |
| `src/components/ui/MetricCard.tsx` | Metric card | Props: label, numericValue, formatValue, delta, variant, isLoading. Supports period-over-period deltas. |
| `src/components/ui/FadeIn.tsx` | Animation wrapper | Progressive reveal animation. |
| `src/components/ui/Badge.tsx` | Badge component | Status badges. |
| `src/components/ui/Tabs.tsx` | Tabs component | Radix-based tabs. |
| `src/components/ui/Progress.tsx` | Progress bar | For funnel/aging visualizations. |
| `src/hooks/useDateRange.ts` | Date range hook | Returns `{ dateRange, setDateRange, isCustomRange, preset, refreshFromUrl }`. Syncs to URL. Defaults to last 30 days. |
| `src/hooks/useDataTableUrlState.ts` | Table state hook | Pagination, sorting, filtering synced to URL via `nuqs`. `toggleSort(field)`, `setFilter()`, `clearFilters()`. |
| `src/lib/utils.ts` | Utilities | `cn()`, `downloadCsv()`. |
| `vitest.config.ts` | Test config | jsdom env, globals, setup: `src/test/setup.ts`. Includes: `src/**/*.test.{ts,tsx}`, `convex/**/*.test.{ts,tsx}`. |
| `src/test/setup.ts` | Test setup | jest-dom, mocks for next/navigation, convex/react, auth-client. |
| `_bmad-output/project-context.md` | Critical rules | All implementation rules and patterns. |

### Technical Decisions

1. **Navigation: Horizontal sub-nav in shared layout** — Use `reports/layout.tsx` (not duplicated per page). Category grouping: 💰 Financial (Commissions, Payouts, Funnel) | 📊 Performance (Affiliates, Campaigns) | 🛡️ Risk (Fraud). Balanced 3+2+1 visual distribution.
2. **Phased delivery** — Phase 1: Scalability refactor + sub-nav. Phase 2a: P0 report pages (Commission Summary, Enhanced Affiliates, Enhanced Campaigns). Phase 2b: P1 report pages (Payouts, Funnel, Fraud) — validate P0 usage before building.
3. **Data access strategy: two-tier with accuracy** — **Home page** reads from `tenantStats` (pre-computed windows: this month, last month, last 3 months). **All sub-report pages** use capped `.take()` queries on composite time-range indexes. **Sub-report summary metrics** (the big MetricCards at the top) should read from `tenantStats` for accuracy, while the detailed tables/charts use capped queries. This prevents number divergence between home page and sub-report summaries. **Affiliate segments** are computed client-side from the paginated table data, not from a separate backend query.
4. **New composite indexes required** — Add `by_tenant_and_creationTime` on `clicks`, `conversions`, and `commissions` tables in `convex/schema.ts`. Also add `by_tenant_flagged` on `commissions` for the fraud report (commissions where `isSelfReferral === true`). These enable efficient `.order("desc").paginate()` with post-filter on `_creationTime >= startDate`. Existing `by_tenant` indexes alone cannot efficiently paginate within a date range.
5. **Export row cap: 10,000 rows with pre-count** — Export actions first run a count query (using `.take(10001)` — if 10,001 results exist, data exceeds cap). If exceeded, return a JSON object `{ error: "DATA_EXCEEDS_CAP", totalRows: number, cappedAt: 10000 }` instead of CSV. Frontend shows: "Your data has X rows. Exporting the first 10,000. Narrow your date range for a complete export." This avoids the expensive full-count problem — `.take(10001)` stops immediately after 10,001.
6. **Component structure** — Follow existing pattern: `page.tsx` (client component with Suspense wrapper) + `components/` folder with individual sub-components + `index.ts` barrel export
7. **Home page = morning glance** — Alex's daily 90-second use case must be answered on `/reports` directly: amounts owed, fraud flags count, top performer changes. No clicks required for daily check-in.
8. **Visualization: Tremor for standard charts, CSS for funnel** — Use `@tremor/react` (`BarChart`, `LineChart`, `AreaChart`, `DonutChart`) for all standard dashboard charts. Tremor is Tailwind-native, covers 96% of chart needs (~24 chart instances across 6 report pages), and reduces chart code from ~4,800 lines (hand-rolled) to ~480 lines. For the conversion funnel (only chart type Tremor lacks), use hand-rolled CSS/Tailwind stepped bars. Replace existing hand-rolled SVG trend charts with Tremor `AreaChart` for consistency. **Spike first:** install Tremor, render one `BarChart` with brand colors, verify Tailwind v4 compatibility before full implementation. **Pin version** to avoid breaking changes. **Fallback path:** Tremor wraps Recharts internally — migration to raw Recharts is low-effort if needed.
9. **DataTable for all tabular reports** — Use existing `DataTable<T>` component for all list/table views. It already supports column filtering, sorting, pagination, and URL state sync via `useDataTableUrlState`.
10. **Reports file split** — During refactor, split `convex/reports.ts` (1589 lines) into `convex/reports/` directory with domain-specific files: `summary.ts`, `campaigns.ts`, `affiliates.ts`, `commissions.ts`, `payouts.ts`, `funnel.ts`, `fraud.ts`. Export barrel from `convex/reports/index.ts`.

## Implementation Plan

### Phase 1: Scalability Refactor + Navigation

**Parallelization strategy:** Tasks 1.1 (Tremor spike), 1.2 (file split), and 1.4 (indexes) can run in parallel — they have no dependencies on each other. Task 1.11 (sidebar) is fully independent and can run anytime.

**Critical gates:** Task 1.4 (indexes) MUST complete before 1.5/1.6/1.7 (query refactors). Task 1.2 (file split) MUST complete before 1.3/1.5/1.6/1.7 (all reference split files). Deploy indexes and file split as standalone changes in a feature branch, verify, then proceed.

- [ ] **Task 1.1: Install and spike-test Tremor**
  - File: `package.json`
  - Action: `pnpm add @tremor/react`. Create a minimal spike component in a temporary file that renders a `BarChart` with brand colors (`#10409a`). Verify it renders correctly in the Next.js 16 App Router environment with Tailwind v4. Remove the spike file after verification.
  - Notes: This is a gate task. If Tremor fails the spike, fall back to raw Recharts or continue hand-rolled SVG.

- [ ] **Task 1.2: Split `convex/reports.ts` into `convex/reports/` directory**
  - File: `convex/reports.ts` → `convex/reports/` (new directory)
  - Action: **CRITICAL ORDER**: First create `convex/reports/` directory with all files, THEN delete `convex/reports.ts`. Convex will fail if both exist simultaneously. Steps:
    1. Create `convex/reports/` directory with all domain files and barrel `index.ts`
    2. Delete `convex/reports.ts`
    3. Verify with `pnpm convex dev --once` that all `api.reports.*` references resolve
  - Domain files:
    - `convex/reports/summary.ts` — `getProgramSummaryMetrics`, `getTopAffiliatesByRevenue`
    - `convex/reports/campaigns.ts` — `getCampaignPerformanceList`, `getCampaignSummaryMetrics`, `getCampaignPerformanceDetails`, `getCampaignExportData`
    - `convex/reports/affiliates.ts` — `getAffiliatePerformanceList`, `getAffiliateSummaryMetrics`, `getAffiliatePerformanceDetails`, `getAffiliateExportData`
    - `convex/reports/index.ts` — Re-export all public functions, shared validators (`dateRangeValidator`, `sortByValidator`, `sortOrderValidator`)
  - Notes: Convex uses file-based routing — `api.reports.getCampaignPerformanceList` resolves to `convex/reports/campaigns.ts` automatically after the split. The barrel `index.ts` re-exports for any internal cross-file imports.

- [ ] **Task 1.3: Refactor home page summary to use `tenantStats` with preset selector**
  - File: `convex/reports/summary.ts`, `convex/tenantStats.ts`, `convex/schema.ts`
  - Action: Rewrite `getProgramSummaryMetrics` for the home page "morning glance":
    - Read all counters directly from `tenantStats.getStats({ tenantId })` — zero table scans
    - Add a `window` arg: `v.optional(v.literal("thisMonth" | "lastMonth" | "last3Months"))` with default `"thisMonth"`
    - `window === "thisMonth"`: `stats.commissionsConfirmedValueThisMonth + stats.commissionsPendingValue`, etc.
    - `window === "lastMonth"`: Read from new `stats.commissionsConfirmedValueLastMonth`, `stats.totalClicksLastMonth`, `stats.totalConversionsLastMonth`, `stats.totalCommissionsLastMonth` fields
    - `window === "last3Months"`: Read from new `stats.commissionsConfirmedValueLast3Months`, `stats.totalClicksLast3Months`, `stats.totalConversionsLast3Months`, `stats.totalCommissionsLast3Months` fields
    - `commissionsFlagged` → `stats.commissionsFlagged` (always current — fraud flags aren't window-specific)
    - `totalPaidOut` → `stats.totalPaidOut` (always cumulative — not window-specific)
    - `pendingPayoutTotal` → `stats.pendingPayoutTotal ?? 0` (always current — pending is current state)
    - **Remove** arbitrary `dateRange` arg — replaced by fixed `window` preset
    - **Remove** period-over-period delta calculation — the preset selector IS the comparison (Alex switches between windows)
  - **Schema changes** (in `convex/schema.ts`): Add to `tenantStats` table:
    - `commissionsConfirmedValueLastMonth`: `v.optional(v.number())` — value of confirmed commissions in the previous calendar month
    - `commissionsConfirmedLastMonth`: `v.optional(v.number())` — count of confirmed commissions in the previous calendar month
    - `commissionsConfirmedValueLast3Months`: `v.optional(v.number())` — rolling 3-month sum (current + last 2 completed months)
    - `commissionsConfirmedLast3Months`: `v.optional(v.number())` — rolling 3-month count
    - `totalClicksLastMonth`: `v.optional(v.number())`, `totalConversionsLastMonth`: `v.optional(v.number())` — for last month views
    - `totalClicksLast3Months`: `v.optional(v.number())`, `totalConversionsLast3Months`: `v.optional(v.number())` — for last 3 months views
  - **Month-rollover migration** (in `convex/tenantStats.ts`): Extend `getMonthStart()` logic to detect month boundary crossings. On the first query of a new month: (1) copy current `*ThisMonth` values to `*LastMonth` fields, (2) compute new `*Last3Months` = old `*Last3Months` - oldest month + current month, (3) reset `*ThisMonth` counters to 0.
  - Notes: This gives Alex 3 preset views without any table scans. The month-rollover logic is triggered lazily on the first `tenantStats` read of each new month. Adding new optional fields to the schema is non-breaking — existing `tenantStats` docs will have `undefined` for new fields, which the query handles with `?? 0` defaults.

- [ ] **Task 1.4: Add composite time-range indexes to schema**
  - File: `convex/schema.ts`
  - Action: Add new indexes to support date-range-filtered pagination:
    - `clicks`: Add `.index("by_tenant_and_creationTime", ["tenantId", "_creationTime"])` — enables paginated time-range queries on clicks
    - `conversions`: Add `.index("by_tenant_and_creationTime", ["tenantId", "_creationTime"])` — enables paginated time-range queries on conversions
    - `commissions`: Add `.index("by_tenant_and_creationTime", ["tenantId", "_creationTime"])` — enables aging and date-range queries on commissions
    - `commissions`: Add `.index("by_tenant_flagged", ["tenantId", "isSelfReferral"]).filter(q => q.eq("isSelfReferral", true))` — enables efficient fraud-flagged commission queries (F1 fix)
  - Notes: Convex requires a schema migration to add indexes. After pushing, existing data is automatically indexed. The `_creationTime` field is a system field that exists on all documents — including it in the index definition is valid and standard practice. The filtered index for flagged commissions uses Convex's `.filter()` on the index definition, which creates an efficient partial index. **This task MUST run before Tasks 1.5 and 1.6** which reference these indexes.

- [ ] **Task 1.5: Refactor `getTopAffiliatesByRevenue` to use capped `.take()`**
  - File: `convex/reports/summary.ts`
  - Action: The `getTopAffiliatesByRevenue` query currently has 4 unbounded `.collect()` calls (affiliates, clicks, conversions, commissions). Refactor:
    - Affiliates: Keep `.collect()` (medium-volume table, typically <500 per tenant). If tenant exceeds 1000 affiliates, cap with `.take(1000)`.
    - Clicks: Replace with `.withIndex("by_tenant_and_creationTime", ...).order("desc").take(5000)` then post-filter on date range.
    - Conversions: Same pattern with `.take(5000)` on `by_tenant_and_creationTime`.
    - Commissions: Same pattern with `.take(5000)` on `by_tenant_and_creationTime`. Only count confirmed/approved status.
  - Notes: This query powers the "Top Affiliates" table on the home page. After refactor it shows current-month top affiliates only (consistent with the home page's tenantStats-only strategy).

- [ ] **Task 1.6: Refactor campaign queries to use pagination + capped `.take()`**
  - File: `convex/reports/campaigns.ts`
  - Action:
    - `getCampaignPerformanceList`: Keep campaign `.collect()` (low-volume table). Replace click/conversion/commission aggregation with paginated reads using `by_tenant_and_creationTime` indexes with post-filter on `_creationTime >= startDate && _creationTime <= endDate`. Add `paginationOpts` arg for the list itself.
    - `getCampaignSummaryMetrics`: Read affiliate counts from `tenantStats`. For clicks/conversions/commissions totals, use capped `.take(5000)` on `by_tenant_and_creationTime` indexes with date range post-filter.
    - `getCampaignPerformanceDetails`: Same pattern — capped `.take()` on new indexes for aggregation data. Limit `topAffiliates` to `.slice(0, 10)` (already done).
    - `getCampaignExportData`: Cap at 10,000 rows. Return early if exceeded.
  - Notes: The `campaigns` table is low-volume (typically <100 per tenant). The high-volume tables are `clicks`, `conversions`, `commissions`. Post-filter pattern: `.order("desc").take(5000)` then filter `item._creationTime >= startDate` in JavaScript. This is efficient because `.order("desc")` returns newest first — if we've collected 5000 and none are within range, the date range has no data.

- [ ] **Task 1.7: Refactor affiliate queries to use pagination + capped `.take()`**
  - File: `convex/reports/affiliates.ts`
  - Action: Same pattern as Task 1.6:
    - `getAffiliatePerformanceList`: Add `paginationOpts` for the affiliate list. Use capped `.take(5000)` for click/conversion/commission aggregation.
    - `getAffiliateSummaryMetrics`: Read affiliate counts from `tenantStats`. Use capped `.take(5000)` for activity metrics.
    - `getAffiliatePerformanceDetails`: Use existing `by_affiliate` indexes (already paginated pattern in codebase). Cap trend data buckets.
    - `getAffiliateExportData`: Cap at 10,000 rows.
  - Notes: Affiliate table can grow but is medium-volume. The click/conversion/commission scans are the risk.

- [ ] **Task 1.8: Update `convex/reportsExport.ts` import paths and fix broken export**
  - File: `convex/reportsExport.ts`
  - Action:
    - Update imports from `./reports` to `./reports/summary`, `./reports/campaigns`, `./reports/affiliates` (or use barrel `./reports`). Verify all 3 export actions still compile.
    - **Fix `exportProgramReportCSV`**: Task 1.3 removed `dateRange` and `campaignId` args from `getProgramSummaryMetrics`. Update this export action to either: (a) call the new tenantStats-only query (no date range filter on export), or (b) redirect to the commissions sub-report export which supports date ranges. Recommend option (a) with a note in the CSV filename that it reflects "current month" data.
  - Notes: Since Convex uses file-based routing, `api.reports.getAffiliateExportData` should still resolve. Test with `pnpm convex dev --once`.

- [ ] **Task 1.9: Create shared reports sub-nav layout**
  - File: `src/app/(auth)/reports/layout.tsx` (new)
  - Action: Create a shared layout component with:
    - Horizontal sub-nav bar with category pills: 💰 Financial (Commissions, Payouts, Funnel) | 📊 Performance (Affiliates, Campaigns) | 🛡️ Risk (Fraud)
    - "Overview" link as first item (points to `/reports`)
    - Active state based on `usePathname()` from `next/navigation`
    - Mobile: horizontal scroll with `overflow-x-auto`, hidden scrollbar
    - Desktop: centered nav bar below the page header
    - Use `<Button variant="ghost" size="sm">` for nav items (preserves `btn-motion`)
  - Notes: Wrap content in `<div className="flex flex-col">{children}</div>`. The sidebar from `(auth)/layout.tsx` is already present. This adds a second-level nav within the content area.

- [ ] **Task 1.10: Write scalability regression tests**
  - File: `convex/reports/summary.test.ts`, `convex/reports/campaigns.test.ts`, `convex/reports/affiliates.test.ts` (new)
  - Action: Using `convex-test`, create test cases that:
    - Seed test data (50 campaigns, 200 affiliates, 5000 clicks, 2000 conversions, 3000 commissions)
    - Call each refactored query and verify results match expected aggregations
    - Verify no unbounded `.collect()` exists (grep check)
    - Verify RBAC: non-owner/non-manager gets `commissions: 0`
    - Verify status equivalence: commissions with status "approved" and "confirmed" are both counted
  - Notes: Follow existing test patterns from `convex/payouts.test.ts` and `convex/commissions.approval.test.ts`.

- [ ] **Task 1.11: Update `Sidebar.tsx` to surface report sub-pages**
  - File: `src/components/shared/Sidebar.tsx` (modify)
  - Action: Update the Reports `NavItem` to use a collapsible sub-menu or add a badge showing the count of "needs attention" items. At minimum, ensure the Reports link points to `/reports` where the sub-nav provides access to all sub-pages. Consider adding direct links to the most-used sub-pages (Commissions, Affiliates) below the main Reports link.
  - Notes: The sub-nav in `reports/layout.tsx` only appears after navigating to `/reports`. The sidebar should make it easy to discover and deep-link to report sub-pages.

- [ ] **Task 1.12: Run `backfillStats` migration for existing tenants**

- [ ] **Task 2a.1: Build Commission & Payout Summary backend queries**
  - File: `convex/reports/commissions.ts` (new)
  - Action: Create new query functions:
    - `getCommissionSummaryMetrics` — Read from `tenantStats`: pendingCount/Value, confirmedThisMonth/Value, reversedThisMonth/Value, flagged, totalPaidOut, pendingPayoutTotal/Count. **No period-over-period deltas** — consistent with the two-tier data strategy, `tenantStats` only stores current month. Show current values only. **RBAC**: Non-owners/non-managers see `0` for all monetary values. These MetricCards use `tenantStats` for accuracy — the table below uses capped queries.
    - `getCommissionAgingBuckets` — Query commissions using new `by_tenant_and_creationTime` index with `.order("desc").take(5000)`. Post-filter on `_creationTime >= startDate`. For each commission, calculate age = `now - _creationTime`. Bucket into: 0-7 days, 8-30 days, 31-90 days, 90+ days. Group by status: pending, confirmed/approved, reversed/declined, paid. All statuses are captured in a single query — no need for per-status queries. Paid commissions appear in the aging chart as a separate color to show recently-paid commission velocity. **Return `totalEstimated`** alongside results for the truncation warning.
    - `getCommissionExportData` — Same as aging but flat list for CSV, capped at 10,000 rows.
    - `getPayoutTrendData` — Query `payoutBatches` by `by_tenant` with `.order("desc")`. Group by month. Calculate monthly totals. Cap at `.take(500)`.
  - Notes: Status equivalence: check both "confirmed" and "approved" as confirmed equivalents. Check both "reversed" and "declined" as reversed equivalents.

- [ ] **Task 2a.2: Build Commission & Payout Summary frontend**
  - File: `src/app/(auth)/reports/commissions/page.tsx` (new), `src/app/(auth)/reports/commissions/components/` (new directory)
  - Action: Create:
    - `page.tsx` — Client component with Suspense wrapper. Contains `CommissionSummaryContent` + `CommissionSummarySkeleton`.
    - `CommissionSummaryContent` — Layout: 6 MetricCards (Pending Amount, Confirmed This Month, Reversed This Month, Total Paid Out, Pending Payouts, Fraud Flags) reading from `tenantStats`. Below: truncation warning banner (conditional), then 2-column layout with aging bar chart (Tremor `BarChart`) on left, payout trend area chart (Tremor `AreaChart`) on right.
    - `DataTruncationWarning` — Shared component: When `results.length / totalEstimated < 0.8`, show amber alert: "Showing {results.length} of ~{totalEstimated} records. Narrow the date range for more accurate data." This component is reused across all sub-report pages.
    - `CommissionAgingChart` — Tremor `BarChart` with stacked bars by status per aging bucket (0-7d, 8-30d, 31-90d, 90+d). Color: green=confirmed, amber=pending, red=reversed.
    - `PayoutTrendChart` — Tremor `AreaChart` showing monthly payout totals.
    - `CommissionStatusTable` — `DataTable<T>` showing recent commissions with status, amount, age, affiliate name. Column filters for status. Capped pagination.
    - Export CSV button using existing `downloadCsv()` pattern.
  - Notes: Currency format: `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`. Use `FadeIn` for progressive reveal.

- [ ] **Task 2a.3: Build affiliate segmentation (client-side)**
  - File: `src/app/(auth)/reports/affiliates/components/AffiliateSegmentsOverview.tsx` (new)
  - Action: **Compute affiliate segments client-side** from the paginated table data returned by `getAffiliatePerformanceList`. No separate backend query needed — this eliminates segment count vs table total divergence.
    - Create a pure function `computeAffiliateSegments(affiliates: AffiliateRow[]): SegmentSummary` in a new `src/lib/affiliate-segments.ts` utility file:
      ```typescript
      export function computeAffiliateSegments(affiliates: AffiliateRow[]): {
        topPerformers: number, risingStars: number,
        needsAttention: number, inactive: number,
        topPerformersList: AffiliateRow[], ...
      }
      ```
    - Segment rules (applied to each affiliate in the table data):
      - **Top Performers**: status="active" AND conversions > 0 AND conversionRate >= 5%
      - **Rising Stars**: status="active" AND clicks > 0 AND conversionRate >= 2% AND conversionRate < 5% AND conversions > 0
      - **Needs Attention**: status="active" AND clicks > 100 AND conversionRate < 1%
      - **Inactive**: status="active" AND clicks = 0
    - `AffiliateSegmentsOverview` component: Takes the computed segment summary and renders 4 segment cards with counts. Also renders a Tremor `DonutChart` for visual distribution.
    - Add segment filter to existing `DataTable` as a column filter (Select type with options: All, Top Performers, Rising Stars, Needs Attention, Inactive) — this filters the already-loaded table data, no additional query needed.
  - Notes: Segment thresholds (5%, 2%, 1%) are initial values. Segments are computed from the current page of table data (not all affiliates) — this is intentional for consistency. If the table has 20 results per page, segments reflect those 20 affiliates. For a "global" segment view, increase the page size or use the export (which covers more data).

- [ ] **Task 2a.4: Enhance Affiliate Performance page with segments**
  - File: `src/app/(auth)/reports/affiliates/page.tsx` (modify), `src/app/(auth)/reports/affiliates/components/` (add files)
  - Action:
    - Add `AffiliateSegmentsOverview` component above the existing table. Uses `computeAffiliateSegments()` pure function on the current page of table data. Shows 4 segment cards with counts and a Tremor `DonutChart` for visual distribution.
    - Add segment filter to the existing `DataTable` as a column filter (Select type with options: All, Top Performers, Rising Stars, Needs Attention, Inactive) — filters table data client-side.
    - Replace `AffiliateTrendChart` (hand-rolled SVG) with Tremor `AreaChart` in `AffiliateDetailView`.
    - Delete `AffiliateTrendChart.tsx` after migration.
  - Notes: Preserve all existing functionality. Segments are computed from the same data as the table — no divergence possible.

- [ ] **Task 2a.5: Build Campaign cost-efficiency backend query**
  - File: `convex/reports/campaigns.ts` (modify existing)
  - Action: Add new query `getCampaignCostEfficiency`:
    - Args: `{ tenantId, dateRange, campaignIds: v.array(v.id("campaigns")) }` (max 3 campaigns for comparison)
    - Returns: array of `{ campaignId, name, clicks, conversions, conversionRate, totalCommissions, costPerConversion, convEfficiency }` per campaign
    - `costPerConversion` = totalCommissions / conversions (₱ cost per conversion — how much Alex pays per conversion)
    - `convEfficiency` = conversions / clicks (conversion efficiency % — what % of clicks become conversions)
    - **RBAC**: Include `canViewSensitiveData` check — non-owners see `totalCommissions: 0` and `costPerConversion: 0`.
    - Use capped `.take(5000)` for aggregation on new `by_tenant_and_creationTime` indexes.
  - Notes: We removed the `roi` field (which required phantom `assumedCustomerValue`). The actual computable metrics are cost per conversion and conversion efficiency. Label these clearly in the UI — do NOT call this "ROI" as that would be misleading.

- [ ] **Task 2a.6: Enhance Campaign Performance page with ROI + comparison**
  - File: `src/app/(auth)/reports/campaigns/page.tsx` (modify), `src/app/(auth)/reports/campaigns/components/` (add files)
  - Action:
    - Add `CampaignComparisonSelector` — Simple campaign picker using the existing `Select` component from `src/components/ui/select.tsx`. Render 3 select dropdowns (Campaign 1, Campaign 2, Campaign 3 — Campaign 3 optional). No multi-select needed — 3 fixed slots is simpler and more predictable UX.
    - Add `CampaignRoiComparison` — Side-by-side metric cards for selected campaigns (clicks, conversions, conv. rate, commissions, cost per conversion).
    - Add `CampaignRoiBarChart` — Tremor `BarChart` comparing selected campaigns on key metrics.
    - Add ROI columns to existing `DataTable`: "Cost/Conversion" (₱X.XX), "Conv. Efficiency" (X.X%).
    - Replace `CampaignTrendChart` (hand-rolled SVG) with Tremor `AreaChart` in `CampaignDetailView`.
    - Delete `CampaignTrendChart.tsx` after migration.
  - Notes: When no campaigns are selected for comparison, show the existing default view. Comparison is an opt-in overlay/panel.

- [ ] **Task 2a.7: Enhance Reports home page as "morning glance"**
  - File: `src/app/(auth)/reports/page.tsx` (modify)
  - Action:
    - **Remove** the `DateRangeSelector` and `CampaignFilterDropdown` components from the home page.
    - **Add** a `WindowSelector` — Simple button group (using `<Button variant="outline">` for each option) with 3 presets: "This Month" (default), "Last Month", "Last 3 Months". Passes the selected `window` value to `getProgramSummaryMetrics` query. No custom date range — only fixed presets that `tenantStats` can serve.
    - Add "Needs Attention" alert banner at top: Shows count of pending commissions (`tenantStats.commissionsPendingCount`), fraud flags (`tenantStats.commissionsFlagged`), and pending payouts (`tenantStats.pendingPayoutCount`). Each item is a clickable link to the relevant report page.
    - Add 2 new MetricCards: "Amounts Owed" (pendingPayoutTotal + commissionsPendingValue) and "Fraud Flags" (commissionsFlagged count).
    - Replace the existing 2-card nav grid with the sub-nav (now in layout.tsx). Keep the MetricCards and Top Affiliates table.
    - **No delta/sparkline indicators** — the preset selector IS the comparison mechanism (Alex switches between "This Month" and "Last Month" to compare).
  - Notes: The "Needs Attention" banner answers Alex's daily question: "what needs my attention RIGHT NOW?" without requiring navigation. The `WindowSelector` replaces the dead `DateRangeSelector` with a functional, performant alternative. Sub-report pages keep their full `DateRangeSelector` for arbitrary date ranges.

- [ ] **Task 2a.8: Write P0 frontend tests**
  - File: `src/app/(auth)/reports/commissions/components/__tests__/` (new), `src/app/(auth)/reports/affiliates/components/__tests__/` (new), `src/app/(auth)/reports/campaigns/components/__tests__/` (new)
  - Action: Create unit tests for:
    - Segment calculation logic (pure function extracted from component)
    - ROI calculation logic (costPerConversion, convEfficiency)
    - Aging bucket calculation (pure function: `getAgeBucket(creationTime, now)`)
    - CSV export formatting
    - Currency formatting helper
  - Notes: Test pure functions, not React rendering. Follow existing `src/lib/*.test.ts` pattern.

### Phase 2b: P1 Report Pages

- [ ] **Task 2b.1: Build Payout History backend queries**
  - File: `convex/reports/payouts.ts` (new)
  - Action: Create:
    - `getPayoutReportMetrics` — Read from `tenantStats`: totalPaidOut, pendingPayoutTotal/Count. These MetricCards use `tenantStats` for accuracy — the table below uses capped queries.
    - `getPayoutBatchList` — Thin wrapper around existing `api.payouts.getPayoutBatches` adding report-specific filtering.
    - `getPayoutMonthlyTrend` — Aggregate payout batches by month. Use capped `.take(500)`.
    - `getPayoutExportData` — Flat list for CSV, capped at 10,000 rows.
  - Notes: Most payout queries already exist in `convex/payouts.ts`. This file adds report-specific aggregations on top.

- [ ] **Task 2b.2: Build Payout History frontend**
  - File: `src/app/(auth)/reports/payouts/page.tsx` (new), `src/app/(auth)/reports/payouts/components/` (new directory)
  - Action: Create:
    - `page.tsx` — Client component with Suspense. Contains `PayoutHistoryContent` + skeleton.
    - `PayoutHistoryContent` — 4 MetricCards (Total Paid Out, Pending Payouts, Batches This Month, Avg Batch Size) with deltas. Below: payout trend chart (Tremor `AreaChart`) + batch status donut (Tremor `DonutChart`).
    - `PayoutBatchTable` — `DataTable<T>` showing batch ID, date, affiliate count, total amount, status. Uses existing `getPayoutBatches` pagination.
    - Batch detail drawer — Click a batch row to see individual payouts in a side drawer (`Drawer` component from `src/components/ui/drawer.tsx`). Use `DataTablePagination` within the drawer for batch payouts (a batch can have hundreds of payouts).
    - Export CSV button.
  - Notes: Reuse existing `api.payouts.getPayoutBatches` and `api.payouts.getBatchPayouts` for data.

- [ ] **Task 2b.3: Build Conversion Funnel backend query**
  - File: `convex/reports/funnel.ts` (new)
  - Action: Create:
    - `getConversionFunnel` — Args: `{ tenantId, dateRange, campaignId? }`. Returns:
      ```
      {
        totalClicks: number,
        totalConversions: number,
        totalCommissions: number,
        clickToConversionRate: number,
        conversionToCommissionRate: number,
        overallRate: number,
        topAffiliates: Array<{ affiliateId, name, clicks, conversions, commissions, funnelRate }>,
        byCampaign: Array<{ campaignId, name, clicks, conversions, commissions, funnelRate }>
      }
      ```
    - Commission step includes ONLY confirmed/approved commissions (status "confirmed" OR "approved"). Pending, reversed, and declined commissions are excluded from the funnel bottom to avoid inflating the conversion-to-commission rate. The funnel answers: "of my conversions, how many generated payable commissions?"
    - **RBAC**: Include `canViewSensitiveData` check — non-owners see `commissions: 0` and `funnelRate: 0`.
    - Use capped `.take(5000)` on new `by_tenant_and_creationTime` indexes for aggregation.
    - `getFunnelExportData` — Flat list for CSV, capped at 10,000 rows.
  - Notes: The funnel is clicks → conversions → commissions. Each step is a filter of the previous.

- [ ] **Task 2b.4: Build Conversion Funnel frontend**
  - File: `src/app/(auth)/reports/funnel/page.tsx` (new), `src/app/(auth)/reports/funnel/components/` (new directory)
  - Action: Create:
    - `page.tsx` — Client component with Suspense. Contains `FunnelContent` + skeleton.
    - `FunnelContent` — 3 MetricCards (Total Clicks, Conversions, Commissions) with conversion rates between them. Below: CSS/Tailwind funnel visualization.
    - `ConversionFunnel` — Hand-rolled CSS component: 3 horizontal bars with decreasing widths (100%, conversion%, commission%), connected by arrows showing conversion rate percentages. Each bar has a label, count, and percentage. Use Tailwind `bg-brand-primary` with opacity variations for the bars.
    - `FunnelAffiliateTable` — `DataTable<T>` showing per-affiliate funnel metrics (clicks, conversions, commissions, funnel rate). Column filter for campaign.
    - Campaign filter dropdown (reuse existing `CampaignFilterDropdown`).
    - Export CSV button.
  - Notes: No Tremor chart for the funnel — CSS/Tailwind only. This is a distinctive visual element.

- [ ] **Task 2b.5: Build Fraud & Risk backend query**
  - File: `convex/reports/fraud.ts` (new)
  - Action: Create:
    - `getFraudReportMetrics` — Read `commissionsFlagged` from `tenantStats` for the summary MetricCard (accurate count). Query affiliates with `fraudSignals.length > 0` using capped `.take(500)` for the detail breakdown. Return: `{ flaggedCommissions, affiliatesWithSignals, signalsBySeverity: { low, medium, high }, signalsByType: { selfReferral, botTraffic, ipAnomaly }, reviewedVsUnreviewed }`. **RBAC**: Non-owners see `flaggedCommissions: 0`.
    - `getFlaggedCommissions` — Query commissions using new `by_tenant_flagged` filtered index (where `isSelfReferral === true`). Paginated with `.order("desc")`. Additionally, use capped `.take(5000)` on `by_tenant_and_creationTime` with post-filter for `fraudIndicators.length > 0`. Merge both result sets, deduplicate by `_id`, then cap total at 5000 items. **RBAC**: Include `canViewSensitiveData` check — non-owners see amounts as 0.
    - `getFraudTrendData` — Bucket fraud signals by time period (daily/weekly) for trend chart.
    - `getFraudExportData` — Flat list for CSV, capped at 10,000 rows.
  - Notes: Leverage existing `api.fraudSignals.getAffiliateFraudSignals` and `api.fraudSignals.getFraudSignalStats` for per-affiliate data. This query adds cross-tenant aggregation.

- [ ] **Task 2b.6: Build Fraud & Risk frontend**
  - File: `src/app/(auth)/reports/fraud/page.tsx` (new), `src/app/(auth)/reports/fraud/components/` (new directory)
  - Action: Create:
    - `page.tsx` — Client component with Suspense. Contains `FraudContent` + skeleton.
    - `FraudContent` — 4 MetricCards (Flagged Commissions, Affiliates with Signals, Unreviewed Signals, High Severity Count). "Needs Attention" alert for unreviewed high-severity signals.
    - `FraudSeverityChart` — Tremor `BarChart` showing signal count by severity (low/medium/high). Color: green/amber/red.
    - `FraudTypeChart` — Tremor `BarChart` showing signal count by type (selfReferral, botTraffic, ipAnomaly).
    - `FraudTrendChart` — Tremor `LineChart` showing fraud signal trend over time.
    - `FlaggedCommissionsTable` — `DataTable<T>` showing flagged commissions with: affiliate name, amount, fraud indicators, self-referral flag, status, created date. Column filter for status and severity. Click row to navigate to commission detail.
    - Export CSV button.
  - Notes: Use amber/red color scheme for fraud alerts (matches design system status colors). High-severity unreviewed signals should have a pulsing dot indicator.

- [ ] **Task 2b.7: Write P1 backend + frontend tests**
  - File: `convex/reports/payouts.test.ts`, `convex/reports/funnel.test.ts`, `convex/reports/fraud.test.ts` (new)
  - Action: Using `convex-test`, create test cases for:
    - Payout: verify trend aggregation, batch status grouping
    - Funnel: verify click→conversion→commission counts, rate calculations, empty data edge case
    - Fraud: verify severity/type aggregation, flagged commission detection, self-referral flag inclusion
    - All: verify 10,000 row export cap, verify RBAC enforcement
  - Notes: Seed test data with known fraud signals and self-referral flags for deterministic tests.

### Acceptance Criteria

- [ ] **AC 1:** Given a tenant with 10,000+ commissions, when Alex opens any report page, then the page loads within 3 seconds (no unbounded `.collect()` on high-volume tables).
- [ ] **AC 2:** Given Alex opens `/reports`, then he sees "Amounts Owed", "Fraud Flags", and "Pending Commissions" counts without clicking into any sub-page.
- [ ] **AC 3:** Given Alex opens `/reports/commissions`, then he sees commission status amounts grouped by aging bucket (0-7d, 8-30d, 31-90d, 90+d) with a stacked bar chart.
- [ ] **AC 4:** Given Alex opens `/reports/affiliates`, then he sees affiliate segments (Top Performers, Rising Stars, Needs Attention, Inactive) with counts and a donut chart.
- [ ] **AC 5:** Given Alex opens `/reports/campaigns`, then he can select up to 3 campaigns and see a side-by-side comparison with cost per conversion (₱X.XX) and conversion efficiency (X.X%) metrics.
- [ ] **AC 6:** Given Alex opens `/reports/funnel`, then he sees a visual funnel (Clicks → Conversions → confirmed Commissions only) with conversion rates between each step. Pending, reversed, and declined commissions are excluded from the commission step.
- [ ] **AC 7:** Given Alex opens `/reports/fraud`, then he sees flagged commissions, fraud signals by severity/type, and unreviewed high-severity alerts.
- [ ] **AC 8:** Given Alex opens `/reports/payouts`, then he sees payout trend over time, batch-level detail, and pending payout amounts.
- [ ] **AC 9:** Given any report page with a table, when Alex clicks "Export CSV", then a CSV file downloads with the current filtered data (capped at 10,000 rows with a warning message if exceeded).
- [ ] **AC 10:** Given a non-owner/non-manager user, when they view any report (including segments, funnel, fraud, cost-efficiency), then commission amounts and sensitive financial data show as `₱0.00` or are hidden. All new queries must include the `canViewSensitiveData` RBAC check.
- [ ] **AC 11:** Given Alex navigates between report pages, then the horizontal sub-nav bar shows the correct active state and category grouping is visible.
- [ ] **AC 12:** Given commissions with status "approved" and "confirmed", when any report aggregates commissions, then both statuses are counted identically as confirmed.
- [ ] **AC 13:** Given an empty tenant (no data), when Alex opens any report page, then the page renders with zero-state placeholders instead of errors.
- [ ] **AC 14:** Given Alex uses the date range selector on any **sub-report page** (not the home page), when he changes the range, then all metrics, charts, and tables update to reflect the new range. The home page (`/reports`) shows current-month data only and does not support date range filtering.
- [ ] **AC 15:** Given Alex opens `/reports` on mobile, then the sub-nav scrolls horizontally and all content is readable without horizontal page scroll.

## Additional Context

### Dependencies

- **`@tremor/react`** — Must be installed and spike-tested (Task 1.1) before any Phase 2a work begins. Pin to a specific version.
- **Schema migration** — Task 1.9 adds 4 new indexes. Convex handles index creation automatically during push, but it may take time on large datasets. Deploy during low-traffic window.
- **`tenantStats` accuracy** — Home page "morning glance" depends on accurate `tenantStats` counters. Task 1.11 runs `backfillStats` post-deployment for existing tenants.
- **Convex file-based routing** — Task 1.2 requires deleting `reports.ts` before creating `reports/` directory. Verify with `pnpm convex dev --once` after migration.
- **Date range and campaign filter components** — Existing components are reusable. No modifications needed.
- **Post-filter pattern** — All date-range-filtered report queries use `.order("desc").take(N)` + JavaScript post-filter on `_creationTime`. This is the standard pattern for date-range queries with Convex's implicit `_creationTime` index ordering.

### Testing Strategy

**Backend tests (convex-test):**
- `convex/reports/summary.test.ts` — Summary metrics from tenantStats, RBAC enforcement
- `convex/reports/campaigns.test.ts` — Campaign list pagination, ROI calculation, export data cap
- `convex/reports/affiliates.test.ts` — Segment classification logic, performance list pagination
- `convex/reports/commissions.test.ts` — Aging bucket calculation, payout trend aggregation
- `convex/reports/payouts.test.ts` — Monthly trend grouping, batch status aggregation
- `convex/reports/funnel.test.ts` — Funnel rate calculation, empty data edge case
- `convex/reports/fraud.test.ts` — Severity/type aggregation, flagged commission detection

**Frontend tests (Vitest globals, no React rendering):**
- Segment calculation pure function (`computeAffiliateSegments` in `src/lib/affiliate-segments.ts`)
- Cost-efficiency calculation pure function (costPerConversion, convEfficiency)
- Aging bucket calculation pure function (getAgeBucket)
- Currency formatting helper
- CSV export formatting
- Truncation warning threshold calculation (results.length / totalEstimated < 0.8)

**Manual testing checklist:**
- Verify Tremor charts render correctly with brand colors in both light and dark mode
- Verify sub-nav horizontal scroll on mobile (iOS Safari, Android Chrome)
- Verify CSV download works and opens correctly in Excel/Google Sheets
- Verify "Needs Attention" banner links navigate to correct report pages
- Verify date range changes propagate to all metrics, charts, and tables
- Verify commission status equivalence (approved = confirmed) across all reports

### Notes

- All currency values should use Philippine Peso (₱) formatting with `en-PH` locale: `new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value)`
- Cross-tenant fraud visibility is a future consideration for Platform Admin — not in scope now but architecture should not preclude it
- Segment thresholds (5%, 2%, 1% conversion rates) are initial values based on industry averages for SaaS affiliate programs. Consider making them configurable per-tenant in a future iteration.
- The funnel visualization is intentionally CSS-only (no Tremor). This makes it lightweight, accessible, and distinctive — it will be the most recognizable visual element in the reports module.
- Consider adding "Last updated" timestamps to report pages to set expectations about data freshness (Convex queries are real-time, but Alex may not know that).

**Adversarial Review Resolution (15 + 13 findings addressed):**

*Round 1 (15 findings):*
- **F1/F6 (Critical)**: Resolved by switching to two-tier data strategy — `tenantStats` for home page (current-month only), capped `.take()` on new composite indexes for all date-range report pages.
- **F3 (Critical)**: Resolved — period-over-period deltas removed from home page query. Home page shows current values only.
- **F2 (High)**: Task 1.2 now requires creating files BEFORE deleting `reports.ts`.
- **F4 (High)**: Task 1.4 (now 1.6) adds `by_tenant_and_creationTime` indexes. Aging query uses single query with post-filter.
- **F5 (High)**: Campaign comparison uses 3 fixed `Select` dropdowns instead of non-existent multi-select.
- **F7 (High)**: Task 1.4 (now 1.6) adds concrete indexes — no more "evaluate before adding" hand-waving.
- **F8 (High)**: Rising Stars segment simplified to static snapshot classification.
- **F9 (Medium)**: All new queries include `canViewSensitiveData` RBAC check.
- **F10 (Medium)**: Funnel commission step explicitly includes only confirmed/approved commissions.
- **F11 (Medium)**: ROI phantom variable removed. Replaced with `costPerConversion` + `convEfficiency`.
- **F12 (High)**: Task 1.12 added for `backfillStats` migration.
- **F13 (Low)**: Batch detail drawer now specifies `DataTablePagination`.
- **F14 (Medium)**: Task 1.11 added for `Sidebar.tsx` update.
- **F15 (Medium)**: Export cap uses `.take(10001)` pre-count strategy with frontend warning.

*Round 2 (13 findings):*
- **S1 (Critical)**: Task ordering fixed — indexes (Task 1.4) now runs before query refactors (Tasks 1.6, 1.7).
- **S2 (Critical)**: Task 1.2 step order corrected — create files first, then delete `reports.ts`.
- **S3 (Critical)**: `getTopAffiliatesByRevenue` refactored in new Task 1.5 with capped `.take()`.
- **S4 (High)**: `backfillStats` double-count bug documented in Task 1.12 with fix guidance.
- **S5 (Critical)**: Deltas removed from `getCommissionSummaryMetrics` (Task 2a.1) — consistent with two-tier strategy.
- **S6 (High)**: AC14 now explicitly excludes home page from date range requirement.
- **S7 (High)**: `exportProgramReportCSV` fix added to Task 1.8 — updated to match new query args.
- **S8 (High)**: Post-filter truncation warning pattern documented in Codebase Patterns.
- **S9 (Critical)**: Task 2a.7 removes delta sparklines and dead UI controls (DateRangeSelector, CampaignFilterDropdown).
- **S10 (Low)**: Test plan updated — `revenuePerClick` replaced with `convEfficiency`.
- **S11 (Medium)**: Aging buckets now include `paid` status.
- **S12 (Medium)**: Fraud merged result sets capped at 5000 after deduplication.
- **S13 (High)**: Home page dead UI controls removed in Task 2a.7.

**Advanced Elicitation Round 3 (7 enhancements from Pre-mortem, Focus Group, Dependency Chain):**
- **Pre-mortem A**: Sub-report summary MetricCards now read from `tenantStats` for accuracy — prevents home page vs sub-report number divergence.
- **Pre-mortem A**: `DataTruncationWarning` shared component added — visible when post-filter result < 80% of cap.
- **Pre-mortem C**: Affiliate segments computed client-side from table data (new `computeAffiliateSegments` pure function) — eliminates segment vs table count divergence.
- **Focus Group**: Home page gets `WindowSelector` with 3 presets (This Month / Last Month / Last 3 Months) — restores quarterly comparison without table scans.
- **Focus Group**: New `tenantStats` fields: `*LastMonth` and `*Last3Months` counters + month-rollover migration logic.
- **Dependency Chain**: Phase 1 parallelization documented — 1.1, 1.2, 1.4 can run in parallel; 1.4 and 1.2 are hard gates.
- **Dependency Chain**: Task 1.3 (home page) depends on Task 1.4 (indexes) implicitly through Task 1.5 — documented as critical gate.

**Chart Library Decision Summary (ADR):**
- **Tremor** selected over Recharts (10x less chart code) and Visx (steep learning curve)
- **Rationale:** Tailwind-native, pre-styled components, covers 96% of needs, wraps Recharts (safe fallback)
- **Funnel:** Hand-rolled CSS/Tailwind stepped bars (no library has good funnel support)
- **Risk mitigation:** Pin Tremor version, spike test before Phase 2a, fallback to raw Recharts if needed

**Report → Chart Mapping:**

| Report | Charts Needed | Library |
|--------|--------------|---------|
| Commission Summary (P0) | Aging bar chart, payout trend area chart | Tremor `BarChart`, `AreaChart` |
| Affiliates Enhanced (P0) | Segment donut, performance trend area chart | Tremor `DonutChart`, `AreaChart` |
| Campaigns Enhanced (P0) | Cost-efficiency comparison bar chart | Tremor `BarChart` |
| Payout History (P1) | Payout trend area chart, batch status donut | Tremor `AreaChart`, `DonutChart` |
| Conversion Funnel (P1) | Clicks → Conversions → Commissions funnel | CSS/Tailwind stepped bars |
| Fraud & Risk (P1) | Severity bar chart, trend line chart | Tremor `BarChart`, `LineChart` |
