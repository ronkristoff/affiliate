# Story 9.3: Affiliate Performance Metrics

Status: done

## Story

As a SaaS Owner or Manager,
I want to view affiliate-level performance metrics,
so that I can identify top performers and underperformers. (FR60)

## Acceptance Criteria

### AC1: Affiliate List with Performance Metrics
**Given** the user is on the Reports > Affiliates page
**When** the page loads
**Then** all affiliates are listed in a table with performance metrics
**And** metrics include: clicks, conversions, conversion rate, total commissions, status
**And** affiliates are sortable by any metric column
**And** affiliates show status badge (active, suspended, pending, rejected)

### AC2: Affiliate Performance Summary Cards
**Given** the user views the affiliate performance page
**When** the page loads
**Then** summary cards display aggregate metrics across all affiliates
**And** cards show: Total Affiliates, Active Affiliates, Total Clicks, Total Commissions
**And** each card shows period-over-period comparison

### AC3: Date Range Filtering
**Given** the user wants to analyze specific time periods
**When** they select a date range (7 days, 30 days, 90 days, custom)
**Then** all metrics update to reflect the selected period
**And** URL params preserve the date range selection

### AC4: Campaign Filter Dropdown
**Given** the user wants to filter by specific campaign
**When** they use the campaign dropdown filter
**Then** they can select a specific campaign to view affiliate metrics for that campaign
**Or** select "All Campaigns" to see aggregate view

### AC5: Sort by Performance
**Given** the user wants to identify top or underperformers
**When** they select a sort option
**Then** the list is reordered accordingly
**And** top performers are visually highlighted

### AC6: Affiliate Detail View
**Given** the user selects a specific affiliate
**When** they view affiliate details
**Then** detailed metrics are displayed including:
- Performance trend over time (line chart)
- Conversion funnel (clicks → conversions)
- Commission breakdown by status
- Campaign participation breakdown

### AC7: Export CSV
**Given** the user wants to export affiliate data
**When** they click "Export CSV"
**Then** a CSV file downloads with affiliate performance data
**And** CSV includes all visible columns and filtered data

### AC8: RBAC Enforcement
**Given** the user has Viewer role
**When** viewing affiliate performance
**Then** sensitive financial data (commission amounts) is hidden
**And** export button is disabled
**Given** the user has Manager or Owner role
**When** viewing affiliate performance
**Then** all data is visible and export is enabled

## Tasks / Subtasks

- [x] Task 1: Create backend queries for affiliate performance (AC: #1, #2, #3)
  - [x] 1.1 Create `getAffiliatePerformanceList` query in `convex/reports.ts`
  - [x] 1.2 Return: affiliateId, name, email, status, clicks, conversions, conversionRate, totalCommissions
  - [x] 1.3 Support date range filtering
  - [x] 1.4 Calculate conversion rate as (conversions / clicks) * 100
  - [x] 1.5 Implement RBAC check for sensitive data
  - [x] 1.6 Add sorting capability (by clicks, conversions, commissions, name)

- [x] Task 2: Create summary metrics query (AC: #2)
  - [x] 2.1 Create `getAffiliateSummaryMetrics` query in `convex/reports.ts`
  - [x] 2.2 Return: totalAffiliates, activeAffiliates, totalClicks, totalConversions, totalCommissions, avgConversionRate
  - [x] 2.3 Include previous period comparison for delta calculation
  - [x] 2.4 Apply date range filtering

- [x] Task 3: Create affiliate detail query (AC: #6)
  - [x] 3.1 Create `getAffiliatePerformanceDetails` query in `convex/reports.ts`
  - [x] 3.2 Return: affiliate info + aggregated metrics + trend data points
  - [x] 3.3 Include campaign breakdown for this affiliate
  - [x] 3.4 Include commission breakdown by status
  - [x] 3.5 Generate trend data points for chart (daily/weekly buckets)

- [x] Task 4: Create trend data query (AC: #6)
  - [x] 4.1 Create `getAffiliateTrendData` query in `convex/reports.ts`
  - [x] 4.2 Return array of data points: date, clicks, conversions, commissions
  - [x] 4.3 Group by day for ranges ≤ 30 days, by week for longer ranges
  - [x] 4.4 Fill in missing dates with zero values for continuous chart

- [x] Task 5: Create CSV export action (AC: #7)
  - [x] 5.1 Create `exportAffiliatePerformanceCSV` action in `convex/reports.ts`
  - [x] 5.2 Generate CSV with headers and all visible data
  - [x] 5.3 Apply date range and campaign filters to export data
  - [x] 5.4 Return base64-encoded CSV for download

- [x] Task 6: Build reports page layout (AC: #1, #3, #4)
  - [x] 6.1 Create `src/app/(auth)/reports/affiliates/page.tsx`
  - [x] 6.2 Reuse existing sidebar layout from `(auth)/layout.tsx`
  - [x] 6.3 Add period tabs (7 days, 30 days, 90 days, custom)
  - [x] 6.4 Add campaign filter dropdown (reuse from 9-2)
  - [x] 6.5 Add Export CSV button in topbar
  - [x] 6.6 Set nav item to "Reports" active state

- [x] Task 7: Implement summary metrics cards (AC: #2)
  - [x] 7.1 Create `AffiliateMetricsSummary` component
  - [x] 7.2 4-column grid: Total Affiliates, Active Affiliates, Total Clicks, Total Commissions
  - [x] 7.3 Each card shows value + period-over-period delta
  - [x] 7.4 Reuse MetricCard component from dashboard (reuse from 9-1)
  - [x] 7.5 Handle loading state with skeleton

- [x] Task 8: Implement affiliate performance table (AC: #1, #5)
  - [x] 8.1 Create `AffiliatePerformanceTable` component
  - [x] 8.2 Columns: Affiliate Name (with status badge), Email, Clicks, Conversions, Conversion Rate, Commissions, Status
  - [x] 8.3 Sortable columns (click header to sort)
  - [x] 8.4 Row click opens affiliate detail view
  - [x] 8.5 Format numbers with locale (currency for commissions)
  - [x] 8.6 Handle empty state
  - [x] 8.7 Highlight top 3 performers with visual indicator

- [x] Task 9: Implement affiliate detail view (AC: #6)
  - [x] 9.1 Create `AffiliateDetailView` component (modal or dedicated section)
  - [x] 9.2 Header: affiliate name, email, status, unique code
  - [x] 9.3 Metrics grid: detailed affiliate stats
  - [x] 9.4 Trend chart section
  - [x] 9.5 Campaign breakdown table for this affiliate
  - [x] 9.6 Commission breakdown by status (pie/donut chart or bar)

- [x] Task 10: Implement trend chart (AC: #6)
  - [x] 10.1 Create `AffiliateTrendChart` component using SVG (no heavy chart library)
  - [x] 10.2 Line/area chart with clicks and conversions over time
  - [x] 10.3 X-axis: time labels
  - [x] 10.4 Y-axis: value scale
  - [x] 10.5 Hover tooltips showing exact values
  - [x] 10.6 Responsive sizing

- [x] Task 11: Implement date range selector (AC: #3)
  - [x] 11.1 Reuse `DateRangeSelector` component from 9-1/9-2
  - [x] 11.2 Preset options: 7 days, 30 days, 90 days, Custom
  - [x] 11.3 Custom option opens date picker
  - [x] 11.4 Update URL params on selection
  - [x] 11.5 Read initial value from URL params

- [x] Task 12: Implement export functionality (AC: #7)
  - [x] 12.1 Connect Export CSV button to export action
  - [x] 12.2 Show loading state during export
  - [x] 12.3 Trigger browser download with filename: `affiliate-performance-YYYY-MM-DD.csv`
  - [x] 12.4 Apply RBAC - hide button for viewers

- [x] Task 13: Implement RBAC controls (AC: #8)
  - [x] 13.1 Get user role from session/auth context
  - [x] 13.2 Hide commission amounts for Viewer role
  - [x] 13.3 Disable export button for Viewer role
  - [x] 13.4 Show read-only indicator for viewers

## Dev Notes

### CRITICAL: Existing Infrastructure - DO NOT Recreate

The following already exist and MUST be leveraged:

| Component | Location | Purpose |
|-----------|----------|---------|
| Sidebar | `src/app/(auth)/layout.tsx` | Navigation sidebar with nav items |
| Topbar | `src/app/(auth)/layout.tsx` | Header with title, actions |
| Layout | `src/app/(auth)/layout.tsx` | Protected route wrapper |
| Convex Client | `src/app/ConvexClientProvider.tsx` | Convex provider setup |
| Auth | `src/lib/auth.ts`, `src/lib/auth-client.ts` | Better Auth configuration |
| Dashboard Queries | `convex/dashboard.ts` | Reference for query patterns |
| Reports Queries | `convex/reports.ts` | Campaign performance queries (add affiliate queries here) |
| Tier Service | `convex/tierConfig.ts` | Tier config service |
| getAuthenticatedUser | `convex/tenantContext.ts` | Auth context helper |
| DateRangeSelector | `src/app/(auth)/dashboard/components/DateRangeSelector.tsx` | Reuse for date filtering |
| MetricCard | `src/app/(auth)/dashboard/components/MetricCard.tsx` | Reuse for summary cards |
| CampaignFilterDropdown | `src/app/(auth)/reports/campaigns/components/CampaignFilterDropdown.tsx` | Reuse for campaign filter |
| Skeleton | `src/components/ui/skeleton.tsx` | Loading component |

### Previous Story Learnings (from 9-2-campaign-performance-metrics)

**What Worked Well:**
- Using async iteration and batch fetching to avoid N+1 queries
- Pre-fetching all related data upfront and using Map for lookups
- Date range filtering passed to all queries consistently
- RBAC checks at query level with `canViewSensitiveData` flag
- Period-over-period comparison provides useful context
- Lightweight SVG charts (no heavy chart library)
- Reusing components from previous stories (DateRangeSelector, MetricCard)

**Common Mistakes to Avoid:**
- Do NOT use `.collect()` followed by per-item queries - fetch all data upfront
- Do NOT hardcode fake data - all metrics must come from real queries
- Do NOT skip loading states - show skeletons while fetching
- Do NOT forget RBAC - check user permissions before showing financial data
- Do NOT use `<a>` tags for internal navigation - use Next.js `<Link>` components
- Do NOT skip URL params for filters - preserve state in URL
- Do NOT create duplicate sidebar/layout - use existing `(auth)/layout.tsx`
- Do NOT use heavy chart libraries - implement lightweight SVG charts

### Backend Queries Needed

Add to existing `convex/reports.ts` file:

#### 1. `getAffiliatePerformanceList`

```typescript
export const getAffiliatePerformanceList = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    campaignId: v.optional(v.id("campaigns")),
    sortBy: v.optional(v.union(
      v.literal("clicks"),
      v.literal("conversions"),
      v.literal("conversionRate"),
      v.literal("commissions"),
      v.literal("name")
    )),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.array(v.object({
    _id: v.id("affiliates"),
    name: v.string(),
    email: v.string(),
    uniqueCode: v.string(),
    status: v.string(),
    clicks: v.number(),
    conversions: v.number(),
    conversionRate: v.number(),
    totalCommissions: v.number(),
  })),
  handler: async (ctx, args) => {
    // 1. Verify user access and RBAC
    // 2. Fetch all affiliates for tenant
    // 3. Fetch all clicks, conversions, commissions for tenant (filtered by campaign if provided)
    // 4. Aggregate metrics per affiliate using Maps
    // 5. Calculate conversion rate
    // 6. Apply RBAC mask for sensitive data
    // 7. Sort by requested column
    // 8. Return enriched affiliate list
  },
});
```

#### 2. `getAffiliateSummaryMetrics`

```typescript
export const getAffiliateSummaryMetrics = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.object({
    totalAffiliates: v.number(),
    activeAffiliates: v.number(),
    pendingAffiliates: v.number(),
    totalClicks: v.number(),
    totalConversions: v.number(),
    totalCommissions: v.number(),
    avgConversionRate: v.number(),
    // Previous period for comparison
    previousTotalClicks: v.number(),
    previousTotalConversions: v.number(),
    previousTotalCommissions: v.number(),
  }),
  handler: async (ctx, args) => {
    // 1. Verify access and RBAC
    // 2. Aggregate across all affiliates
    // 3. Calculate period-over-period deltas
    // 4. Return summary metrics
  },
});
```

#### 3. `getAffiliatePerformanceDetails`

```typescript
export const getAffiliatePerformanceDetails = query({
  args: {
    affiliateId: v.id("affiliates"),
    dateRange: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
  },
  returns: v.object({
    affiliate: v.object({
      _id: v.id("affiliates"),
      name: v.string(),
      email: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      promotionChannel: v.optional(v.string()),
    }),
    metrics: v.object({
      clicks: v.number(),
      conversions: v.number(),
      conversionRate: v.number(),
      totalCommissions: v.number(),
      commissionBreakdown: v.object({
        confirmed: v.number(),
        pending: v.number(),
        reversed: v.number(),
      }),
    }),
    campaignBreakdown: v.array(v.object({
      _id: v.id("campaigns"),
      name: v.string(),
      clicks: v.number(),
      conversions: v.number(),
      commissions: v.number(),
    })),
    trendData: v.array(v.object({
      date: v.number(),
      clicks: v.number(),
      conversions: v.number(),
      commissions: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    // 1. Verify access and affiliate ownership
    // 2. Get affiliate details
    // 3. Aggregate metrics for this affiliate
    // 4. Get campaign breakdown for this affiliate
    // 5. Generate trend data points
    // 6. Return comprehensive affiliate detail
  },
});
```

### Data Aggregation Strategy

To avoid N+1 queries, use the following pattern (from 9-2):

```typescript
// 1. Fetch all base data upfront
const allAffiliates = await ctx.db
  .query("affiliates")
  .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
  .collect();

const allClicks = await ctx.db
  .query("clicks")
  .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
  .collect();

const allConversions = await ctx.db
  .query("conversions")
  .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
  .collect();

const allCommissions = await ctx.db
  .query("commissions")
  .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
  .collect();

// 2. Build aggregation maps
const clickCountsByAffiliate = new Map<Id<"affiliates">, number>();
const conversionCountsByAffiliate = new Map<Id<"affiliates">, number>();
const commissionTotalsByAffiliate = new Map<Id<"affiliates">, number>();

// 3. Aggregate in single passes
for (const click of allClicks) {
  if (isInDateRange(click._creationTime, dateRange)) {
    clickCountsByAffiliate.set(
      click.affiliateId,
      (clickCountsByAffiliate.get(click.affiliateId) ?? 0) + 1
    );
  }
}
// Repeat for conversions, commissions...

// 4. Build final results with pre-aggregated data
return allAffiliates.map(affiliate => ({
  ...affiliate,
  clicks: clickCountsByAffiliate.get(affiliate._id) ?? 0,
  conversions: conversionCountsByAffiliate.get(affiliate._id) ?? 0,
  // etc.
}));
```

### UI Design Reference

Primary design: `_bmad-output/screens/06-owner-reports.html`

Adapt the reports screen for affiliate-specific metrics:

**Key Design Elements:**
1. **Period Tabs**: Horizontal tabs (7 days, 30 days, 90 days, All time) - REUSE from 9-2
2. **Campaign Filter**: Dropdown above metrics - REUSE from 9-2
3. **Metrics Grid** (4 columns):
   - Total Affiliates (blue)
   - Active Affiliates (green)
   - Total Clicks (amber)
   - Total Commissions (gray)
4. **Affiliate Performance Table**:
   - Affiliate Name (with status badge)
   - Email
   - Unique Code
   - Clicks
   - Conversions
   - Conversion Rate
   - Commissions (₱)
   - Status
5. **Affiliate Detail View** (when affiliate selected):
   - Affiliate header with status
   - Trend chart (line/area)
   - Campaign breakdown table
   - Commission breakdown

**Color System (CSS Variables):**
```css
--brand-primary: #10409a;
--brand-secondary: #1659d6;
--brand-dark: #022232;
--text-heading: #333333;
--text-body: #474747;
--text-muted: #6b7280;
--bg-page: #f2f2f2;
--bg-surface: #ffffff;
--border: #e5e7eb;
--success: #10b981;
--warning: #f59e0b;
--danger: #ef4444;
--blue: #3b82f6;
```

**Status Badge Colors:**
- Active: Green background (#d1fae5), green text (#065f46)
- Pending: Yellow background (#fef3c7), amber text (#92400e)
- Suspended: Red background (#fee2e2), red text (#991b1b)
- Rejected: Gray background (#f3f4f6), gray text (#374151)

**Typography:**
- Font: Poppins (Google Fonts)
- Metric values: 26px, weight 700, tabular-nums
- Metric labels: 11px, weight 600, uppercase
- Table headers: 11px, weight 600, uppercase
- Table cells: 13px

**Top Performer Highlighting:**
- Row 1: Gold rank badge (#fbbf24 background)
- Row 2: Silver rank badge (#d1d5db background)
- Row 3: Bronze rank badge (#f59e0b background)

### File Structure

```
src/app/(auth)/reports/
├── affiliates/
│   ├── page.tsx                           # Affiliate performance page
│   └── components/
│       ├── AffiliateMetricsSummary.tsx     # Summary cards
│       ├── AffiliatePerformanceTable.tsx   # Affiliates table
│       ├── AffiliateDetailView.tsx         # Detail view modal/section
│       ├── AffiliateTrendChart.tsx         # Line/area chart
│       └── index.ts                        # Component exports

convex/
└── reports.ts                             # ADD affiliate queries to existing file
```

### RBAC Requirements

This story requires Manager+ role for full access:
- **Owner**: Full access to all affiliate performance features
- **Manager**: Can view all data and export
- **Viewer**: Read-only access with sensitive data hidden (commission amounts)

Implementation: Check user role from session and conditionally:
- Mask commission amounts for Viewer role
- Disable export button for Viewer role
- Show read-only indicator

### Anti-Pattern Prevention

**DO NOT:**
- Recreate existing queries - check `convex/reports.ts`, add to existing file
- Use N+1 query patterns - fetch all data upfront
- Hardcode placeholder data - all metrics must come from real database queries
- Skip loading states - show skeletons/spinners while fetching
- Forget error handling - handle query failures gracefully
- Create duplicate sidebar/layout - use existing `(auth)/layout.tsx`
- Ignore RBAC - check user permissions before showing financial data
- Use heavy chart libraries - implement lightweight SVG charts
- Create new DateRangeSelector - reuse from dashboard
- Create new MetricCard - reuse from dashboard
- Create new CampaignFilterDropdown - reuse from reports/campaigns

### Project Structure Notes

- Reports page should be at `src/app/(auth)/reports/affiliates/page.tsx`
- Layout wrapper is in `src/app/(auth)/layout.tsx` - USE this
- Use Radix UI components from `src/components/ui/`
- Use Tailwind CSS v4 utility patterns
- Client components use `"use client"` directive

### Schema References

**Affiliates Table:**
```typescript
affiliates: {
  tenantId: Id<"tenants">,
  email: string,
  name: string,
  uniqueCode: string,
  status: "active" | "suspended" | "pending" | "rejected",
  // ...
}
```

**Clicks Table (by_affiliate index):**
```typescript
clicks: {
  tenantId: Id<"tenants">,
  affiliateId: Id<"affiliates">,
  campaignId?: Id<"campaigns">,
  // ...
}
```

**Conversions Table (by_affiliate index):**
```typescript
conversions: {
  tenantId: Id<"tenants">,
  affiliateId: Id<"affiliates">,
  campaignId?: Id<"campaigns">,
  amount: number,
  // ...
}
```

**Commissions Table (by_affiliate index):**
```typescript
commissions: {
  tenantId: Id<"tenants">,
  affiliateId: Id<"affiliates">,
  campaignId: Id<"campaigns">,
  amount: number,
  status: "pending" | "confirmed" | "reversed",
  // ...
}
```

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#L1603-1618`] - Story definition and acceptance criteria
- [Source: `_bmad-output/screens/06-owner-reports.html`] - Reports UI design specification
- [Source: `_bmad-output/planning-artifacts/architecture.md#L436-462`] - Project structure and boundaries
- [Source: `_bmad-output/project-context.md`] - Technology stack and coding standards
- [Source: `convex/schema.ts`] - Database schema for queries
- [Source: `convex/reports.ts`] - Existing reports queries (add affiliate queries here)
- [Source: `convex/tenantContext.ts`] - getAuthenticatedUser helper
- [Source: `_bmad-output/implementation-artifacts/9-2-campaign-performance-metrics.md`] - Previous story patterns and learnings
- [Source: `_bmad-output/implementation-artifacts/9-1-dashboard-overview.md`] - Reusable components (DateRangeSelector, MetricCard)

## Dev Agent Record

### Agent Model Used

kimi-k2.5

### Debug Log References

- N/A - No debug issues encountered

### Completion Notes List

- **2026-03-16**: Implemented all 13 tasks for affiliate performance metrics
- Backend queries follow the same pattern as Story 9-2 (Campaign Performance) with aggregation using Maps to avoid N+1 queries
- Frontend components reuse existing DateRangeSelector, MetricCard, and CampaignFilterDropdown from previous stories
- Implemented lightweight SVG charts (AffiliateTrendChart) without heavy chart libraries
- RBAC controls implemented at both backend (query level) and frontend (UI masking) levels
- Export functionality generates CSV with proper formatting and browser download

### File List

**New Files:**
- `convex/reports.ts` - Extended with 5 new functions:
  - `getAffiliatePerformanceList` - List affiliates with metrics
  - `getAffiliateSummaryMetrics` - Summary cards data
  - `getAffiliatePerformanceDetails` - Single affiliate detail
  - `getAffiliateTrendData` - Trend chart data points
  - `exportAffiliatePerformanceCSV` - CSV export action
  - `getAffiliateExportData` - Helper query for export
- `src/app/(auth)/reports/affiliates/page.tsx` - Main page component
- `src/app/(auth)/reports/affiliates/components/index.ts` - Component exports
- `src/app/(auth)/reports/affiliates/components/AffiliateMetricsSummary.tsx` - Summary cards
- `src/app/(auth)/reports/affiliates/components/AffiliatePerformanceTable.tsx` - Data table
- `src/app/(auth)/reports/affiliates/components/AffiliateDetailView.tsx` - Detail view
- `src/app/(auth)/reports/affiliates/components/AffiliateTrendChart.tsx` - SVG chart
- `src/app/api/export-affiliates/route.ts` - API route for export

**Modified Files:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated story status to `in-progress` then `review`
- `_bmad-output/implementation-artifacts/9-3-affiliate-performance-metrics.md` - Updated task checkboxes and completion notes

### Change Log

**2026-03-16** - Story implementation complete
- Added 5 new Convex queries/actions for affiliate performance metrics
- Built responsive reports page with summary cards, data table, and detail view
- Implemented lightweight SVG trend charts without external dependencies
- Added CSV export functionality with RBAC controls
- Integrated with existing date range selector and campaign filter components
- Applied period-over-period comparison for metrics
- Highlighted top 3 performers with gold/silver/br rank badges
- Status: ready-for-dev → review
