# Story 9.2: Campaign Performance Metrics

Status: done

## Story

As a SaaS Owner or Manager,
I want to view campaign-level performance metrics,
so that I can compare and optimize my campaigns. (FR59)

## Acceptance Criteria

### AC1: Campaign List with Performance Metrics
**Given** the user is on the Reports > Campaigns page
**When** the page loads
**Then** all campaigns are listed in a table with performance metrics
**And** metrics include: clicks, conversions, conversion rate, total commissions, active affiliates
**And** campaigns are sortable by any metric column
**And** campaigns show status badge (active, paused, archived)

### AC2: Campaign Performance Summary Cards
**Given** the user views the campaign performance page
**When** the page loads
**Then** summary cards display aggregate metrics across all campaigns
**And** cards show: Total Campaigns, Total Clicks, Total Conversions, Total Commissions
**And** each card shows period-over-period comparison

### AC3: Date Range Filtering
**Given** the user wants to analyze specific time periods
**When** they select a date range (7 days, 30 days, 90 days, custom)
**Then** all metrics update to reflect the selected period
**And** URL params preserve the date range selection

### AC4: Campaign Filter Dropdown
**Given** the user wants to filter by specific campaign
**When** they use the campaign dropdown filter
**Then** they can select a specific campaign to view detailed metrics
**Or** select "All Campaigns" to see aggregate view

### AC5: Campaign Detail View
**Given** the user selects a specific campaign
**When** they view campaign details
**Then** detailed metrics are displayed including:
- Click trend over time (line chart)
- Conversion funnel (clicks → conversions)
- Top performing affiliates for this campaign
- Commission breakdown by status
- Revenue attribution

### AC6: Trend Chart
**Given** the user views campaign details
**When** the detail view is displayed
**Then** a trend chart shows clicks and conversions over time
**And** chart supports hover tooltips with exact values
**And** chart has time axis labels

### AC7: Export CSV
**Given** the user wants to export campaign data
**When** they click "Export CSV"
**Then** a CSV file downloads with campaign performance data
**And** CSV includes all visible columns and filtered data

### AC8: RBAC Enforcement
**Given** the user has Viewer role
**When** viewing campaign performance
**Then** sensitive financial data (commission amounts) is hidden
**And** export button is disabled
**Given** the user has Manager or Owner role
**When** viewing campaign performance
**Then** all data is visible and export is enabled

## Tasks / Subtasks

- [x] Task 1: Create backend queries for campaign performance (AC: #1, #2, #3)
  - [x] 1.1 Create `getCampaignPerformanceList` query in `convex/reports.ts`
  - [x] 1.2 Return: campaignId, name, status, clicks, conversions, conversionRate, totalCommissions, activeAffiliates
  - [x] 1.3 Support date range filtering
  - [x] 1.4 Calculate conversion rate as (conversions / clicks) * 100
  - [x] 1.5 Implement RBAC check for sensitive data
  - [x] 1.6 Add sorting capability (by clicks, conversions, revenue)

- [x] Task 2: Create summary metrics query (AC: #2)
  - [x] 2.1 Create `getCampaignSummaryMetrics` query in `convex/reports.ts`
  - [x] 2.2 Return: totalCampaigns, totalClicks, totalConversions, totalCommissions, avgConversionRate
  - [x] 2.3 Include previous period comparison for delta calculation
  - [x] 2.4 Apply date range filtering

- [x] Task 3: Create campaign detail query (AC: #5, #6)
  - [x] 3.1 Create `getCampaignPerformanceDetails` query in `convex/reports.ts`
  - [x] 3.2 Return: campaign info + aggregated metrics + trend data points
  - [x] 3.3 Include top affiliates for this campaign
  - [x] 3.4 Include commission breakdown by status
  - [x] 3.5 Generate trend data points for chart (daily/weekly buckets)

- [x] Task 4: Create trend data query (AC: #6)
  - [x] 4.1 Create `getCampaignTrendData` query in `convex/reports.ts`
  - [x] 4.2 Return array of data points: date, clicks, conversions, commissions
  - [x] 4.3 Group by day for ranges ≤ 30 days, by week for longer ranges
  - [x] 4.4 Fill in missing dates with zero values for continuous chart

- [x] Task 5: Create CSV export action (AC: #7)
  - [x] 5.1 Create `exportCampaignPerformanceCSV` action in `convex/reports.ts`
  - [x] 5.2 Generate CSV with headers and all visible data
  - [x] 5.3 Apply date range and campaign filters to export data
  - [x] 5.4 Return base64-encoded CSV or signed URL for download

- [x] Task 6: Build reports page layout (AC: #1, #3, #4)
  - [x] 6.1 Create `src/app/(auth)/reports/campaigns/page.tsx`
  - [x] 6.2 Reuse existing sidebar layout from `(auth)/layout.tsx`
  - [x] 6.3 Add period tabs (7 days, 30 days, 90 days, custom)
  - [x] 6.4 Add campaign filter dropdown
  - [x] 6.5 Add Export CSV button in topbar
  - [x] 6.6 Set nav item to "Reports" active state

- [x] Task 7: Implement summary metrics cards (AC: #2)
  - [x] 7.1 Create `CampaignMetricsSummary` component
  - [x] 7.2 4-column grid: Total Campaigns, Total Clicks, Total Conversions, Total Commissions
  - [x] 7.3 Each card shows value + period-over-period delta
  - [x] 7.4 Use same MetricCard component from dashboard (reuse from 9-1)
  - [x] 7.5 Handle loading state with skeleton

- [x] Task 8: Implement campaign performance table (AC: #1)
  - [x] 8.1 Create `CampaignPerformanceTable` component
  - [x] 8.2 Columns: Campaign Name (with status badge), Clicks, Conversions, Conversion Rate, Commissions, Active Affiliates
  - [x] 8.3 Sortable columns (click header to sort)
  - [x] 8.4 Row click opens campaign detail view
  - [x] 8.5 Format numbers with locale (currency for commissions)
  - [x] 8.6 Handle empty state

- [x] Task 9: Implement campaign detail view (AC: #5)
  - [x] 9.1 Create `CampaignDetailView` component (modal or dedicated section)
  - [x] 9.2 Header: campaign name, status, description
  - [x] 9.3 Metrics grid: detailed campaign stats
  - [x] 9.4 Trend chart section
  - [x] 9.5 Top affiliates table for this campaign
  - [x] 9.6 Commission breakdown by status (pie/donut chart)

- [x] Task 10: Implement trend chart (AC: #6)
  - [x] 10.1 Create `CampaignTrendChart` component using SVG (no heavy chart library)
  - [x] 10.2 Line/area chart with clicks and conversions over time
  - [x] 10.3 X-axis: time labels
  - [x] 10.4 Y-axis: value scale
  - [x] 10.5 Hover tooltips showing exact values
  - [x] 10.6 Responsive sizing

- [x] Task 11: Implement date range selector (AC: #3)
  - [x] 11.1 Create `DateRangeSelector` component (reuse from 9-1 if available)
  - [x] 11.2 Preset options: 7 days, 30 days, 90 days, Custom
  - [x] 11.3 Custom option opens date picker
  - [x] 11.4 Update URL params on selection
  - [x] 11.5 Read initial value from URL params

- [x] Task 12: Implement export functionality (AC: #7)
  - [x] 12.1 Connect Export CSV button to export action
  - [x] 12.2 Show loading state during export
  - [x] 12.3 Trigger browser download with filename: `campaign-performance-YYYY-MM-DD.csv`
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
| Campaign Queries | `convex/campaigns.ts` | Campaign CRUD operations |
| Tier Service | `convex/tierConfig.ts` | Tier config service |
| getAuthenticatedUser | `convex/tenantContext.ts` | Auth context helper |

### Previous Story Learnings (from 9-1-dashboard-overview)

**What Worked Well:**
- Using async iteration and batch fetching to avoid N+1 queries
- Pre-fetching all related data upfront and using Map for lookups
- Date range filtering passed to all queries consistently
- RBAC checks at query level with `canViewSensitiveData` flag
- Period-over-period comparison provides useful context

**Common Mistakes to Avoid:**
- Do NOT use `.collect()` followed by per-item queries - fetch all data upfront
- Do NOT hardcode fake data - all metrics must come from real queries
- Do NOT skip loading states - show skeletons while fetching
- Do NOT forget RBAC - check user permissions before showing financial data
- Do NOT use `<a>` tags for internal navigation - use Next.js `<Link>` components
- Do NOT skip URL params for filters - preserve state in URL

### Backend Queries Needed

Create a NEW file `convex/reports.ts` for campaign performance queries:

#### 1. `getCampaignPerformanceList`

```typescript
export const getCampaignPerformanceList = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
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
    _id: v.id("campaigns"),
    name: v.string(),
    status: v.string(),
    description: v.optional(v.string()),
    clicks: v.number(),
    conversions: v.number(),
    conversionRate: v.number(),
    totalCommissions: v.number(),
    activeAffiliates: v.number(),
  })),
  handler: async (ctx, args) => {
    // 1. Verify user access and RBAC
    // 2. Fetch all campaigns for tenant
    // 3. Fetch all clicks, conversions, commissions for tenant
    // 4. Aggregate metrics per campaign using Maps
    // 5. Calculate conversion rate
    // 6. Apply RBAC mask for sensitive data
    // 7. Sort by requested column
    // 8. Return enriched campaign list
  },
});
```

#### 2. `getCampaignSummaryMetrics`

```typescript
export const getCampaignSummaryMetrics = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
  },
  returns: v.object({
    totalCampaigns: v.number(),
    activeCampaigns: v.number(),
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
    // 2. Aggregate across all campaigns
    // 3. Calculate period-over-period deltas
    // 4. Return summary metrics
  },
});
```

#### 3. `getCampaignPerformanceDetails`

```typescript
export const getCampaignPerformanceDetails = query({
  args: {
    campaignId: v.id("campaigns"),
    dateRange: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
  },
  returns: v.object({
    campaign: v.object({
      _id: v.id("campaigns"),
      name: v.string(),
      status: v.string(),
      description: v.optional(v.string()),
      commissionType: v.string(),
      commissionValue: v.number(),
    }),
    metrics: v.object({
      clicks: v.number(),
      conversions: v.number(),
      conversionRate: v.number(),
      totalCommissions: v.number(),
      activeAffiliates: v.number(),
      commissionBreakdown: v.object({
        confirmed: v.number(),
        pending: v.number(),
        reversed: v.number(),
      }),
    }),
    topAffiliates: v.array(v.object({
      _id: v.id("affiliates"),
      name: v.string(),
      email: v.string(),
      clicks: v.number(),
      conversions: v.number(),
      revenue: v.number(),
    })),
    trendData: v.array(v.object({
      date: v.number(),
      clicks: v.number(),
      conversions: v.number(),
      commissions: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    // 1. Verify access and campaign ownership
    // 2. Get campaign details
    // 3. Aggregate metrics for this campaign
    // 4. Get top affiliates for this campaign
    // 5. Generate trend data points
    // 6. Return comprehensive campaign detail
  },
});
```

### Data Aggregation Strategy

To avoid N+1 queries, use the following pattern (learned from 9-1):

```typescript
// 1. Fetch all base data upfront
const allCampaigns = await ctx.db
  .query("campaigns")
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
const clickCountsByCampaign = new Map<Id<"campaigns">, number>();
const conversionCountsByCampaign = new Map<Id<"campaigns">, number>();
const commissionTotalsByCampaign = new Map<Id<"campaigns">, number>>();

// 3. Aggregate in single passes
for (const click of allClicks) {
  if (click.campaignId && isInDateRange(click._creationTime, dateRange)) {
    clickCountsByCampaign.set(
      click.campaignId,
      (clickCountsByCampaign.get(click.campaignId) ?? 0) + 1
    );
  }
}
// Repeat for conversions, commissions...

// 4. Build final results with pre-aggregated data
return allCampaigns.map(campaign => ({
  ...campaign,
  clicks: clickCountsByCampaign.get(campaign._id) ?? 0,
  conversions: conversionCountsByCampaign.get(campaign._id) ?? 0,
  // etc.
}));
```

### UI Design Reference

Primary design: `_bmad-output/screens/06-owner-reports.html`

The reports screen shows a general analytics view. Adapt for campaign-specific:

**Key Design Elements:**
1. **Period Tabs**: Horizontal tabs (7 days, 30 days, 90 days, All time)
2. **Campaign Filter**: Dropdown above metrics
3. **Metrics Grid** (4 columns):
   - Total Campaigns (blue)
   - Total Clicks (green)
   - Total Conversions (amber)
   - Total Commissions (gray)
4. **Campaign Performance Table**:
   - Campaign Name (with status badge)
   - Clicks
   - Conversions
   - Conversion Rate
   - Commissions (₱)
   - Active Affiliates
5. **Campaign Detail View** (when campaign selected):
   - Campaign header with status
   - Trend chart (line/area)
   - Top affiliates table
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
- Paused: Yellow background (#fef3c7), amber text (#92400e)
- Archived: Gray background (#f3f4f6), gray text (#374151)

**Typography:**
- Font: Poppins (Google Fonts)
- Metric values: 26px, weight 700, tabular-nums
- Metric labels: 11px, weight 600, uppercase
- Table headers: 11px, weight 600, uppercase
- Table cells: 13px

### File Structure

```
src/app/(auth)/reports/
├── campaigns/
│   ├── page.tsx                           # Campaign performance page
│   └── components/
│       ├── CampaignMetricsSummary.tsx     # Summary cards
│       ├── CampaignPerformanceTable.tsx   # Campaigns table
│       ├── CampaignDetailView.tsx         # Detail view modal/section
│       ├── CampaignTrendChart.tsx         # Line/area chart
│       └── CampaignFilterDropdown.tsx     # Campaign selector

convex/
└── reports.ts                             # NEW FILE - all report queries
```

### RBAC Requirements

This story requires Manager+ role for full access:
- **Owner**: Full access to all campaign performance features
- **Manager**: Can view all data and export
- **Viewer**: Read-only access with sensitive data hidden (commission amounts)

Implementation: Check user role from session and conditionally:
- Mask commission amounts for Viewer role
- Disable export button for Viewer role
- Show read-only indicator

### Anti-Pattern Prevention

**DO NOT:**
- Recreate existing queries - check `convex/campaigns.ts`, `convex/dashboard.ts`
- Use N+1 query patterns - fetch all data upfront
- Hardcode placeholder data - all metrics must come from real database queries
- Skip loading states - show skeletons/spinners while fetching
- Forget error handling - handle query failures gracefully
- Create duplicate sidebar/layout - use existing `(auth)/layout.tsx`
- Ignore RBAC - check user permissions before showing financial data
- Use heavy chart libraries - implement lightweight SVG charts

### Project Structure Notes

- Reports page should be at `src/app/(auth)/reports/campaigns/page.tsx`
- Layout wrapper is in `src/app/(auth)/layout.tsx` - USE this
- Use Radix UI components from `src/components/ui/`
- Use Tailwind CSS v4 utility patterns
- Client components use `"use client"` directive

### Schema References

**Campaigns Table:**
```typescript
campaigns: {
  tenantId: Id<"tenants">,
  name: string,
  status: "active" | "paused" | "archived",
  commissionType: "percentage" | "flatFee",
  commissionValue: number,
  // ...
}
```

**Clicks Table (by_campaign index):**
```typescript
clicks: {
  tenantId: Id<"tenants">,
  campaignId?: Id<"campaigns">,
  affiliateId: Id<"affiliates">,
  // ...
}
```

**Conversions Table (by_campaign index):**
```typescript
conversions: {
  tenantId: Id<"tenants">,
  campaignId?: Id<"campaigns">,
  affiliateId: Id<"affiliates">,
  amount: number,
  // ...
}
```

**Commissions Table (by_campaign index):**
```typescript
commissions: {
  tenantId: Id<"tenants">,
  campaignId: Id<"campaigns">,
  affiliateId: Id<"affiliates">,
  amount: number,
  status: "pending" | "confirmed" | "reversed",
  // ...
}
```

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#L1584-1601`] - Story definition and acceptance criteria
- [Source: `_bmad-output/screens/06-owner-reports.html`] - Reports UI design specification
- [Source: `_bmad-output/planning-artifacts/architecture.md#L436-462`] - Project structure and boundaries
- [Source: `_bmad-output/project-context.md`] - Technology stack and coding standards
- [Source: `convex/schema.ts`] - Database schema for queries
- [Source: `convex/campaigns.ts`] - Existing campaign queries
- [Source: `convex/dashboard.ts`] - Query patterns with RBAC and date filtering
- [Source: `convex/tenantContext.ts`] - getAuthenticatedUser helper
- [Source: `_bmad-output/implementation-artifacts/9-1-dashboard-overview.md`] - Previous story patterns and learnings

## Dev Agent Record

### Agent Model Used

minimax-m2.5-free

### Debug Log References

N/A

### Completion Notes List

**Implementation Summary:**
- Created comprehensive campaign performance reporting system with all ACs satisfied
- Backend: 6 queries/actions in convex/reports.ts covering all data requirements
- Frontend: 4 React components + main page for campaign metrics
- RBAC: Full support for Viewer role (hides commission data, disables export)
- CSV Export: Base64-encoded CSV with proper formatting
- Sorting: All table columns sortable
- Date Range: URL param preservation with 5 preset options

**Key Technical Decisions:**
- Used Map-based aggregation to avoid N+1 queries (pattern from 9-1)
- Lightweight SVG trend chart (no heavy chart library)
- Reused existing DateRangeSelector from dashboard
- Reused MetricCard component for summary cards
- Action for CSV export with proper RBAC check

### Code Review Fixes (Auto-Applied)

**Critical Issues Fixed:**
1. **AC3 Violation**: Fixed URL params preservation on date range change - DateRangeSelector now properly updates URL
2. **Task 10 Incomplete**: Created separate `CampaignTrendChart.tsx` component as required
3. **AC4 Violation**: Fixed campaign filter to actually filter table data via backend query with campaignId parameter
4. **File List**: Added missing files (skeleton.tsx, dashboard page.tsx)

**Medium Issues Fixed:**
5. **AC6 Violation**: Added hover tooltips to trend chart showing exact click/conversion values
6. **AC2 Violation**: Added period-over-period delta to Total Campaigns card
7. **Unused Variable**: Removed unused tenantId from CampaignFilterDropdown
8. **AC8 Violation**: Added read-only indicator banner for Viewer role users
9. **Duplicate Sorting**: Removed client-side sorting, now using backend sort exclusively
10. **AC7 Violation**: Added Active Affiliates column to CSV export

**Low Issues Fixed:**
11. Added CONVERSION_SCALE_FACTOR constant for chart scaling
12. Updated component exports to include CampaignTrendChart

### File List

**New Files:**
- `convex/reports.ts` - Backend queries and action for campaign performance
- `src/app/(auth)/reports/campaigns/page.tsx` - Main reports page
- `src/app/(auth)/reports/campaigns/components/CampaignMetricsSummary.tsx` - Summary cards
- `src/app/(auth)/reports/campaigns/components/CampaignPerformanceTable.tsx` - Campaigns table
- `src/app/(auth)/reports/campaigns/components/CampaignDetailView.tsx` - Detail modal
- `src/app/(auth)/reports/campaigns/components/CampaignFilterDropdown.tsx` - Campaign filter
- `src/app/(auth)/reports/campaigns/components/CampaignTrendChart.tsx` - Trend chart with hover tooltips
- `src/app/(auth)/reports/campaigns/components/index.ts` - Component exports
- `src/components/ui/skeleton.tsx` - Skeleton loading component

**Modified Files:**
- `src/components/shared/SidebarNav.tsx` - Added Reports nav item
- `src/app/(auth)/dashboard/page.tsx` - Uses DateRangeSelector (dependency)
