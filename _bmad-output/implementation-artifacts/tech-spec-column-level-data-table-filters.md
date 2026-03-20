---
title: "Reusable Column-Level Filtering for DataTable"
slug: "column-level-data-table-filters"
created: "2026-03-19"
status: "Implementation Complete"
stepsCompleted: [1, 2, 3, 4, 5]
tech_stack: ["Next.js 16 (App Router)", "React 19", "Convex 1.32.0", "TypeScript 5.9.3", "Tailwind CSS 4.1.16", "Radix UI (Popover, Checkbox, Command)", "nuqs 2.8.9", "date-fns 4.1.0", "react-day-picker 9.x (via shadcn)", "lucide-react", "cmdk 1.1.1", "Vitest 4.1.0 + @testing-library/react"]
files_to_modify: ["src/components/ui/DataTable.tsx (MODIFY - extend TableColumn interface, import and render filter components in headers)", "src/components/ui/table-filters/FilterIcon.tsx (NEW - funnel icon with ghost/active states)", "src/components/ui/table-filters/TextFilter.tsx (NEW - text search filter popover)", "src/components/ui/table-filters/SelectFilter.tsx (NEW - multi-select checkbox filter popover)", "src/components/ui/table-filters/NumberRangeFilter.tsx (NEW - min/max number range filter popover)", "src/components/ui/table-filters/DateRangeFilter.tsx (NEW - date range presets + shadcn DatePicker popover)", "src/components/ui/table-filters/index.ts (NEW - barrel export for filter components)", "src/components/ui/FilterChips.tsx (NEW - active filter chips/pills display)", "src/components/ui/calendar.tsx (NEW - shadcn Calendar component via CLI)", "src/components/ui/date-picker.tsx (NEW - shadcn DatePicker component via CLI)", "src/lib/date-utils.ts (NEW - shared date utility functions + presets)", "convex/affiliates.ts (MODIFY - extend listAffiliatesFiltered args)", "src/app/(auth)/affiliates/page.tsx (MODIFY - wire nuqs filter params, server-side sort, FilterChips)", "src/app/(auth)/dashboard/components/DateRangeSelector.tsx (MODIFY - import date utils from shared module)", "package.json (MODIFY - react-day-picker added via shadcn CLI)"]
code_patterns: ["Generic DataTable<T> with TableColumn<T> interface", "Builder functions for column configs (buildActiveColumns, buildPendingColumns)", "nuqs useQueryState for URL-persisted state", "Radix Popover for dropdown/popover patterns", "MultiSelectCombobox (Popover + Command + Checkbox) for multi-select", "In-memory filtering within Convex query (collect → filter → sort → paginate)", "date-fns for date formatting", "cn() utility from tailwind-merge for conditional classes", "Client-side sort on useMemo (to be replaced with server-side)", "Cell renderer pattern: standalone functions (AvatarCell, CurrencyCell, NumberCell, DateCell, StatusBadgeCell)"]
test_patterns: ["Vitest 4.1.0 configured with jsdom environment", "@testing-library/react for component tests", "@testing-library/user-event for interactions", "convex-test for Convex backend tests", "Test files use .test.ts/.test.tsx suffix", "No production tests currently exist (placeholder tests only)"]
---

# Tech-Spec: Reusable Column-Level Filtering for DataTable

**Created:** 2026-03-19

## Overview

### Problem Statement

The affiliates table (and other data tables in the app) only support toolbar-level filtering and sorting. SaaS Owners ("Alex") managing hundreds of affiliates need to drill down by specific column values — e.g., "Show me affiliates with earnings >= ₱5,000 who joined this month." Currently this is impossible without exporting to CSV. Adding column-level filters with type-appropriate controls (text search, numeric range, date range, enum select) would unlock powerful data exploration directly in the UI.

### Solution

Enhance the reusable `DataTable` component with a column-level filter system. Each column declares its filter type, and DataTable renders a funnel icon that opens a popover with type-appropriate filter controls. Filter state is exposed via callbacks so consumers can pass it to their backend queries. The Convex `listAffiliatesFiltered` query is extended to support numeric range, date range, and text search filters server-side. Filter state is persisted in the URL via `nuqs` for shareable/bookmarkable filtered views.

### Scope

**In Scope:**
- DataTable component: new `filterable`, `filterType`, `filterOptions` column properties + funnel icon popover UI for each type (text, select, number-range, date-range)
- Active filter indicator on column headers — funnel icon gets filled state (brand primary `#10409a` fill or small count badge) when a filter is active, providing **ambient awareness** at a glance
- "Clear all filters" / "Clear this column" controls
- **Date range presets**: Clickable quick-select chips inside the date-range popover ("Last 7 days", "This month", "Last 3 months") for zero-friction date filtering — no manual date math required
- **Filter chips/pills** displayed above the table showing all active filters as removable chips (e.g., `[Earnings: ≥ ₱5,000 ×] [Joined: After Mar 1, 2026 ×] [Status: Active ×]`) + "Clear all" action
- URL state persistence via `nuqs` for filter values
- **DataTable stays state-agnostic**: DataTable emits `onFilterChange(filters: ColumnFilter[])` callbacks; the consumer (page component) owns nuqs serialization and backend wiring. This keeps DataTable reusable without coupling to any specific URL state library.
- Convex `listAffiliatesFiltered` query extended with: `searchQuery`, `referralMin/Max`, `clickMin/Max`, `earningsMin/Max`, `joinedAfter/Before`, server-side `sortBy`/`sortOrder`
- Moving search from client-side to server-side
- **Fix client-side sort bug**: Current sort is client-side on paginated results only (sorts within a page, not across all results). This must move server-side as part of this work.
- Applying the new DataTable filters to the **Affiliates** page (both active and pending column sets)

**Out of Scope:**
- Applying filters to other tables (commissions, payouts, reports) — those pages can adopt the reusable component in follow-up work
- Saved filter presets / named filter views
- Backend schema/index changes (we'll filter in-memory within the existing query)
- Complex conditional logic between columns
- Mobile-specific filter UI (popover works on touch)

## Context for Development

### Codebase Patterns

- **URL state management**: The project uses `nuqs` v2.8.9 (`parseAsString`, `parseAsArrayOf`, `parseAsInteger`, `parseAsStringLiteral`) for persisting query/filter/sort state in the URL. No `parseAsFloat` usage found — need to use `parseAsString` + manual parseFloat for numeric filter params, or use `parseAsInteger` for whole numbers.
- **Component architecture**: `DataTable` is a generic `DataTable<T>` component in `src/components/ui/DataTable.tsx` (621 lines) with `TableColumn<T>` and `TableAction<T>` interfaces. Column configs are built via builder functions (`buildActiveColumns`, `buildPendingColumns`) that return `{ columns, actions }`.
- **UI primitives**: Radix UI-based shadcn components available: `Popover` (with Portal, Anchor, Trigger, Content), `Checkbox`, `Command` (cmdk), `DropdownMenu`, `Dialog`, `Input`, `Label`, `Button`, `Badge`. All in `src/components/ui/`.
- **Styling**: Tailwind CSS v4 utility classes, brand primary `#10409a`, secondary `#1659d6`, font sizes `text-[11px]`-`text-[13px]` for table elements. `cn()` from `tailwind-merge` for conditional class composition.
- **Convex query pattern**: `listAffiliatesFiltered` (line 371, `convex/affiliates.ts`) — fetches all tenant affiliates via index, applies in-memory filters (status multi-select, campaign allowlist via referralLinks), hardcodes sort desc by `_creationTime`, then paginates. Per-affiliate stats (clickCount, referralCount, totalEarnings) are computed **after pagination** (Step 7), meaning these fields are only available on the current page's results — a critical constraint for numeric/date filtering.
- **Existing date handling**: `date-fns` v4.1.0 is installed. The `DateRangeSelector` component (`src/app/(auth)/dashboard/components/DateRangeSelector.tsx`, 410 lines) implements date presets ("Last 7 days", "Last 30 days", "Last 90 days", "This month", "Last month", "Custom") with native `<Input type="date">` pickers. The preset `getRange()` pattern and date utility functions (`dateToTimestamp`, `timestampToDateInput`) can be reused or adapted for the column filter date-range popover.
- **Date picker for column filters**: No `react-day-picker` or shadcn Calendar/DatePicker is currently installed. Install via `npx shadcn@latest add date-picker` which creates `src/components/ui/calendar.tsx` and `src/components/ui/date-picker.tsx`. This provides a fully themeable calendar that matches the brand (`#10409a`, Tailwind v4) — superior to native `<input type="date">` for visual consistency, cross-browser behavior, and compact popover integration.
- **Filter pattern**: `MultiSelectCombobox` (`src/components/ui/multi-select.tsx`, 166 lines) uses `Popover` + `Command` + `Checkbox` for multi-select with search. Pattern: `open` state, `PopoverTrigger` as styled button, `PopoverContent` with `Command` inside. Active state styling: `border-[#10409a] bg-[#eff6ff] text-[#10409a]`. This visual language should be followed for the `select` filter type.
- **Cell renderers**: Pre-built cell components (`AvatarCell`, `CurrencyCell`, `NumberCell`, `DateCell`, `StatusBadgeCell`) are exported from `DataTable.tsx`. They are pure display functions, not filter-aware.
- **Sort implementation**: Currently client-side via `useMemo` in `src/app/(auth)/affiliates/page.tsx` (lines 439-453). The `DataTable` component also has internal sort logic (lines 323-342) that is bypassed when `onSortChange` is provided. The `nuqs` params `sortBy` and `sortOrder` are stored in the URL but only applied client-side on the current page — this is the bug to fix.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/components/ui/DataTable.tsx` | Core DataTable component + TableColumn interface + cell renderers (621 lines) |
| `src/components/ui/popover.tsx` | Radix Popover primitive — wraps `@radix-ui/react-popover` with Tailwind styling (38 lines) |
| `src/components/ui/multi-select.tsx` | MultiSelectCombobox — reference pattern for Popover + Command + Checkbox (166 lines) |
| `src/components/ui/input.tsx` | Radix Input component — for text filter and number-range inputs |
| `src/components/ui/label.tsx` | Radix Label component — for filter form labels |
| `src/components/ui/checkbox.tsx` | Radix Checkbox component — for select filter checkboxes |
| `src/components/ui/command.tsx` | cmdk Command component — for searchable select filter |
| `src/components/ui/badge.tsx` | Radix Badge component — for filter chips |
| `src/components/affiliate/AffiliateToolbar.tsx` | Current toolbar filters (search, status, campaign) — 72 lines |
| `src/app/(auth)/affiliates/page.tsx` | Main affiliates page — column builders, nuqs wiring, client-side sort bug (862 lines) |
| `src/app/(auth)/dashboard/components/DateRangeSelector.tsx` | Date range preset pattern — reusable preset definitions and date utility functions (410 lines) |
| `src/components/ui/calendar.tsx` | shadcn Calendar component (to be installed via CLI) — wraps react-day-picker |
| `src/components/ui/date-picker.tsx` | shadcn DatePicker component (to be installed via CLI) — wraps Calendar with Button/Popover |
| `convex/affiliates.ts` | `listAffiliatesFiltered` query (lines 371-529) — backend filtering pipeline |
| `convex/schema.ts` | Database schema — affiliates table fields, indexes (540 lines) |

### Technical Decisions

- **Filter popover position**: Column header funnel icon → popover anchored below the icon, using Radix Popover
- **Filter type taxonomy**: `text` | `select` | `number-range` | `date-range` — declared per column in `TableColumn.filterable`
- **Server-side filtering**: All filters (including search and sort) move to Convex query to ensure pagination accuracy
- **URL persistence**: Each column's filter state serialized into URL params (e.g., `?earnings_min=5000&joined_after=2026-01-01`)
- **DataTable agnosticism (Party Mode - Winston)**: DataTable receives `activeFilters` as props and emits `onFilterChange(filters: ColumnFilter[])`. It does NOT own filter state or URL serialization. Export a `ColumnFilter` type so consumers have a typed contract.
- **Funnel icon state language (Party Mode - Sally)**: Empty funnel = ghost/subtle ("you can filter here"). Active funnel = filled with brand primary `#10409a` or small count badge. This ambient awareness lets Alex instantly see which columns are filtered without scanning.
- **Date range presets (Party Mode - Sally)**: Quick-select chips ("Last 7 days", "This month", "Last 3 months") above the From/To date inputs. Reduces cognitive load — Alex clicks "This month" and is done. Reuse the `getRange()` pattern from existing `DateRangeSelector.tsx`.
- **Null vs. zero distinction (Party Mode - Amelia)**: In number-range filters, empty inputs = `null` (no filter/unbounded). Entering `0` is a valid explicit value (filters to exactly 0). Filter state uses `null` for "not set" and `number` for active value. Parse logic: `const parsed = str.trim() === "" ? null : parseFloat(str)`.
- **Sort moves server-side (Party Mode - Winston)**: Current client-side sort on paginated results is a latent bug — sorting within a page doesn't reflect the true order across all records. Sort args (`sortBy`, `sortOrder`) must be passed to the Convex query and applied before pagination.
- **shadcn DatePicker for date selection**: Install via `npx shadcn@latest add date-picker` (adds `react-day-picker` as dependency). Provides a fully themeable calendar UI consistent with the brand aesthetic. Supports range mode for From/To date selection. Superior to native `<input type="date">` for cross-browser consistency, theming, and compact popover integration. The existing `DateRangeSelector.tsx` on the dashboard continues to use native inputs for V1 (migration is out of scope).
- **Per-affiliate stats filtering constraint**: The `listAffiliatesFiltered` query computes `referralCount`, `clickCount`, `totalEarnings` **after pagination** (only for the current page). To filter on these fields server-side, the stat computation must move **before pagination** (i.e., compute stats for ALL affiliates, then filter, then paginate). This has performance implications for tenants with many affiliates but is necessary for correct filtering. The existing MAX_AFFILIATES guard (1000) provides a safety bound.
- **One new npm dependency**: `react-day-picker` (v9.x, ~12KB gzipped) — installed automatically via `npx shadcn@latest add date-picker`. All other required primitives are already installed and verified in `package.json`: `@radix-ui/react-popover` (v1.1.15), `@radix-ui/react-checkbox` (v1.3.3), `cmdk` (v1.1.1), `date-fns` (v4.1.0), `nuqs` (v2.8.9), `lucide-react`.

## Implementation Plan

### Tasks

#### Phase 1: Foundation — Types & Utilities

- [x] **Task 1: Define ColumnFilter types and extend TableColumn interface**
  - File: `src/components/ui/table-filters/types.ts` (NEW)
  - Action: Create a shared types file with the following type definitions:
    ```typescript
    export type ColumnFilterType = "text" | "select" | "number-range" | "date-range";

    export interface ColumnFilter {
      columnKey: string;
      type: ColumnFilterType;
      value?: string;           // for "text" type
      values?: string[];        // for "select" type
      min?: number | null;      // for "number-range"
      max?: number | null;      // for "number-range"
      after?: number | null;    // for "date-range" (unix ms)
      before?: number | null;   // for "date-range" (unix ms)
    }

    export interface FilterOption {
      value: string;
      label: string;
    }
    ```
  - Action: Extend `TableColumn<T>` with three new optional properties:
    ```typescript
    filterable?: boolean;
    filterType?: ColumnFilterType;
    filterOptions?: FilterOption[];  // for "select" type — list of { value, label }
    filterLabel?: string;            // human-readable label for filter chips (defaults to column header)
    filterStep?: number;              // for "number-range" type — step increment for decimal precision (e.g., 0.01 for currency)
    ```
  - Notes: Keep `filterable: true` separate from `filterType` so a column can declare it's filterable without necessarily committing to a type upfront (though both are typically set together). Export all new types for consumer use.

- [x] **Task 2: Extract shared date utility functions + install shadcn DatePicker**
  - File: `src/lib/date-utils.ts` (NEW)
  - Action: Extract the following functions from `DateRangeSelector.tsx` into a shared utility module:
    - `dateToTimestamp(dateStr: string): number` — converts YYYY-MM-DD to end-of-day timestamp (exists in DateRangeSelector at line 108)
    - `timestampToDateInput(timestamp: number): string` — converts timestamp to YYYY-MM-DD (exists in DateRangeSelector at line 118, used by existing DateRangeSelector)
    - `DATE_PRESETS` array — re-export the preset definitions from `DateRangeSelector`'s local `dateRangeOptions` constant with `{ label, value, getRange }` shape
  - Action: Install shadcn date-picker component:
    ```bash
    npx shadcn@latest add date-picker
    ```
    This creates `src/components/ui/calendar.tsx` and `src/components/ui/date-picker.tsx` and adds `react-day-picker` to `package.json`. The shadcn CLI auto-configures Tailwind v4 styling and date-fns locale support.
  - Action: Update `DateRangeSelector.tsx` to import date utilities from `src/lib/date-utils.ts` instead of defining them locally. The DateRangeSelector continues to use native `<input type="date">` for V1 (DatePicker migration is out of scope).
  - Notes: The `date-utils.ts` utilities are used for URL serialization (converting between ISO strings and timestamps). The shadcn `DatePickerWithRange` component handles the actual UI calendar rendering inside the filter popover.

#### Phase 2: Filter Popover Components

- [x] **Task 3: Create FilterIcon component**
  - File: `src/components/ui/table-filters/FilterIcon.tsx` (NEW)
  - Action: Add a `FilterIcon` component using lucide-react's `Filter` icon (imported as `FilterIcon` or aliased from `Funnel`):
    ```typescript
    function FilterIcon({ isActive, onClick }: { isActive: boolean; onClick?: () => void }) { ... }
    ```
  - Ghost state: `opacity-40 hover:opacity-70` with default color
  - Active state: `text-[#10409a]` with brand primary fill + subtle scale (e.g., `transform scale-110`)
  - Wrapper: `cursor-pointer` button with `ml-1` spacing from the column header text
  - Notes: Use the existing `cn()` utility. Click handler should be optional — DataTable controls open/close via Popover, FilterIcon just receives `isActive` state.

- [x] **Task 4: Create TextFilter popover component**
  - File: `src/components/ui/table-filters/TextFilter.tsx` (NEW)
  - Action: Create a `TextFilter` component rendered inside a Radix `Popover`:
    - `PopoverTrigger`: the `FilterIcon`
    - `PopoverContent` (`w-64 p-3`):
      - Label: "Contains..." using `Label` component
      - `Input` with `placeholder="Search..."`, `type="text"`
      - Footer: "Apply" (primary Button) and "Clear" (outline Button) in a flex row with `justify-end`
    - Internal state: `useState` for the input value
    - On "Apply": call `onFilterChange({ columnKey, type: 'text', value: inputValue.trim() })`
    - On "Clear": call `onFilterChange` to remove this column's filter (emit array without this columnKey)
    - Pre-populate input from `activeFilter?.value` when popover opens
  - Notes: Keep the popover compact — `text-[12px]` labels, `h-8` inputs. Follow MultiSelectCombobox visual language for the popover container.

- [x] **Task 5: Create SelectFilter popover component**
  - File: `src/components/ui/table-filters/SelectFilter.tsx` (NEW)
  - Action: Create a `SelectFilter` component rendered inside a Radix `Popover`:
    - `PopoverTrigger`: the `FilterIcon`
    - `PopoverContent` (`w-56 p-0`):
      - Optional `CommandInput` for searchable option list (follow MultiSelectCombobox pattern)
      - `CommandList` with `CommandGroup` of `CommandItem`s
      - Each item: `Checkbox` + label, same styling as MultiSelectCombobox
    - Internal state: `useState` for selected values (string[])
    - On toggle: immediately call `onFilterChange({ columnKey, type: 'select', values: [...selected] })` (no Apply button needed — checkbox toggling is instant feedback)
    - Options come from `column.filterOptions` (the `FilterOption[]` array)
  - Notes: Multi-select behavior — user can select multiple values. Deselecting all effectively clears the filter. **Loading state**: If `column.filterOptions` is `undefined` or empty, render a disabled trigger with a loading skeleton (follow the `isLoading` pattern from `MultiSelectCombobox`). If options load but the array is empty, render "No options available" message in the popover content.

- [x] **Task 6: Create NumberRangeFilter popover component**
  - File: `src/components/ui/table-filters/NumberRangeFilter.tsx` (NEW)
  - Action: Create a `NumberRangeFilter` component rendered inside a Radix `Popover`:
    - `PopoverTrigger`: the `FilterIcon`
    - `PopoverContent` (`w-56 p-3`):
      - Two rows: "Min" and "Max", each with `Label` + `Input type="number"`
      - Labels use `≥` and `≤` symbols for visual clarity (e.g., "≥ Min" / "≤ Max")
      - Footer: "Apply" (primary) and "Clear" (outline) buttons
    - Internal state: `useState` for `{ min: string, max: string }` as strings (to handle empty inputs)
    - Null vs. zero rule: empty string = `null` (no filter). `"0"` = `0` (explicit filter to 0).
      - Parse: `const parsedMin = minStr.trim() === "" ? null : parseFloat(minStr);`
    - On "Apply": call `onFilterChange({ columnKey, type: 'number-range', min: parsedMin, max: parsedMax })`
    - On "Clear": clear both inputs and remove filter
    - Validation: if both min and max are provided and min > max, show inline error text "Min must be less than Max" and do not apply
    - Pre-populate from `activeFilter?.min` / `activeFilter?.max` when popover opens (convert null to "")
  - Notes: Use `Intl.NumberFormat` for optional formatted display of currency columns (but filtering is on raw number). Add `step` prop support via an optional `filterStep?: number` on TableColumn for decimal precision.

- [x] **Task 7: Create DateRangeFilter popover component**
  - File: `src/components/ui/table-filters/DateRangeFilter.tsx` (NEW)
  - Action: Create a `DateRangeFilter` component rendered inside a Radix `Popover`:
    - `PopoverTrigger`: the `FilterIcon`
    - `PopoverContent` (`w-auto min-w-[280px] p-3`):
      - **Presets row**: horizontal flex-wrap of clickable preset chips (reuse `DATE_PRESETS` from `date-utils.ts`):
        - Each chip: `<button>` with `text-[11px] px-2 py-1 rounded-full border`
        - Default: `border-[#e5e7eb] text-[#6b7280] hover:border-[#1659d6]`
        - Active (selected preset): `border-[#10409a] bg-[#eff6ff] text-[#10409a]`
        - Presets: "Last 7 days", "Last 30 days", "Last 90 days", "This month", "Last month"
      - **Separator**: thin `border-b border-[#f3f4f6] my-2`
      - **Calendar**: shadcn `Calendar` component with range mode (`mode="range"`) using `DatePickerWithRange` pattern from `src/components/ui/date-picker.tsx`
        - `selected` state: `DateRange | undefined` (from date-picker types)
        - Disable future dates: pass `disabled={{ after: new Date() }}` to Calendar
        - Number of months visible: `defaultMonth` set to the "after" date if present
        - Styling: use the shadcn defaults (already themed with Tailwind v4 brand colors via the Calendar component)
        - Day highlight: range selected days get `bg-[#10409a] text-white`, range midpoint gets `bg-[#10409a]/10`
      - **Footer**: "Apply" (primary Button, `bg-[#10409a]`) and "Clear" (outline Button) buttons
    - Internal state: `useState` for `{ preset: string | null, range: DateRange | undefined }`
    - Clicking a preset: immediately compute range from `getRange()`, set state, call `onFilterChange({ columnKey, type: 'date-range', after: startTimestamp, before: endTimestamp })`, close popover
    - Selecting a date range via calendar: updates internal state but does NOT auto-apply (user clicks "Apply" to confirm custom range)
    - Clicking "Apply" (custom range): validate range is complete (both from and to selected), no future dates → call `onFilterChange` with timestamps
    - Clicking "Clear": reset range and preset state, close popover, remove filter
    - Pre-populate from `activeFilter?.after` / `activeFilter?.before` when popover opens (convert Unix ms to `Date` objects for Calendar)
   - Notes: shadcn `DatePickerWithRange` provides `from` and `to` `Date` objects. Convert to Unix ms timestamps for the `ColumnFilter` using `date.getTime()`. The Calendar renders inside the Popover's Portal, so no z-index conflicts with the table. On mobile, the Calendar is scrollable within the popover.
     - Clicking "Clear": reset all state and remove filter
     - Pre-populate from `activeFilter?.after` / `activeFilter?.before` when popover opens

#### Phase 3: DataTable Integration

- [x] **Task 8: Integrate filter popovers into DataTable column headers**
  - File: `src/components/ui/DataTable.tsx`
  - Action: Import filter components from the new `table-filters/` module:
    ```typescript
    import { FilterIcon } from "@/components/ui/table-filters/FilterIcon";
    import { TextFilter } from "@/components/ui/table-filters/TextFilter";
    import { SelectFilter } from "@/components/ui/table-filters/SelectFilter";
    import { NumberRangeFilter } from "@/components/ui/table-filters/NumberRangeFilter";
    import { DateRangeFilter } from "@/components/ui/table-filters/DateRangeFilter";
    ```
  - Action: Update `DataTableProps<T>` to add:
    ```typescript
    activeFilters?: ColumnFilter[];
    onFilterChange?: (filters: ColumnFilter[]) => void;
    ```
  - Action: In the `<thead>` rendering (around line 426), for each column where `col.filterable === true`:
    - Determine `isActive = activeFilters?.some(f => f.columnKey === col.key)`
    - Render the appropriate filter component based on `col.filterType`:
      - `"text"` → `TextFilter`
      - `"select"` → `SelectFilter`
      - `"number-range"` → `NumberRangeFilter`
      - `"date-range"` → `DateRangeFilter`
    - Pass `columnKey={col.key}`, `isActive`, `activeFilter` (from activeFilters array), `onFilterChange`
  - Action: The `onFilterChange` callback in DataTable should:
    - Accept a new/updated filter for this column
    - Merge with existing `activeFilters` (replace filter for same columnKey, or remove if cleared)
    - Call `props.onFilterChange(updatedFilters)` to emit to parent
  - Action: Place the filter popover trigger next to the sort icon in the column header, wrapped in a flex container
  - Action: **Prevent filter click from triggering sort**: The existing `<th>` has `onClick={isSortable ? () => handleSort(col) : undefined}` on the entire header. The filter popover trigger (which wraps FilterIcon in a button) must call `e.stopPropagation()` on click to prevent the sort handler from firing. This is critical — without `stopPropagation`, every filter interaction also sorts the column.
  - Notes: When both sort and filter are active on a column, the header should show: `Column Name [SortIcon] [FilterIcon(active)]`. The filter icon is always clickable regardless of sort state. Clicking the filter icon should NOT trigger sort.

- [x] **Task 9: Create FilterChips component**
  - File: `src/components/ui/FilterChips.tsx` (NEW)
  - Action: Create a standalone `FilterChips` component with proper generic typing:
    ```typescript
    interface FilterChipsProps<T> {
      filters: ColumnFilter[];
      columns: TableColumn<T>[];
      onRemove: (columnKey: string) => void;
      onClearAll: () => void;
    }

    export function FilterChips<T>({ filters, columns, onRemove, onClearAll }: FilterChipsProps<T>) { ... }
    ```
  - Render a horizontal flex-wrap row of removable chips, each chip:
    - Label: constructed from column header + filter value (e.g., "Earnings: ≥ ₱5,000", "Joined: This month")
    - Styling: `text-[11px] px-2 py-1 rounded-full bg-[#eff6ff] text-[#10409a] border border-[#10409a]/20`
    - Close button: `X` icon (lucide-react `X` at `w-3 h-3`) on click calls `onRemove(columnKey)`
  - "Clear all" link: shown only when `filters.length > 1`, styled as `text-[11px] text-[#6b7280] hover:text-[#ef4444] cursor-pointer`
  - Notes: This component is generic — it receives columns and filters, looks up column headers for labels. It does NOT own filter state. The consumer controls the layout (place above or below the table).

#### Phase 4: Backend

- [x] **Task 10: Extend Convex listAffiliatesFiltered query with server-side filtering and sorting**
  - File: `convex/affiliates.ts`
  - Action: Add new optional args to `listAffiliatesFiltered`:
    ```typescript
    searchQuery: v.optional(v.string()),
    referralMin: v.optional(v.number()),
    referralMax: v.optional(v.number()),
    clickMin: v.optional(v.number()),
    clickMax: v.optional(v.number()),
    earningsMin: v.optional(v.number()),
    earningsMax: v.optional(v.number()),
    joinedAfter: v.optional(v.number()),
    joinedBefore: v.optional(v.number()),
    sortBy: v.optional(v.union(
      v.literal("name"),
      v.literal("referralCount"),
      v.literal("clickCount"),
      v.literal("totalEarnings"),
      v.literal("_creationTime")
    )),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    ```
  - Action: **Move per-affiliate stat computation BEFORE pagination** (currently Step 7 → move to before Step 5). This means computing referralCount, clickCount, totalEarnings for ALL matching affiliates, not just the current page. This is necessary for numeric/date filtering to work correctly.
  - Action: **Performance mitigation — batch stat queries with parallel reads**: The current per-affiliate stat computation makes 3 sequential DB reads (clicks, conversions, commissions) per affiliate. For N affiliates, this is 3N reads. Mitigate by:
    1. First batch-fetch ALL clicks, conversions, and commissions for the tenant using the `by_affiliate` index (3 collect calls total, not 3N)
    2. Build in-memory maps: `Map<affiliateId, clickCount>`, `Map<affiliateId, referralCount>`, `Map<affiliateId, totalEarnings>`
    3. Look up each affiliate's stats from the maps — O(1) per affiliate
    4. This reduces total DB reads from 3N to ~3 + (affiliate filter queries), regardless of affiliate count
    5. Add a performance log when the affiliate list exceeds 200 affiliates: `console.warn("[listAffiliatesFiltered] Computing stats for ${N} affiliates. Consider denormalized stat fields for large tenants.")`
  - Action: After stat computation, apply new in-memory filters in this order:
    1. **Text search**: if `searchQuery` provided, filter affiliates where `name`, `email`, or `uniqueCode` contains the search query (case-insensitive)
    2. **Numeric ranges**: filter `referralCount`, `clickCount`, `totalEarnings` against min/max bounds (omit from args if null)
    3. **Date range**: filter `_creationTime` against `joinedAfter`/`joinedBefore` (omit from args if null)
  - Action: **CRITICAL: Recompute `total` AFTER all filters are applied, BEFORE pagination.** The current code computes `total` before stat-based filters. After this change, the pipeline must be:
    1. Fetch affiliates (index query) → ~100-1000 docs
    2. Apply existing filters (status, campaign allowlist) → subset
    3. Batch-fetch stats (3 reads) → build maps
    4. Merge stats onto affiliate objects
    5. Apply new filters (search, numeric ranges, date ranges) → further subset
    6. **`total = filteredAffiliates.length`** ← HERE, after ALL filters
    7. Sort
    8. Paginate (slice)
    This ensures `total`, `hasMore`, and pagination are correct.
  - Action: **Replace hardcoded sort** (currently always desc by `_creationTime`) with dynamic sort:
    - Default: `sortBy` not provided → sort desc by `_creationTime` (existing behavior)
    - When `sortBy` provided: map field names to the computed stat object. Supported sort fields: `"name"`, `"referralCount"`, `"clickCount"`, `"totalEarnings"`, `"_creationTime"`. Each field in the `v.union()` validator has a corresponding accessor function. Note: `"status"` is intentionally excluded — alphabetical sort on freeform status strings is not meaningful.
  - Action: Keep existing steps (campaign allowlist, statuses multi-select) in their current positions — new filters are additive
  - Notes: Performance tradeoff: stat computation now runs on ALL affiliates before pagination, not just the current page. The existing MAX_AFFILIATES guard (1000) bounds this. Add a performance log when stat computation runs on > 100 affiliates.

#### Phase 5: Affiliates Page Wiring

- [x] **Task 11: Wire nuqs filter params and remove client-side filtering on Affiliates page**
  - File: `src/app/(auth)/affiliates/page.tsx`
  - Action: Add new nuqs URL state params for each column filter:
    ```typescript
    const [affiliateName, setAffiliateName] = useQueryState("affiliate_name", parseAsString.withDefault(""));
    const [referralMin, setReferralMin] = useQueryState("referral_min", parseAsString.withDefault(""));
    const [referralMax, setReferralMax] = useQueryState("referral_max", parseAsString.withDefault(""));
    const [clickMin, setClickMin] = useQueryState("click_min", parseAsString.withDefault(""));
    const [clickMax, setClickMax] = useQueryState("click_max", parseAsString.withDefault(""));
    const [earningsMin, setEarningsMin] = useQueryState("earnings_min", parseAsString.withDefault(""));
    const [earningsMax, setEarningsMax] = useQueryState("earnings_max", parseAsString.withDefault(""));
    const [joinedAfter, setJoinedAfter] = useQueryState("joined_after", parseAsString.withDefault(""));
    const [joinedBefore, setJoinedBefore] = useQueryState("joined_before", parseAsString.withDefault(""));
    ```
  - Action: Build a `ColumnFilter[]` array from nuqs params, converting empty strings to null for numeric/date filters. **Critical: date serialization layer** — nuqs stores dates as ISO strings (e.g., `"2026-03-19"`) but Convex expects Unix ms timestamps. Conversion must happen in the page component before passing to the query:
    ```typescript
    // Convert ISO date string to start-of-day timestamp, or null if empty
    const joinedAfterTimestamp = joinedAfter ? dateToTimestamp(joinedAfter) : null;
    const joinedBeforeTimestamp = joinedBefore ? dateToTimestamp(joinedBefore) : null;
    ```
    Similarly, numeric params stored as strings must be parsed: `earningsMin ? parseFloat(earningsMin) : null`. Only include non-null values in the Convex query args (do NOT pass `earningsMin: null` — simply omit the key from the args object).
  - Action: **Remove client-side search filter** (lines 427-436 `filteredAffiliates` useMemo) — pass `searchQuery` to Convex instead
  - Action: **Remove client-side sort** (lines 439-453 `sortedFilteredAffiliates` useMemo) — pass `sortBy`/`sortOrder` to Convex instead
  - Action: Use paginated result directly: `const allAffiliates = paginatedResult?.page ?? []` (no client-side filtering/sorting)
  - Action: Pass `activeFilters` and `onFilterChange` to `DataTable`
  - Action: The `onFilterChange` handler should:
    1. Extract the changed filter
    2. Update the corresponding nuqs param(s)
    3. Reset page to 1
  - Action: Add page reset to the `useEffect` that watches filter params (add all new filter params to the dependency array alongside existing `search`, `statuses`, `campaigns`, `sortBy`, `sortOrder`)
  - Notes: **Toolbar search vs. column text filter coexistence**: Remove the separate `affiliate_name` nuqs param entirely. The Affiliate column text filter updates the existing `search` nuqs param (which already feeds `searchQuery` to Convex). Single source of truth — no conflict possible.
  - Notes: **Toolbar statuses vs. column Status filter coexistence**: The toolbar's status multi-select (`statuses` nuqs param) and the column-level Status select filter both control affiliate status. For V1, they combine with **OR logic** — an affiliate matches if they are in EITHER set. In the Convex query, merge both arrays into a single `statuses` set before filtering. If the user clears one, only the other applies. This is implemented in the page component's `onFilterChange` handler by merging column status values with the existing `statuses` nuqs param.
  - Notes: **Campaign column sort disabled**: Set `sortable: false` on the Campaign column in `buildActiveColumns`. The existing `sortField: "campaignName"` is incompatible with the new `sortBy` validator.

- [x] **Task 12: Add filterable declarations to column builders**
  - File: `src/app/(auth)/affiliates/page.tsx`
  - Action: Update `buildActiveColumns` to add filterable metadata to each column:
    - **Affiliate** (name): `filterable: true, filterType: "text", filterLabel: "Affiliate"`
    - **Status**: `filterable: true, filterType: "select", filterOptions: [{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }]` **Also: set `sortable: false`** on the Status column — alphabetical sort on freeform status strings is not meaningful (removed from `sortBy` validator per F22).
    - **Campaign**: `filterable: true, filterType: "select", filterOptions: []` (options loaded dynamically from campaigns query — see note below). **Also: set `sortable: false` on the Campaign column** — the existing `sortField: "campaignName"` is incompatible with the new `sortBy` validator (campaignName is not in the return type and was removed per F13). Campaign sorting is not meaningful without a backend join.
    - **Referrals**: `filterable: true, filterType: "number-range", filterLabel: "Referrals"`
    - **Clicks**: `filterable: true, filterType: "number-range", filterLabel: "Clicks"`
    - **Earnings**: `filterable: true, filterType: "number-range", filterLabel: "Earnings"`
    - **Joined**: `filterable: true, filterType: "date-range", filterLabel: "Joined"`
  - Action: Update `buildPendingColumns` similarly:
    - **Applicant** (name): `filterable: true, filterType: "text"`
    - **Applied**: `filterable: true, filterType: "date-range"` (note: pending tab uses legacy query, so column filters would be client-side for this tab — acceptable for V1)
    - **Source**: `filterable: true, filterType: "text"`
    - **Campaign**: `filterable: true, filterType: "select"` (same dynamic options pattern as active columns)
  - Notes: The column builder functions return `TableColumn<Affiliate>[]` — just add the new optional fields to each column object. **Campaign filter note**: Campaign filtering uses `filterType: "select"` (not "text") because the backend filters by campaign ID through referralLinks, not by campaign name text search. The `filterOptions` must be loaded dynamically from the `listCampaigns` Convex query (which already exists and is used by the toolbar's campaign filter). **Async loading pattern**: The column builder should NOT call the Convex query directly. Instead, `buildActiveColumns` accepts `campaignOptions: FilterOption[]` as a parameter. The page component passes the options from its existing `allCampaigns` query result (which is already fetched for the toolbar). Since `allCampaigns` starts as `undefined` (loading), the column builder should handle `undefined` by passing `filterOptions: allCampaigns ?? []` — the `SelectFilter` component already has a loading skeleton for empty/undefined options (per Task 5). When `allCampaigns` resolves, the page re-renders and columns rebuild with the populated options.

- [x] **Task 13: Render FilterChips and connect filter lifecycle on Affiliates page**
  - File: `src/app/(auth)/affiliates/page.tsx`
  - Action: Import `FilterChips` from `src/components/ui/FilterChips`
  - Action: Render `<FilterChips>` above the `DataTable` (between the toolbar and the table):
    ```tsx
    <FilterChips
      filters={activeFilters}
      columns={activeCols.columns}
      onRemove={(columnKey) => { /* clear that column's nuqs param(s) */ }}
      onClearAll={() => { /* clear all filter nuqs params */ }}
    />
    ```
  - Action: `onRemove` handler: determine the filter type from the column config, clear the corresponding nuqs param(s) (e.g., for number-range, clear both `earnings_min` and `earnings_max`)
  - Action: `onClearAll` handler: reset all filter-related nuqs params to their defaults
  - Action: Hide `FilterChips` when `activeFilters.length === 0` (no visual noise when no filters active)
  - Notes: The FilterChips row should only appear on the "all", "active", and "suspended" tabs (where the paginated query is used). On the "pending" tab, column filters are client-side only and optional for V1.

### Acceptance Criteria

#### DataTable Component

- [ ] **AC 1**: Given a `TableColumn` with `filterable: true` and `filterType: "text"`, when the DataTable renders, then a funnel icon is visible in that column's header.
- [ ] **AC 2**: Given a column has an active text filter (value "Alex"), when DataTable renders, then the funnel icon is visually distinct (brand primary color fill, `#10409a`).
- [ ] **AC 3**: Given a column with `filterType: "number-range"`, when the user opens the filter popover, then Min (≥) and Max (≤) number inputs are displayed with Apply and Clear buttons.
- [ ] **AC 4**: Given a column with `filterType: "number-range"`, when the user enters Min = 5000, Max = 10000 and clicks Apply, then `onFilterChange` is called with `{ columnKey, type: "number-range", min: 5000, max: 10000 }`.
- [ ] **AC 5**: Given a column with `filterType: "number-range"`, when the user leaves both Min and Max empty and clicks Apply, then the filter is NOT applied (empty = unbounded). When the user enters Min = 0, the filter IS applied with `min: 0` (0 is a valid explicit value, not a sentinel for "no minimum").
- [ ] **AC 6**: Given a column with `filterType: "number-range"`, when the user enters Min = 10000 and Max = 5000 and clicks Apply, then an inline validation error is shown ("Min must be less than Max") and `onFilterChange` is NOT called.
- [ ] **AC 7**: Given a column with `filterType: "select"` and `filterOptions: [{ value: "active", label: "Active" }, ...]`, when the user opens the filter popover, then a checkbox list of all options is displayed.
- [ ] **AC 8**: Given a column with `filterType: "date-range"`, when the user opens the filter popover, then preset chips ("Last 7 days", "Last 30 days", "This month", etc.) are displayed above the custom From/To date inputs.
- [ ] **AC 9**: Given a column with `filterType: "date-range"`, when the user clicks "This month" preset, then the filter is immediately applied and the popover closes.
- [ ] **AC 10**: Given a column has an active filter, when the user opens the filter popover, then the popover pre-populates with the current filter values.
- [ ] **AC 11**: Given a column has an active filter, when the user clicks "Clear" in the popover, then the filter is removed and `onFilterChange` is called without that column's filter.
- [ ] **AC 12**: Given the DataTable has `activeFilters` prop, when `onFilterChange` is called, then DataTable merges the new filter with existing filters (replaces filter for same columnKey, preserves others) and emits the full array.

#### FilterChips Component

- [ ] **AC 13**: Given active filters `[{ columnKey: "earnings", type: "number-range", min: 5000, max: null }]`, when FilterChips renders, then a chip labeled "Earnings: ≥ 5,000" with a close (×) button is displayed.
- [ ] **AC 14**: Given active filters `[{ columnKey: "joined", type: "date-range", after: <this_month_start>, before: null }]`, when FilterChips renders, then a chip labeled "Joined: This month" (or human-readable date) is displayed.
- [ ] **AC 15**: Given the user clicks the × on a filter chip, when the click fires, then `onRemove(columnKey)` is called.
- [ ] **AC 16**: Given more than one active filter, when FilterChips renders, then a "Clear all" link is displayed.
- [ ] **AC 17**: Given the user clicks "Clear all", when the click fires, then `onClearAll()` is called.
- [ ] **AC 18**: Given zero active filters, when FilterChips renders, then nothing is rendered (no empty container).

#### Convex Backend

- [ ] **AC 19**: Given `listAffiliatesFiltered` is called with `earningsMin: 5000`, when the query executes, then only affiliates with `totalEarnings >= 5000` are included in results.
- [ ] **AC 20**: Given `listAffiliatesFiltered` is called with `joinedAfter: <timestamp>` and `joinedBefore: <timestamp>`, when the query executes, then only affiliates with `_creationTime` in that range are included.
- [ ] **AC 21**: Given `listAffiliatesFiltered` is called with `searchQuery: "alex"`, when the query executes, then only affiliates whose `name`, `email`, or `uniqueCode` contains "alex" (case-insensitive) are included.
- [ ] **AC 22**: Given `listAffiliatesFiltered` is called with `sortBy: "totalEarnings"` and `sortOrder: "desc"`, when the query executes, then results are sorted by totalEarnings descending BEFORE pagination.
- [ ] **AC 23**: Given `listAffiliatesFiltered` is called with `sortBy: "name"` and `sortOrder: "asc"`, when the query executes, then results are sorted alphabetically by name ascending BEFORE pagination.
- [ ] **AC 24**: Given no `sortBy` is provided, when the query executes, then results default to `_creationTime` descending (existing behavior preserved).
- [ ] **AC 25**: Given multiple filter args are provided (e.g., `earningsMin` + `searchQuery` + `joinedAfter`), when the query executes, then ALL filters are applied (intersection/AND logic) and the total count reflects the combined filter result.
- [ ] **AC 26**: Given a filter returns zero results, when the query executes, then `{ page: [], total: 0, hasMore: false }` is returned without errors.

#### Affiliates Page Integration

- [ ] **AC 27**: Given the user sets a text filter on the "Affiliate" column to "Alex", when the page renders, then the existing `search` nuqs param is updated to "Alex" (the column text filter reuses the toolbar search param — see Task 11) and the Convex query receives `searchQuery: "Alex"`.
- [ ] **AC 28**: Given the user sets a number-range filter on "Earnings" with Min = 5000, when the page renders, then the URL contains `?earnings_min=5000` and results are filtered server-side.
- [ ] **AC 29**: Given the user sets a date-range filter on "Joined" with "This month" preset, when the page renders, then the URL contains `?joined_after=2026-03-01` (ISO date string, not raw timestamp) and results are filtered server-side. The calendar popover shows the selected range highlighted in brand primary.
- [ ] **AC 30**: Given the user refreshes the page with active filter params in the URL, when the page loads, then all filters are restored from URL state and the Convex query receives the correct filter args.
- [ ] **AC 31**: Given the user has filters active and navigates to page 2, when the user then changes a filter value, then the page resets to page 1.
- [ ] **AC 32**: Given the user clicks a sort column header, when the sort changes, then results are re-fetched server-side with the correct `sortBy`/`sortOrder` and pagination is preserved or reset as appropriate.
- [ ] **AC 33**: Given the user clicks the × on a filter chip, when the filter is removed, then the corresponding nuqs param(s) are cleared and the table re-fetches without that filter.

#### Date Utilities Refactor

- [ ] **AC 34**: Given `DateRangeSelector.tsx` now imports from `src/lib/date-utils.ts`, when the dashboard page renders and the user selects a date range, then the behavior is identical to before the refactor (no regression).

## Additional Context

### Dependencies

- **One new npm package**: `react-day-picker` v9.x (~12KB gzipped) — installed automatically via `npx shadcn@latest add date-picker`. Creates `src/components/ui/calendar.tsx` and `src/components/ui/date-picker.tsx`.
- **Existing `DateRangeSelector.tsx`** — date utility functions and preset pattern should be reused/extracted into `src/lib/date-utils.ts`. The DateRangeSelector continues using native `<input type="date">` for V1 (migration to shadcn DatePicker is a future consideration).
- **Existing `MultiSelectCombobox`** — the visual language (Popover + Command + Checkbox, active state styling) is referenced but not directly imported. The `SelectFilter` follows the same pattern inline.
- **Task dependency chain**: Task 1 → Tasks 3-7 (types needed). Task 7b (barrel export) depends on Tasks 1-7. Task 8 depends on Task 7b (imports from barrel). Task 2 is independent. Task 10 is independent. Tasks 11-12 depend on Tasks 8 and 10. Task 13 depends on Tasks 8 and 11.

### Testing Strategy

**Unit tests (Vitest + @testing-library/react):**

1. `FilterIcon` — renders ghost state when `isActive={false}`, renders active state when `isActive={true}`
2. `TextFilter` — opens popover on click, applies filter on "Apply", clears on "Clear", pre-populates from activeFilter
3. `SelectFilter` — renders checkbox list from options, toggles selection, calls onFilterChange immediately
4. `NumberRangeFilter` — handles null/empty inputs correctly (empty = no filter), validates min ≤ max, formats currency display
5. `DateRangeFilter` — presets apply immediately and close popover, calendar range selection updates state, "Apply" confirms custom range, "Clear" resets all, future dates disabled on calendar
6. `FilterChips` — renders correct labels from filter + column config, onRemove fires with columnKey, onClearAll fires, hidden when no filters
7. `date-utils.ts` — `dateToTimestamp` converts correctly, `timestampToDateInput` formats correctly
8. `DatePickerWithRange` (shadcn) — renders calendar with range mode, range selection works, future dates disabled, integrates correctly within Popover portal

**Convex tests (convex-test):**

8. `listAffiliatesFiltered` — verify numeric range filtering, date range filtering, text search, combined filters, sort order, pagination correctness after filtering, total count accuracy

**Manual testing steps:**

9. Open `/affiliates` → click funnel icon on "Earnings" column → enter Min 5000 → Apply → verify URL params update → verify table shows only affiliates with earnings ≥ 5000 → verify filter chip appears above table
10. Click "Joined" funnel → click "This month" preset → verify instant apply → verify URL has `joined_after` param
11. Click × on filter chip → verify filter removed → verify table re-fetches → verify URL param cleared
12. Click "Clear all" → verify all filters removed → verify all URL params cleared
13. Sort by "Earnings" desc → verify sort icon appears → verify results are globally sorted (not just within page) → verify pagination works correctly with sort
14. Refresh page with active filters → verify all filters restore from URL
15. Test pending tab → verify filter icons appear but note filters may be client-side only for V1

### Notes

- **Party Mode insights incorporated**: UX (Sally), Architecture (Winston), Implementation (Amelia) — see Technical Decisions section for tagged insights.
- Existing `AffiliateToolbar` search/status/campaign filters should be considered for consolidation into the column-level filter system in a future iteration, but for now they coexist — toolbar handles global search + status/campaign, column filters handle per-column granular filtering.
- The `MultiSelectCombobox` pattern in `src/components/ui/multi-select.tsx` can be reused for the `select` filter type inside popovers.
- **Key constraint discovered**: Per-affiliate stats (referralCount, clickCount, totalEarnings) are computed post-pagination. Moving stat computation before pagination is required for correct server-side numeric filtering. This means a performance tradeoff: more DB reads per page load, but bounded by the 1000-affiliate guard.
- **Future consideration**: The existing `DateRangeSelector.tsx` on the dashboard page could be migrated from native `<input type="date">` to shadcn DatePicker for visual consistency with the column filter date picker. This is out of scope for V1.
- **Future consideration**: For tenants exceeding 1000 affiliates, the per-affiliate stat computation before pagination will become a performance bottleneck. A future optimization could add a `lastStatSnapshot` computed field on the affiliates table, updated periodically via a cron job, to avoid real-time stat computation during list queries.
- **Future consideration**: The toolbar search and status/campaign filters could eventually be absorbed into column-level filters (Affiliate name → text filter, Status → select filter, Campaign → select filter loaded from campaigns query). This would simplify the UI to one consistent filtering mechanism.
- **Future consideration**: Other tables (commissions, payouts, reports, dashboard affiliates) can adopt the reusable DataTable filters by simply adding `filterable` + `filterType` to their column configs and wiring `activeFilters`/`onFilterChange` to their respective nuqs params and backend queries.
