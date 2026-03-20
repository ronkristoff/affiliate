---
title: "Reusable DataTable with Built-in Column Sorting"
slug: "reusable-datatable-column-sorting"
created: "2026-03-19"
status: "complete"
stepsCompleted: [1, 2, 3, 4, 5]
completedAt: "2026-03-19"
tech_stack: ["Next.js 16", "React 19", "TypeScript", "Convex", "nuqs", "Tailwind CSS v4", "Lucide Icons", "Radix UI"]
files_to_modify: ["src/components/ui/DataTable.tsx", "src/app/(auth)/affiliates/page.tsx", "src/components/affiliate/AffiliateTable.tsx", "src/app/(auth)/reports/affiliates/components/AffiliatePerformanceTable.tsx", "src/app/(auth)/dashboard/components/RecentCommissionsTable.tsx", "src/app/(auth)/dashboard/components/TopAffiliatesTable.tsx", "src/app/(auth)/payouts/history/PayoutHistoryClient.tsx", "src/app/(auth)/emails/history/page.tsx", "src/components/settings/BillingHistoryTable.tsx"]
files_modified: ["src/components/ui/DataTable.tsx", "src/app/(auth)/affiliates/page.tsx", "src/app/(auth)/reports/affiliates/components/AffiliatePerformanceTable.tsx", "src/app/(auth)/dashboard/components/RecentCommissionsTable.tsx", "src/app/(auth)/dashboard/components/TopAffiliatesTable.tsx", "src/app/(auth)/dashboard/page.tsx", "src/app/(auth)/payouts/history/PayoutHistoryClient.tsx", "src/app/(auth)/emails/history/page.tsx", "src/components/settings/BillingHistoryTable.tsx", "src/components/affiliate/index.ts"]
files_deleted: ["src/components/affiliate/AffiliateTable.tsx"]
code_patterns: ["column-config-driven tables", "props-based sort state", "nuqs URL persistence at consumer level", "rowClassName callback for flexible row styling", "client-side sort fallback when no onSortChange"]
test_patterns: ["no production tests exist in project", "placeholder tests only", "vitest configured"]
---

# Tech-Spec: Reusable DataTable with Built-in Column Sorting

**Created:** 2026-03-19

## Overview

### Problem Statement

The codebase has two divergent table implementations. A domain-specific `AffiliateTable` (`src/components/affiliate/AffiliateTable.tsx`) renders hardcoded `<table>` markup with no sorting capability and is used only on `/affiliates`. A generic `DataTable` (`src/components/ui/DataTable.tsx`) exists with a `sortable` flag on `TableColumn` that is declared in the type but has **zero implementation**. The reports page (`AffiliatePerformanceTable`) manually wires its own `handleSort` and `getSortIcon` per column header instead of using `DataTable`'s built-in mechanism. Styling is inconsistent across tables.

### Solution

Enhance the existing `DataTable` component with built-in asc/desc column sorting (URL-synced via `nuqs` for persistence). Wire up the existing `sortable` flag on `TableColumn`. Migrate ALL table views to use `DataTable` as the single source of truth. The visual styling from the current `/affiliates` `AffiliateTable` becomes the site-wide standard applied inside `DataTable`.

### Scope

**In Scope:**
- Enhance `DataTable` (`src/components/ui/DataTable.tsx`) with built-in column sorting (client-side + server-side sort callback support)
- URL-synced sort state via `nuqs` (bookmarkable, back-button friendly)
- Update `DataTable` styling to exactly match the current `AffiliateTable` styling from `/affiliates` — this is the non-negotiable visual standard
- Migrate `/affiliates` `AffiliateTable` → use `DataTable` (pending and non-pending tabs as two column configs on the same `DataTable`)
- Migrate `/reports/affiliates` `AffiliatePerformanceTable` → use `DataTable`'s built-in sort (remove manual sort wiring)
- Migrate `/dashboard` tables (`RecentCommissionsTable`, `TopAffiliatesTable`) → use `DataTable`
- Migrate `/payouts/history` `PayoutHistoryClient` table → use `DataTable`
- Migrate `/emails/history` table → use `DataTable`
- Migrate `/settings` `BillingHistoryTable` → use `DataTable`

**Out of Scope:**
- New Convex backend sort queries for the affiliates list endpoint
- Pagination changes (already handled at page level)
- Mobile-specific responsive table behavior changes
- Tables on pages not yet created (future work)

## Context for Development

### Codebase Patterns

- **Component library:** Radix UI primitives + shadcn/ui patterns with class-variance-authority
- **URL state:** `nuqs` v2 for URL-synced state (already used in `/affiliates` for tabs, search, filters, pagination)
- **Styling convention:** Tailwind utility classes with `cn()` for conditional merging; semantic color tokens (`text-[#333]`, `text-[#6b7280]`, `bg-[#fafafa]`, `border-[#e5e7eb]`)
- **Design system:** Brand primary `#10409a`, secondary `#1659d6`; border-radius `12px`; status colors: success green, warning amber, danger red
- **Client components:** `"use client"` directive required for hooks; wrap in `<Suspense>` with skeleton fallback per Next.js 16 requirements

### Critical Styling Reference — AffiliateTable (THE STANDARD)

The following styling from `src/components/affiliate/AffiliateTable.tsx` must be applied to `DataTable`:

| Element | Style |
|---------|-------|
| Container | `bg-white border border-[#e5e7eb] rounded-xl overflow-hidden` |
| Header row bg | `bg-[#fafafa] border-b border-[#e5e7eb]` |
| Header text | `text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide` |
| Header right-align | `text-right` on currency columns |
| Body row hover | `hover:bg-[#f9fafb] transition-colors` |
| Body row border | `border-b border-[#f3f4f6]` |
| Selected row (pending) | `backgroundColor: "#fffbeb"` |
| Cell padding | `px-4 py-3` |
| Header padding | `px-4 py-2.5` |
| Checkbox col width | `w-10` |
| Name font | `font-semibold text-[#333] text-[13px]` |
| Email text | `text-[11px] text-[#6b7280]` |
| Stats value | `text-[13px] font-semibold text-[#333]` |
| Secondary value | `text-[13px] text-[#6b7280]` |
| Currency | `font-semibold tabular-nums text-[#333]` |
| Muted currency | `font-semibold tabular-nums text-[#6b7280]` |
| Date text | `text-[12px] text-[#6b7280]` |
| Action button (outline) | `h-7 px-2 text-[12px] border border-[#e5e7eb]` |
| Empty state | `flex items-center justify-center h-32 text-[#6b7280] text-sm` |

### Files to Reference

| File | Purpose | Lines | Investigated |
| ---- | ------- | ----- | ------------ |
| `src/components/ui/DataTable.tsx` | Existing generic table — PRIMARY modification target | 577 | ✅ |
| `src/components/affiliate/AffiliateTable.tsx` | THE styling reference — delete after migration | 499 | ✅ |
| `src/app/(auth)/affiliates/page.tsx` | Affiliates page consuming `AffiliateTable` — column config extraction | 613 | ✅ |
| `src/app/(auth)/reports/affiliates/components/AffiliatePerformanceTable.tsx` | Reports table with manual sort wiring — convert to built-in sort | 236 | ✅ |
| `src/app/(auth)/dashboard/components/RecentCommissionsTable.tsx` | Dashboard commissions — already DataTable, add sortable flags | ~130 | ✅ |
| `src/app/(auth)/dashboard/components/TopAffiliatesTable.tsx` | Dashboard top affiliates — already DataTable, add sortable flags | ~90 | ✅ |
| `src/app/(auth)/payouts/history/PayoutHistoryClient.tsx` | Payouts — shadcn Table to DataTable migration, dialog table | ~632 | ✅ |
| `src/app/(auth)/emails/history/page.tsx` | Email history — CSS grid to DataTable, dual responsive | ~300 | ✅ |
| `src/components/settings/BillingHistoryTable.tsx` | Billing history — already DataTable, add sortable flags | ~152 | ✅ |
| `src/components/ui/table.tsx` | Base shadcn table primitives (Table, TableHead, etc.) | 108 | ✅ |
| `src/lib/utils.ts` | `cn()` utility for class merging | — | ✅ |

### Technical Decisions

- **Sort state management (ARCHITECTURE — Winston):** `DataTable` does NOT directly use `nuqs`. It accepts `sortBy`, `sortOrder`, and `onSortChange` as props. The **consumer** (page-level component) handles `nuqs` wiring. This keeps `DataTable` framework-agnostic, testable, and decoupled from routing. Any page can use `DataTable` with `useState`, `nuqs`, or any other state management.
- **Dual sort mode:** `DataTable` accepts an optional `onSortChange` callback. If provided, sort is fully consumer-controlled (server-side). `DataTable` does NOT sort internally when `onSortChange` is provided — clean separation of concerns. If `onSortChange` is omitted, `DataTable` falls back to client-side array sorting for sortable columns.
- **Column config approach:** Each page/view defines its own `TableColumn<T>[]` array. The `/affiliates` pending tab and non-pending tabs use two different column configs passed to the same `DataTable`.
- **Sortable column header rendering:** When `sortable: true`, `DataTable` wraps the header in a clickable button with sort icons (Lucide). The entire `<th>` cell is the click target (not just the icon) for adequate touch targets. The consumer does NOT manually render sort icons — `DataTable` handles it internally.
- **Sort icon behavior (UX — Sally):** On first render (no active sort), sortable columns show a **subtle, low-opacity** `ArrowUpDown` icon (`opacity-40`) to signal discoverability. When a column is actively sorted, show `ArrowUp` (asc) or `ArrowDown` (desc) at full opacity.
- **Sort direction default:** When clicking a new (unsorted) column, default to `desc` — matches existing reports behavior.
- **Row styling flexibility (Architecture — Winston):** `DataTable` accepts an optional `rowClassName?: (row: T) => string` callback. Merge order in `cn()`: `cn(baseClasses, isSelected && "bg-[#eff6ff]", rowClassName?.(row))` — `rowClassName` comes LAST so `twMerge` correctly resolves `bg-*` conflicts. When `rowClassName` returns a non-empty value, it overrides the built-in selection highlight.
- **Sort field mapping (Round 2 fix):** `TableColumn` gains `sortField?: string` to decouple display column keys from data field names. Client-side sort uses `row[col.sortField || col.key]`. `onSortChange` callback receives `col.sortField || col.key`. This solves the mismatch between `key="affiliate"` and data field `affiliateName`, and between `key="date"` and data field `timestamp`.
- **Mobile touch targets (UX — Sally):** Sort header `<th>` cells have a minimum height and the full cell is the interactive zone, ensuring ≥ 44px tap area for mobile.

## Implementation Plan

### Migration Target Analysis (from Deep Investigation)

**Tier 1 — Already using DataTable, simple sort addition (3 files):**

| File | Current State | Sort | Notes |
|------|--------------|------|-------|
| `RecentCommissionsTable.tsx` | ✅ Uses `DataTable` + `TableColumn` | ❌ | Add `sortable: true` to columns. Has custom loading skeleton (35 lines) that duplicates `DataTable` built-in — remove it. 2 unused props (`pendingCount`, `showPayAllButton`). |
| `TopAffiliatesTable.tsx` | ✅ Uses `DataTable` + `TableColumn` | ❌ | Add `sortable: true` to columns. Remove dead `Skeleton` import. Revenue column has custom `TrendingUp` icon wrapper — keep as cell renderer. |
| `BillingHistoryTable.tsx` | ✅ Uses `DataTable` + `TableColumn` | ❌ | Add `sortable: true` to columns. Pagination externally driven via 4 props (`hasMore`, `hasPrevious`, `onNext`, `onPrevious`) — no changes needed. Pure presentational. |

**Tier 2 — Already using DataTable, needs sort migration (1 file):**

| File | Current State | Sort | Notes |
|------|--------------|------|-------|
| `AffiliatePerformanceTable.tsx` | ✅ Uses `DataTable` + `TableColumn` | ✅ Manual | Has manual `handleSort`/`getSortIcon` per column (lines 77-95). Sort state wired via `nuqs` at component level (good pattern). Needs to switch to `DataTable` built-in sort props (`sortBy`/`sortOrder`/`onSortChange`). Remove manual sort icon rendering from column headers. |

**Tier 3 — Full migration from raw table to DataTable (3 files):**

| File | Current State | Sort | Complexity | Notes |
|------|--------------|------|------------|-------|
| `AffiliateTable.tsx` → `/affiliates` | ❌ Raw `<table>` (499 lines) | ❌ | **Medium** | THE styling reference. Hardcoded pending vs non-pending column layouts. Has checkbox selection, approve/reject/suspend/reactivate actions, fraud signal badge, avatar color system. Must extract into two `TableColumn[]` configs. Helpers (`getAvatarColor`, `getInitials`, `formatRelativeTime`, `formatDate`, `formatCurrency`) already exist in `DataTable.tsx`. Delete file after migration. |
| `PayoutHistoryClient.tsx` | ❌ shadcn `Table` primitives | ❌ | **Medium** | 632 lines. Main batches table (6 cols) is straightforward. But has co-located `BatchDetailDialog` (~200 lines) with its own inner table (7 cols), CSV export, mark-all-as-paid flow. Server-side cursor pagination. Filter tabs. `TableSkeleton` and `EmptyState` sub-components. Consider keeping detail dialog as-is or extracting inner table to `DataTable`. |
| `Emails history page.tsx` | ❌ Custom CSS grid | ✅ Client-side | **Medium-Complex** | Uses `md:grid-cols-[...]` layout, NOT `<table>` at all. Dual responsive layouts (mobile/desktop are completely separate JSX trees). Entire rows are `<Link>` elements. Client-side filtering + sorting (3 sortable fields via `handleSort` + `Select` dropdown with 6 presets). Export button needs `e.preventDefault()` on row click. `STATUS_CONFIG`, `getOpenRate()`, `getClickRate()` helpers co-located. Weak typing (`Record<string, unknown>`). |

### Tasks

- [x] **Task 1: Enhance `DataTable` with built-in column sorting + cleanup**
  - File: `src/components/ui/DataTable.tsx`
  - Action:
    1. Add new props to `DataTableProps<T>`: `sortBy?: string`, `sortOrder?: "asc" | "desc"`, `onSortChange?: (sortBy: string, sortOrder: "asc" | "desc") => void`, `rowClassName?: (row: T) => string`
    2. **[F1.1 fix]** Add `sortField?: string` property to `TableColumn<T>` interface. This maps a display column key to the actual data field name for sorting. When doing client-side sort, use `col.sortField || col.key` to access `row[col.sortField || col.key]`. This bridges the gap where `key="affiliate"` but data has `affiliateName`, `key="date"` but data has `timestamp`, etc. When `onSortChange` is provided, pass `col.sortField || col.key` to the callback so the consumer receives the correct backend sort field.
    3. Add sort icon imports: `ArrowUpDown`, `ArrowUp`, `ArrowDown` from `lucide-react`
    4. Implement `handleSort(columnKey: string)` internal function:
       - If `sortBy === columnKey`: toggle `asc` → `desc` → `asc`
       - If different column: set to `desc` (default for new column)
       - If `onSortChange` provided: call `onSortChange(col.sortField || col.key, newOrder)` — do NOT sort data internally
       - If `onSortChange` NOT provided: sort data array client-side by `row[col.sortField || col.key]` value
    5. Implement `getSortIcon(columnKey: string)`:
       - Not sorted: `<ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />`
       - Sorted asc: `<ArrowUp className="w-3 h-3 ml-1" />`
       - Sorted desc: `<ArrowDown className="w-3 h-3 ml-1" />`
    5. In the `<thead>` rendering, when `col.sortable === true`:
       - Render the entire `<th>` as a clickable zone with `cursor-pointer select-none`
       - Wrap header content + sort icon in a `<button>` or make the `<th>` itself the click target
       - Add `hover:text-[#10409a]` transition on sort headers
       - Ensure minimum 44px height for mobile touch targets
     6. **[F2/F7 fix]** In the `<tbody>` rendering, apply row classes using this exact `cn()` merge order: `cn(baseRowClasses, hoverClass, isSelected && "bg-[#eff6ff]", rowClassName?.(row))`. The `rowClassName` value comes LAST in the `cn()` call, so `twMerge` correctly resolves any `bg-*` conflict — `rowClassName`'s `bg-[#fffbeb]` overrides the earlier `bg-[#eff6ff]`. When `rowClassName` returns `undefined`/empty, the default `bg-[#eff6ff]` applies for selected rows.
     7. **[F4 fix]** Update `DateCell` to accept a `size?: "sm" | "default"` prop. `size="sm"` applies `text-[11px]`, `size="default"` applies `text-[12px]`. Default to `"default"` if omitted. This matches AffiliateTable's "Applied" column (`text-[11px]`) and "Joined" column (`text-[12px]`) respectively.
     8. **[F7 fix]** Update `DateCell` to support `format: "relative-full"` which spells out time units (e.g., "5 minutes ago", "2 hours ago", "1 day ago") instead of the abbreviated "5m ago" format. This matches `AffiliateTable.formatRelativeTime` output for AC 19 pixel-identical compliance.
     9. **[F12/F13 fix]** Remove `CompactTable` — it is dead code (zero imports across the entire codebase). Delete ONLY the `CompactTable` component and its `CompactTableProps` interface (approximately lines 439-509). Do NOT delete `StatusBadgeCell` (defined after CompactTable) or the `TableColumn` type (used by both).
  - Notes: This is the foundation task. All subsequent migrations depend on this.

- [x] **Task 2: Fix minor `DataTable` styling deltas vs `AffiliateTable`**
  - File: `src/components/ui/DataTable.tsx`
  - Action:
    1. **[F5 fix]** DataTable already matches AffiliateTable styling almost exactly. Only fix these specific deltas:
       - Checkbox column header: `AffiliateTable` omits `bg-[#fafafa] border-b border-[#e5e7eb]` on the checkbox `<th>` (line 273) while `DataTable` includes them. Match `AffiliateTable` — remove these classes from the checkbox header cell.
    2. Visual regression check at `http://localhost:3000/reports/affiliates` (already uses DataTable) — verify no unintended changes.
  - Notes: This is a targeted fix, not a comprehensive restyling. DataTable's core styling is already correct.

- [x] **Task 3: Migrate `AffiliatePerformanceTable` to use built-in sort**
  - File: `src/app/(auth)/reports/affiliates/components/AffiliatePerformanceTable.tsx`
  - Action:
    1. Remove manual `handleSort` function (lines 77-84)
    2. Remove manual `getSortIcon` function (lines 86-95)
    3. Remove `ArrowUpDown`, `ArrowUp`, `ArrowDown` from imports
    4. Add `sortable: true` to columns that currently have manual sort buttons: `affiliate`, `clicks`, `conversions`, `conversionRate`, `commissions`
    5. **[F1.2 fix]** Add `sortField: "name"` to the `affiliate` column — the column key is `"affiliate"` but the Convex backend sort field is `"name"` (the nuqs parser allows `["clicks", "conversions", "conversionRate", "commissions", "name"]`). Without `sortField`, `onSortChange("affiliate", ...)` would fail the nuqs literal union. The other columns already have matching keys and sort fields.
    6. Revert column headers from manual `<button onClick={handleSort(...)}` + `{getSortIcon(...)}` back to plain string headers (e.g., `"Clicks"` instead of JSX button)
    7. Pass `sortBy={sortBy}` and `sortOrder={sortOrder}` props to `<DataTable>`
    8. Pass `onSortChange={(col, order) => { setSortBy(col as typeof sortBy); setSortOrder(order); }}` to `<DataTable>` — `DataTable` automatically passes `col.sortField || col.key` to `onSortChange`, so the callback receives `"name"` not `"affiliate"`
    8. Keep existing `nuqs` state wiring for `sortBy` and `sortOrder` (this is the consumer-level URL persistence)
    9. The `rank` column is computed from commission-sorted data — it should NOT be sortable
    10. **[F9 fix]** Remove the custom loading skeleton (lines 214-225) that renders a raw `<div>` + `<Skeleton>` before reaching `<DataTable>`. Instead, pass `isLoading` to `<DataTable>` so it uses the standardized built-in skeleton.
  - Notes: This is the simplest Tier 2 migration. The `nuqs` wiring already exists at the right level (consumer).

- [x] **Task 4: Add sortable flags to `RecentCommissionsTable`**
  - File: `src/app/(auth)/dashboard/components/RecentCommissionsTable.tsx`
  - Action:
    1. Add `sortable: true` to `date` column — also set `sortField: "createdAt"` since the column key is `"date"` but the data field is `createdAt`
    2. Add `sortable: true` to `amount` column
    3. Remove the custom loading skeleton (lines with raw `<table>` markup) — `DataTable`'s built-in `isLoading` already handles this
    4. **[F14 fix]** Before removing `pendingCount` and `showPayAllButton` props, verify no parent components pass them. Grep the codebase for `<RecentCommissionsTable` call sites. If any pass these props, remove them from the call site first. If none pass them, safely remove from the interface.
  - Notes: No `nuqs` wiring needed here — client-side sort fallback is fine for a dashboard widget showing recent items.

- [x] **Task 5: Add sortable flags to `TopAffiliatesTable`**
  - File: `src/app/(auth)/dashboard/components/TopAffiliatesTable.tsx`
  - Action:
    1. Add `sortable: true` to `clicks`, `conversions`, `revenue` columns (keys already match data field names — no `sortField` needed)
    2. Remove dead `Skeleton` import
    3. Keep the `TrendingUp` icon wrapper in the revenue cell renderer as-is
  - Notes: Client-side sort fallback is fine for a dashboard widget.

- [x] **Task 6: Add sortable flags to `BillingHistoryTable` + standardize loading/empty states**
  - File: `src/components/settings/BillingHistoryTable.tsx`
  - Action:
    1. Add `sortable: true` to `date` column — also set `sortField: "timestamp"` since the column key is `"date"` but the data field is `timestamp`
    2. Add `sortable: true` to `event` column (key matches data field — no `sortField` needed)
    3. **[F11 fix]** Remove custom loading state (`<Loader2>` spinner, lines ~124-128). Pass `isLoading` to `<DataTable>` so it uses the standardized skeleton.
     4. **[F11 fix]** Remove custom empty state (`Receipt` icon + description text, lines ~129-135). Pass `emptyMessage` to `<DataTable>` so it uses the standardized empty message. **IMPORTANT:** `Receipt` import must be RETAINED — it is still used in the `CardTitle` icon at line ~116. Do NOT remove the import.
  - Notes: Client-side sort fallback is fine. Pagination is externally driven — no conflict.

- [x] **Task 7: Migrate `/affiliates` page from `AffiliateTable` to `DataTable`**
  - File: `src/app/(auth)/affiliates/page.tsx`
  - File: `src/components/affiliate/AffiliateTable.tsx` (to be deleted)
  - Action:
    1. **[F4 fix]** Before deleting `AffiliateTable.tsx`, extract the `Affiliate` interface to a shared location. Move it to `src/app/(auth)/affiliates/page.tsx` (co-located with the only consumer) OR to a new `src/types/affiliate.ts` file. Update all imports of `Affiliate` from the old path.
     2. **[F3 fix]** `StatusBadge` (from `@/components/shared/StatusBadge`) uses shadcn `<Badge>` which adds `border` and `focus:*` ring styles, while `StatusBadgeCell` (from `@/components/ui/DataTable`) uses a raw `<span>`. They do NOT render identically. Fix: Update `StatusBadgeCell` to use shadcn `<Badge>` as its wrapper (imported from `@/components/ui/badge`), stripping Badge's default classes via `cn("inline-flex ...", Badge className overrides)`, so it matches `StatusBadge`'s visual output. This must be done in Task 1 or Task 2 as part of the DataTable enhancement.
     3. Define two `TableColumn<Affiliate>[]` configs inside or near the page component:
        - `pendingColumns`: applicant (AvatarCell), applied (DateCell with `format="relative-full"` and `size="sm"` for `text-[11px]`), source, campaign, actions (approve/reject buttons via `actions` prop)
        - `activeColumns`: affiliate (AvatarCell + fraud badge), status (StatusBadgeCell — updated with Badge wrapper per step 2), campaign, referrals (NumberCell), clicks (NumberCell), earnings (CurrencyCell), joined (DateCell with `format="short"` and `size="default"` for `text-[12px]`), actions (view/suspend/reactivate via `actions` prop)
     4. **[F5 fix]** INTENTIONAL BUG FIX: The current `AffiliateTable` pending tab renders 5 data cells (Applicant, Applied, Source, Campaign, Actions) but only 4 column headers (Applicant, Applied, Source, Actions — missing "Campaign" header). Adding "Campaign" to `pendingColumns` fixes this existing mismatch. The visual will change (a new header appears) — this is documented as a bug fix, not a regression. AC 19 is updated to note this exception.
     5. **[F3 fix]** The page renders TWO separate `<DataTable>` instances — one for the pending tab (with `selectable={true}`) and one for non-pending tabs (with `selectable={false}`). This avoids the need for runtime conditional checkbox display. The tab-switching logic at the page level already conditionally renders different content per tab.
    5. For the pending tab DataTable: pass `selectable={true}`, `selectedIds`, `onSelectionChange`, `actions` array with approve/reject, `rowClassName={(row) => selectedAffiliates.has(row._id) ? "bg-[#fffbeb]" : ""}`
    6. **[F10 fix]** For non-pending tabs: DO NOT add `sortable: true` yet. The current page has server-side pagination with no Convex sort support. Client-side sort on 20 items is misleading. Instead, wire `sortBy`/`sortOrder` via `nuqs` and pass `onSortChange` to DataTable, but only enable `sortable: true` on columns AFTER the Convex query supports `sortBy`/`sortOrder` parameters (future task, out of scope). Add a `// TODO: Enable sortable: true once Convex query supports sorting` comment on referrals, clicks, earnings, joined columns.
    7. Pass `canManage` to control action visibility via `actions[].disabled` or conditional `actions` array
    8. The fraud signal badge rendering moves into the affiliate column's cell renderer
    9. Replace all `<AffiliateTable ... />` usages with `<DataTable columns={...} data={...} ... />`
    10. Delete `src/components/affiliate/AffiliateTable.tsx`
    11. Remove `AffiliateTable` import and re-export from `src/components/affiliate/index.ts` if exported there
  - Notes: This is the highest-risk migration. The pending tab has unique selection behavior (bulk approve/reject). AC 19 "pixel-identical" depends on F6 (StatusBadge parity) and F7 (DateCell relative-full format). Verify visually at `http://localhost:3000/affiliates` — ALL tabs.

- [x] **Task 8: Migrate `PayoutHistoryClient` main table to `DataTable`**
  - File: `src/app/(auth)/payouts/history/PayoutHistoryClient.tsx`
  - Action:
    1. Replace the main batches table (shadcn `Table` primitives) with `DataTable` + `TableColumn<PayoutBatch>[]` config
    2. Columns: batchCode (code mono), generatedAt (DateCell), affiliateCount (NumberCell, right), totalAmount (CurrencyCell, right), status (BatchStatusBadge)
    3. The "View" action button maps to `TableAction` with Eye icon
    4. Loading state: replace custom `TableSkeleton` with `DataTable`'s built-in `isLoading`
    5. Empty state: replace custom `EmptyState` with `DataTable`'s `emptyMessage`
    6. Keep `BatchDetailDialog` as-is for now (its inner table can be migrated later — it's a detail view, not a list page)
    7. Keep pagination controls (Previous/Next) as-is — they're external to the table
  - Notes: Only the main list table is migrated. The detail dialog's inner table is a separate concern.

- [x] **Task 9: Migrate email history from CSS grid to `DataTable`**
  - File: `src/app/(auth)/emails/history/page.tsx`
  - Action:
     1. **[F8 fix]** Define a proper `Broadcast` TypeScript interface to replace the weak `Record<string, unknown>` typing. Extract from the fields actually used in cell renderers: `id`, `subject`, `sentAt`, `recipientCount`, `sentCount`, `openedCount`, `clickedCount`, `status`, etc. Type the column config as `TableColumn<Broadcast>[]`.
     2. **[F6 fix]** Remove the early return full-page spinner (`broadcasts === undefined` check that returns `<Loader2>`). Instead, let the page render with `<DataTable isLoading={broadcasts === undefined}>` so the standardized skeleton displays during initial load.
     3. Replace the custom CSS grid layout with `DataTable` + `TableColumn<Broadcast>` config
     4. Columns with explicit `width` values matching current CSS grid (`md:grid-cols-[1fr_120px_120px_100px_100px_120px_80px]`):
        - `subject`: no width (flex/stretch, like `1fr`)
        - `sentAt`: `width={120}`
        - `recipients`: `width={120}`, NumberCell, right-aligned
        - `status`: `width={100}`, center-aligned
        - `opens`: `width={100}`, center-aligned, percent format
        - `clicks`: `width={120}`, center-aligned, percent format
        - `actions`: `width={80}`, center-aligned (export button)
     5. Add `sortable: true` to subject, sentAt, recipients columns with `sortField` set to match data fields
     6. **[F2 fix]** Use externally managed sort state with `onSortChange` (NOT internal fallback). The email page already has `sortField`/`sortDirection` state and a `<Select>` dropdown. Wire DataTable's `onSortChange` to update these existing state variables. Pass `sortBy`/`sortOrder` from the same state to DataTable. This ensures the dropdown and column headers are automatically in sync because they share the same source of truth. Remove the manual `handleSort` client-side sorting logic — DataTable handles it internally.
     7. **[F8 fix]** Retain the `<Select>` sort dropdown as a COMPLEMENTARY control — it provides combined field+direction presets ("Subject A-Z", "Most recipients") that column header clicking alone can't replicate. Since sort state is shared (step 6), selecting a preset updates column headers and vice versa.
     8. **[F8 fix]** Row click → navigate: do NOT use `onRowClick` (it replaces `<Link>` semantics with a JS click handler, breaking middle-click, Ctrl+click, screen readers, and crawlability). Instead, keep each row as a `<Link>` — DataTable already renders `<tr>` elements; the consumer can either: (a) use `onRowClick` with `window.location.href` as a pragmatic approach (acceptable trade-off noted), OR (b) the subject column cell renderer wraps content in `<Link>` directly, making the primary content a real link while the rest of the row is non-clickable. **Decision: use approach (b)** — wrap the subject cell content in `<Link href={/emails/history/${broadcast.id}}>`. This preserves proper link semantics for the primary content.
    8. Export button in actions column: use `e.stopPropagation()` pattern (already handled by `DataTable`'s action column which stops propagation)
    9. **[F1 fix]** Mobile layout: DO NOT remove the mobile card JSX tree. Instead, render the `<DataTable>` only on `md:` breakpoint and above, and keep the existing mobile card layout for `md:hidden`. This preserves the purpose-built mobile UX while standardizing the desktop table. Use a responsive wrapper: `{/* Mobile card layout */}<div className="hidden md:block"><DataTable ... /></div>{/* Desktop table */}`
    10. Extract `STATUS_CONFIG`, `getOpenRate()`, `getClickRate()` helpers (keep co-located or move to utils)
  - Notes: This is the most complex migration. F1 and F12 are the biggest UX decisions — keeping the mobile card view and retaining the sort dropdown preserves existing functionality while standardizing the desktop table.

- [x] **Task 10: Clean up and verify**
  - Files: multiple
  - Action:
    1. Verify no imports of deleted `AffiliateTable` remain anywhere in the codebase
    2. Verify `Affiliate` type is importable from its new location
    3. Run `pnpm lint` — fix any lint errors
    4. Run `pnpm build` — verify no type errors
    5. Visual spot-check all migrated pages:
       - `http://localhost:3000/affiliates` (all tabs: all, pending, active, suspended)
       - `http://localhost:3000/reports/affiliates` (sort via column headers)
       - `http://localhost:3000/dashboard` (commissions table, top affiliates table)
       - `http://localhost:3000/payouts/history` (batches table)
       - `http://localhost:3000/emails/history` (broadcast list, sort via headers)
       - Settings billing history page
    6. Verify sort persistence via URL params (back button, bookmark)
    7. Verify mobile touch targets on sort headers (≥ 44px)
  - Notes: Final quality gate before marking spec complete.

### Acceptance Criteria

**DataTable Core (Tasks 1-2):**

- [x] AC 1: Given a `DataTable` with a column where `sortable: true`, when the user clicks the column header, then the data rows reorder by that column in descending order (default for first click)
- [x] AC 2: Given the user has sorted a column ascending, when the user clicks the same column header again, then the sort toggles to descending
- [x] AC 3: Given the user has sorted by column A descending, when the user clicks column B header, then the data sorts by column B descending (resets to default direction for new column)
- [x] AC 4: Given a sortable column header, when no sort is active on that column, then a subtle `ArrowUpDown` icon displays at `opacity-40`
- [x] AC 5: Given a column is actively sorted ascending, when rendered, then an `ArrowUp` icon displays at full opacity on that column header
- [x] AC 6: Given a column is actively sorted descending, when rendered, then an `ArrowDown` icon displays at full opacity on that column header
- [x] AC 7: Given `sortBy="amount"` and `sortOrder="asc"` and `onSortChange` is provided, when the component renders, then the data is NOT internally sorted (consumer controls sorting)
- [x] AC 8: Given `sortBy` and `sortOrder` and `onSortChange` are all omitted, when the user clicks a sortable header, then the data sorts client-side using the column values
- [x] AC 9: Given `rowClassName` callback returns `"bg-[#fffbeb]"` for selected rows, when those rows render, then the custom background color is applied AND it OVERRIDES the built-in `bg-[#eff6ff]` selection highlight (no class conflict)
- [x] AC 10: Given the `DataTable` renders, when visually compared to `AffiliateTable` screenshots, then all styles match exactly (container, header, rows, cells, hover, empty state, loading skeleton)
- [x] AC 11: Given a sortable column header on mobile, when measured, then the clickable area is ≥ 44px in height

**AffiliatePerformanceTable Migration (Task 3):**

- [x] AC 12: Given the reports affiliates page, when the user clicks a sortable column header, then sort state updates in the URL (`?sortBy=clicks&order=desc`)
- [x] AC 13: Given the reports affiliates page with `?sortBy=commissions&order=asc` in URL, when the page loads, then data is sorted by commissions ascending and the correct sort icon displays
- [x] AC 14: Given the reports affiliates page, when the user navigates away and presses back, then sort state is preserved from the URL

**Affiliates Page Migration (Task 7):**

- [x] AC 15: Given the `/affiliates` pending tab, when rendered, then checkboxes display for row selection, approve/reject action buttons display for manage-able users
- [x] AC 16: Given the `/affiliates` pending tab with 3 affiliates selected, when rendered, then selected rows have `bg-[#fffbeb]` background AND NOT `bg-[#eff6ff]` (F7 merge — rowClassName override works correctly)
- [x] AC 17: Given the `/affiliates` non-pending tab, sortable columns are NOT yet enabled (F10 fix — pending Convex sort support). The columns have TODO comments marking them for future enablement.
- [x] AC 18: Given the `/affiliates` non-pending tab, when an affiliate has `hasFraudSignals: true`, then the "Flagged" badge displays in the affiliate name column
- [x] AC 19: Given the `/affiliates` page, when visually compared before and after migration, then the styling is pixel-identical across all tabs EXCEPT the pending tab which gains a "Campaign" column header (intentional bug fix — F5)
- [x] AC 20: Given `StatusBadgeCell` after update, when rendered alongside `StatusBadge`, then both produce visually identical badges (F3 fix — shadcn Badge wrapper)

**Payout History Migration (Task 8):**

- [x] AC 20: Given the `/payouts/history` page, when rendered, then the batches table displays with columns: Batch ID, Date, Affiliates, Total Amount, Status, Actions
- [x] AC 21: Given the `/payouts/history` page, when loading, then the `DataTable` built-in skeleton displays (not the old custom `TableSkeleton`)
- [x] AC 22: Given the `/payouts/history` page with no batches, when rendered, then the `DataTable` empty message displays

**Email History Migration (Task 9):**

- [x] AC 23: Given the `/emails/history` page, when rendered, then broadcast emails display in a `DataTable` with sortable columns (subject, sent date, recipients)
- [x] AC 24: Given the `/emails/history` page, when the user clicks the subject cell link, then navigation to the email detail occurs via proper `<Link>` semantics (middle-click, Ctrl+click work correctly)
- [x] AC 25: Given the `/emails/history` page, when the user clicks the export button on a row, then the CSV downloads without navigating away
- [x] AC 26: Given the `/emails/history` page on mobile viewport (< 768px), when rendered, then the card layout displays (NOT a horizontally scrollable table)
- [x] AC 27: Given the `/emails/history` page on desktop (≥ 768px), when rendered, then the `DataTable` displays with the sort dropdown and column headers staying in sync via shared state
- [x] AC 28: Given `DateCell` with `format="relative-full"`, when the value is 5 minutes ago, then the output reads "5 minutes ago" (not "5m ago")
- [x] AC 29: Given `DateCell` with `size="sm"`, when rendered, then the text is `text-[11px]`. Given `size="default"`, then `text-[12px]`.
- [x] AC 30: Given a `DataTable` column with `key="affiliate"` and `sortField="name"`, when `onSortChange` is called, then `"name"` is passed (not `"affiliate"`)

## Additional Context

### Party Mode Insights (captured from agent discussion)

**Winston (Architect):**
- Decouple `DataTable` from `nuqs` — accept `sortBy`/`sortOrder`/`onSortChange` as props, let consumer handle URL persistence
- When `onSortChange` is provided, `DataTable` must NOT also sort internally — clean separation
- Add `rowClassName?: (row: T) => string` callback for flexible row-level styling (e.g., pending tab yellow highlight)

**Sally (UX Designer):**
- Sort icons at `opacity-40` on inactive columns for discoverability
- Full `<th>` cell as click target, not just the icon — ensures ≥ 44px mobile touch targets
- Preserve pending tab's `#fffbeb` selected row and action button styling (green approve, red outline reject) exactly

**Amelia (Dev):**
- Existing `sortable` flag on `TableColumn` (lines 21-22) is the hook — wire implementation there
- New column click: if same column → toggle asc↔desc; if different column → set desc (matches reports behavior)
- 7 migration targets identified; `AffiliateTable.tsx` deleted after migration confirmed

### Dependencies

- `nuqs` — already installed; used at page/consumer level (NOT inside `DataTable`)
- `lucide-react` — already installed; `ArrowUpDown`, `ArrowUp`, `ArrowDown` icons for sort indicators
- `@/components/ui/checkbox` — already installed; used for row selection

### Testing Strategy

**Unit Tests:** Not required for this spec. The project has no production tests (Vitest configured, placeholder only). The changes are UI component refactoring — best validated visually.

**Manual Testing Steps:**

1. **DataTable sort:** Visit any page with sortable columns → click each column header → verify sort direction toggles → verify sort icon changes → verify URL params update on pages using `nuqs`
2. **Styling fidelity:** Open `/affiliates` before and after migration → screenshot comparison → verify all tabs match pixel-perfectly
3. **Mobile sort targets:** Open DevTools → toggle mobile viewport → tap sortable column headers → verify no misclicks (adequate touch target)
4. **URL persistence:** Sort a column → copy URL → open in new tab → verify sort preserved → press back → verify sort preserved
5. **Selection + sort interaction:** On `/affiliates` pending tab → select rows → sort by column → verify selection state persists visually
6. **Row click + action coexistence:** On `/emails/history` → click export button → verify no navigation occurs → click row body → verify navigation occurs
7. **Empty state:** Visit `/affiliates` with no data for a tab → verify "No X affiliates found" message displays
8. **Loading state:** Visit `/payouts/history` → observe skeleton → verify it matches the standard styling

### Notes

- **CRITICAL CONSTRAINT:** The visual styling of `/affiliates` tables is the non-negotiable standard. Any `DataTable` styling changes MUST match `AffiliateTable` exactly. Pixel-perfect fidelity required.
- **Risk — Email history mobile:** The mobile card layout is PRESERVED (F1 fix). The `<DataTable>` renders only at `md:` breakpoint and above. The existing mobile JSX tree remains for `md:hidden`.
- **Risk — Payout detail dialog:** The inner table inside `BatchDetailDialog` is NOT migrated in this spec. It remains using shadcn `Table` primitives. A follow-up task can migrate it.
- **Risk — Affiliates server-side sort (F10 fix):** Non-pending tabs do NOT get `sortable: true` until Convex queries support sorting. Adding sort controls that only reorder one page of 20 items is misleading. A TODO comment marks the columns for future enablement.
- **`CompactTable` variant:** Removed in Task 1 — confirmed dead code (zero imports). Delete ONLY lines ~439-509; `StatusBadgeCell` and `TableColumn` must be preserved.
- **StatusBadge vs StatusBadgeCell (F3 fix):** `StatusBadgeCell` updated to use shadcn `<Badge>` wrapper (matching `StatusBadge`) instead of raw `<span>`. Strips Badge's default `border`/`focus:ring` classes.
- **DateCell enhancements (F4/F7 fix):** New `size` prop (`"sm"` → `text-[11px]`, `"default"` → `text-[12px]`). New `format: "relative-full"` for spelled-out time units.
- **Sort field mapping (F1.1 fix):** New `sortField` property on `TableColumn` bridges key/data field name gaps for both client-side sort and `onSortChange` callback.
- **Pending tab bug fix (F5 fix):** Adding the missing "Campaign" column header is an intentional bug fix — documented in AC 19 exception.
- **Email page accessibility (F8 fix):** Subject cell uses `<Link>` (not `onRowClick`) to preserve proper link semantics for middle-click, Ctrl+click, and screen readers.
- **Future work:** Convex query-level sorting for `/affiliates` (requires backend changes, then enable `sortable: true` on non-pending columns), `BatchDetailDialog` inner table migration.
- `DataTable` must remain framework-agnostic — no `nuqs`, no `next/navigation`, no `useRouter` inside the component.
