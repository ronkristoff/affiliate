# Story 9.1: Dashboard Overview

Status: done

## Story

As a SaaS Owner or Manager,
I want to view a dashboard overview of program performance,
so that I can quickly understand my program's health. (FR58)

## Acceptance Criteria

### AC1: Key Metrics Display
**Given** the user is on the Dashboard page
**When** the page loads
**Then** key metrics are displayed: MRR influenced, active affiliates, pending commissions, total paid out
**And** metrics are computed from real data (not placeholders)
**And** MRR influenced shows monetary value of affiliate-referred subscriptions

### AC2: Recent Activity Feed
**Given** the user is viewing the dashboard
**When** new events occur (commissions, affiliate signups, payouts)
**Then** the activity feed updates automatically via Convex real-time subscription
**And** no page refresh is required
**And** activity items show type, description, time ago

### AC3: Top Affiliates Table
**Given** the user views the dashboard
**When** there are active affiliates with conversions
**Then** a table shows top performing affiliates
**And** columns displayed: name, clicks, conversions, revenue, status
**And** affiliates sorted by revenue (highest first)

### AC4: Quick Actions Panel
**Given** the user wants to perform common tasks
**When** the dashboard loads
**Then** quick action buttons are available
**And** actions include: Invite Affiliate, Pay All Pending, New Campaign, Export Report
**And** buttons are styled consistently with brand design

### AC5: Plan Usage Widget
**Given** the user has a subscription with limits
**When** viewing the dashboard
**Then** a usage widget shows current usage vs limits
**And** metrics shown: affiliates used, campaigns used
**And** visual progress bar indicates usage percentage
**And** upgrade prompt shown when approaching limits

### AC6: Alert Banner for Setup Tasks
**Given** the user has incomplete setup tasks
**When** viewing the dashboard
**Then** alert banners display pending tasks (e.g., "Tracking snippet not verified")
**And** banners are dismissible after task completed
**And** links in banners navigate to relevant settings pages

### AC7: Recent Commissions Table
**Given** the user has recent commissions
**When** viewing the dashboard
**Then** a table shows recent commissions
**And** columns displayed: affiliate, amount, status, date
**And** status badges use semantic colors (Confirmed=green, Pending=amber, Reversed=red)
**And** "Pay All Pending" button available when there are pending commissions

### AC8: Date Range Filter
**Given** the user wants to filter dashboard data
**When** they click the date range selector
**Then** preset options are available (Last 7 days, Last 30 days, Last 90 days, Custom)
**And** all metrics update based on selected range
**And** URL updates to preserve selection

## Tasks / Subtasks

- [x] Task 1: Create backend queries for dashboard statistics (AC: #1, #2, #3)
  - [x] 1.1 Create `getOwnerDashboardStats` query in `convex/dashboard.ts`
  - [x] 1.2 Return: mrrInfluenced, activeAffiliatesCount, pendingCommissionsCount, totalPaidOut, recentClicks, recentConversions
  - [x] 1.3 Include period filtering support (thisMonth, lastMonth, last90Days)
  - [x] 1.4 Calculate MRR from confirmed commissions with subscription amounts
  - [x] 1.5 Validate user has Manager+ role for access

- [x] Task 2: Create backend query for recent activity feed (AC: #2)
  - [x] 2.1 Create `getRecentActivity` query in `convex/dashboard.ts`
  - [x] 2.2 Return combined feed: recent commissions, affiliate signups, payouts
  - [x] 2.3 Each item includes: type, title, description, amount, timestamp, icon type
  - [x] 2.4 Sort by timestamp descending, limit to 20 items
  - [x] 2.5 Filter by tenant and date range

- [x] Task 3: Create backend query for top affiliates (AC: #3)
  - [x] 3.1 Create `getTopAffiliates` query in `convex/dashboard.ts`
  - [x] 3.2 Return: affiliate data with clicks, conversions, revenue, status
  - [x] 3.3 Calculate affiliate performance metrics
  - [x] 3.4 Sort by revenue descending, limit to 10
  - [x] 3.5 Filter by tenant and date range

- [x] Task 4: Create backend query for recent commissions (AC: #7)
  - [x] 4.1 Create `getRecentCommissions` query in `convex/dashboard.ts`
  - [x] 4.2 Return: affiliate name, amount, status, date, plan context
  - [x] 4.3 Join with affiliate and campaign data
  - [x] 4.4 Sort by date descending, limit to 10
  - [x] 4.5 Filter by tenant and date range

- [x] Task 5: Create backend query for plan usage (AC: #5)
  - [x] 5.1 Create `getPlanUsage` query in `convex/dashboard.ts`
  - [x] 5.2 Return: affiliateCount, maxAffiliates, campaignCount, maxCampaigns
  - [x] 5.3 Get limits from `getTierConfig()` service
  - [x] 5.4 Calculate usage percentages
  - [x] 5.5 Include warning thresholds (80%, 95%)

- [x] Task 6: Create backend query for setup status (AC: #6)
  - [x] 6.1 Create `getSetupStatus` query in `convex/dashboard.ts`
  - [x] 6.2 Return: trackingSnippetInstalled, saligPayConnected, firstCampaignCreated
  - [x] 6.3 Check relevant tenant and campaign data

- [x] Task 7: Build dashboard page layout (AC: #1, #4, #5)
  - [x] 7.1 Create `src/app/(auth)/dashboard/page.tsx` (update existing)
  - [x] 7.2 Use existing sidebar navigation (from layout.tsx)
  - [x] 7.3 Implement responsive grid layout for metric cards
  - [x] 7.4 Add date range selector in topbar
  - [x] 7.5 Set active nav item to "Overview"

- [x] Task 8: Implement metric cards component (AC: #1)
  - [x] 8.1 Create `MetricCard` component with color variants (blue, green, yellow, gray)
  - [x] 8.2 Display: label, value, delta (change indicator), subtext
  - [x] 8.3 Use semantic colors per metric type
  - [x] 8.4 Implement 4-column grid layout
  - [x] 8.5 Handle loading state with skeleton

- [x] Task 9: Implement recent commissions table (AC: #7)
  - [x] 9.1 Create `RecentCommissionsTable` component
  - [x] 9.2 Columns: affiliate (avatar + name + email), amount, status badge, date, actions
  - [x] 9.3 Status badges with semantic colors
  - [x] 9.4 "Pay All Pending" button with count badge
  - [x] 9.5 "View All" link to commissions page
  - [x] 9.6 Handle empty state

- [x] Task 10: Implement top affiliates table (AC: #3)
  - [x] 10.1 Create `TopAffiliatesTable` component
  - [x] 10.2 Columns: affiliate, clicks, conversions, revenue, status badge
  - [x] 10.3 Format numbers with locale (₱ for currency)
  - [x] 10.4 "View All" link to affiliates page
  - [x] 10.5 Handle empty state

- [x] Task 11: Implement quick actions panel (AC: #4)
  - [x] 11.1 Create `QuickActionsPanel` component
  - [x] 11.2 2x2 grid of action buttons
  - [x] 11.3 Actions: Invite Affiliate, Pay All, New Campaign, Export Report
  - [x] 11.4 Each shows icon, label, subtext
  - [x] 11.5 Hover effects with brand color

- [x] Task 12: Implement activity feed component (AC: #2)
  - [x] 12.1 Create `ActivityFeed` component
  - [x] 12.2 Activity items with icon, text, time
  - [x] 12.3 Map activity types to icons and colors
  - [x] 12.4 "View All" link to activity log
  - [x] 12.5 Handle empty state

- [x] Task 13: Implement plan usage widget (AC: #5)
  - [x] 13.1 Create `PlanUsageWidget` component
  - [x] 13.2 Progress bars for affiliates and campaigns
  - [x] 13.3 Show count vs limit (e.g., "47 / 5,000")
  - [x] 13.4 Warning styling when approaching limits
  - [x] 13.5 Plan badge (e.g., "Growth")

- [x] Task 14: Implement alert banner component (AC: #6)
  - [x] 14.1 Create `AlertBanner` component
  - [x] 14.2 Warning icon + message + CTA link
  - [x] 14.3 Yellow background, dismissible
  - [x] 14.4 Multiple banners can stack
  - [x] 14.5 Links navigate to relevant settings pages

- [x] Task 15: Implement date range selector (AC: #8)
  - [x] 15.1 Create `DateRangeSelector` component
  - [x] 15.2 Dropdown with preset options + custom date picker
  - [x] 15.3 Update URL params on selection
  - [x] 15.4 Read initial value from URL params
  - [x] 15.5 Display current selection (e.g., "Last 30 days")

- [x] Task 16: Integrate all components (AC: #1-8)
  - [x] 16.1 Fetch all dashboard data with useQuery hooks
  - [x] 16.2 Handle loading states with skeletons
  - [x] 16.3 Handle error states gracefully
  - [x] 16.4 Pass date range filter to all queries
  - [x] 16.5 Wire up quick action buttons to navigation/mutations

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
| Tier Service | `convex/tiers.ts` | `getTierConfig()` for plan limits |
| Commission Queries | `convex/commissions.ts` | Commission data access |
| Affiliate Queries | `convex/affiliates.ts` | Affiliate data access |
| Tenant Queries | `convex/tenants.ts` | Tenant data access |

### Backend Queries Needed

Create a NEW file `convex/dashboard.ts` with all dashboard queries:

#### 1. `getOwnerDashboardStats`

```typescript
export const getOwnerDashboardStats = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
  },
  returns: v.object({
    mrrInfluenced: v.number(),
    activeAffiliatesCount: v.number(),
    pendingCommissionsCount: v.number(),
    pendingCommissionsValue: v.number(),
    totalPaidOut: v.number(),
    recentClicks: v.number(),
    recentConversions: v.number(),
    // Period comparison
    previousPeriodMrr: v.number(),
    mrrChangePercent: v.number(),
  }),
  handler: async (ctx, args) => {
    // 1. Get tenant's active campaigns
    // 2. Get affiliates with status "active"
    // 3. Get commissions with status "confirmed" and sum amounts
    // 4. Get commissions with status "pending" and count/value
    // 5. Get paid payouts and sum amounts
    // 6. Get clicks in date range
    // 7. Get conversions in date range
    // 8. Calculate MRR from subscription amounts in conversions
  },
});
```

#### 2. `getRecentActivity`

```typescript
export const getRecentActivity = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.string(),
    type: v.string(), // "commission_confirmed" | "commission_pending" | "affiliate_signup" | "payout_sent" | "self_referral_detected" | "saligpay_reconnected"
    title: v.string(),
    description: v.string(),
    amount: v.optional(v.number()),
    status: v.optional(v.string()),
    timestamp: v.number(),
    iconType: v.string(), // "green" | "amber" | "blue" | "red"
  })),
  handler: async (ctx, args) => {
    // Combine recent events from:
    // 1. Commissions (confirmed, pending, reversed)
    // 2. Affiliate signups (pending approval)
    // 3. Payouts (completed)
    // 4. Fraud signals (self-referral)
    // 5. SaligPay connections
    // Merge, sort by timestamp, limit
  },
});
```

#### 3. `getTopAffiliates`

```typescript
export const getTopAffiliates = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("affiliates"),
    name: v.string(),
    email: v.string(),
    handle: v.optional(v.string()),
    clicks: v.number(),
    conversions: v.number(),
    revenue: v.number(),
    status: v.string(),
  })),
  handler: async (ctx, args) => {
    // 1. Get all active affiliates for tenant
    // 2. For each affiliate, aggregate clicks, conversions, confirmed commission amounts
    // 3. Sort by revenue descending
    // 4. Limit to 10
  },
});
```

#### 4. `getRecentCommissions`

```typescript
export const getRecentCommissions = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("commissions"),
    affiliateId: v.id("affiliates"),
    affiliateName: v.string(),
    affiliateEmail: v.string(),
    campaignName: v.string(),
    amount: v.number(),
    status: v.string(),
    createdAt: v.number(),
    planContext: v.optional(v.string()), // e.g., "Pro Plan · $29/mo"
  })),
  handler: async (ctx, args) => {
    // 1. Query commissions with tenant filter
    // 2. Join with affiliates for name/email
    // 3. Join with campaigns for name
    // 4. Sort by creation time descending
    // 5. Limit to 10
  },
});
```

#### 5. `getPlanUsage`

```typescript
export const getPlanUsage = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.object({
    planName: v.string(),
    affiliateCount: v.number(),
    maxAffiliates: v.number(),
    campaignCount: v.number(),
    maxCampaigns: v.number(),
    affiliateUsagePercent: v.number(),
    campaignUsagePercent: v.number(),
    affiliateWarning: v.optional(v.boolean()),
    campaignWarning: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    // 1. Get tenant's plan
    // 2. Call getTierConfig() for limits
    // 3. Count active affiliates
    // 4. Count active campaigns
    // 5. Calculate percentages
    // 6. Set warning flags at 80%+
  },
});
```

#### 6. `getSetupStatus`

```typescript
export const getSetupStatus = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.object({
    trackingSnippetInstalled: v.boolean(),
    saligPayConnected: v.boolean(),
    firstCampaignCreated: v.boolean(),
    firstAffiliateApproved: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // 1. Check tenant's trackingSnippetInstalled flag
    // 2. Check tenant's saligPayCredentials existence
    // 3. Check if any campaigns exist
    // 4. Check if any approved affiliates exist
  },
});
```

### UI Design Reference

Primary design: `_bmad-output/screens/01-owner-dashboard.html`

**Key Design Elements:**
1. **Sidebar** (240px fixed): Dark brand color, tenant avatar, navigation items with badges
2. **Topbar**: Page title, date range selector, Export CSV, Invite Affiliate buttons
3. **Alert Banner** (optional): Yellow warning banner for incomplete setup tasks
4. **Metrics Grid** (4 columns):
   - MRR Influenced (blue)
   - Active Affiliates (green)
   - Pending Commissions (yellow)
   - Total Paid Out (gray)
5. **Main Grid** (2 columns):
   - Left: Recent Commissions table + Top Affiliates table
   - Right: Quick Actions + Activity Feed + Plan Usage

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
- Confirmed: Green background (#d1fae5), green text (#065f46)
- Pending: Yellow background (#fef3c7), amber text (#92400e)
- Reversed: Red background (#fee2e2), red text (#991b1b)
- Paid: Gray background (#f3f4f6), gray text (#374151)
- Active: Green background (#d1fae5), green text (#065f46)
- Processing: Blue background (#dbeafe), blue text (#1e40af)

**Typography:**
- Font: Poppins (Google Fonts)
- Metric values: 28px, weight 700, tabular-nums
- Metric labels: 12px, weight 600, uppercase, tracking-wide
- Table headers: 11px, weight 600, uppercase
- Table cells: 13px

**Spacing & Sizing:**
- Sidebar width: 240px
- Card border-radius: 12px
- Button border-radius: 8px
- Metric card padding: 20-22px
- Page padding: 28-32px

### Previous Story Learnings (from 8-3-real-time-statistics-dashboard)

**What Worked Well:**
- Using async iteration (`for await`) instead of `.collect()` for large datasets reduces memory pressure
- Skeleton loading states improve perceived performance
- Period-over-period comparison with delta badges provides context
- Tenant branding application via CSS variables works smoothly

**Common Mistakes to Avoid:**
- Do NOT recreate existing Convex queries - check for existing functions first
- Do NOT use `<a>` tags for internal navigation - use Next.js `<Link>` components
- Do NOT skip loading states - show skeletons while fetching
- Do NOT forget error handling - handle query failures gracefully
- Do NOT hardcode fake data - all statistics must come from real queries

**Code Patterns to Follow:**
- Use `useQuery` from `convex/react` for real-time data
- Handle loading with `data === undefined` check
- Use `cn()` from `@/lib/utils` for conditional classes
- Format currency with `new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })`
- Use relative time formatting for activity feeds

### File Structure

```
src/app/(auth)/dashboard/
├── page.tsx                              # Main dashboard page (update existing)
└── components/
    ├── MetricCard.tsx                    # Metric display card
    ├── RecentCommissionsTable.tsx        # Commissions table
    ├── TopAffiliatesTable.tsx            # Top affiliates table
    ├── QuickActionsPanel.tsx             # Quick action buttons
    ├── ActivityFeed.tsx                  # Activity timeline
    ├── PlanUsageWidget.tsx               # Plan usage progress
    ├── AlertBanner.tsx                   # Setup warning banner
    └── DateRangeSelector.tsx             # Date filter dropdown

convex/
└── dashboard.ts                          # NEW FILE - all dashboard queries
```

### RBAC Requirements

This story requires theManager+ role for full access:
- **Owner**: Full access to all dashboard features
- **Manager**: Can view dashboard and metrics, can approve commissions
- **Viewer**: Read-only access to dashboard (cannot see Pay All button)

Implementation: Check user role from session and conditionally render action buttons.

### Anti-Pattern Prevention

**DO NOT:**
- Recreate existing Convex queries - check `convex/affiliates.ts`, `convex/commissions.ts`, etc.
- Hardcode placeholder data - all metrics must come from real database queries
- Skip loading states - show skeletons/spinners while fetching
- Forget error handling - handle query failures with retry buttons
- Mix up date filtering - use consistent date range across all queries
- Create duplicate sidebar/layout - use existing `(auth)/layout.tsx`
- Ignore RBAC - check user permissions before showing action buttons

### Project Structure Notes

- Dashboard page exists at `src/app/(auth)/dashboard/page.tsx` - UPDATE this file
- Layout wrapper is in `src/app/(auth)/layout.tsx` - USE this
- Use Radix UI components from `src/components/ui/`
- Use Tailwind CSS v4 utility patterns
- Client components use `"use client"` directive

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#L1567-1582`] - Story definition and acceptance criteria
- [Source: `_bmad-output/screens/01-owner-dashboard.html`] - Complete UI design specification
- [Source: `_bmad-output/planning-artifacts/architecture.md#L436-462`] - Project structure and boundaries
- [Source: `_bmad-output/project-context.md`] - Technology stack and coding standards
- [Source: `convex/schema.ts`] - Database schema for queries
- [Source: `convex/tiers.ts`] - getTierConfig() service for plan limits
- [Source: `convex/commissions.ts`] - Existing commission queries
- [Source: `convex/affiliates.ts`] - Existing affiliate queries
- [Source: `_bmad-output/implementation-artifacts/8-3-real-time-statistics-dashboard.md`] - Previous story patterns and learnings

## Dev Agent Record

### Agent Model Used

kimi-k2.5

### Debug Log References

- No debug issues encountered during implementation

### Completion Notes List

- [2026-03-16] Story 9.1 Dashboard Overview implementation complete
  - Created 6 Convex backend queries in `convex/dashboard.ts`
  - Built 8 React components for dashboard UI
  - All acceptance criteria satisfied (AC1-AC8)
  - TypeScript compilation successful with no errors
  - Components support real-time data via Convex subscriptions
  - Date range filtering working across all queries
  - Loading states and empty states implemented
  - Responsive layout implemented for all screen sizes

### File List

**New Files:**
- `convex/dashboard.ts` - Backend queries (getOwnerDashboardStats, getRecentActivity, getTopAffiliates, getRecentCommissions, getPlanUsage, getSetupStatus)
- `src/components/ui/skeleton.tsx` - Skeleton loading component
- `src/app/(auth)/dashboard/components/MetricCard.tsx` - Metric display card with variants
- `src/app/(auth)/dashboard/components/RecentCommissionsTable.tsx` - Recent commissions table
- `src/app/(auth)/dashboard/components/TopAffiliatesTable.tsx` - Top affiliates table
- `src/app/(auth)/dashboard/components/QuickActionsPanel.tsx` - Quick action buttons
- `src/app/(auth)/dashboard/components/ActivityFeed.tsx` - Real-time activity feed
- `src/app/(auth)/dashboard/components/PlanUsageWidget.tsx` - Plan usage progress widget
- `src/app/(auth)/dashboard/components/AlertBanner.tsx` - Setup task alert banners
- `src/app/(auth)/dashboard/components/DateRangeSelector.tsx` - Date range filter dropdown
- `src/app/(auth)/dashboard/components/index.ts` - Component exports

**Modified Files:**
- `src/app/(auth)/dashboard/page.tsx` - Main dashboard page (complete rewrite)

## Change Log

- [2026-03-16] Initial implementation of Dashboard Overview (Story 9.1)
  - Implemented all 8 acceptance criteria
  - Created comprehensive dashboard with metrics, tables, and widgets
  - Added real-time activity feed using Convex subscriptions
  - Integrated date range filtering with URL persistence
  - Added plan usage tracking with warning indicators
  - Implemented setup task alert banners
  - All components support loading and empty states

- [2026-03-16] Code Review Fixes Applied (Story 9.1)
  - **FIXED**: N+1 query performance in getTopAffiliates - now fetches all data upfront
  - **FIXED**: N+1 query performance in getRecentActivity - now uses affiliate lookup map
  - **FIXED**: N+1 query performance in getRecentCommissions - now uses lookup maps
  - **FIXED**: MRR calculation now uses conversion amounts (not just commission amounts)
  - **ADDED**: RBAC role verification to all dashboard queries
  - **ADDED**: Frontend RBAC - Pay All button now hidden for Viewer role
  - **IMPROVED**: Sensitive data (amounts, payouts) now hidden from Viewer role
  - **CLEANUP**: Removed unused variable `sixtyDaysAgo`
