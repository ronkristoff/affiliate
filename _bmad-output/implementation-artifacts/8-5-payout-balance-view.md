# Story 8.5: Payout Balance View

Status: done

## Story

As an affiliate,
I want to view my pending and paid payout balance with clear breakdown by status,
so that I know how much I've earned, what's awaiting review, what's confirmed for next payout, and what's already been paid. (FR41)

## Acceptance Criteria

### AC1: Balance Summary Display
**Given** the affiliate is on the Earnings page
**When** the page loads
**Then** a balance summary section is displayed at the top
**And** the summary shows three distinct balance states: Pending (in review), Confirmed (ready for payout), Total Paid Out

### AC2: Pending Balance (In Review)
**Given** the affiliate has commissions with "pending" status
**When** viewing the balance summary
**Then** the pending balance is displayed
**And** an explanation is shown that pending commissions are under review
**And** the count of pending commissions is shown

### AC3: Confirmed Balance (Ready for Payout)
**Given** the affiliate has commissions with "confirmed" status that have not been paid out
**When** viewing the balance summary
**Then** the confirmed balance is displayed prominently
**And** this represents commissions approved and ready for the next payout batch
**And** the count of confirmed commissions is shown

### AC4: Total Paid Out
**Given** the affiliate has received payouts
**When** viewing the balance summary
**Then** the total paid out amount is displayed
**And** this shows the historical sum of all completed payouts

### AC5: Expected Payout Date/Batch
**Given** the affiliate has a confirmed balance greater than zero
**When** viewing the balance summary
**Then** the expected payout date or next payout batch info is shown
**And** if the tenant has a payout schedule configured, it's displayed

### AC6: Payout Method Display
**Given** the affiliate has configured a payout method
**When** viewing the balance summary
**Then** the payout method is displayed (e.g., "GCash ••• XXXX")
**And** a link to update payout method is available

### AC7: Recent Payout History
**Given** the affiliate has received payouts
**When** they scroll down or expand the payouts section
**Then** recent payouts are listed with date, amount, and status
**And** each payout shows the batch reference or payment confirmation

## Tasks / Subtasks

- [x] Task 1: Update earnings summary query (AC: #1-4)
  - [x] 1.1 Modify `getAffiliateEarningsSummary` in `convex/affiliateAuth.ts`
  - [x] 1.2 Add `confirmedBalance` field to return type (sum of confirmed commissions not yet paid)
  - [x] 1.3 Add `nextPayoutDate` field (if tenant has payout schedule)
  - [x] 1.4 Keep `pendingBalance` as sum of "pending" status only (already correct)
  - [x] 1.5 Keep `paidOut` as sum of "paid" status commissions

- [x] Task 2: Create payout schedule query (AC: #5)
  - [x] 2.1 Create `getTenantPayoutSchedule` query in `convex/tenants.ts`
  - [x] 2.2 Return: payoutDayOfMonth, minimumPayoutAmount, payoutProcessingDays
  - [x] 2.3 Calculate next expected payout date based on current date

- [x] Task 3: Update PayoutBanner component (AC: #5)
  - [x] 3.1 Modify `src/app/portal/earnings/components/PayoutBanner.tsx`
  - [x] 3.2 Display confirmed balance instead of just "pending"
  - [x] 3.3 Show expected payout date from tenant schedule
  - [x] 3.4 Only show when confirmedBalance > 0

- [x] Task 4: Update EarningsHero component (AC: #1-4)
  - [x] 4.1 Modify `src/app/portal/earnings/components/EarningsHero.tsx`
  - [x] 4.2 Update grid to show three balance states clearly
  - [x] 4.3 Add labels: "Awaiting Review", "Ready for Payout", "Total Paid Out"
  - [x] 4.4 Display counts for each category

- [x] Task 5: Create payout history query (AC: #7)
  - [x] 5.1 Create `getAffiliatePayoutHistory` query in `convex/affiliateAuth.ts`
  - [x] 5.2 Return recent payouts with batch info and payment details
  - [x] 5.3 Order by paidAt descending

- [x] Task 6: Create PayoutHistory component (AC: #7)
  - [x] 6.1 Create `src/app/portal/earnings/components/PayoutHistory.tsx`
  - [x] 6.2 Display list of recent payouts
  - [x] 6.3 Each item shows: date, amount, status, batch reference
  - [x] 6.4 Collapsible/expandable section

- [x] Task 7: Add payout method display (AC: #6)
  - [x] 7.1 Create `PayoutMethodInfo` component
  - [x] 7.2 Show masked payout method details (e.g., "GCash ••• 4242")
  - [x] 7.3 Add link to Account page to update method

- [x] Task 8: Update main earnings page (All ACs)
  - [x] 8.1 Modify `src/app/portal/earnings/page.tsx`
  - [x] 8.2 Integrate updated components
  - [x] 8.3 Ensure proper data flow and loading states
  - [x] 8.4 Maintain tenant branding

## Dev Notes

### CRITICAL: Distinction Between Balance States

**This story clarifies the THREE distinct balance states:**

| Balance State | Commission Status | Meaning |
|---------------|-------------------|---------|
| **Pending Balance** | `pending` | Awaiting review/approval by SaaS Owner |
| **Confirmed Balance** | `confirmed` | Approved, ready for next payout batch |
| **Total Paid Out** | `paid` | Already distributed via payout batch |

**The previous story (8-4) conflated "Pending" with "Confirmed Balance". This story adds the proper distinction.**

### Current Implementation Analysis

The existing `getAffiliateEarningsSummary` query returns:
- `totalEarnings` - Sum of all commission amounts
- `paidOut` - Sum of commissions with `paid` status ✓
- `pendingBalance` - Sum of commissions with `pending` status ✓
- `confirmedCount` - Count of confirmed commissions
- `pendingCount` - Count of pending commissions

**MISSING**: `confirmedBalance` - Sum of commissions with `confirmed` status (not yet paid)

### Required Query Modification

```typescript
// In convex/affiliateAuth.ts - getAffiliateEarningsSummary

// Add to returns:
confirmedBalance: v.number(),

// Add to calculation:
let confirmedBalance = 0;

for (const commission of commissions) {
  totalEarnings += commission.amount;

  if (commission.status === "confirmed") {
    confirmedCount += 1;
    confirmedBalance += commission.amount; // NEW
  } else if (commission.status === "pending") {
    pendingCount += 1;
    pendingBalance += commission.amount;
  } else if (commission.status === "paid") {
    paidOut += commission.amount;
  }
}
```

### Payout Schedule System

Tenants may have a configured payout schedule:
- `payoutDayOfMonth`: Day of month payouts are processed (e.g., 1st, 15th)
- `minimumPayoutAmount`: Minimum balance required before payout
- `payoutProcessingDays`: Days to process after payout day

**New Query Needed:**
```typescript
// convex/tenants.ts
export const getTenantPayoutSchedule = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    payoutDayOfMonth: v.optional(v.number()),
    minimumPayoutAmount: v.optional(v.number()),
    payoutProcessingDays: v.optional(v.number()),
    nextPayoutDate: v.optional(v.number()),
    payoutScheduleNote: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return null;
    
    // Calculate next payout date based on current date
    // If payoutDayOfMonth is 1, next payout is the1st of next month
    // ... calculation logic
  },
});
```

### UI Design Updates

**Earnings Hero Section - Updated Grid:**
```
┌─────────────────────────────────────────────────────────────┐
│  TOTAL LIFETIME EARNINGS                                  │
│  ₱X,XXX                                                     │
│  Across X confirmed commissions                            │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ PAID OUT   │  │ CONFIRMED  │  │ PENDING    │           │
│  │ ₱X,XXX     │  │ ₱X,XXX    │  │ ₱X,XXX     │           │
│  │ X payouts  │  │ ready now  │  │ in review   │           │
│  └────────────┘  └────────────┘  └────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

**Payout Banner - Updated:**
```
┌─────────────────────────────────────────────────────────────┐
│ 💸 PAYOUT COMING SOON                                       │
│ Next payout: April 1, 2026 • ₱1,240 ready                  │
│ Your confirmed balance will be included                    │
└─────────────────────────────────────────────────────────────┘
```

**Payout History Section (NEW):**
```
┌─────────────────────────────────────────────────────────────┐
│ PAYOUT HISTORY                                              │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Mar 1, 2026    ₱580    ✓ Paid                           │ │
│ │ Batch #2026-03 • GCash ••• 4242                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Feb 1, 2026    ₱720    ✓ Paid                           │ │
│ │ Batch #2026-02 • GCash ••• 4242                        │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Status Badge Color System (Existing - No Changes)

- **Confirmed**: Green background (#d1fae5), green text (#065f46)
- **Pending**: Yellow background (#fef3c7), amber text (#92400e)
- **Paid**: Gray background (#f3f4f6), gray text (#374151)
- **Reversed**: Red background (#fee2e2), red text (#991b1b)

### File Structure

```
src/app/portal/earnings/
├── page.tsx                           # UPDATE: Integrate new components
└── components/
    ├── EarningsHero.tsx              # UPDATE: Add three balance states
    ├── PayoutBanner.tsx              # UPDATE: Show confirmed balance + expected date
    ├── PayoutMethodInfo.tsx          # NEW: Payout method display
    ├── PayoutHistory.tsx             # NEW: Recent payouts list
    ├── [existing components...]      # Keep from 8-4

convex/
├── affiliateAuth.ts                  # UPDATE: getAffiliateEarningsSummary - add confirmedBalance
└── tenants.ts                        # NEW: getTenantPayoutSchedule query
```

### White-Label Requirement

**CRITICAL**: All components must reflect tenant branding:
- Use tenant's primary color as CSS `--brand` variable
- Use tenant's logo in header
- Use tenant's `portalName` in display
- NO salig-affiliate branding visible to affiliates

### Anti-Pattern Prevention

**DO NOT:**
- Confuse "pending" (awaiting review) with "confirmed" (approved, awaiting payout)
- Recreate existing queries - modify the ones listed
- Hardcode fake balance data - all statistics must come from real queries
- Skip loading states - show skeletons while fetching
- Forget error handling - handle query failures gracefully
- Show negative balances - ensure all displayed amounts are non-negative

### Previous Story Intelligence (8-4: Commission History View)

From the previous story implementation:
- Session management pattern established in `page.tsx`
- Tenant branding fetched via `getAffiliateTenantContext` query
- Navigation components: PortalHeader, PortalBottomNav, PortalSidebar already exist
- Error handling with error state and error banner UI
- Responsive layout: sidebar for desktop, bottom nav for mobile
- Used Next.js Link components for navigation
- Loading skeletons shown while fetching data
- Toast notifications using sonner

### Database Tables Involved

| Table | Fields Used | Purpose |
|-------|------------|---------|
| `commissions` | status, amount, affiliateId | Calculate balance by status |
| `payouts` | amount, status, paidAt, batchId | Payout history |
| `payoutBatches` | status, generatedAt | Batch information |
| `affiliates` | payoutMethod | Payout method display |
| `tenants` | branding | Tenant payout schedule (future) |

### Performance Considerations

- Use indexed queries on commissions table (by_affiliate index exists)
- Paginate payout history (don't load all at once)
- Consider caching tenant payout schedule
- Real-time updates via Convex subscriptions

### Project Structure Notes

- Follow existing component patterns in `src/app/portal/earnings/`
- Use Radix UI components from `src/components/ui/`
- Use Tailwind CSS v4 utility patterns
- Client components use `"use client"` directive
- All amounts displayed as Philippine Peso (₱)

### Testing Considerations

- Test with no commissions (all zeros)
- Test with only pending commissions
- Test with only confirmed commissions
- Test with mix of statuses
- Test with paid out commissions
- Test payout history with multiple batches

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#L1473-1488`] - Story definition and acceptance criteria
- [Source: `_bmad-output/screens/10-portal-earnings.html`] - UI design specification
- [Source: `convex/affiliateAuth.ts:1120-1226`] - getAffiliateEarningsSummary query (needs modification)
- [Source: `convex/schema.ts:272-283`] - payouts and payoutBatches tables
- [Source: `src/app/portal/earnings/components/EarningsHero.tsx`] - Existing hero component (needs update)
- [Source: `src/app/portal/earnings/components/PayoutBanner.tsx`] - Existing banner component (needs update)
- [Source: `_bmad-output/project-context.md`] - Project coding standards

- [Source: `_bmad-output/implementation-artifacts/8-4-commission-history-view.md`] - Previous story context

- [Source: `_bmad-output/planning-artifacts/architecture.md#L155-158`] - Authentication split pattern

- [Source: `convex/affiliateAuth.ts:668-702`] - getAffiliateTenantContext query

## Change Log

- **2026-03-16**: Story created with comprehensive context from epic analysis
  - Analyzed Epic 8 requirements and previous story learnings
  - Identified the need for three distinct balance states
  - Clarified pending vs confirmed balance terminology
  - Documented required query modifications
  - Status: ready-for-dev

- **2026-03-16**: Implemented payout balance view features
  - Added confirmedBalance and paidOutCount to getAffiliateEarningsSummary
  - Created getTenantPayoutSchedule query with next payout date calculation
  - Updated EarningsHero to show three balance states
  - Updated PayoutBanner to show confirmed balance and payout date
  - Created PayoutHistory and PayoutMethodInfo components
  - Integrated all components in earnings page
  - Status: review

- **2026-03-16**: Code review fixes applied
  - Fixed getAffiliateEarningsSummary to remove SaaS owner auth dependency (affiliate portal uses session-based auth)
  - Fixed getAffiliatePayoutHistory auth pattern to match affiliate portal pattern
  - Fixed PayoutMethodInfo masking logic - now shows "GCash •••• 4567" format correctly
  - Added totalCount to earnings summary and display in EarningsHero
  - Fixed payout method data flow - session API now returns payoutMethod and payoutMethodLastDigits
  - Updated getCurrentAffiliate query to include payout method fields
  - Status: done

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- **Task 1**: Updated `getAffiliateEarningsSummary` query to add `confirmedBalance` and `paidOutCount` fields. Confirmed commissions now properly tracked separately from pending commissions.
- **Task 2**: Created `getTenantPayoutSchedule` query in `convex/tenants.ts` with payout schedule fields added to schema. Calculates next payout date based on current date and payout day of month.
- **Task 3**: Updated `PayoutBanner` component to show confirmed balance and expected payout date. Only displays when confirmedBalance > 0.
- **Task 4**: Updated `EarningsHero` component with three balance states: "Total Paid Out", "Ready for Payout", and "Awaiting Review". Each displays count and amount.
- **Task 5**: Created `getAffiliatePayoutHistory` query to fetch recent payouts with batch information.
- **Task 6**: Created `PayoutHistory` component with collapsible/expandable section showing recent payouts with date, amount, status, and batch reference.
- **Task 7**: Created `PayoutMethodInfo` component showing masked payout method details and link to update.
- **Task 8**: Updated main earnings page to integrate all components with proper data flow and tenant branding.

### File List

- `convex/affiliateAuth.ts` - Updated getAffiliateEarningsSummary query (added confirmedBalance, totalCount, fixed auth), added getAffiliatePayoutHistory query, updated getCurrentAffiliate (added payoutMethod fields)
- `convex/tenants.ts` - Added getTenantPayoutSchedule query
- `src/app/portal/earnings/page.tsx` - Integrated all new components
- `src/app/portal/earnings/components/EarningsHero.tsx` - Updated with three balance states and total count
- `src/app/portal/earnings/components/PayoutBanner.tsx` - Updated to show confirmed balance
- `src/app/portal/earnings/components/PayoutHistory.tsx` - NEW - Recent payouts list
- `src/app/portal/earnings/components/PayoutMethodInfo.tsx` - NEW - Payout method display (fixed masking logic)
- `src/app/api/affiliate-auth/session/route.ts` - Updated to return payout method data
