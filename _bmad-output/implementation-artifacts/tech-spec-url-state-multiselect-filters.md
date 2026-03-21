---
title: "URL-Driven State & Multi-Select Filters"
slug: "url-state-multiselect-filters"
created: "2026-03-19"
status: "complete"
stepsCompleted: [1, 2, 3, 4, "adversarial-review-r1", "party-mode-r2", "adversarial-review-r2"]
tech_stack:
  - "Next.js 16.1.0 (App Router, useSearchParams, useRouter)"
  - "Convex 1.32.0 (queries with manual page-based pagination)"
  - "nuqs (new dep — type-safe URL state management, replaces custom useUrlState hook)"
  - "cmdk (new dep — searchable multi-select via shadcn Command)"
  - "Radix UI (Popover, Checkbox, DropdownMenu — existing)"
  - "Tailwind CSS v4.1.16"
  - "TypeScript 5.9.3"
  - "Vitest + @testing-library/react (test framework)"
files_to_modify:
  - "src/app/layout.tsx (MINOR — add NuqsAdapter wrapper for Suspense boundary)"
  - "src/components/ui/multi-select.tsx (NEW — MultiSelectCombobox component)"
  - "src/components/ui/command.tsx (NEW — shadcn Command component)"
  - "src/app/(auth)/affiliates/page.tsx (MAJOR — full URL state migration + pagination)"
  - "src/components/affiliate/AffiliateToolbar.tsx (MAJOR — replace FilterPill with MultiSelectCombobox)"
  - "src/components/affiliate/AffiliateTabs.tsx (MINOR — sync activeTab to URL)"
  - "convex/affiliates.ts (MAJOR — add paginated query + campaign filter)"
  - "src/app/(auth)/emails/history/page.tsx (MEDIUM — URL state migration)"
  - "src/app/(auth)/payouts/history/PayoutHistoryClient.tsx (MEDIUM — URL state migration)"
  - "src/app/(auth)/reports/affiliates/page.tsx (MINOR — extend existing URL state)"
  - "src/app/(auth)/reports/affiliates/components/AffiliatePerformanceTable.tsx (MINOR — sortBy/sortOrder to URL)"
  - "src/app/(auth)/reports/campaigns/components/CampaignFilterDropdown.tsx (REPLACE — swap to MultiSelectCombobox)"
code_patterns:
  - "nuqs useQueryState / useQueryStates for URL state (replaces custom useUrlState hook)"
  - "nuqs parseAsIndex for page, parseAsArrayOf for multi-select, parseAsStringLiteral for enums"
  - "NuqsAdapter in root layout.tsx provides Suspense boundary for all pages"
  - "Multi-select combobox (Popover + Command + Checkbox, responsive styling)"
  - "Manual page-based pagination (NOT Convex paginationOptsValidator — cursors are opaque)"
  - "Per-affiliate stat queries via by_affiliate index (avoids Convex 1MB read limit)"
  - "Per-campaign referralLinks query via by_tenant_and_campaign index"
  - "Page auto-reset on search/filter change; page clamping to max valid page"
  - "Client-side search filtering (debounced, applied to current page results)"
  - "Responsive combobox: single Popover with responsive className (CSS media query, no sheet switching)"
  - "Existing URL state pattern: useDateRange.ts (useState + useEffect + router.push)"
  - "Existing URL state pattern: tenants/page.tsx (useState + useEffect + router.replace)"
  - "Existing mock pattern: src/test/setup.ts (vi.mock next/navigation, convex/react)"
test_patterns:
  - "Vitest + @testing-library/react"
  - "Test files co-located: useDateRange.test.ts, useDebounce.test.ts"
  - "Mock pattern: vi.mock('next/navigation') with useSearchParams/useRouter"
  - "Hook testing: renderHook + act from @testing-library/react"
---

# Tech-Spec: URL-Driven State & Multi-Select Filters

**Created:** 2026-03-19

## Overview

### Problem Statement

Filter/search/pagination state across list pages (`/affiliates`, `/emails/history`, `/payouts/history`, `/reports/affiliates`, etc.) is managed via `useState`. This means state is lost on navigation, URLs aren't shareable/bookmarkable, and the browser back button doesn't restore filter context. Additionally, the affiliates page filter dropdowns have hardcoded dummy values and don't function as proper multi-select searchable dropdowns.

### Solution

Migrate all list page filter/search/pagination/sort state to URL search params using [`nuqs`](https://nuqs.dev/) — a battle-tested, type-safe URL state management library that provides `useQueryState` hooks with built-in parsers (`parseAsIndex`, `parseAsArrayOf`, `parseAsStringLiteral`). Replace static `FilterPill` buttons with functional searchable multi-select combobox dropdown menus (checkbox-based, built on `cmdk`/shadcn `Command` + `Popover`). Add server-side pagination and campaign filtering via Convex query changes. Configure `NuqsAdapter` in the root layout for app-wide Suspense boundary support.

### Scope

**In Scope:**
- `/affiliates` page — tabs, search, multi-select searchable status filter, multi-select searchable campaign filter, server-side pagination
- `/emails/history` — search, status filter, sort, date range filter
- `/payouts/history` — status filter
- `/reports/affiliates` — campaign param (extend to full URL state)
- `AffiliatePerformanceTable` — sortBy, sortOrder
  - New reusable `MultiSelectCombobox` component (`src/components/ui/multi-select.tsx`)
  - New `src/components/ui/command.tsx` (shadcn Command component, depends on `cmdk`)
  - New `NuqsAdapter` setup in `src/app/layout.tsx` (replaces custom `useUrlState` hook)
- Convex query changes: `listAffiliates` with pagination + campaign filter support
- URL state sync: handled by `nuqs` parsers (comma-separated for multi-select, `parseAsIndex` for page)
- "Load 20 more" replaced with proper numbered pagination with page URL param

**Out of Scope:**
- Dashboard overview page (no list filtering there)
- Settings pages (no list filtering)
- Portal pages (different UX context)
- New UI for the "rejected" tab
- Payouts page main view (PayoutsClient) — separate pagination system already in place

## Context for Development

### Codebase Patterns

- **Existing URL state reference**: `src/app/(admin)/tenants/page.tsx` — uses `useSearchParams` for search, filter, page, sort, order with `useState` + `useEffect` sync pattern via `router.replace`. This page can be migrated to `nuqs` in a follow-up to demonstrate consistency.
- **Existing date range URL pattern**: `src/hooks/useDateRange.ts` — demonstrates `URLSearchParams` manipulation with `useState` + `useEffect` + `router.push`. Can be simplified using `nuqs` `parseAsTimestamp` parser in a follow-up.
- **Existing debounce hook**: `src/hooks/useDebounce.ts` — simple generic debounce hook, 20 lines. Used by tenants page for search input. Still useful for debouncing search input before triggering re-renders.
- **Campaign data source**: `convex/campaigns.ts` → `listCampaigns` query returns all campaigns with `_id`, `name`, `status`. Already used by `CampaignFilterDropdown.tsx` via `useQuery(api.campaigns.listCampaigns, {})`.
- **Brand colors**: Primary `#10409a`, Secondary `#1659d6`, radius 12px
- **UI primitives available**: `popover.tsx`, `checkbox.tsx`, `dropdown-menu.tsx` — but NO `command.tsx` yet
- **Test framework**: Vitest + `@testing-library/react`. Mock setup in `src/test/setup.ts`. Existing hook tests: `useDateRange.test.ts` (258 lines, comprehensive), `useDebounce.test.ts`.

### Affiliate-Campaign Relationship (Schema Analysis)

**Critical finding**: There is NO direct `campaignId` field on the `affiliates` table. The relationship is through `commissions` and `referralLinks`:

- `commissions` table: has `affiliateId` + `campaignId` — an affiliate earns commissions per campaign
- `referralLinks` table: has `affiliateId` + `campaignId` (optional) — an affiliate can have referral links for specific campaigns
- `clicks` table: has `affiliateId` + `campaignId` (optional)
- `conversions` table: has `affiliateId` + `campaignId` (optional)

**Campaign filtering strategy**: To filter affiliates by campaign, query `commissions` (or `referralLinks`) for affiliateIds that have activity in the selected campaign(s). This is a join-like operation — query `referralLinks` with `by_tenant_and_campaign` index or `commissions` with `by_campaign` index, collect unique `affiliateId`s, then use those to filter the main affiliates list.

**Existing `listAffiliatesByStatus` query**: Currently fetches ALL affiliates for tenant, then aggregates stats from clicks/conversions/commissions collections in-memory. No pagination, no campaign filtering. The entire result set is loaded client-side. This needs a complete rewrite for server-side pagination + campaign filtering.

**Status enum values**: `pending`, `active`, `suspended`, `rejected`. The tab UI currently only shows All, Pending, Active, Suspended (no Rejected tab).

### Files to Reference

| File | Purpose | Change Level |
| ---- | ------- | ------------ |
| `src/app/(admin)/tenants/page.tsx` | Reference: URL state sync + pagination pattern | READ ONLY |
| `src/hooks/useDateRange.ts` | Reference: URL param parser/updater pattern to generalize | READ ONLY |
| `src/hooks/useDebounce.ts` | Reference: debounce hook for search inputs | READ ONLY |
| `src/hooks/useDateRange.test.ts` | Reference: hook test pattern (mock setup, renderHook) | READ ONLY |
| `src/test/setup.ts` | Reference: mock patterns for next/navigation, convex/react | READ ONLY |
| `src/app/(auth)/affiliates/page.tsx` | Primary target: full URL state migration | MAJOR REWRITE |
| `src/components/affiliate/AffiliateToolbar.tsx` | Replace FilterPill with MultiSelectCombobox | MAJOR REWRITE |
| `src/components/affiliate/AffiliateTabs.tsx` | Sync activeTab to URL param | MINOR UPDATE |
| `convex/affiliates.ts` | New paginated query with campaign filter | NEW QUERY |
| `convex/schema.ts` | Verify indexes (no schema changes needed) | READ ONLY |
| `src/app/(auth)/emails/history/page.tsx` | URL state migration (search, statusFilter, sort, dateRange) | MEDIUM UPDATE |
| `src/app/(auth)/payouts/history/PayoutHistoryClient.tsx` | URL state migration (statusFilter) | MEDIUM UPDATE |
| `src/app/(auth)/reports/affiliates/page.tsx` | Extend URL state (already has campaign param) | MINOR UPDATE |
| `src/app/(auth)/reports/affiliates/components/AffiliatePerformanceTable.tsx` | sortBy/sortOrder to URL params | MINOR UPDATE |
| `src/app/(auth)/reports/campaigns/components/CampaignFilterDropdown.tsx` | Single-select campaign dropdown — can reuse or replace | REFERENCE |
| `src/components/ui/popover.tsx` | UI primitive for multi-select dropdown | READ ONLY |
| `src/components/ui/checkbox.tsx` | UI primitive for checkbox items | READ ONLY |

### Technical Decisions

1. **URL param encoding for multi-select**: Use `nuqs` `parseAsArrayOf(parseAsString)` which defaults to comma-separated values in a single param (`?status=active,suspended`). Alternative: `parseAsNativeArrayOf` for repeated params (`?status=active&status=suspended`). Start with comma-separated (standard, shareable). Safe for status enums and campaign IDs (no commas in values).
2. **Multi-select combobox**: Built on `cmdk` via shadcn `Command` component + `Popover`. Provides fuzzy search, keyboard navigation, checkbox multi-select. Same pattern as shadcn's official multi-select combobox example.
3. **State sync — `nuqs` library (replaces custom `useUrlState` hook)**: Use `nuqs` for all URL state management. Provides `useQueryState` (single param) and `useQueryStates` (batch params) hooks with built-in parsers: `parseAsString`, `parseAsInteger`, `parseAsIndex` (zero-indexed internally, 1-indexed in URL), `parseAsArrayOf` (comma-separated by default), `parseAsStringLiteral` (enum validation), `parseAsNativeArrayOf` (repeated URL params). Built-in features handle: empty-state cleanup (`clearOnDefault`), invalid param graceful degradation (returns default), history control (`shallow`/replace/push), Suspense boundary via `NuqsAdapter`. Eliminates Tasks 3 and 6 from the original spec (no custom hook to write or test). 6KB gzipped, battle-tested (used by shadcn/ui, Supabase, Vercel, Cal.com).
4. **Pagination — manual page-based, NOT cursor-based**: Convex's `paginationOptsValidator` uses opaque cursors that cannot be manufactured from page numbers. Instead, the query accepts `page: v.number()` and `numItems: v.number()`, collects all matching IDs, sorts, slices `[(page-1)*numItems, page*numItems]`, and returns `{ page, total, hasMore }`. Page number stored in URL. Accepted tradeoff: O(n) collection of matching IDs on each request — performant for up to ~1000 affiliates per tenant.
5. **Campaign filter — per-campaign index queries**: For each selected `campaignId` in `args.campaignIds`, query `referralLinks` with the existing `by_tenant_and_campaign` index. Collect unique `affiliateId`s across all campaigns. For typically 1-5 selected campaigns, this is 1-5 small queries — far better than 1 query fetching all 10,000+ tenant referral links (which risks the 1MB Convex read limit).
6. **Responsive combobox**: Single `Popover` component for all viewports (no sheet/drawer switching). **Positioning**: Let Radix Popover handle collision detection natively — do NOT override with CSS positioning. **Sizing only via CSS media query**: Mobile: `w-[var(--radix-popover-trigger-width)]` full trigger width, max-height 60vh. Desktop: `w-56 min-w-[200px]`, max-height 300px. Media queries control SIZE only; Radix handles POSITION (viewport edges, landscape, split-screen).
7. **Combobox UX**: Trigger shows selected count as badge (`Status (2)`) when multiple selected, or label when single (`Active`). Clear-all (X) visible when filters active. Search input auto-focuses on open. Keyboard: ↑↓ navigate, Enter toggle, Escape close.
8. **Real-time tradeoff**: Page-numbered pagination means newly created/updated records won't shift the current page view — user refreshes or navigates to see updates. Acceptable for this use case.
9. **No schema changes needed**: All required indexes already exist (`by_tenant`, `by_tenant_and_status` on affiliates; `by_tenant_and_campaign` on referralLinks; `by_campaign` on commissions).
10. **`listAffiliatesByStatus` rewrite**: New paginated query uses per-affiliate stat queries via existing `by_affiliate` indexes (clicks, conversions, commissions). For a page of 20 affiliates, this is 60 small queries — each returning one affiliate's data. Total data transferred is well under Convex's 1MB read limit. This trades query count for data volume safety.
11. **Search is client-side**: The `search` URL param is persisted in the URL, but actual text filtering (name/email/uniqueCode) is applied client-side against the current page's results. This avoids a full table scan on every keystroke. The `search` param still ensures search state survives navigation/refresh — it just filters the already-fetched page data.
12. **Suspense boundary via `NuqsAdapter`**: `nuqs` provides a `NuqsAdapter` component that wraps the app and handles the Suspense boundary requirement for `useSearchParams` at the root layout level. This means NO per-page Suspense setup is needed — add `NuqsAdapter` to `src/app/layout.tsx` once and it covers all pages. This resolves F4/F6 (Suspense boundary placement) from the adversarial reviews.
13. **History control built into nuqs**: `nuqs` handles history management natively with `shallow` (default, client-side only), `push` (new history entry), and `replace` options. No custom history guard needed — nuqs already avoids redundant history entries.

## Implementation Plan

### Tasks

- [ ] **Task 1: Install `nuqs` and `cmdk` dependencies**
  - File: `package.json`
  - Action: Run `pnpm add nuqs cmdk` to install both libraries
  - Notes: `nuqs` replaces the planned custom `useUrlState` hook. `cmdk` is required by the shadcn `Command` component (Task 2).

- [ ] **Task 2: Create `src/components/ui/command.tsx` (shadcn Command component)**
  - File: `src/components/ui/command.tsx` (NEW)
  - Action: Add standard shadcn/ui `Command` component wrapping `cmdk`. This provides `Command.Input`, `Command.List`, `Command.Empty`, `Command.Group`, `Command.Item`, `Command.Separator`, `Command.Shortcut`. Follow the official shadcn command component implementation.
  - Notes: Uses `cmdk` installed in Task 1. Import `cn` from `@/lib/utils`. Apply brand-aware styling.

- [ ] **Task 3: Add `NuqsAdapter` to root layout**
  - File: `src/app/layout.tsx`
  - Action: Import `NuqsAdapter` from `nuqs` and wrap `{children}` in the root layout. This provides the Suspense boundary required by `useSearchParams` across ALL pages. Follow the nuqs documentation for Next.js App Router setup.
    ```tsx
    import { NuqsAdapter } from 'nuqs/adapters/next/app'
    // In root layout:
    <html><body><NuqsAdapter>{children}</NuqsAdapter></body></html>
    ```
  - Notes: This single addition resolves the Suspense boundary requirement (F4/F6) for every page that uses `nuqs`. No per-page Suspense wrappers needed. Follow nuqs docs for the exact import path based on Next.js version.

- [ ] **Task 4: Create `src/components/ui/multi-select.tsx` (MultiSelectCombobox component)**
  - File: `src/components/ui/multi-select.tsx` (NEW)
  - Action: Create a reusable multi-select combobox with the following interface:
    ```typescript
    interface MultiSelectOption { value: string; label: string; }
    interface MultiSelectComboboxProps {
      options: MultiSelectOption[];
      selected: string[];
      onSelectedChange: (selected: string[]) => void;
      placeholder?: string;
      searchPlaceholder?: string;
      emptyMessage?: string;
      className?: string;
    }
    ```
    Implementation: `Popover` → `Command` with `Command.Input` (search), `Command.List`, `Command.Empty`, `Command.Group` with `Command.Item` + `Checkbox` for each option. Trigger button shows: no selection → placeholder; single selection → label; multiple → `Label (N)` with blue badge. Clear-all X button when selections > 0. Auto-focus search input on open.
  - Notes: Uses `command.tsx` (Task 2), `popover.tsx` (existing), `checkbox.tsx` (existing). Brand colors: active state `border-[#10409a] bg-[#eff6ff] text-[#10409a]`. Responsive: `w-[var(--radix-popover-trigger-width)]` on mobile, `min-w-[200px]` on desktop. Max-height: `max-h-[300px] md:max-h-[400px]`.
  - Depends on: Task 2.

- [ ] **Task 5: Add paginated affiliates query to `convex/affiliates.ts`**
  - File: `convex/affiliates.ts`
  - Action: Create a new query `listAffiliatesFiltered` with the following signature:
    ```typescript
    export const listAffiliatesFiltered = query({
      args: {
        status: v.union(v.literal("all"), v.literal("pending"), v.literal("active"), v.literal("suspended"), v.literal("rejected")),
        campaignIds: v.optional(v.array(v.id("campaigns"))),
        page: v.number(),
        numItems: v.number(),
      },
      returns: v.object({
        page: v.array(/* affiliate object with stats */),
        total: v.number(),
        hasMore: v.boolean(),
      }),
      handler: async (ctx, args) => { /* ... */ },
    });
    ```
    **Handler logic:**
    1. Get `tenantId` via `requireTenantId`
    2. If `campaignIds` provided: query `referralLinks` with `by_tenant` index (**single query, NOT per-campaign**), filter results where `campaignId` is in `args.campaignIds`, collect unique `affiliateId`s → use as allowlist. Resolves F6 (N+1 campaign queries).
    3. If `status !== "all"`: query affiliates with `by_tenant_and_status` index; else `by_tenant` index
    4. Collect all matching affiliate IDs (apply campaign allowlist if present)
    5. Sort by `_creationTime` desc. **Note**: The `by_tenant` and `by_tenant_and_status` indexes return results in `_creationTime` ascending order by default. An in-memory reverse sort is needed for descending order. This is acceptable because the collection step already materializes all IDs into memory; the sort is O(n log n) on the ID array only (not the full documents).
    6. Calculate `total` count of matching affiliates
    7. Slice for current page: `[(page-1) * numItems, page * numItems]`
     8. **Per-affiliate stat queries (resolves F1/F2 — Convex 1MB read limit)**: For the page's affiliate IDs (max 20), use the existing `by_affiliate` index on each table. Loop through page affiliateIds and query individually:
       - `clicks.by_affiliate` for each page affiliate → count
       - `conversions.by_affiliate` for each page affiliate → count + amount
       - `commissions.by_affiliate` for each page affiliate → sum amount (filtered to "confirmed" or "pending" status)
       This is 20 × 3 = 60 queries but each returns a tiny result set (one affiliate's data). **Total data transferred << 1MB**. This is the correct tradeoff for Convex: many small queries beats one massive tenant-wide query that hits the 1MB read limit.
     9. Return `{ page: affiliatesWithStats, total, hasMore }`
    **IMPORTANT**: No `searchQuery` arg — search is client-side (F7). No `paginationOptsValidator` — manual page slicing (F1). No tenant-wide stat queries — per-affiliate via `by_affiliate` index (F1/F2).
  - Notes: **Consumer audit required**: Before keeping `listAffiliatesByStatus`, search the codebase for all callers (`grep -r "listAffiliatesByStatus" src/ convex/`). If only the affiliates page uses it, it can be removed after Task 9 migration. If other pages use it, document the behavioral difference (no campaign filter, no pagination) and migrate those consumers as a follow-up task. Add a `MAX_AFFILIATES = 1000` guard — if total matching affiliates exceeds this, log a warning and consider performance optimization in a follow-up.
  - Depends on: No other tasks.

- [ ] **Task 6: Verify `nuqs` integration with smoke test**
  - File: All migrated pages
  - Action: After all pages are migrated, verify nuqs integration works end-to-end:
    - Open `/affiliates` → click tab → verify URL updates → refresh → state restores
    - Open `/affiliates?tab=invalid_value` → verify page renders with default (no crash)
    - Open `/affiliates?page=abc` → verify page renders with page 1 (no crash)
    - Click browser back button → verify filter state restores
  - Notes: `nuqs` is a well-tested library with its own test suite. No need to write a custom hook test file. The primary risk is `NuqsAdapter` setup in the root layout — verify this works with Next.js 16 specifically.
  - Depends on: Tasks 3, 9.

- [ ] **Task 7: Rewrite `src/components/affiliate/AffiliateToolbar.tsx`**
  - File: `src/components/affiliate/AffiliateToolbar.tsx`
  - Action: Replace the static `FilterPill` components with `MultiSelectCombobox`. New interface:
    ```typescript
    interface AffiliateToolbarProps {
      searchQuery: string;
      onSearchChange: (query: string) => void;
      statusOptions: MultiSelectOption[];
      selectedStatuses: string[];
      onStatusesChange: (statuses: string[]) => void;
      campaignOptions: MultiSelectOption[];
      selectedCampaigns: string[];
      onCampaignsChange: (campaigns: string[]) => void;
    }
    ```
    Status options: `[{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }]` (hardcoded status enum — no dummy values). Campaign options: passed in from parent (live data from `listCampaigns` query).
  - Notes: Remove the old `FilterPill` component entirely. Remove hardcoded `statusFilters` and `campaignFilters` arrays. Search input styling stays the same. Keep the flex layout with search on left, dropdowns on right.
  - Depends on: Task 4.

- [ ] **Task 8: Update `src/components/affiliate/AffiliateTabs.tsx` for URL state**
  - File: `src/components/affiliate/AffiliateTabs.tsx`
  - Action: Keep as a **controlled component** — do NOT add internal URL management. The parent page (Task 9) manages the `tab` URL param via `useUrlState` and passes `activeTab` + `onTabChange` as props. Update the component to accept these props:
    ```typescript
    interface AffiliateTabsProps {
      activeTab: string;
      onTabChange: (tab: string) => void;
      counts: Record<string, number>;
    }
    ```
    Remove any internal state management. The parent is the single source of truth for the active tab.
  - Notes: Small change — props update only. Resolves F12 (dual URL management conflict between parent and child).

- [ ] **Task 9: Rewrite `src/app/(auth)/affiliates/page.tsx` (primary target)**
  - File: `src/app/(auth)/affiliates/page.tsx`
  - Action: Full URL state migration:
    1. Remove all filter/search/tab `useState` calls: `activeTab`, `searchQuery`, `statusFilter`, `campaignFilter`
    2. Use `nuqs` `useQueryState` for each param:
       ```typescript
       import { useQueryState, parseAsStringLiteral, parseAsArrayOf, parseAsIndex, parseAsString } from 'nuqs';

       const [tab, setTab] = useQueryState("tab",
         parseAsStringLiteral(["all", "pending", "active", "suspended"]).withDefault("all"));

       const [search, setSearch] = useQueryState("search",
         parseAsString.withDefault(""));

       const [statuses, setStatuses] = useQueryState("status",
         parseAsArrayOf(parseAsString).withDefault([]));

       const [campaigns, setCampaigns] = useQueryState("campaign",
         parseAsArrayOf(parseAsString).withDefault([]));

       const [page, setPage] = useQueryState("page",
         parseAsIndex.withDefault(1)); // 1-indexed in URL, 0-indexed internally
       ```
    3. Replace `useQuery(api.affiliates.listAffiliatesByStatus, ...)` with `useQuery(api.affiliates.listAffiliatesFiltered, { status, campaignIds, page: page + 1, numItems: PAGE_SIZE })`
    4. **Client-side search (F7)**: Apply `search` filter against the returned page results in a `useMemo`. Filter by name/email/uniqueCode match (case-insensitive). The `search` URL param persists the search term across navigation but does NOT go to the backend.
    4b. **Page reset on search/filters (F4/F5)**: When `search` changes (non-empty input), automatically reset `page` to 1. When `status` or `campaign` filters change, automatically reset `page` to 1. When `page` exceeds `Math.ceil(total / PAGE_SIZE)` (due to filter change reducing total), clamp to the last valid page. This prevents stale page params showing empty results.
    5. Fetch campaigns for dropdown: `useQuery(api.campaigns.listCampaigns, {})` → map to `MultiSelectOption[]` as `{ value: campaign._id, label: campaign.name }`. This query is tenant-scoped (the existing `listCampaigns` filters by the authenticated user's tenant). Show all campaigns regardless of status. While campaigns are loading, show disabled combobox or skeleton.
    6. Derive status options from tab context (when on "all" tab, show active/suspended options; when on specific status tab, disable status filter)
    7. **Suspense boundary**: Provided by `NuqsAdapter` in root layout (Task 3). No per-page Suspense wrapper needed.
    8. Replace "Load 20 more" button with `Pagination` component using `total`, `page`, `PAGE_SIZE`, `hasMore`
    9. Pass `selectedStatuses`, `onStatusesChange`, `campaignOptions`, `selectedCampaigns`, `onCampaignsChange` to `AffiliateToolbar`
    10. Pass `activeTab` + `onTabChange` to `AffiliateTabs` (controlled component)
    11. Keep dialog/drawer state as `useState` (these are ephemeral UI state, not shareable)
    12. **Loading state (F10)**: Show skeleton overlay while `listAffiliatesFiltered` query is loading (`undefined`). Pagination buttons should disable during load.
  - Notes: Keep `selectedAffiliates`, `rejectingAffiliate`, `suspendingAffiliate`, `reactivatingAffiliate`, `isProcessing`, `detailDrawerAffiliate`, `isDrawerOpen` as `useState` — these are ephemeral UI interactions, not URL-addressable state. The pending tab bulk actions (`BulkActionBar`) continue to work since they use the same `listAffiliatesFiltered` query. `getAffiliateCountByStatus` query remains for tab counts.
  - Depends on: Tasks 3, 4, 5, 7, 8.

- [ ] **Task 10: Migrate `src/app/(auth)/emails/history/page.tsx` to URL state**
  - File: `src/app/(auth)/emails/history/page.tsx`
  - Action: Replace `useState` calls with `nuqs` `useQueryState`:
    - `searchQuery` → `useQueryState("search", parseAsString.withDefault(""))`
    - `statusFilter` → `useQueryState("status", parseAsStringLiteral(["all", "sent", ...]).withDefault("all"))`
    - `sortField` → `useQueryState("sort", parseAsString.withDefault("date"))`
    - `sortDirection` → `useQueryState("order", parseAsStringLiteral(["asc", "desc"]).withDefault("desc"))`
    - `dateRangeFilter` → `useQueryState("range", parseAsString.withDefault("all"))`
    - Keep `cursor`, `exportingId` as `useState` (cursor is internal pagination, exportingId is ephemeral)
  - Notes: Medium change — replace ~5 useState calls. Client-side sorting and filtering remain (the backend `listBroadcasts` doesn't support server-side filtering). No per-page Suspense wrapper needed (provided by `NuqsAdapter`).
  - Depends on: Task 3.

- [ ] **Task 11: Migrate `src/app/(auth)/payouts/history/PayoutHistoryClient.tsx` to URL state**
  - File: `src/app/(auth)/payouts/history/PayoutHistoryClient.tsx`
  - Action: Replace `useState` for `statusFilter` with `useQueryState("status", parseAsStringLiteral(["all", "processing", "completed"]).withDefault("all"))`. Keep `cursor`, `selectedBatch`, `isMarkingAllPaid` as `useState`. The `useEffect` that resets cursor on filter change stays — but now it watches the nuqs-derived `statusFilter` value.
  - Notes: Small change — 1 useState replaced. The Convex query `getPayoutBatches` already accepts `statusFilter` and `paginationOpts`. No per-page Suspense wrapper needed.

- [ ] **Task 12: Migrate `src/app/(auth)/reports/affiliates/components/AffiliatePerformanceTable.tsx` to URL state**
  - File: `src/app/(auth)/reports/affiliates/components/AffiliatePerformanceTable.tsx`
  - Action: Replace `useState` for `sortBy` and `sortOrder` with `useQueryState`:
    - `sortBy` → `useQueryState("sortBy", parseAsStringLiteral(["name", "clicks", "conversions", "conversionRate", "commissions"]).withDefault("name"))`
    - `sortOrder` → `useQueryState("order", parseAsStringLiteral(["asc", "desc"]).withDefault("asc"))`
  - Notes: Minor change — 2 useState calls replaced. The parent page (`reports/affiliates/page.tsx`) already uses `useSearchParams` for campaign filter, so this integrates cleanly. No per-page Suspense wrapper needed.

- [ ] **Task 13: Extend `src/app/(auth)/reports/affiliates/page.tsx` URL state**
  - File: `src/app/(auth)/reports/affiliates/page.tsx`
  - Action: Replace the `useState` for `selectedCampaignId` with `useQueryState("campaign", parseAsString.withDefault(""))`. Remove the manual `useEffect` that syncs `campaignParam` to state. The `handleCampaignChange` function no longer needs to manually update URL params — `useQueryState` handles it.
  - Notes: Minor change — removes ~10 lines of manual URL sync code. The page already uses `useDateRange` for date range state (no change needed there).

### Verification Gate

After all 13 implementation tasks are complete, verify the following:

- **Lint**: `pnpm lint` — zero warnings or errors
- **Build**: `pnpm build` — zero TypeScript errors, no import issues
- **Tests**: `pnpm vitest run` — all existing + new tests pass (including `useUrlState.test.ts`)
- **Manual smoke test**: Open `/affiliates` — verify page loads with clean URL, filters work, pagination works, back button restores state

### Acceptance Criteria

- [ ] **AC 1**: Given the `/affiliates` page with no URL params, when the page loads, then all affiliates are shown (tab="all"), no filters active, page=1, and URL is clean (`/affiliates`). No unnecessary `?page=1` in URL when on default page.
- [ ] **AC 2**: Given the `/affiliates` page, when a user clicks the "Active" tab, then the URL updates to `?tab=active`, the affiliates list shows only active affiliates, and refreshing the page preserves the tab selection.
- [ ] **AC 3**: Given the status filter dropdown, when a user types "sus" in the search field, then only "Suspended" option is visible. When they check it, the URL updates to `?status=suspended` and the list filters to suspended affiliates.
- [ ] **AC 4**: Given the status filter with "active" selected, when a user also selects "suspended", then the URL shows `?status=active,suspended`, both checkboxes are checked, and the list shows affiliates matching either status.
- [ ] **AC 5**: Given the status filter with items selected, when a user clicks the clear-all (X) button, then the URL param `status` is removed, no items are checked, and all affiliates are shown.
- [ ] **AC 6**: Given the campaign filter dropdown, when opened, then it shows all active campaigns from the database (live data via `listCampaigns` query), not hardcoded dummy values.
- [ ] **AC 7**: Given multiple campaigns selected in the filter, when the affiliates list renders, then only affiliates with referral links in at least one of the selected campaigns are shown (backend filtering).
- [ ] **AC 8**: Given the `/affiliates` page with search input, when a user types "maria" then the URL updates to `?search=maria` and the **current page's** affiliate list is client-side filtered to show affiliates matching "maria" (case-insensitive) in name, email, or uniqueCode. Navigating to page 2 preserves the search filter in the URL and applies it to page 2's results.
- [ ] **AC 9**: Given the affiliates list has more than 20 results, when the page loads, then a pagination component shows with page numbers and total count. Clicking page 2 updates the URL to `?page=2` and shows the next 20 results. Pagination buttons disable during loading.
- [ ] **AC 10**: Given the URL `/affiliates?tab=active&search=maria&status=suspended&campaign=camp123&page=2`, when a user copies and opens this URL in a new tab, then the identical filtered, paginated view is displayed.
- [ ] **AC 11**: Given the user has set filters on `/affiliates`, when they navigate to `/campaigns` and click browser back, then the filter state is restored from the URL.
- [ ] **AC 12**: Given the secondary pages (`/emails/history`, `/payouts/history`, `/reports/affiliates`), when a user sets filter/sort state, then the URL updates accordingly and the state persists on refresh and across tab navigation. Coverage matrix:
  - `/emails/history`: `?status=sent&sort=date&order=asc&range=30d`
  - `/payouts/history`: `?status=completed`
  - `/reports/affiliates`: `?sortBy=commissions&order=desc&campaign=camp123`
- [ ] **AC 13**: Given the `useUrlState` hook with default value "all", when the value is set to "all", then the URL param is removed (not set to "all").
- [ ] **AC 14**: Given the `MultiSelectCombobox` with no items selected, when the trigger is rendered, then it shows the placeholder text.
- [ ] **AC 15**: Given the `MultiSelectCombobox` with 2 items selected, when the trigger is rendered, then it shows `Label (2)` with a blue badge count.
- [ ] **AC 16**: Given the `MultiSelectCombobox` is open, when the user presses Escape, then the dropdown closes.
- [ ] **AC 17**: Given the `MultiSelectCombobox` is open, when the user presses ArrowDown then Enter, then the next item is toggled.
- [ ] **AC 18**: Given all tasks complete, when `pnpm build` runs, then the build succeeds with zero errors.
- [ ] **AC 19**: Given all tasks complete, when `pnpm vitest run` executes, then all existing and new tests pass.
- [ ] **AC 20**: Given any migrated page using `useUrlState`, when the page loads, then it renders inside a `<Suspense>` boundary with a skeleton fallback — no "Blocking Route" errors in the console.
- [ ] **AC 21**: Given the `useUrlState` hook with value at default, when the component re-renders without value change, then `router.replace` is NOT called (no redundant history entries created).
- [ ] **AC 22**: Given the affiliates page with `?page=5&status=active`, when the user clears the status filter and total drops below 5 pages, then the page param clamps to the last valid page (or resets to 1).
- [ ] **AC 23**: Given a malformed URL like `?page=abc`, when the page loads, then the parser returns the default value (page 1) and the page renders normally — no crash, no error state.

## Additional Context

### Dependencies

- **`nuqs`**: New package to install (`pnpm add nuqs`). Replaces the custom `useUrlState` hook. Provides `useQueryState`, `useQueryStates`, built-in parsers (`parseAsIndex`, `parseAsArrayOf`, `parseAsStringLiteral`), `NuqsAdapter` for Suspense boundary, and history controls. 6KB gzipped. Battle-tested (used by shadcn/ui, Supabase, Vercel, Cal.com).
- **`cmdk`**: New package to install (`pnpm add cmdk`). Required for searchable multi-select combobox. The shadcn `Command` component wraps `cmdk`.
- No other new external dependencies expected.

### Testing Strategy

**Integration smoke test (required):**
- Task 6 covers: URL roundtrip (filter → URL update → refresh → state restores), invalid param graceful degradation (`?page=abc`, `?tab=invalid`), browser back button state restoration. This replaces the original Task 6 (custom hook test file) since `nuqs` has its own comprehensive test suite.

**Unit Tests (existing):**
- Run existing hook tests (`useDebounce.test.ts`, `useDateRange.test.ts`) to ensure no regression.

**Component Tests (recommended but not blocking):**
- `src/components/ui/multi-select.tsx` — Test rendering, selection toggle, search filtering, clear-all, keyboard navigation. These are complex UI interactions best validated manually first.

**Manual Testing Steps:**
1. Open `/affiliates` — verify clean URL, all data loads
2. Click each tab — verify URL `tab` param updates, correct data shown, back button restores
3. Open status filter — verify live status options, search filters options, multi-select works, URL updates with comma-separated values
4. Open campaign filter — verify live campaign data from DB, search, multi-select
5. Type in search — verify 400ms debounce, URL updates after debounce
6. Click page 2 — verify URL `page` param, correct data, refresh preserves page
7. Copy full URL with all params — open in new tab — verify identical view
8. Repeat filter/search verification on `/emails/history`, `/payouts/history`, `/reports/affiliates`

**Key test scenarios (from Party Mode discussion):**
- URL serialization roundtrip — select filters → verify URL updates → refresh → state restores
- Multi-select toggle — check/uncheck items → verify comma-joined string in URL
- Clear all — clear filters → verify URL params removed
- Search within combobox — type in search → verify list filters correctly
- Pagination — change page → verify `page` param in URL → refresh → correct page shown
- Browser back button — navigate away → hit back → verify filter state restores
- Shared URLs — copy URL with filters → open in new tab → identical view
- Edge cases — select all options, deselect all, rapid filter changes, special characters in campaign names

### Notes

**High-risk items:**
- **Affiliate query rewrite (Task 5)**: The query collects all matching affiliate IDs for the tenant on each request (O(n) scan). This is acceptable for up to ~1000 affiliates per tenant. A `MAX_AFFILIATES = 1000` guard should be added with a logged warning for follow-up optimization.
- **Stats query count**: Per-affiliate queries = 20 affiliates × 3 tables = 60 queries per page load. Each query returns a small result set (well under 1MB Convex read limit). This trades query count for data safety. If Convex query limits become a concern, a follow-up optimization could batch with `Promise.all`-style concurrency (Convex supports concurrent reads via `Promise.all`).
- **Campaign filter**: Per-campaign queries via `by_tenant_and_campaign` index. For typically 1-5 selected campaigns, this is 1-5 small queries. Acceptable.
- **Consumer audit needed**: `listAffiliatesByStatus` may have consumers beyond the affiliates page. Must audit before removing (R2-F11).

**Known limitations:**
- Search is client-side only — filters the current page's results, not the entire affiliate database. Users on page 1 searching for an affiliate on page 5 won't find it. Server-side Convex full-text search is a follow-up (requires schema search index).
- Real-time updates (Convex subscriptions) will not auto-update pagination counts. A newly created affiliate won't appear until the user refreshes or changes a filter. This is documented as acceptable per R2-F13 — affiliate status changes are infrequent events for a management dashboard.
- **F10 (loading transitions)**: During URL param changes, the UI should show a skeleton/stale-data state. This is specified in Task 9 but the exact skeleton design is left to the implementer's judgment — follow the existing page's skeleton pattern.
- `nuqs` `parseAsArrayOf` uses comma separation by default. Values containing commas will break parsing. Only use for status enums, campaign IDs, and other comma-safe values. The `parseAsNativeArrayOf` alternative (repeated URL params) avoids this but produces less clean URLs.

**Future considerations (out of scope):**
- Global filter state that persists across page navigation (e.g., status filter set on `/affiliates` carries to `/reports/affiliates`)
- URL state for the detail drawer (e.g., `?drawer=affiliateId`)
- Server-side search with Convex full-text search indexes (replace client-side search with backend `withSearchIndex` on affiliates table for name + email)
- The `CampaignFilterDropdown.tsx` in reports/campaigns could also be migrated to `MultiSelectCombobox` if multi-select campaign filtering is needed there
- MultiSelectCombobox unit tests (F11) — deferred to follow-up phase after core URL state migration is verified
- Performance optimization for tenants exceeding 1000 affiliates (tenant-scoped stat indexes, cursor-free pagination with backend scan limits)
- Responsive mechanism refinement (F14) — currently CSS media query; container queries could be evaluated for component-level responsiveness

**Review history:**
- **Party Mode Round 1** (Step 1→2): Custom `useUrlState` hook (Winston), responsive Popover pattern (Sally), page-number pagination (Amelia), URL roundtrip + shared URL testing (Quinn).
- **Adversarial Review Round 1** (Step 4): 14 findings (3 CRITICAL, 4 HIGH, 5 MEDIUM, 2 LOW). All CRITICALs and HIGHs resolved:
  - F1: Dropped `paginationOptsValidator` → manual page-based pagination
  - F2: Accepted O(n) scan with MAX_AFFILIATES guard
  - F3: Batched stats to 3 queries (not N+1 per affiliate) → *later revised in Round 2*
  - F4: Added Suspense boundary requirements for all migrated pages
  - F5: Verified existing indexes cover all query paths
  - F6: Single `referralLinks.by_tenant` query + in-memory filter → *later revised in Round 2*
  - F7: Moved search to client-side
  - F8: Resolved by F1 (no cursor state, page in URL)
  - F9: History guard in `useUrlState`
  - F12: AffiliateTabs kept as controlled component
- **Party Mode Round 2**: Validated resolutions, confirmed phased approach.
- **Adversarial Review Round 2**: 15 findings (2 CRITICAL, 6 HIGH, 5 MEDIUM, 2 LOW). Key resolutions:
  - R2-F1/F2 [CRITICAL]: Replaced tenant-wide stat queries (hit 1MB Convex limit) with per-affiliate `by_affiliate` index queries (60 small queries, each << 1MB)
  - R2-F3 [HIGH]: Reverted campaign filter to per-campaign `by_tenant_and_campaign` index queries
  - R2-F4/F5 [HIGH]: Added page reset logic — search/filters auto-reset to page 1; page clamps to last valid page
  - R2-F6 [HIGH]: Mandated Suspense at page level (one boundary wrapping inner client component)
  - R2-F7 [HIGH]: All parsers must return defaultValue on invalid input (malformed URL degrades gracefully)
  - R2-F8 [HIGH]: Explicit campaign combobox data source (listCampaigns, tenant-scoped, loading state)
  - R2-F9 [MEDIUM]: Documented comma delimiter constraint in useUrlState JSDoc
  - R2-F10 [MEDIUM]: Clarified Radix collision detection vs media queries
  - R2-F11 [MEDIUM]: Consumer audit required before removing listAffiliatesByStatus
  - R2-F12 [MEDIUM]: History guard uses string equality comparison
  - R2-F13 [MEDIUM]: Justified in-memory sort (index returns asc, need desc)
  - R2-F14/F15 [LOW]: Consolidated ACs 12-14 into single matrix AC; restructured Task 14 as verification gate
- **nuqs adoption** (post-review): Replaced custom `useUrlState` hook (Tasks 3, 6) with `nuqs` library. Benefits: built-in parsers (`parseAsIndex`, `parseAsArrayOf`, `parseAsStringLiteral`), `NuqsAdapter` for root-level Suspense (eliminates per-page setup), built-in invalid param handling, built-in history guard, comprehensive test suite, battle-tested in production. Reduced spec from 13 tasks + verification to 13 tasks + verification (no new hook to write or test).
