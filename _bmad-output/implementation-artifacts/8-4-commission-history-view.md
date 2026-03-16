# Story 8.4: Commission History View

Status: done

## Story

As an affiliate,
I want to view the history and status of all my commissions,
so that I can track my earnings and understand my payout timeline. (FR40)

## Acceptance Criteria

### AC1: Commission List Display
**Given** the affiliate is on the Earnings page
**When** the page loads
**Then** a list of all commissions is displayed
**And** each commission shows amount, status, date, and customer context (plan type)

### AC2: Status Filter
**Given** the affiliate wants to filter commissions
**When** they select a status filter
**Then** the list is filtered to show only matching commissions

### AC3: Pending Commission Display
**Given** a commission is pending
**When** displayed
**Then** the status badge shows "Pending" with appropriate styling (amber color)
**And** an explanation of the review process is available

### AC4: Confirmed Commission Hero Card
**Given** a commission is recently confirmed
**When** the affiliate views the list
**Then** the most recent confirmed commission displays prominently as a hero card (screenshot-shareable)
**And** the hero card includes: amount, brand, customer plan, date, share button

### AC5: Commission Detail Drawer
**Given** the affiliate clicks on a commission
**When** the drawer opens
**Then** full commission details are displayed
**And** details include: amount, status, plan, date, rate, billing event type, referral code, payout info

### AC6: Period Filter Tabs
**Given** the affiliate wants to filter by time period
**When** they select a period tab (All Time, This Month, Last Month, etc.)
**Then** the commission list is filtered to that period
**And** the selected tab is highlighted

### AC7: Total Earnings Summary
**Given** the affiliate is on the Earnings page
**When** the page loads
**Then** a hero section displays: Total Lifetime Earnings, Paid Out amount, Pending amount, Commission Rate
**And** values are computed from actual commission data

### AC8: Payout Banner
**Given** the affiliate has a pending payout balance
**When** the Earnings page loads
**Then** a banner displays: upcoming payout amount, payout schedule info

### AC9: Load More Pagination
**Given** the affiliate has more commissions than displayed
**When** they click "Load more"
**Then** additional commissions are loaded
**And** the remaining count is shown

### AC10: Share Commission Win
**Given** a confirmed commission hero card
**When** the affiliate clicks "Share this win"
**Then** the Web Share API is invoked with commission details
**Or** a fallback prompt to screenshot is shown (on desktop)

## Tasks / Subtasks

- [x] Task 1: Create/update backend query for commission history (AC: #1, #6, #7)
  - [x] 1.1 Use existing `getAffiliateCommissions` query from `convex/commissions.ts`
  - [x] 1.2 Ensure query returns all fields needed: amount, status, createdAt, campaign name, plan type
  - [x] 1.3 Add period filtering support (this month, last month, all time, etc.)
  - [x] 1.4 Validate affiliate belongs to session tenant

- [x] Task 2: Create earnings summary query (AC: #7)
  - [x] 2.1 Create `getAffiliateEarningsSummary` query in `convex/affiliateAuth.ts`
  - [x] 2.2 Return: totalEarnings, paidOut, pendingBalance, commissionRate, confirmedCount, pendingCount
  - [x] 2.3 Calculate totals from commission records (sum amounts by status)

- [x] Task 3: Implement period filter tabs component (AC: #6)
  - [x] 3.1 Create `PeriodFilterTabs` component
  - [x] 3.2 Tabs: All Time, This Month, Last Month, Last 3 Months
  - [x] 3.3 Active state management with URL params or local state
  - [x] 3.4 Pass selected period to backend query

- [x] Task 4: Implement total earnings hero section (AC: #7)
  - [x] 4.1 Create `EarningsHero` component with gradient background
  - [x] 4.2 Display: Total Lifetime Earnings (large number)
  - [x] 4.3 Sub-stats grid: Paid Out, Pending, Commission Rate
  - [x] 4.4 Apply tenant brand color to gradient

- [x] Task 5: Implement payout banner component (AC: #8)
  - [x] 5.1 Create `PayoutBanner` component
  - [x] 5.2 Display: upcoming payout amount, schedule info
  - [x] 5.3 Show only when pending balance > 0
  - [x] 5.4 Green/success styling

- [x] Task 6: Implement commission list component (AC: #1)
  - [x] 6.1 Create `CommissionList` component
  - [x] 6.2 Fetch data using `getAffiliateCommissions` query
  - [x] 6.3 Map status to badge colors (confirmed=green, pending=amber, reversed=red, paid=gray)
  - [x] 6.4 Show loading skeleton while fetching
  - [x] 6.5 Handle empty state (no commissions yet)

- [x] Task 7: Implement confirmed commission hero card (AC: #4)
  - [x] 7.1 Create `ConfirmedCommissionCard` component
  - [x] 7.2 Display most recent confirmed commission prominently
  - [x] 7.3 Include: brand icon, amount, customer plan, date, share button
  - [x] 7.4 Dark gradient background with decorative circles

- [x] Task 8: Implement commission detail drawer (AC: #5)
  - [x] 8.1 Create `CommissionDetailDrawer` component using Radix Dialog
  - [x] 8.2 Display: amount, status badge, plan details, date, rate, billing event
  - [x] 8.3 Show payout info section (status, expected date, method)
  - [x] 8.4 Close button and backdrop click to close

- [x] Task 9: Implement status filter dropdown (AC: #2)
  - [x] 9.1 Create `StatusFilter` component
  - [x] 9.2 Options: All, Confirmed, Pending, Reversed, Paid
  - [x] 9.3 Update query filter when selection changes

- [x] Task 10: Implement share functionality (AC: #10)
  - [x] 10.1 Use Web Share API for mobile/native sharing
  - [x] 10.2 Fallback to alert/prompt on desktop
  - [x] 10.3 Include referral link in share text

- [x] Task 11: Integrate navigation components (AC: #1)
  - [x] 11.1 Import PortalHeader from `src/components/affiliate/PortalHeader.tsx`
  - [x] 11.2 Import PortalBottomNav from `src/components/affiliate/PortalBottomNav.tsx`
  - [x] 11.3 Import PortalSidebar from `src/components/affiliate/PortalSidebar.tsx`
  - [x] 11.4 Set active state to "Earnings" in navigation

- [x] Task 12: Apply tenant branding (All ACs)
  - [x] 12.1 Fetch tenant context using `getAffiliateTenantContext` query
  - [x] 12.2 Apply tenant's primary color as CSS variable `--brand`
  - [x] 12.3 Use tenant's logo in header
  - [x] 12.4 Ensure NO salig-affiliate branding (white-label)

## Dev Notes

### CRITICAL: Existing Backend Functions - DO NOT RECREATE

 The following Convex functions already exist and MUST be used:

 | Function | File | Purpose |
 |----------|------|---------|
 | `getAffiliateCommissions` | `convex/commissions.ts:529-603` | Returns commission history with campaign names |
 | `getAffiliateTenantContext` | `convex/affiliateAuth.ts:668-702` | Returns tenant branding |
 | `getCurrentAffiliate` | `convex/affiliateAuth.ts` | Returns current affiliate data |
 | `validateAffiliateSession` | `convex/affiliateAuth.ts:539-581` | Session validation |

 ### New Query Needed: `getAffiliateEarningsSummary`

 Create this query in `convex/affiliateAuth.ts`:

 ```typescript
 export const getAffiliateEarningsSummary = query({
   args: {
     affiliateId: v.id("affiliates"),
   },
   returns: v.object({
     totalEarnings: v.number(),
     paidOut: v.number(),
     pendingBalance: v.number(),
     confirmedCount: v.number(),
     pendingCount: v.number(),
     commissionRate: v.number(), // Average or default rate
   }),
   handler: async (ctx, args) => {
     // 1. Validate affiliate session
     // 2. Query all commissions for this affiliate
     // 3. Calculate totals by status
     // 4. Return summary object
   },
 });
 ```

 ### Modifying Existing Query for Period Filter

 The existing `getAffiliateCommissions` query needs a `period` argument added:

 ```typescript
 args: {
   affiliateId: v.id("affiliates"),
   limit: v.optional(v.number()),
   period: v.optional(v.string()), // "all" | "this_month" | "last_month" | "last_3_months"
   status: v.optional(v.string()), // "all" | "confirmed" | "pending" | "reversed" | "paid"
 },
 ```

 ### Period Calculation Helpers

 ```typescript
 function getPeriodRange(period: string): { start: number; end: number } | null {
   const now = Date.now();
   const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
   const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
   const endOfLastMonth = startOfMonth - 1;
   const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).getTime();

   switch (period) {
     case "this_month":
       return { start: startOfMonth, end: now };
     case "last_month":
       return { start: startOfLastMonth, end: endOfLastMonth };
     case "last_3_months":
       return { start: threeMonthsAgo, end: now };
     default:
       return null; // All time
   }
 }
 ```

 ### UI Design Reference

 Primary design: `_bmad-output/screens/10-portal-earnings.html`

 **Key Design Elements:**
 1. **Header**: Tenant-branded with logo icon + portal name + "Earnings" page title
 2. **Payout Banner** (conditional):
     - Green background with money emoji
     - "Payout Coming Soon" message
     - Pending payout amount displayed
     - Payout schedule info
  3. **Total Earnings Hero**:
     - Gradient background (brand color to lighter blue)
     - Large "Total Lifetime Earnings" amount
     - Subtext: "Across X confirmed commissions"
     - 3-column stats grid: Paid Out, Pending, Commission Rate
  4. **Period Filter Tabs**:
     - Horizontal scrolling tabs
     - Options: All Time, This Month, Last Month, Last 3 Months
     - Active tab highlighted with brand color
  5. **Commission List Section**:
     - Section header: "Commission History — [Month Year]"
     - **Confirmed Commission Hero Card** (first confirmed commission):
       - Dark gradient background
       - Brand icon + program name
       - "Commission Confirmed ✓" badge
       - Large amount display
       - "Recurring · every month" label
       - Meta grid: Customer Plan, Confirmed Date, Rate
       - "Share this win" + "View Details" buttons
     - **Regular Commission Items**:
       - White background with border
       - Title + customer plan description
       - Amount (right-aligned, color-coded by status)
       - Status badge + date in footer
  6. **Commission Detail Drawer**:
     - Slide-in from right
     - Header with close button
     - Large amount + status badge centered
     - Details section: Plan, Date, Rate, Billing Event, Referral Code
     - Payout info section: Status, Expected Date, Payout Method
  7. **Load More Button**:
     - Centered at bottom
     - Shows remaining count
     - Pill-shaped button

 **Status Badge Colors:**
 - **Confirmed**: Green background (#d1fae5), green text (#065f46), green dot
 - **Pending**: Yellow background (#fef3c7), amber text (#92400e), amber dot
 - **Reversed**: Red background (#fee2e2), red text (#991b1b), red dot
 - **Paid**: Gray background (#f3f4f6), gray text (#374151), gray dot

 **Color System (CSS Variables):**
 ```css
 --brand: #10409a;          /* Tenant's primary color - dynamic */
 --brand-light: #eff6ff;
 --brand-dark: #0c2e6e;
 --text-heading: #1a1a2e;
 --text-body: #474747;
 --text-muted: #6b7280;
 --bg-page: #f8fafc;
 --bg-surface: #ffffff;
 --border: #e5e7eb;
 --success: #10b981;
 --warning: #f59e0b;
 --danger: #ef4444;
 --info: #3b82f6;
 ```

 **Typography:**
 - Font: Poppins (already configured)
 - Hero earnings value: 36px, weight 900
 - Hero stats: 18px, weight 700
 - Section titles: 14px, weight 700
 - Card amounts: 15-40px, weight 800-900
 - Badge text: 11-12px, weight 600-700

 **Spacing & Sizing:**
 - Hero section padding: 24px
 - Card padding: 14-24px
 - Card border-radius: 12-16px
 - Button border-radius: 8-999px
 - Bottom nav height: 64px
 - Sidebar width: 220px
 - Content max-width: 640px (mobile), 720px (desktop)

 ### Session Management Pattern

 Follow the established pattern from previous stories:

 ```typescript
 const [session, setSession] = useState<AffiliateSession | null>(null);
 const [isLoading, setIsLoading] = useState(true);

 useEffect(() => {
   async function fetchSession() {
     try {
       const response = await fetch("/api/affiliate-auth/session", {
         method: "GET",
         credentials: "include",
       });
       if (response.ok) {
         const data = await response.json();
         setSession(data.session);
       }
     } catch (error) {
       console.error("Failed to fetch session:", error);
     } finally {
       setIsLoading(false);
     }
   }
   fetchSession();
 }, []);
 ```

 ### File Structure

 ```
 src/app/portal/earnings/
 ├── page.tsx                        # Main page component
 └── components/
     ├── EarningsHero.tsx           # Total earnings hero section
     ├── PayoutBanner.tsx          # Payout notification banner
     ├── PeriodFilterTabs.tsx      # Period filter tabs
     ├── CommissionList.tsx        # Commission list with items
     ├── ConfirmedCommissionCard.tsx # Hero card for confirmed commission
     ├── CommissionItem.tsx        # Regular commission item row
     ├── CommissionDetailDrawer.tsx # Commission detail drawer/dialog
     └── StatusFilter.tsx         # Status filter dropdown

 src/components/affiliate/
 ├── PortalHeader.tsx             # EXISTS from 8-1
 ├── PortalBottomNav.tsx         # EXISTS from 8-2
 └── PortalSidebar.tsx           # EXISTS from 8-2

 convex/
 └── affiliateAuth.ts             # Add getAffiliateEarningsSummary query
 └── commissions.ts               # MODIFY getAffiliateCommissions to add period/status filters
 ```

 ### Toast Notifications

 Use sonner (already installed) for toast notifications:
 ```typescript
 import { toast } from "sonner";

 // Usage
 toast.success("Commission details loaded");
 toast.error("Failed to load commissions");
 ```

 ### White-Label Requirement

 **CRITICAL**: The portal MUST reflect the tenant's brand, NOT salig-affiliate:
 - Use tenant's logo (fallback to initial if no logo)
 - Use tenant's primary color as CSS `--brand` variable
 - Use tenant's `portalName` in header
 - NO salig-affiliate branding anywhere visible to affiliates

 ### Anti-Pattern Prevention

 **DO NOT:**
 - Recreate existing Convex queries - use the ones listed above
 - Add salig-affiliate branding to the portal
 - Hardcode fake data - all statistics must come from real queries
 - Skip loading states - show skeletons/spinners while fetching
 - Forget error handling - handle query failures gracefully
 - Mix authentication contexts - this is affiliate portal, not SaaS Owner

 ### Previous Story Intelligence (8-3: Real-Time Statistics Dashboard)

 From the previous story implementation:
 - Session management pattern established in `page.tsx`
 - Tenant branding fetched via `getAffiliateTenantContext` query
 - Navigation components: PortalHeader, PortalBottomNav, PortalSidebar already exist
 - Time-based greeting helper exists (can reuse pattern)
 - Error handling with error state and error banner UI
 - Responsive layout: sidebar for desktop, bottom nav for mobile
 - Used Next.js Link components for navigation
 - Loading skeletons shown while fetching data

 ### Performance Considerations

 - Use pagination for commission list (don't load all at once)
 - Query should use indexes (by_affiliate index exists on commissions table)
 - Consider caching tenant branding in component state
 - Real-time updates via Convex subscriptions

 ### Project Structure Notes

 - Follow existing component patterns in `src/components/affiliate/`
 - Use Radix UI components from `src/components/ui/`
 - Use Tailwind CSS v4 utility patterns
 - Client components use `"use client"` directive
 - All navigation links should use Next.js `Link` component

 ### References

 - [Source: `_bmad-output/planning-artifacts/epics.md#L1451-1470`] - Story definition and acceptance criteria
 - [Source: `_bmad-output/screens/10-portal-earnings.html`] - UI design specification
 - [Source: `convex/commissions.ts:529-603`] - getAffiliateCommissions query
 - [Source: `convex/affiliateAuth.ts:668-702`] - getAffiliateTenantContext query
 - [Source: `src/app/portal/home/page.tsx`] - Session management pattern from 8-3
 - [Source: `src/components/affiliate/PortalHeader.tsx`] - Header component from 8-1
 - [Source: `_bmad-output/planning-artifacts/architecture.md#L155-158`] - Authentication split pattern
 - [Source: `_bmad-output/project-context.md`] - Project coding standards

 ## Change Log

 - **2026-03-16**: Story created with comprehensive context from epic analysis
   - Analyzed Epic 8 requirements and previous story learnings
   - Extracted UI design patterns from 10-portal-earnings.html
   - Documented existing backend functions to reuse
   - Status: ready-for-dev

 ## Dev Agent Record

 ### Agent Model Used

 {{agent_model_name_version}}

 ### Debug Log References

  ### Completion Notes List

**Implementation Summary:**
- Created all frontend components for the Commission History View feature
- Modified existing backend query to support period and status filtering
- Created new backend query for earnings summary
- Integrated tenant branding support with dynamic CSS variables
- Implemented responsive design with mobile-first approach
- Used existing navigation components from previous stories (8-1, 8-2, 8-3)
- Implemented Web Share API with fallback for desktop

**Key Technical Decisions:**
- Used period filtering with date range calculation helper functions
- Created loading skeletons for better UX
- Used URL params for period filter persistence
- Applied tenant primary color to hero sections and gradients
- Used Radix UI Dialog for commission detail drawer
- Implemented status-based color coding for commission items

**Testing Notes:**
- Dev server runs successfully at localhost:3001
- Earnings page redirects to login as expected for unauthenticated users
- Convex functions compile without errors

  ### File List

**New Files Created:**
- `src/app/portal/earnings/page.tsx` - Main earnings page component
- `src/app/portal/earnings/components/PeriodFilterTabs.tsx` - Period filter tabs component
- `src/app/portal/earnings/components/EarningsHero.tsx` - Total earnings hero section
- `src/app/portal/earnings/components/PayoutBanner.tsx` - Payout notification banner
- `src/app/portal/earnings/components/StatusFilter.tsx` - Status filter dropdown
- `src/app/portal/earnings/components/CommissionList.tsx` - Commission list with items
- `src/app/portal/earnings/components/CommissionItem.tsx` - Regular commission item row
- `src/app/portal/earnings/components/ConfirmedCommissionCard.tsx` - Hero card for confirmed commission
- `src/app/portal/earnings/components/CommissionDetailDrawer.tsx` - Commission detail drawer

**Modified Files:**
- `convex/commissions.ts` - Modified `getAffiliateCommissions` to add period/status filtering and referralCode
- `convex/affiliateAuth.ts` - Added `getAffiliateEarningsSummary` query, fixed pendingBalance calculation, added commission rate from campaigns
- `convex/affiliateAuth.test.ts` - Added comprehensive tests for getAffiliateEarningsSummary (see Review Follow-ups)

  ### Review Follow-ups (AI)

**Code Review Fixes Applied (2026-03-16):**

- [x] [AI-Review][CRITICAL] Fixed pendingBalance calculation - was incorrectly including confirmed commissions
- [x] [AI-Review][HIGH] Added pending commission explanation section to CommissionDetailDrawer (AC3)
- [x] [AI-Review][HIGH] Added referral link to share functionality (AC10)
- [x] [AI-Review][HIGH] Created comprehensive unit tests for getAffiliateEarningsSummary query
- [x] [AI-Review][MEDIUM] Fixed adjustColor placeholder function with actual implementation
- [x] [AI-Review][MEDIUM] Fixed loading state pattern (useEffect instead of useState)
- [x] [AI-Review][MEDIUM] Fixed type safety issues (removed 'as any', added proper Id types)
- [x] [AI-Review][MEDIUM] Implemented actual commission rate calculation from campaigns (was returning 0)
- [x] [AI-Review][MEDIUM] Fixed TypeScript errors - replaced non-existent affiliateCampaigns table query with proper logic using commissionOverrides and campaigns table
- [x] [AI-Review][LOW] Added referralCode field to getAffiliateCommissions return type
