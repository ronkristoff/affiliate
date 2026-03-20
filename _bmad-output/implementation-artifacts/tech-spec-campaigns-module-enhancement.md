---
title: "Campaigns Module Enhancement — Stats Bar, Affiliates Table & CSV Export"
slug: "campaigns-module-enhancement"
created: "2026-03-20"
status: "implementation-complete"
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - Convex (queries with new function syntax)
  - React (Server/Client Components)
  - shadcn/ui (DataTable, Select, Button, Card, Skeleton)
  - Tailwind CSS v4
files_to_modify:
  - convex/campaigns.ts
  - src/components/dashboard/CampaignStatsBar.tsx
  - src/components/dashboard/AffiliatesByCampaignTable.tsx
  - src/app/(auth)/campaigns/page.tsx
code_patterns:
  - Convex query with v.object returns validator
  - DataTable with pre-built cell renderers (AvatarCell, CurrencyCell, NumberCell, DateCell)
  - useQuery/useMutation from convex/react
  - Client component with "use client" directive
test_patterns:
  - Manual testing (no automated tests required for this feature)
  - Adversarial-derived edge case tests (scale, isolation, encoding)
---

# Tech-Spec: Campaigns Module Enhancement — Stats Bar, Affiliates Table & CSV Export

**Created:** 2026-03-20

## Overview

### Problem Statement

The `/campaigns` page currently only shows campaign cards with basic per-campaign stats (affiliates, conversions, paid out). The original design spec (`05-owner-campaigns.html`) called for an "Affiliates by Campaign" table, campaign-level analytics summary, and CSV export — none of which are implemented. The page feels empty and lacks operational depth for SaaS Owners who need to check on individual affiliate performance within campaigns.

### Solution

Add a summary stats bar above the campaign cards (total affiliates, conversions, commissions across all campaigns) and a read-only "Affiliates by Campaign" table below the cards with a campaign filter dropdown and CSV export button.

### Scope

**In Scope:**
- Summary stats bar (horizontal strip with aggregated per-campaign numbers: Campaign Affiliates, Total Conversions, Total Commissions)
- Affiliates by Campaign table (read-only): Affiliate Name, Email, Joined Date, Clicks, Conversions, Revenue, Pending Commission, Confirmed Commission
- Campaign filter dropdown above the table (first campaign auto-selected on load)
- CSV Export button (downloads current filtered table view)
- Error handling for query failures (toast notification + retry option)

**Out of Scope:**
- Active/suspend affiliate toggle (defer to follow-up)
- Time-series charts or conversion funnels
- Commission pipeline view (pending vs. confirmed vs. reversed)
- Pagination on the table (defer to later if needed)

## Context for Development

### Codebase Patterns

- Use existing `src/components/ui/DataTable.tsx` (full-featured: sorting, filtering, selection, actions)
- Use pre-built cell renderers: `AvatarCell`, `CurrencyCell`, `NumberCell`, `DateCell`
- Campaign stats already available via `getCampaignCardStats` query — no new backend needed for stats bar
- Convex queries use new function syntax with `v.*` validators and `returns` validators
- **⚠️ Tenant resolution pattern:** All existing queries resolve tenant from auth via `getAuthenticatedUser(ctx)` — NO `tenantId` arg is passed. `getCampaignCardStats`, `getCampaignStats`, `listCampaigns` all take `{}` args. The new query MUST follow this same pattern.
- **⚠️ DataTable limitations:** `hideOnMobile` property exists in `TableColumn<T>` type but is **never applied in rendering** (dead code). `width` property applies to `<th>` headers only, NOT `<td>` cells. With 8 columns, mobile will be cramped — hide lower-priority columns manually or accept horizontal scroll.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/app/(auth)/campaigns/page.tsx` | Main campaigns page — needs stats bar and table insertion |
| `src/components/dashboard/CampaignList.tsx` | Campaign card grid component — stats bar goes above this |
| `src/components/ui/DataTable.tsx` | Reusable DataTable with sorting, filtering, cell renderers |
| `src/components/ui/AvatarCell` | Pre-built: `AvatarCell`, `CurrencyCell`, `NumberCell`, `DateCell`, `StatusBadgeCell` |
| `convex/campaigns.ts` | Existing campaign queries: `getCampaignCardStats`, `getCampaignStats`, `listCampaigns` |
| `convex/schema.ts` | Schema: campaigns, affiliates, referralLinks, clicks, conversions, commissions tables |
| `_bmad-output/screens/05-owner-campaigns.html` | Original design spec showing two-section layout + affiliates table |

### Technical Decisions

- **DataTable component:** Use existing `src/components/ui/DataTable.tsx` — no custom table styling needed
- **Cell renderers:** Use pre-built `AvatarCell`, `CurrencyCell`, `NumberCell`, `DateCell` from DataTable exports
- **Stats bar data:** Aggregate from existing `getCampaignCardStats` query — no new backend function
- **Stats bar labeling:** Use "Campaign Affiliates" (sum of per-campaign counts) NOT "Total Affiliates" — avoids misleading distinct count when affiliates are in multiple campaigns
- **Affiliates table data:** New `getAffiliatesByCampaign` query. Takes `{ campaignId: v.id("campaigns") }` as single arg. Resolves tenant internally via `getAuthenticatedUser(ctx)` — same pattern as all existing queries. NOT `tenantId` as arg.
- **Tenant isolation:** Handled internally via `getAuthenticatedUser(ctx)` — no client-side tenantId needed. Follows existing codebase pattern.
- **Scale guard:** Query uses `take(200)` on referralLinks to prevent unbounded N+3 lookups. Campaigns with >200 affiliates documented as needing pagination (future)
- **CSV export:** Frontend-only utility function (~20 lines) — serialize column definitions + data to CSV. Export raw numbers (500.00) not formatted currency (₱500)
- **Column model:** 8 columns — Affiliate (AvatarCell), Joined (DateCell), Clicks, Conversions, Revenue, Pending, Confirmed
- **Filter:** Campaign dropdown above table — standard select element, no DataTable column filter needed
- **Known limitation:** Table is read-only (no active/suspend toggle) — documented as fast-follow. Users must navigate to campaign detail to manage affiliate status.

## Implementation Plan

### Tasks

- [x] **Task 1: Create `getAffiliatesByCampaign` Convex query**
  - File: `convex/campaigns.ts`
  - Action: Add new public query function `getAffiliatesByCampaign` with args `{ campaignId: v.id("campaigns") }`. Resolve tenant internally via `getAuthenticatedUser(ctx)` — NO tenantId arg (follows codebase pattern). Returns `v.array(v.object({ affiliateId: v.id("affiliates"), name: v.string(), email: v.string(), joinedAt: v.number(), clicks: v.number(), conversions: v.number(), totalRevenue: v.number(), pendingCommission: v.number(), confirmedCommission: v.number() }))`. Implementation: query `referralLinks` using `by_tenant_and_campaign` index with `take(200)` scale guard, aggregate clicks/conversions/commissions per affiliate.
  - Notes: Follow new function syntax pattern. MUST use `getAuthenticatedUser(ctx)` for tenant resolution — NOT `tenantId` arg. Do NOT use dynamic imports.

- [x] **Task 2: Create `CampaignStatsBar` component**
  - File: `src/components/dashboard/CampaignStatsBar.tsx`
  - Action: Create client component that calls `useQuery(api.campaigns.getCampaignCardStats)` — same query as CampaignList, no args needed. Aggregates the response to produce: "Campaign Affiliates" (sum of per-campaign affiliate counts), "Total Conversions" (sum), "Total Commissions" (sum of paid amounts). Use Skeleton for loading state. Show error toast on query failure with retry button.
  - Notes: Use existing brand colors (`#10409a`, `#1659d6`). Match card styling from existing dashboard components.

- [x] **Task 3: Create `AffiliatesByCampaignTable` component**
  - File: `src/components/dashboard/AffiliatesByCampaignTable.tsx`
  - Action: Create client component using `DataTable` from `@/components/ui/DataTable`. Import `AvatarCell`, `CurrencyCell`, `NumberCell`, `DateCell` cell renderers. Define 8-column schema: Affiliate, Joined, Clicks, Conversions, Revenue, Pending, Confirmed. Add campaign filter dropdown (Select component) above table — first campaign auto-selected on load. If tenant has no campaigns, show placeholder message "No campaigns yet — create your first campaign to see affiliate performance." Add "Export CSV" button that serializes current table data to CSV. Use `useQuery(api.campaigns.getAffiliatesByCampaign)` for data loading. Show error toast on query failure with retry button. CSV filename sanitized: strip special chars from campaign name, replace spaces with hyphens.
  - Notes: DataTable handles sorting, loading skeleton, empty state. CSV export exports raw numbers (500.00) not formatted currency. Filename pattern: `campaign-affiliates-{sanitized-campaignName}-{date}.csv`. Do NOT rely on `hideOnMobile` (dead code in DataTable).

- [x] **Task 4: Update campaigns page layout**
  - File: `src/app/(auth)/campaigns/page.tsx`
  - Action: Import `CampaignStatsBar` and `AffiliatesByCampaignTable`. Insert `CampaignStatsBar` inside the existing `<Suspense>` boundary (alongside `CampaignList`) so it renders with the same loading skeleton. Insert `AffiliatesByCampaignTable` below `CampaignList` inside the same `<Suspense>` boundary. Maintain existing page title and Create button in topbar.
  - Notes: Both new components must be INSIDE the existing `<Suspense>` wrapper that contains `CampaignsContent`. Do NOT add a separate Suspense boundary — use the existing one.

### Acceptance Criteria

**Stats Bar:**
- [ ] AC-1: Given the campaigns page loads with multiple campaigns, when the stats bar renders, then it displays "Campaign Affiliates" showing the sum of per-campaign affiliate counts (NOT unique distinct count)
- [ ] AC-2: Given the stats bar renders, when affiliate data loads, then "Total Conversions" shows the sum of conversion counts across all campaigns
- [ ] AC-3: Given the stats bar renders, when commission data loads, then "Total Commissions" shows the sum of confirmed payout amounts (not pending)
- [ ] AC-4: Given the campaigns page loads, when stats data is still fetching, then the stats bar displays loading skeletons
- [ ] AC-5: Given the campaigns page loads, when stats data fails to fetch, then a toast notification appears with error message and retry button

**Affiliates by Campaign Table:**
- [ ] AC-6: Given the campaigns page loads, when the page renders, then the affiliates table appears below the campaign cards in a card container
- [ ] AC-7: Given the table is displayed and tenant has campaigns, when the table renders for the first time, then the first campaign is auto-selected in the dropdown and table shows that campaign's affiliates
- [ ] AC-8: Given the table is displayed, when the user selects a different campaign from the filter dropdown, then the table shows only affiliates for that campaign
- [ ] AC-9: Given a campaign is selected, when the table renders, then it displays columns: Affiliate (with avatar + email), Joined (date), Clicks, Conversions, Revenue, Pending, Confirmed
- [ ] AC-10: Given the table has data, when the user clicks a column header, then the table sorts by that column (ascending/descending toggle)
- [ ] AC-11: Given a campaign with no affiliates is selected, when the table renders, then it displays an empty state message
- [ ] AC-12: Given the tenant has no campaigns, when the page renders, then the table shows a placeholder message "No campaigns yet — create your first campaign to see affiliate performance"
- [ ] AC-13: Given a query for campaign affiliates, when the query executes, then it resolves tenant internally via `getAuthenticatedUser(ctx)` and only returns data for that tenant (tenant isolation)
- [ ] AC-14: Given a campaign with 200+ affiliates, when the query executes, then it returns exactly 200 affiliates maximum (scale guard)
- [ ] AC-15: Given the table data fails to fetch, when the error occurs, then a toast notification appears with error message and retry button

**CSV Export:**
- [ ] AC-16: Given the affiliates table is displayed, when the table renders, then the "Export CSV" button is visible in the table header
- [ ] AC-17: Given the user clicks "Export CSV", when a campaign is selected in the dropdown, then the exported CSV matches the current filtered table view
- [ ] AC-18: Given the CSV export is triggered, when the file is generated, then columns match the table columns in order
- [ ] AC-19: Given the CSV export is triggered, when monetary values are exported, then they are raw numbers (e.g., 500.00) not formatted currency (e.g., ₱500)
- [ ] AC-20: Given the CSV export is triggered, when the file is downloaded, then the filename follows the pattern `campaign-affiliates-{sanitized-campaignName}-{date}.csv` where special characters are stripped and spaces replaced with hyphens

## Additional Context

### Dependencies

- Existing Convex schema tables: `campaigns`, `affiliates`, `referralLinks`, `clicks`, `conversions`, `commissions`
- Existing indexes: `commissions.by_campaign`, `commissions.by_tenant_and_status`, `clicks.by_affiliate`, `conversions.by_affiliate`, `conversions.by_campaign`, `referralLinks.by_tenant_and_campaign`, `affiliates.by_tenant`
- Existing UI components: `DataTable`, `AvatarCell`, `CurrencyCell`, `NumberCell`, `DateCell`, `Select` (for dropdown), `Button`, `Card`, `Skeleton`, `sonner` (toast)
- Existing Convex queries: `getCampaignCardStats`, `getCampaignStats`, `listCampaigns`
- Existing auth helper: `getAuthenticatedUser` in `convex/campaigns.ts` — used internally for tenant resolution

### Testing Strategy

**Functional:**
- Manual: Select each campaign from dropdown, verify table populates with correct affiliates
- Manual: Verify CSV export downloads correct data matching table view
- Manual: Verify stats bar numbers match sum of campaign card stats
- Manual: Verify empty state when campaign has no affiliates
- Manual: Verify error toast appears when Convex query fails (kill Convex dev server to test)

**Adversarial-derived tests:**
- [ ] Test with campaign containing 200+ affiliates — verify query returns exactly 200 (scale guard)
- [ ] Test with affiliate in multiple campaigns — verify stats bar shows summed counts, not distinct
- [ ] Test CSV export with Filipino names containing special characters (ñ, accented vowels)
- [ ] Test tenant isolation: user from Tenant A cannot query Tenant B's campaign data
- [ ] Verify DataTable column widths render correctly with 8 columns on desktop (horizontal scroll on mobile is acceptable)
- [ ] Test "no campaigns" state — verify placeholder message appears in table area
- [ ] Test CSV filename with campaign containing spaces and special characters — verify sanitization

### Notes

- The data is ALL THERE already — no new tables needed, just new aggregation queries
- Future enhancements (deferred): active/suspend toggle, column-level filters, pagination for 200+ affiliates, time-series charts, fixing DataTable `hideOnMobile` and `width` properties
- CSV export utility can be extracted to `src/lib/csv-export.ts` if reused elsewhere
- **Adversarial reviews completed** — 2 rounds: Red Team vs Blue Team + Critical Perspective (6 issues), then full cynical review (12 issues). All critical/high issues addressed.

### Known Limitations (documented, not bugs)

- Affiliates in multiple campaigns are counted multiple times in stats bar (labeled "Campaign Affiliates" to be honest about this)
- Table is read-only — no active/suspend toggle (deferred to follow-up story). Users must navigate to campaign detail page to manage affiliate status.
- Maximum 200 affiliates per campaign in table view (scale guard). Campaigns exceeding this need pagination (future enhancement).
- DataTable `hideOnMobile` property is dead code — 8-column table will scroll horizontally on mobile. Lower-priority columns (Revenue, Pending, Confirmed) can be hidden later when DataTable is fixed.
- DataTable `width` property only constrains `<th>` headers, not `<td>` cells — minor visual misalignment possible.
