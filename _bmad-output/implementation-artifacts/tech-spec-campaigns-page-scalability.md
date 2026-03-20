---
title: "Campaigns Page Scalability — Overview + Searchable Listing"
slug: "campaigns-page-scalability"
created: "2026-03-20"
status: "implementation-complete"
stepsCompleted: [1, 2, 3, 4, 5]
tech_stack: ["Next.js 16.1.0 (App Router)", "Convex 1.32.0 (cursor pagination)", "Tailwind CSS 4.1.16", "TypeScript 5.9.3", "React 19.2.3", "Radix UI", "Sonner (toast)"]
files_to_modify: [
  "convex/schema.ts",
  "convex/campaigns.ts",
  "src/app/(auth)/campaigns/page.tsx",
  "src/app/(auth)/campaigns/all/page.tsx",
  "src/app/(auth)/campaigns/[id]/page.tsx",
  "src/components/dashboard/CampaignOverview.tsx",
  "src/components/dashboard/CampaignCard.tsx",
  "src/components/dashboard/CampaignListView.tsx",
  "src/components/dashboard/CampaignFilters.tsx",
  "src/components/dashboard/AffiliatesByCampaignTable.tsx",
  "src/components/shared/Sidebar.tsx",
  "src/components/shared/SidebarNav.tsx",
]
code_patterns: [
  "Cursor-based pagination: paginationOptsValidator + .paginate() — established in payouts.ts, audit.ts, commissions.ts, clicks.ts",
  "Frontend pagination: useState(cursor) + { numItems, cursor } args + isDone/continueCursor checks — see PayoutsClient.tsx",
  "usePaginatedQuery hook available from convex/react for incremental load-more — see api-reference/page.tsx",
  "Sidebar nav: STATIC_NAV_ITEMS object with href/label/icon — flat structure, no sub-items currently",
  "Campaign aliasing: commissionValue→commissionRate, recurringCommission→recurringCommissions in query returns",
  "Component pattern: page.tsx → Suspense wrapper → ContentComponent (hooks inside)",
  "DataTable: reusable with column-level filters (text, number-range, date-range, select), sorting, avatar/currency/number/date cells",
  "Command component (cmdk) exists at src/components/ui/command.tsx — can be used for searchable campaign combobox",
]
test_patterns: []
---

# Tech-Spec: Campaigns Page Scalability — Overview + Searchable Listing

**Created:** 2026-03-20

## Overview

### Problem Statement

The campaigns page (`/campaigns`) renders all campaigns as cards in a single grid with no search, filtering, or pagination. At 100+ campaigns this becomes an unscrollable, unfindable wall of cards. Additionally, the `AffiliatesByCampaignTable` at the bottom has a campaign selector dropdown that will break at scale.

### Solution

Restructure `/campaigns` into a **dashboard overview page** (stats + top campaigns + quick actions) and a **separate full listing page** (`/campaigns/all`) with search, multi-dimension filters, view toggle (cards/table), and server-side cursor-based pagination. Move the affiliate breakdown table into the existing campaign detail page (`/campaigns/[id]`).

### Scope

**In Scope:**
- Campaigns overview page (`/campaigns`) — Stats bar, top 5 active campaigns, "Needs Attention" section (paused campaigns, zero-affiliate campaigns), quick action buttons with campaign count ("View All 47 Campaigns →"), status summary
- Campaign listing page (`/campaigns/all`) — Search (name, description), filters (status, commission type, recurring vs. one-time), date range as expandable/secondary filter, view toggle (card grid / table) with context-aware default (cards for <10 total, table for 10+), server-side Convex cursor pagination with hydration strategy (20 per page)
- Campaign detail page (`/campaigns/[id]` enhancement) — Move `AffiliatesByCampaignTable` here, remove campaign picker
- Backend — Paginated `listCampaignsPaginated` query with filter args + hydration (fetch 30, filter, return up to 20); new `getTopCampaigns` query for overview; new `getAttentionCampaigns` query for "Needs Attention" section
- Sidebar nav — "Campaigns" link stays pointing to overview; `/campaigns/all` highlighted via existing `startsWith` logic (confirmed no-op — no sidebar changes needed)

**Out of Scope:**
- Campaign creation/edit flow changes (already works)
- Stats bar logic changes
- Commission engine changes
- Bulk campaign actions (archive/delete multiple)
- Full-text search index (client-side text filtering is sufficient for ~100-500 campaigns per tenant)

## Context for Development

### Codebase Patterns

- **React Server Components** by default; `"use client"` only for interactive leaf components
- **Convex queries** use `v.*` validators for all args and returns; `ReturnsValidationError` if mismatch
- **Multi-tenant isolation** via `getAuthenticatedUser(ctx)` — tenant resolved server-side, never passed as arg
- **Campaign statuses**: `active`, `paused`, `archived` with enforced transition rules in `updateCampaign`
- **UI styling**: Tailwind CSS v4 with CSS custom properties (`var(--brand-primary)`, etc.)
- **Component pattern**: `page.tsx` → Suspense wrapper → content component (hooks inside)
- **`cn()` utility** for conditional Tailwind classes
- **Campaign field aliasing**: `commissionValue`→`commissionRate`, `recurringCommission`→`recurringCommissions` in query returns
- **Cursor pagination pattern** (established in 7+ files): `paginationOptsValidator` arg → `.paginate()` → returns `{ page, isDone, continueCursor }`; frontend uses `useState(cursor)` with `{ numItems, cursor }` args
- **`usePaginatedQuery`** hook from `convex/react` available for incremental load-more pattern
- **DataTable** reusable component at `src/components/ui/DataTable.tsx` with column-level filters (text, number-range, date-range, select), sorting, and cell renderers (AvatarCell, CurrencyCell, NumberCell, DateCell)
- **Command** (cmdk) component at `src/components/ui/command.tsx` — available for searchable combobox
- **Sidebar nav**: `STATIC_NAV_ITEMS` object with `href/label/icon`; flat structure. Active detection: `pathname === item.href || pathname.startsWith(item.href + "/")`

### Files to Reference

| File | Purpose | Key Details |
| ---- | ------- | ----------- |
| `convex/campaigns.ts` | All campaign queries/mutations | `listCampaigns` (no pagination), `getCampaignStats`, `getCampaignCardStats`, `getAffiliatesByCampaign` |
| `convex/schema.ts:153-167` | Campaigns table definition + indexes | Indexes: `by_tenant`, `by_tenant_and_status`. Missing `_creationTime` index for paginated ordering |
| `convex/payouts.ts:218-268` | Reference: paginated query pattern | `paginationOptsValidator` + `.paginate()` + filter by status via index switching |
| `src/app/(auth)/campaigns/page.tsx` | Current campaigns page shell | Renders `CampaignStatsBar` + `CampaignList` + `AffiliatesByCampaignTable` |
| `src/components/dashboard/CampaignList.tsx` | Card grid, no pagination | `showArchived` hardcoded to `false` (dead code) |
| `src/components/dashboard/CampaignCard.tsx` | Individual card component | Has `Campaign` and `CampaignStats` interfaces, pause/resume/archive actions with confirmation dialogs |
| `src/components/dashboard/AffiliatesByCampaignTable.tsx` | Affiliate table to relocate | Uses `Select` dropdown for campaign picker (breaks at scale), `DataTable` with column-level filters |
| `src/components/dashboard/CampaignStatsBar.tsx` | Aggregate stats (keep on overview) | 3 stat cards: affiliates, conversions, commissions. No changes needed. |
| `src/app/(auth)/campaigns/[id]/page.tsx` | Campaign detail page | Edit/view mode, commission config cards — no affiliate breakdown currently |
| `src/components/shared/Sidebar.tsx` | Sidebar navigation | Line 44: `href: "/campaigns"`, line 223: active detection via `startsWith` |
| `src/components/shared/SidebarNav.tsx` | Sidebar navigation (alt) | Line 45: `href: "/campaigns"` |
| `src/components/ui/DataTable.tsx` | Reusable table with filters | Column-level filters, sorting, cell renderers |
| `src/components/ui/command.tsx` | cmdk-based command palette | Available for searchable combobox component |

### Technical Decisions

#### Architecture Decision Records (ADRs)

**ADR-1: Hydration over Dedicated Filter Indexes**
- **Decision**: Use hydration strategy (fetch 30, filter, display 20) instead of dedicated compound filter indexes
- **Rationale**: Convex doesn't support multi-field range queries on compound indexes (can't efficiently filter by `status + commissionType + recurring` on one index). Hydration is pragmatic for expected scale (~100-500 campaigns per tenant).
- **Trade-off**: May require 1-3 auto-fetch rounds at extreme filter combinations. Monitor latency at 500+ campaigns; if exceeds 500ms, add `by_tenant_and_commissionType` index as follow-up.
- **Revisit trigger**: When Convex adds query composition or campaign count exceeds 500 per tenant.

**ADR-2: No Filter-Specific Compound Indexes**
- **Decision**: Do NOT add indexes for `by_tenant_and_commissionType`, `by_tenant_and_recurring`, etc.
- **Rationale**: Binary filters (type: ~50% match, recurring: ~30% match) compound poorly — the hydration strategy handles it efficiently. Adding indexes for every filter combination would bloat the schema.
- **Exception**: If latency monitoring reveals >500ms on filtered queries, add `by_tenant_and_commissionType` first (most-used secondary filter).

**ADR-3: Fetch Card Stats Once on Frontend, Not Inside Backend Queries**
- **Decision**: `getCampaignCardStats` is called ONCE from the `CampaignOverview` component (frontend), NOT inside `getAttentionCampaigns` backend query. **Exception**: `getTopCampaigns` calls `getCampaignCardStats` internally (1 internal round-trip) because sorting by conversions requires it and the 10-newest heuristic is broken at scale (F32 fix).
- **Rationale**: `getAttentionCampaigns` doesn't need card stats — zero-affiliate detection comes from the extended `getCampaignStats` query (F31/F47 fix). `getTopCampaigns` needs them to sort accurately.
- **Impact**: Overview query budget: 3 external + 1 internal round-trips (~390ms).
- **Updated query budget**:
  ```
  1. getCampaignStats       → 1 external round-trip (~80ms) — now includes zeroAffiliateCampaignIds
  2. getTopCampaigns         → 1 external round-trip (~80ms) — includes 1 internal call to getCampaignCardStats (~50ms)
  3. getAttentionCampaigns   → 1 external round-trip (~80ms) — no internal calls
  4. getCampaignCardStats    → NOT called from frontend for overview (ADR-3 holds)
  Total: ~290ms (well under 500ms target)
  ```

**ADR-4: Shared Campaign Return Shape Validator**
- **Decision**: Extract a shared `campaignReturnShape` validator constant used by `listCampaignsPaginated`, `getTopCampaigns`, and `getAttentionCampaigns`.
- **Rationale**: All three queries return the same campaign object with identical field aliases (`commissionRate`, `recurringCommissions`). A shared validator prevents `ReturnsValidationError` — the #1 runtime error in Convex apps.
- **Implementation**: Define at top of `convex/campaigns.ts`:
  ```typescript
  export const campaignReturnShape = v.object({
    _id: v.id("campaigns"),
    _creationTime: v.number(),
    tenantId: v.id("tenants"),
    name: v.string(),
    description: v.optional(v.string()),
    commissionType: v.string(),
    commissionRate: v.number(),          // alias for commissionValue
    cookieDuration: v.optional(v.number()),
    recurringCommissions: v.boolean(),    // alias for recurringCommission
    recurringRate: v.optional(v.number()),
    recurringRateType: v.optional(v.string()),
    autoApproveCommissions: v.optional(v.boolean()),
    approvalThreshold: v.optional(v.number()),
    status: v.string(),
  });
  ```
- **CRITICAL (Adversarial F1 fix)**: Do NOT use `...campaign` spread when mapping to this shape — it leaves ghost fields (`commissionValue`, `recurringCommission`) from the raw DB doc. Instead, explicitly destructure and map:
  ```typescript
  const result = campaigns.map(c => ({
    _id: c._id,
    _creationTime: c._creationTime,
    tenantId: c.tenantId,
    name: c.name,
    description: c.description,
    commissionType: c.commissionType,
    commissionRate: c.commissionValue,          // explicit alias
    cookieDuration: c.cookieDuration,
    recurringCommissions: c.recurringCommission,  // explicit alias
    recurringRate: c.recurringRate,
    recurringRateType: c.recurringRateType,
    autoApproveCommissions: c.autoApproveCommissions,
    approvalThreshold: c.approvalThreshold,
    status: c.status,
  }));
  ```
  Extract a shared `mapCampaignToReturnShape(c)` helper function to avoid repetition across queries.

#### Core Technical Decisions

- **Server-side Convex cursor pagination** (not client-side) — follows established pattern across payouts, audit, commissions, clicks
- **New `listCampaignsPaginated` query** rather than modifying existing `listCampaigns` — preserves backward compatibility for any other consumers (e.g., `CreateCampaignModal`, `AffiliatesByCampaignTable`)
- **New `getTopCampaigns` query** for overview page — returns top 5 active campaigns sorted by conversion count (card stats fetched on frontend per ADR-3, not inside query); falls back to creation date if no conversion data
- **New `getAttentionCampaigns` query** for overview page — returns paused campaigns and zero-affiliate campaigns (card stats fetched on frontend per ADR-3, NOT inside query); returns both arrays + total counts for each category
- **Search**: client-side text search across paginated results (no full-text search index needed for ~100-500 campaigns per tenant). Server handles status/type/date filtering.
- **New schema index**: `by_tenant_and_creationTime` on campaigns table for efficient paginated ordering by newest first
- **Filter dimensions**: status (active/paused/archived), commission type (percentage/flatFee), recurring (true/false), date range (created after/before)
- **View toggle**: card grid and table layout — **context-aware default**: cards when total campaign count < 10, table when 10+ (reduces cognitive load for high-count tenants)
- **Hydration strategy for pagination**: Fetch 30 items from server, apply post-filters client-side, display up to 20. If after filtering fewer than 20 remain and `isDone` is false, fetch next page and append. Prevents "sparse page" problem (Party Mode — Winston)
- **20 campaigns per page** (displayed) with "Load More" button (matching established cursor pattern)
- **"Needs Attention" section** on overview page — shows paused campaigns and active campaigns with zero affiliates, each with **total counts** ("3 Paused Campaigns", "2 With No Affiliates") so Alex knows if there are more than shown (User Focus Group — Alex)
- **Button hierarchy on overview**: "Create Campaign" = **primary** (filled, brand color), "View All X Campaigns →" = **secondary** (outline). Visual hierarchy signals that CREATE is the most important action (User Focus Group — Alex)
- **"View All Campaigns" button** shows campaign count: "View All 47 Campaigns →" (confidence-building CTA — Party Mode — Sally)
- **Date range filter** is secondary/expandable, not prominent in default filter bar (status + type + search are front and center — Party Mode — Sally; data-aligned per Mary's filter usage analysis)
- **Empty filter state** mirrors active filter context: "No active percentage campaigns found" instead of generic "No campaigns found" (Party Mode — John)
- **Overview page design priority**: Serves the 80% case (5-20 campaigns) beautifully; listing page handles the 20% case (100+) — Party Mode — Mary
- **Overview page load target**: Under 500ms total (3 external + 1 internal round-trips per revised ADR-3 budget)
- **Overview stats performance**: `getTopCampaigns` fetches card stats internally (F32 fix). Zero-affiliate data comes from extended `getCampaignStats`. `CampaignOverview` does NOT call `getCampaignCardStats` directly (ADR-3). May use `useMemo` for derived sorting/filtering to avoid unnecessary re-renders — Party Mode — Winston
- **Affiliate breakdown** moved to `/campaigns/[id]` — removes campaign picker entirely since context is already set by the URL
- **Sidebar**: Keep single "Campaigns" link pointing to overview; `/campaigns/all` is a sub-route. Active highlighting works via existing `startsWith` logic. **Confirmed no-op — no sidebar code changes needed.**

## Implementation Plan

### Tasks

- [ ] **Task 1: Add `by_tenant_and_creationTime` index to campaigns schema**
  - File: `convex/schema.ts`
  - Action: Add `.index("by_tenant_and_creationTime", ["tenantId", "_creationTime"])` to the campaigns table definition (line ~167, after existing indexes)
  - Notes: This index enables efficient paginated "newest first" queries. Convex automatically backfills indexes — no migration needed. Run `pnpm convex dev --once` to push schema.

- [ ] **Task 2: Create `listCampaignsPaginated` query**
  - File: `convex/campaigns.ts`
  - Action: Add new paginated query following the established pattern from `convex/payouts.ts:218-268`:
    ```
    args: {
      paginationOpts: paginationOptsValidator,
      statusFilter: v.optional(v.union(v.literal("active"), v.literal("paused"), v.literal("archived"))),
      commissionTypeFilter: v.optional(v.union(v.literal("percentage"), v.literal("flatFee"))),
      recurringFilter: v.optional(v.boolean()),
      createdAfter: v.optional(v.number()),
      createdBefore: v.optional(v.number()),
      includeArchived: v.optional(v.boolean()),
    }
    returns: v.object({
      page: v.array(campaignReturnShape),
      isDone: v.boolean(),
      continueCursor: v.union(v.string(), v.null()),
      hasMoreFiltered: v.boolean(),
    })
    ```
  - Handler logic:
    1. Get authenticated user → tenantId
    2. If `statusFilter` is provided, use `by_tenant_and_status` index with that status
    3. Otherwise, use `by_tenant_and_creationTime` index — exclude archived unless `includeArchived` is `true` (post-filter archived out by default to match existing `listCampaigns` behavior)
    4. `.order("desc").paginate(args.paginationOpts)` — `numItems` should be set to **30** from frontend (hydration strategy)
    5. Apply `commissionTypeFilter`, `recurringFilter`, `createdAfter`, `createdBefore` as in-memory post-filters on the paginated page
    6. Slice filtered results to first 20 for display
    7. **Map campaign objects with EXPLICIT field mapping** (not `...campaign` spread — see ADR-4 update below): destructure raw fields, map `commissionValue` → `commissionRate` and `recurringCommission` → `recurringCommissions` explicitly. This prevents ghost fields from the spread (Adversarial F1).
    8. **Hydration indicator**: Return `hasMoreFiltered: true` if post-filtering removed items AND `isDone` is false — signals frontend to fetch next page
  - Notes: Import `paginationOptsValidator` from `"convex/server"`. Use shared `campaignReturnShape` validator (ADR-4). Date filters use Convex `_creationTime` (epoch ms). **Hydration strategy** (ADR-1): The frontend requests `numItems: 30` but displays only 20. Post-filtering is applied client-side. If fewer than 20 items remain after filtering and `isDone` is false, the frontend automatically fetches the next page and appends. This prevents the "sparse page" problem where filtering 30 → 8 items looks broken. Add `hasMoreFiltered` to returns as `v.boolean()`.

- [ ] **Task 3: Create `getTopCampaigns` query**
  - File: `convex/campaigns.ts`
  - Action: Add new query that returns top 5 active campaigns for the overview page:
    ```
    args: {}
    returns: v.array(campaignReturnShape)
    ```
  - Handler logic:
    1. Get authenticated user → tenantId
    2. Use `by_tenant_and_status` index with `status: "active"` → `.take(50)` (fetch up to 50 to find actual top converters — Adversarial F32 fix)
    3. Call `getCampaignCardStats` via `ctx.runQuery` (one internal round-trip) to get conversion counts
    4. Sort active campaigns by `cardStats[campaignId].conversions` descending, fallback to `_creationTime` desc
    5. Return top 5 using `mapCampaignToReturnShape` helper
  - Notes: Use shared `campaignReturnShape` validator (ADR-4) + `mapCampaignToReturnShape` helper (F1 fix). **Calls `getCampaignCardStats` internally** — this is the ONE exception to ADR-3 because without it, the "Top Campaigns" section is misleading (fetching 10 newest ≠ top converters at scale). ADR-3 still holds for `getAttentionCampaigns` and the overview component. Impact on query budget: 1 extra internal round-trip (~50ms), total still ~390ms (under 500ms).

- [ ] **Task 3b: Create `getAttentionCampaigns` query**
  - File: `convex/campaigns.ts`
  - Action: Add new query that returns campaigns needing attention for the overview page:
    ```
    args: {}
    returns: v.object({
      pausedCampaigns: v.array(campaignReturnShape),
      pausedTotal: v.number(),
    })
    ```
  - Handler logic:
    1. Get authenticated user → tenantId
    2. Query `by_tenant_and_status` with `status: "paused"` → `.order("desc").take(5)` for `pausedCampaigns`; count total with `.collect().length` for `pausedTotal`
    3. Return paused data — **zero-affiliate detection is handled entirely on the frontend** (see Task 5 notes below)
  - Notes: Use shared `campaignReturnShape` validator (ADR-4) + `mapCampaignToReturnShape` helper. **Does NOT return zero-affiliate data or `zeroAffiliateTotal`** — this was an ADR-3 contradiction (Adversarial F31). Instead, `getCampaignStats` is extended (see Task 3c below) to return `zeroAffiliateCampaignIds`, and the frontend handles zero-affiliate display entirely. **Does NOT call `getCampaignCardStats` internally** (ADR-3 holds).

- [ ] **Task 3c: Extend `getCampaignStats` to return zero-affiliate campaign IDs**
  - File: `convex/campaigns.ts`
  - Action: Modify existing `getCampaignStats` query to also return `zeroAffiliateCampaignIds`:
    - During the existing campaign scan loop, collect IDs of active campaigns that have zero affiliates (no matching document in `affiliates` table)
    - Add to returns: `zeroAffiliateCampaignIds: v.array(v.id("campaigns"))`
  - Notes: This query already scans all campaigns for status counts. Adding zero-affiliate detection is zero extra cost (just check affiliates table existence for each campaign). The frontend uses these IDs to display up to 5 zero-affiliate campaign rows and show the accurate count.

- [ ] **Task 4: Refactor campaigns overview page**
  - File: `src/app/(auth)/campaigns/page.tsx`
  - Action: Replace current page shell content. Remove `CampaignList` and `AffiliatesByCampaignTable` imports. Replace with:
    ```tsx
    <CampaignStatsBar />
    <CampaignOverview />
    ```
  - Notes: Keep the same top bar structure (title "Campaigns", "New Campaign" button). `CampaignOverview` is a new component (Task 5).

- [ ] **Task 5: Create `CampaignOverview` component**
  - File: `src/components/dashboard/CampaignOverview.tsx` (NEW)
  - Action: Create overview component with:
    1. **Data fetching** — Call `getCampaignStats`, `getTopCampaigns`, `getAttentionCampaigns`. Use `useMemo` for derived sorting/filtering.
    2. **Status summary row** — 3 stat chips: "X Active", "Y Paused", "Z Archived" (from `getCampaignStats`)
    3. **Top campaigns section** — "Top Active Campaigns" label, grid of top 5 campaign cards (pre-sorted by conversions from `getTopCampaigns` query — F32 fix).
    4. **"Needs Attention" section** (Party Mode — John + Focus Group — Alex) — Two subsections:
       - "X Paused Campaigns" (count from `getAttentionCampaigns.pausedTotal`; shows up to 5 with "View All →" link → `/campaigns/all?status=paused` if `pausedTotal > 5`)
       - "Y Campaigns With No Affiliates" (count from `getCampaignStats.zeroAffiliateCampaignIds.length`; take first 5 IDs, fetch each via individual `ctx.db.get()` calls or batch from the `getAttentionCampaigns` active data). **Default missing `getCampaignCardStats` entries to `{ affiliates: 0, conversions: 0, paidOut: 0 }`** (Adversarial F21 fix).
       - Each item: compact row with campaign name, status badge, link to detail page
       - Only rendered when attention items exist
    5. **Quick actions row** — Button hierarchy (Focus Group — Alex):
       - **"Create Campaign"** = primary (filled, brand color `#1659d6`) — triggers existing `CreateCampaignModal`
       - **"View All X Campaigns →"** = secondary (outline) — links to `/campaigns/all` (X from `getCampaignStats`)
  - Notes: Use existing `CampaignCard` component for the top 5 cards. `"use client"` directive needed for hooks. Wrap in Suspense in the page.tsx. If tenant has 0 campaigns, show the empty state CTA (existing "Create New Campaign" card). **Primary/secondary button hierarchy** makes CREATE the obvious action (Focus Group — Alex). **Count displays** give Alex confidence about what's behind each link (Focus Group — Alex). **Overview serves the 80% case** (5-20 campaigns) — Party Mode — Mary. **Updated query budget: 3 external + 1 internal round-trips (~390ms)** — ADR-3 revised after F32 fix (getTopCampaigns now calls cardStats internally).

- [ ] **Task 6: Create campaigns listing page**
  - File: `src/app/(auth)/campaigns/all/page.tsx` (NEW)
  - Action: Create new page with same top bar structure as current campaigns page:
    ```tsx
    // Top bar: title "All Campaigns", "New Campaign" button
    // Page content:
    <CampaignFilters />
    <CampaignListView />
    ```
  - Notes: Follow established component pattern — Suspense wrapper around content. The page shell is similar to the current campaigns page but uses the new listing components.

- [ ] **Task 7: Create `CampaignFilters` component**
  - File: `src/components/dashboard/CampaignFilters.tsx` (NEW)
  - Action: Create filter bar component with:
    1. **Search input** — text input with magnifying glass icon; debounced (300ms); filters client-side by name/description. **Label** (Adversarial F8 fix): Placeholder text reads "Search within current page" to clarify that search only operates on the currently loaded ~20 campaigns, not across all pages. Add a subtle helper text: "For exact campaign lookup, use the status and type filters."
    2. **Status filter** — toggle buttons or segmented control: All | Active | Paused | Archived (default: All) — **primary/prominent position**
    3. **Commission type filter** — dropdown: All Types | Percentage | Flat Fee — **primary position**
    4. **Recurring filter** — dropdown: All | Recurring | One-time — **primary position**
    5. **Date range filter** — **secondary/expandable** (Party Mode — Sally): collapsible "Date Range" section or "More Filters ▾" dropdown. Not visible by default. Contains "Created after" and "Created before" date pickers.
    6. **View toggle** — icon button group: card grid icon / table list icon. **Context-aware default** (Party Mode — Sally): cards when total campaign count < 10, table when 10+. Requires total count from `getCampaignStats` query.
    7. **Active filter pills** — show active filters as dismissible chips (follow pattern from `AffiliatesByCampaignTable.tsx:368-406`)
    8. **"Clear all" link** when filters are active
  - State: All filter state lives here. Expose via props to `CampaignListView`.
  - Notes: `"use client"` directive. Use existing UI components (`Input`, `Select`, `Button`). Status filter calls `listCampaignsPaginated` with `statusFilter` arg (server-side). Date range is secondary per data-aligned UX (Party Mode — Mary: status ~60% usage, type ~10%, date ~5% of filter interactions).

- [ ] **Task 8: Create `CampaignListView` component**
  - File: `src/components/dashboard/CampaignListView.tsx` (NEW)
  - Action: Create the main listing component with pagination and view toggle:
    1. **Data fetching** — Call `listCampaignsPaginated` with filter args + `paginationOpts: { numItems: 30, cursor }` (hydration strategy: request 30, display up to 20). **Default**: `includeArchived: false` to match existing behavior (Adversarial F35 fix).
    2. **Cursor reset on filter change** (Adversarial F9 fix) — `useEffect` that resets cursor to `undefined` whenever any filter prop changes (status, commissionType, recurring, date range). Prevents stale cursor producing wrong results.
    3. **Hydration mutex** (Adversarial F44 fix) — Use `useRef(false)` as loading lock. Both auto-hydrate and manual "Load More" check `isLoadingRef.current` before fetching; set to `true` before fetch, `false` in `finally`. Prevents concurrent fetches from corrupting cursor state or duplicating items.
    4. **Post-filtering + hydration** — Apply `commissionTypeFilter`, `recurringFilter`, date range filters on the 30-item response. If filtered result < 20 AND `hasMoreFiltered === true`, auto-fetch next page (respecting mutex). Display final array (up to 20). **Max 3 auto-fetch rounds** per page (Adversarial F26 fix) — if after 3 rounds still < 20 results, stop and display what we have. This caps worst-case hydration at ~240ms extra.
    3. **Client-side text search** — After pagination + hydration, filter by search query against `name` and `description`
    4. **Card grid view** — `CampaignCard` components in 3-col grid (existing component)
    5. **Table view** — Use existing `DataTable` component with columns: Name (link), Status (badge), Commission Type, Commission Rate, Affiliates, Conversions, Paid Out, Created (date), Actions (edit/archive)
    6. **View toggle default** — Context-aware (from `CampaignFilters`): cards when total count < 10, table when 10+
    7. **Load More button** — "Load More" button at bottom; disabled when `isDone === true`. Shows count "Showing X campaigns" (follow pattern from `PayoutsClient.tsx:900-920`)
    8. **Empty states with context** (Party Mode — John):
       - 0 total campaigns: "No campaigns yet — create your first campaign"
       - Filters active + 0 results: "No active percentage campaigns found" (mirrors filter state)
       - Search active + 0 results: "No campaigns matching 'partner'"
    9. **Loading state** — Skeleton cards/grid matching the current `CampaignsSkeleton` pattern
  - Props: `viewMode: "cards" | "table"` (from CampaignFilters toggle), `filterState` (from CampaignFilters)
  - Notes: `"use client"` directive. For table view, stats come from `getCampaignCardStats` query (already exists). Table rows link to `/campaigns/[id]`. Hydration prevents sparse pages (Party Mode — Winston).

- [ ] **Task 9: Move `AffiliatesByCampaignTable` to campaign detail page**
  - File: `src/app/(auth)/campaigns/[id]/page.tsx`
  - File: `src/components/dashboard/AffiliatesByCampaignTable.tsx`
  - Action:
    1. In `AffiliatesByCampaignTable.tsx` — Add optional `campaignId` prop (`Id<"campaigns">`) **and optional `campaignName` prop** (`string`). When `campaignId` is provided, skip the campaign picker dropdown entirely and use the prop directly. Remove the `useEffect` that auto-selects first campaign. Remove the `useEffect` that resets filters on campaign change. Remove the `listCampaigns` query dependency for the dropdown. **In `handleExportCsv`, use `campaignName` prop** for the CSV filename instead of `campaigns?.find(...)` which will be undefined (Adversarial F34 fix). Keep all DataTable logic, column-level filters, CSV export, and sorting.
    2. In `campaigns/[id]/page.tsx` — Import `AffiliatesByCampaignTable` and render it below the campaign details cards (after the existing commission/tracking/approval cards section, ~line 740). Pass `campaignId={campaign._id}` and `campaignName={campaign.name}` as props.
    3. Remove the "Affiliates by Campaign" header from the table since the page already provides context. Or keep it as a section label.
  - Notes: This is the key UX improvement — the campaign picker dropdown becomes unnecessary when the table is in context. The existing `DataTable` with its column-level filters (text search on affiliate name/email, number ranges on clicks/conversions/revenue, date range on joined) is already excellent.

- [ ] **Task 10: Confirm sidebar navigation (no-op)**
  - File: `src/components/shared/Sidebar.tsx`
  - File: `src/components/shared/SidebarNav.tsx`
  - Action: **No changes needed.** Verified by Amelia (Party Mode — Dev). The existing `startsWith` active detection on line 223 (`pathname.startsWith(item.href + "/")`) already handles `/campaigns/all` — when user is on `/campaigns/all`, the "Campaigns" nav item highlights because `"/campaigns/all".startsWith("/campaigns/")` is `true`. Same for `/campaigns/[id]` detail pages.
  - Notes: `/campaigns` → highlights. `/campaigns/all` → highlights. `/campaigns/abc123` → highlights. This task is documentation-only — no code changes. Mark complete immediately.

### Acceptance Criteria

- [ ] **AC 1**: Given a tenant with 100+ campaigns, when the user visits `/campaigns`, then only the overview is displayed (stats bar, top 5 active campaigns, "Needs Attention" section, status summary, quick actions) — NOT a full card grid of all campaigns.
- [ ] **AC 2**: Given a tenant with fewer than 6 active campaigns, when the user visits `/campaigns`, then ALL active campaigns are shown as cards (no "View All" needed since they all fit).
- [ ] **AC 3**: Given a tenant with 0 campaigns, when the user visits `/campaigns`, then an empty state CTA is shown ("Create New Campaign").
- [ ] **AC 4**: Given the user clicks "View All Campaigns" on the overview page, when navigated to `/campaigns/all`, then the button text shows total count ("View All 47 Campaigns →") and the listing page shows a paginated listing with view toggle.
- [ ] **AC 5**: Given the user is on `/campaigns/all` with 25 campaigns, when they scroll to the bottom and click "Load More", then 5 more campaigns are appended and the button becomes disabled.
- [ ] **AC 6**: Given the user types "partner" in the search input on `/campaigns/all`, when the search executes (after 300ms debounce), then only campaigns whose name or description contains "partner" (case-insensitive) are displayed.
- [ ] **AC 7**: Given the user selects "Archived" status filter, when the filter is applied, then only archived campaigns are shown (server-side filtered via `statusFilter` arg).
- [ ] **AC 8**: Given the user selects "Percentage" commission type filter, when the filter is applied, then only percentage-based campaigns are shown.
- [ ] **AC 9**: Given the user toggles to "Table" view on `/campaigns/all`, when the view switches, then campaigns are displayed in a DataTable with columns: Name, Status, Type, Rate, Affiliates, Conversions, Paid Out, Created.
- [ ] **AC 10**: Given the user has multiple active filters, when viewing the filter bar, then active filter pills are displayed with individual dismiss buttons and a "Clear all" link.
- [ ] **AC 11**: Given the user navigates to `/campaigns/[id]`, when the page loads, then the campaign details are shown along with the "Affiliates by Campaign" table (no campaign picker dropdown) showing only affiliates for this specific campaign.
- [ ] **AC 12**: Given the user is on `/campaigns/all` or `/campaigns/[id]`, when viewing the sidebar, then the "Campaigns" nav item is highlighted as active.
- [ ] **AC 13**: Given a tenant with 5 active campaigns where 3 have conversions, when the overview page loads, then the top 5 campaigns are shown sorted by conversion count descending.
- [ ] **AC 14**: Given the `listCampaignsPaginated` query receives a `createdAfter` timestamp, when campaigns are fetched, then only campaigns created after that timestamp are returned.
- [ ] **AC 15**: Given the user exports CSV from the affiliate breakdown on `/campaigns/[id]`, when the download triggers, then the CSV filename includes the campaign name and current date.
- [ ] **AC 16**: Given a tenant with paused campaigns and active campaigns with zero affiliates, when the overview page loads, then the "Needs Attention" section shows both categories with campaign names, status badges, and total counts ("3 Paused Campaigns", "2 With No Affiliates").
- [ ] **AC 17**: Given a tenant with 12 paused campaigns, when the overview "Needs Attention" section renders, then 5 paused campaigns are shown with a "View All →" link indicating there are more.
- [ ] **AC 18**: Given the user is on `/campaigns/all` with 50 campaigns and applies "Percentage" + "Recurring" filters, when the hydration strategy runs, then the page fetches 30 items, post-filters to matching campaigns, displays up to 20, and auto-fetches more if fewer than 20 match (no sparse pages).
- [ ] **AC 19**: Given a tenant with 8 total campaigns, when the user visits `/campaigns/all`, then the view toggle defaults to card grid (context-aware default for <10 campaigns).
- [ ] **AC 20**: Given a tenant with 15 total campaigns, when the user visits `/campaigns/all`, then the view toggle defaults to table view (context-aware default for 10+ campaigns).
- [ ] **AC 21**: Given the user has "Active" + "Percentage" filters active on `/campaigns/all` and no matching campaigns, then the empty state reads "No active percentage campaigns found" (mirrors filter context).
- [ ] **AC 22**: Given the user expands the date range filter on `/campaigns/all`, then a collapsible "Date Range" section appears with "Created after" and "Created before" date pickers (not visible by default — secondary filter per UX analysis).
- [ ] **AC 23**: Given the overview page loads, when `getCampaignCardStats` is queried, then it is called exactly ONCE on the frontend (not inside backend queries) — verified by inspecting network requests (ADR-3).
- [ ] **AC 24**: Given the overview page quick actions row, then "Create Campaign" renders as a primary (filled) button and "View All X Campaigns →" renders as a secondary (outline) button.
- [ ] **AC 25**: Given the overview page fully loads, then total page load time is under 500ms (4 external Convex round-trips per ADR-3 query budget).

## Additional Context

### Dependencies

- **Convex schema push**: Task 1 requires running `pnpm convex dev --once` to deploy the new index. This must happen before Tasks 2-3 can work.
- **No new npm packages**: All UI components needed (`DataTable`, `Command`, `Select`, `Input`, `Button`, `Skeleton`) already exist in the project.
- **No backend API changes outside campaigns.ts**: The `AffiliatesByCampaignTable` already calls `getAffiliatesByCampaign` with a campaignId — just needs to receive it as a prop instead of managing it internally.

### Testing Strategy

- **Manual testing steps**:
  1. Create 25+ test campaigns via the "New Campaign" modal (mix of active, paused, archived; mix of percentage and flat fee; some with recurring enabled)
  2. Verify `/campaigns` overview shows stats bar + top 5 + status summary
  3. Verify `/campaigns/all` shows 20 campaigns with "Load More" button
  4. Verify search filters by name and description
  5. Verify status filter works (active/paused/archived)
  6. Verify commission type filter works
  7. Verify view toggle switches between card grid and table
  8. Verify "Load More" loads next page and button disables when exhausted
  9. Verify `/campaigns/[id]` shows affiliate table without campaign picker
  10. Verify sidebar "Campaigns" highlights on all `/campaigns/*` routes
- **Unit tests**: Not required — project has no existing test infrastructure (placeholder tests only per AGENTS.md).
- **Edge cases to verify manually**:
  - 0 campaigns → empty states on both pages
  - Exactly 20 campaigns → "Load More" should not appear (isDone = true)
  - 21 campaigns → first page of 20 + "Load More" loads 1 more + button disables
  - Search with no results → "No campaigns found" message
  - All filters active + search → combined filtering works
  - Archived campaign detail page → affiliate table still loads correctly

### Adversarial Review Resolutions (4 rounds, 52 findings)

52 findings across 4 rounds of adversarial review. Key resolutions:

| Finding | Severity | Resolution |
|---------|----------|------------|
| F19 (route shadowing) | Critical → **Noise** | Next.js App Router static segments (`all/`) DO take priority over dynamic segments (`[id]/`). Verified via Next.js docs. No issue. Added defensive ID validation to `[id]` page as good practice. |
| F2 (infinite hydration loop) | Critical → **Noise** | Loop terminates via `isDone: true` from Convex — when all pages exhausted, `isDone = true` and loop stops. No change needed. |
| F1 (ghost field) | Critical → **Fixed** | Use explicit field mapping helper `mapCampaignToReturnShape(c)` instead of `...campaign` spread. Prevents raw DB fields leaking into response. |
| F32 (top 5 by newest) | Critical → **Fixed** | Changed `getTopCampaigns` to fetch 50 active campaigns, call `getCampaignCardStats` internally, sort by conversions, return top 5. |
| F44 (hydration race condition) | Critical → **Fixed** | Added `useRef` mutex to `CampaignListView`. Both auto-hydrate and manual "Load More" check lock before fetching. |
| F46 (statusFilter type mismatch) | High → **Fixed** | Changed from `v.array(...)` to `v.optional(v.union(...))` — single value matching the segmented control UI. |
| F31/F47 (validator contradiction) | High → **Fixed** | Removed `zeroAffiliateTotal` and `zeroAffiliateCampaigns` from backend. Extended `getCampaignStats` to return `zeroAffiliateCampaignIds`. Frontend handles display. |
| F8 (search scope) | High → **Mitigated** | Search input labeled "Search within current page" with helper text. Clear user expectation. |
| F9 (cursor reset) | High → **Fixed** | `useEffect` resets cursor to `undefined` when any filter prop changes. |
| F34 (CSV export broken) | High → **Fixed** | Added `campaignName` prop to `AffiliatesByCampaignTable`; used directly in `handleExportCsv`. |
| F35 (archived leak) | High → **Fixed** | Added `includeArchived: v.optional(v.boolean())` arg; defaults to `false`. Post-filters archived when no status filter set. |
| F21 (missing stats entries) | High → **Mitigated** | Frontend defaults missing `getCampaignCardStats` entries to `{ affiliates: 0, conversions: 0, paidOut: 0 }`. |
| F22 (zero-affiliate undercount) | High → **Fixed** | `getCampaignStats` extension returns ALL zero-affiliate campaign IDs (not limited to 20). Count is accurate. |
| F26 (max accumulation cap) | Medium → **Fixed** | Max 3 auto-fetch rounds per hydration cycle (~240ms cap). |
| F28 (no back-navigation) | Medium → **Noted** | `/campaigns/all` top bar should include a "Back to Overview" link or breadcrumb. Added as implementation note. |
| F36 (hydration waterfall) | Medium → **Noted** | Worst case ~240ms for 3 hydration rounds. Acceptable. Progress rendering via Suspense skeleton during fetch. |
| F51 (timezone mismatch) | Medium → **Noted** | Date picker values must be converted to UTC epoch ms at start-of-day. Document timezone handling in implementation. |

### Implementation Notes

- **Defensive ID validation** (F19 downgraded): Add validation in `campaigns/[id]/page.tsx` — check that `params.id` matches a valid Convex document ID pattern before rendering. If not, show 404. This prevents edge cases where a typo creates confusing UI.
- **Back-navigation** (F28): The `/campaigns/all` top bar should include a "← Back to Overview" link (text, not icon) or breadcrumb: "Campaigns / All Campaigns". Essential for mobile users where sidebar may be collapsed.
- **Error boundaries** (F24): Wrap `CampaignOverview` sections in individual `<ErrorBoundary>` components (or React error boundaries). If `getCampaignStats` fails, the overview should still render "Top Campaigns" and "Needs Attention" sections with graceful fallbacks. If `getTopCampaigns` fails, show a retry button — not a blank page.
- **Skeleton states** (F37): Create `CampaignOverviewSkeleton` — stat chips (3 pulse bars), "Top Campaigns" label with 3 card-shaped skeletons, "Needs Attention" placeholder. Different from existing `CampaignsSkeleton` which assumes full card grid.
- **Table view skeleton** (F42): When view mode is "table", show row-shaped skeletons (alternating gray bars) instead of card-shaped ones. The `DataTable` component's existing loading state should handle this.
- **Filter bar loading** (F41): `CampaignFilters` renders immediately with defaults. View toggle shows "cards" placeholder until `getCampaignStats` resolves, then updates. Use `useMemo` to stabilize the default during the query window to prevent flash.
- **Date range timezone** (F51): Browser date pickers return local time. Convert to UTC epoch ms at start-of-day: `new Date(dateString + 'T00:00:00').getTime()`. Store and compare as UTC in both frontend and Convex.
- **Dead CampaignCard code** (F43/F48): `CampaignCard` has unreachable pause/resume dialog code. When used in overview (display-only), these add unnecessary DOM. Consider adding an `interactive` prop to `CampaignCard` — when `false`, hide action buttons and dialogs.
- **getCampaignCardStats on listing page** (F49): The listing page's table view needs "Paid Out" data from `getCampaignCardStats`. This is a separate query call from the overview. The listing page query budget is: (1) `listCampaignsPaginated` + (2) `getCampaignStats` (for view toggle count) + (3) `getCampaignCardStats` (for table columns) = ~280ms. Acceptable.
- **Index backfill window** (F27): After running `pnpm convex dev --once`, the new `by_tenant_and_creationTime` index begins backfilling. Queries using this index may return incomplete results during backfill on large tables. This is brief (< 1 minute typically) and self-healing. No action needed.
- **CampaignList.tsx cleanup**: After refactor, verify no other files import `CampaignList`. Check: barrel files (`index.ts`), `CreateCampaignModal`, any test files. Delete `CampaignList.tsx` once confirmed unused.

### Notes

- **ADR-1 (Hydration)**: Frontend requests `numItems: 30` from server, post-filters to match commission type / recurring / date criteria, displays up to 20. Auto-fetches next page if filtered count < 20 and `hasMoreFiltered` is true. Prevents sparse pages. Revisit if Convex adds query composition or campaigns exceed 500/tenant.
- **ADR-2 (No filter indexes)**: Binary filters compound poorly. Hydration handles it. Add `by_tenant_and_commissionType` only if latency monitoring reveals >500ms.
- **ADR-3 (Frontend stats dedup)**: `getCampaignCardStats` called once internally by `getTopCampaigns` only. `CampaignOverview` does NOT call it directly. Zero-affiliate data comes from extended `getCampaignStats`. Overview query budget: 3 external + 1 internal (~290ms total).
- **ADR-4 (Shared validator + helper)**: `campaignReturnShape` constant + `mapCampaignToReturnShape(c)` helper defined at top of `convex/campaigns.ts`. Uses explicit field mapping (no spread) to prevent ghost fields (F1 fix). Used by all 3 new queries.
- **Known limitation (mitigated)**: The hydration strategy significantly reduces (but doesn't fully eliminate) the post-filtering sparse page issue. Max 3 auto-fetch rounds per cycle (~240ms cap). In extreme edge cases (e.g., 95% filtered out), 3 rounds of 30 items may still yield < 20 matches — acceptable for ~100-500 campaigns.
- **Sidebar**: Confirmed NO changes needed. Existing `startsWith` logic handles all sub-routes correctly (Party Mode — Amelia). **F19 (route shadowing) verified as noise** — Next.js static segments (`all/`) take priority over dynamic (`[id]/`).
- **`CampaignList.tsx`**: This file becomes unused after the refactor (replaced by `CampaignOverview.tsx` and `CampaignListView.tsx`). Verify no other imports exist before deleting.
- **`listCampaigns` query**: Kept unchanged for backward compatibility. `CreateCampaignModal` and any other consumers can continue using it. A future cleanup could migrate all consumers to `listCampaignsPaginated`.
- **Future consideration**: If campaign count grows beyond 500, consider adding Convex full-text search index on campaign name/description for server-side search instead of client-side filtering.
- **Nice-to-have (out of scope)**: Archived campaign detail page could show a prominent banner: "This campaign is archived. Referral links are no longer active." Currently only shows a small status badge (User Focus Group — Jamie).
- **Party Mode improvements applied**: Hydration strategy (Winston), context-aware view toggle (Sally), campaign count CTA (Sally), secondary date range filter (Sally + Mary data alignment), "Needs Attention" section (John), contextual empty states (John), 80/20 design priority (Mary), sidebar no-op confirmation (Amelia).
- **Advanced Elicitation improvements applied**: ADR-1 through ADR-4 (Architecture Decision Records — Winston, Elena, Marcus), "Needs Attention" counts (Focus Group — Alex), button hierarchy primary/secondary (Focus Group — Alex), frontend stats dedup ADR-3 (Elena), shared validator ADR-4 (Marcus), archived banner note (Focus Group — Jamie).
- **Adversarial Review improvements applied** (4 rounds, 52 findings): F32 fix (fetch 50 + internal sort), F1 fix (explicit field mapping helper), F44 fix (useRef hydration mutex), F46 fix (single statusFilter type), F31/F47 fix (getCampaignStats extension for zero-affiliate IDs), F9 fix (cursor reset on filter change), F34 fix (campaignName prop for CSV), F35 fix (exclude archived by default), F8 mitigation (search scope labeling), F26 fix (max 3 hydration rounds), implementation notes for F24/F28/F36/F37/F41/F42/F43/F48/F49/F51.
