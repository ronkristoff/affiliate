# Story 13.5: Payout History View

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a SaaS Owner,
I want to view the full payout history,
so that I can track all past payments. (FR49)

## Acceptance Criteria

1. **Payout History Page — Batch List** (AC: #1)
   - Given the SaaS Owner navigates to `/payouts/history`
   - When the page loads
   - Then all past payout batches are listed in a data table sorted by generation date (newest first)
   - And each batch row displays: Batch ID (monospace code), Date (generated), Number of affiliates, Total amount, Status badge
   - And the table uses proper `font-variant-numeric: tabular-nums` for amount columns
   - And an empty state is shown when no batches exist: "No payout history yet. Generate your first payout batch from the Payouts page."
   - And a link/button to navigate back to `/payouts` is provided

2. **Batch Detail View** (AC: #2)
   - Given the SaaS Owner clicks on a batch row
   - When the detail view opens (reuse existing Dialog pattern from Story 13.3)
   - Then all individual payouts in the batch are displayed in a table
   - And each payout shows: affiliate name, email, payout method, commission count, amount, status (pending/paid), payment reference (if any), paid date (if paid)
   - And a progress bar shows paid/total ratio
   - And "Mark All as Paid" button is available for batches with pending payouts
   - And CSV download is available for the batch

3. **Pagination** (NFR2 — Performance)
   - Given many batches exist (>20)
   - When the page loads
   - Then batches are paginated (20 per page default)
   - And page navigation controls are displayed at the bottom of the table

4. **Status Filtering** (UX Enhancement)
   - Given the SaaS Owner views the history page
   - When status filter tabs are displayed (All / Processing / Completed)
   - Then the batch list filters to the selected status
   - And "All" is the default tab

5. **Responsive Design** (NFR1 — Affiliate portal: N/A for this Owner page)
   - Given the SaaS Owner views on a smaller desktop viewport
   - When the table is rendered
   - Then it remains usable with horizontal scroll if needed
   - And the batch detail dialog is properly sized and scrollable

## Tasks / Subtasks

- [x] Task 1: Create `/payouts/history` route with page.tsx and PayoutHistoryClient.tsx (AC: #1, #3, #4, #5)
  - [x] Create `src/app/(auth)/payouts/history/page.tsx` — Server Component wrapper
  - [x] Create `src/app/(auth)/payouts/history/PayoutHistoryClient.tsx` — Client Component
  - [x] Add "View History" link/button on the main payouts page (`/payouts`) to navigate to `/payouts/history`

- [x] Task 2: Add pagination to `getPayoutBatches` query (AC: #3)
  - [x] Modify `convex/payouts.ts` — `getPayoutBatches` to accept pagination args: `{ paginationOpts }` and `{ statusFilter }`
  - [x] Use Convex `paginationOptsValidator` for proper pagination
  - [x] Add `by_tenant_and_status` index usage for status filtering
  - [x] Return paginated result with `page`, `isDone`, `continueCursor`

- [x] Task 3: Enhance `getBatchPayouts` to include payment reference and paid date (AC: #2)
  - [x] Added `paymentReference` and `paidAt` to `getBatchPayouts` return type
  - [x] Updated handler to include these fields in the response

- [x] Task 4: Build the PayoutHistoryClient component (AC: #1, #2, #4, #5)
  - [x] Status filter tabs: "All", "Processing", "Completed" — using Tab component
  - [x] Batch table columns: Batch ID (monospace), Date, Affiliates, Amount, Status, Actions
  - [x] Reuse `BatchStatusBadge` from shared component
  - [x] Use shared format functions from `src/lib/format.ts`
  - [x] Pagination controls at table bottom (Prev / Next with page number display)
  - [x] Empty state with link back to payouts page
  - [x] Batch detail dialog with progress bar and payout details
  - [x] "Mark All as Paid" action for non-completed batches
  - [x] CSV download action
  - [x] Loading skeleton states

- [x] Task 5: Add navigation from payouts page to history (AC: #1)
  - [x] Add "View Full History" button/link in the "Recent Batches" section on `/payouts`
  - [x] Link navigates to `/payouts/history`

- [x] Task 6: Extract shared helper utilities (AC: #1, #2)
  - [x] Move `formatCurrency`, `formatDate`, `formatCurrencyCompact`, `getInitials` to `src/lib/format.ts`
  - [x] Move `BatchStatusBadge` to `src/components/shared/BatchStatusBadge.tsx`
  - [x] Import from shared location in both PayoutsClient and PayoutHistoryClient

- [x] Task 7: Write tests (AC: #1-5)
  - [x] Test `getPayoutBatches` returns batches sorted by generatedAt desc
  - [x] Test `getPayoutBatches` with pagination returns correct page and cursor
  - [x] Test `getPayoutBatches` with statusFilter filters by batch status
  - [x] Test status filter "All" returns all batches
  - [x] Test status filter "Completed" returns only completed batches
  - [x] Test status filter "Processing" returns only pending/processing batches
  - [x] Test `getBatchPayouts` returns paymentReference for paid payouts
  - [x] Test `getBatchPayouts` returns paidAt date for paid payouts

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] Fixed incorrect property names in PayoutHistoryClient.tsx toast handler (lines 457-460) - changed `result.markedCount` to `result.payoutsMarked` and removed non-existent `result.totalAmount` reference
- [x] [AI-Review][MEDIUM] Updated File List to include missing files: `src/lib/csv-utils.ts`, `src/lib/csv-utils.test.ts`
- [x] [AI-Review][MEDIUM] Corrected File List to mark `convex/payouts.ts` and `convex/payouts.test.ts` as CREATED (not modified)

## Dev Notes

### CURRENT STATE ANALYSIS — What Already Exists

**Existing Payouts Page (`src/app/(auth)/payouts/`):**
- `page.tsx` — Server Component wrapper
- `PayoutsClient.tsx` — Full client component (1211 lines) containing:
  - Hero banner showing "Ready to Pay" pending total
  - Metrics row (Total Paid Out, Pending Batches, Processing)
  - Affiliates Pending Payout table
  - "Recent Batches" section with batch history table (line 588-686)
  - Batch Generated Success Dialog
  - Confirmation Dialog for batch generation
  - Batch Detail Dialog (Story 13.3, line 859-1024)
  - Mark Single Payout as Paid Dialog (Story 13.3, line 1026-1093)
  - Mark All Batch Payouts as Paid Dialog (Story 13.3, line 1095-1170)
  - `BatchStatusBadge` sub-component (line 1179-1211)

**Existing Convex Backend (`convex/payouts.ts`):**
- `getPayoutBatches` (line 213) — Returns ALL batches for tenant, sorted desc. Returns: `_id`, `totalAmount`, `affiliateCount`, `status`, `generatedAt`, `completedAt`, `batchCode` (computed as `BATCH-${id.slice(-8)}`). **NO pagination. NO status filter.**
- `getBatchPayouts` (line 318) — Returns all payouts for a batch, enriched with affiliate data. Returns: `payoutId`, `affiliateId`, `name`, `email`, `amount`, `payoutMethod`, `status`, `commissionCount`. **MISSING: `paymentReference` and `paidAt` fields.**
- `getBatchPayoutStatus` (line 757) — Returns batch status summary: `batchStatus`, `total`, `paid`, `pending`
- `markPayoutAsPaid` mutation — Updates payout status, sends email (Story 13.4)
- `markBatchAsPaid` mutation — Marks all pending in batch as paid (Story 13.3)
- `generatePayoutBatch` mutation — Creates new batch (Story 13.1)

**Schema (`convex/schema.ts`):**
```
payouts: { tenantId, affiliateId, batchId, amount, status, paymentReference?, paidAt? }
  indexes: by_tenant, by_affiliate, by_batch, by_tenant_and_status

payoutBatches: { tenantId, totalAmount, affiliateCount, status, generatedAt, completedAt? }
  indexes: by_tenant, by_tenant_and_status
```

**UX Screen Reference (`04-owner-payouts.html`):**
- "Payout History" section (line 920-1003) shows table with: Batch ID, Date, Affiliates, Commissions, Total Amount, Status, View button
- Status badges: "badge-processing" (🔵 blue), "badge-paid" (⚪ gray)

### CRITICAL IMPLEMENTATION RULES

**Rule 1: Separate Route, Not Tab.** Create `/payouts/history` as a new route page, NOT a tab within the existing payouts page. This keeps the main payouts page focused on active batch work (generation, marking paid) and the history page as a clean archive view. The epics description "Payouts > History page" implies a sub-route.

**Rule 2: Reuse Existing Dialogs.** The batch detail dialog, mark-as-paid dialog, and CSV download pattern from `PayoutsClient.tsx` (Stories 13.1-13.4) should be reused. Extract to shared components if practical, or import and reuse.

**Rule 3: Extract Shared Helpers.** The `formatCurrency`, `formatDate`, `formatCurrencyCompact`, `getInitials`, and `BatchStatusBadge` are currently defined inline in `PayoutsClient.tsx`. Extract them to shared locations:
- `src/lib/format.ts` — formatting utilities
- `src/components/shared/BatchStatusBadge.tsx` — status badge component
- Both `PayoutsClient.tsx` and `PayoutHistoryClient.tsx` import from shared locations

**Rule 4: Pagination Required.** The current `getPayoutBatches` query uses `.collect()` which returns ALL batches. For a history view, this must be paginated using Convex's `paginationOptsValidator`. Add pagination args to the query.

**Rule 5: Status Filter.** Add optional `statusFilter` argument to `getPayoutBatches`. When provided, use the `by_tenant_and_status` index. When "all" or not provided, use `by_tenant` index (current behavior).

**Rule 6: Include Payment Reference and Paid Date in Batch Details.** The `getBatchPayouts` query currently does NOT return `paymentReference` or `paidAt` per payout. These must be added to the return type and handler.

**Rule 7: NEW Convex Function Syntax.** All backend changes must use the new Convex function syntax with proper validators.

**Rule 8: Tenant Isolation.** All queries must enforce tenant isolation via `requireTenantId()`.

**Rule 9: Use Consistent UX Patterns.** Match the visual design from `04-owner-payouts.html` and existing `PayoutsClient.tsx`. Use the same Card/Table/Badge/Dialog patterns.

**Rule 10: No New Database Tables.** This story only creates frontend pages and enhances existing queries. No schema changes needed.

### FILE STRUCTURE

```
Files to CREATE:
├── src/app/(auth)/payouts/history/page.tsx           # Server Component wrapper
├── src/app/(auth)/payouts/history/PayoutHistoryClient.tsx # Client Component (main)
├── src/lib/format.ts                                 # Shared formatting utilities (extracted)
├── src/components/shared/BatchStatusBadge.tsx          # Shared status badge (extracted)

Files to MODIFY:
├── convex/payouts.ts                                   # Add pagination + statusFilter to getPayoutBatches, add paymentReference/paidAt to getBatchPayouts
├── convex/payouts.test.ts                              # Add tests for new/modified queries
├── src/app/(auth)/payouts/PayoutsClient.tsx            # Add "View Full History" link, extract shared helpers to imports
├── src/components/shared/SidebarNav.tsx                # (optional) Add history link if desired
└── src/app/(auth)/payouts/page.tsx                    # (optional) Add breadcrumb or link

Files to REFERENCE (do NOT modify):
├── _bmad-output/screens/04-owner-payouts.html         # UX design reference
├── convex/schema.ts                                    # payouts, payoutBatches schema
├── convex/tenantContext.ts                             # requireTenantId(), getAuthenticatedUser()
├── src/lib/csv-utils.ts                                # CSV generation utilities
```

### TECHNICAL SPECIFICATIONS

#### New Route: `/payouts/history/page.tsx`

```typescript
// Server Component wrapper
import { PayoutHistoryClient } from "./PayoutHistoryClient";

export default function PayoutHistoryPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/payouts" className="hover:text-foreground">Payouts</Link>
          <span>/</span>
          <span>History</span>
        </div>
        <h1 className="text-3xl font-bold">Payout History</h1>
        <p className="text-muted-foreground mt-1">
          View all past payout batches and their details
        </p>
      </div>
      <PayoutHistoryClient />
    </div>
  );
}
```

#### Modified Query: `getPayoutBatches` — Add Pagination + Status Filter

```typescript
import { paginationOptsValidator } from "convex/server";

export const getPayoutBatches = query({
  args: {
    paginationOpts: paginationOptsValidator,
    statusFilter: v.optional(v.union(
      v.literal("all"),
      v.literal("processing"),
      v.literal("completed"),
    )),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("payoutBatches"),
        totalAmount: v.number(),
        affiliateCount: v.number(),
        status: v.string(),
        generatedAt: v.number(),
        completedAt: v.optional(v.number()),
        batchCode: v.string(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);

    let query = ctx.db
      .query("payoutBatches")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId));

    // Apply status filter if provided
    if (args.statusFilter && args.statusFilter !== "all") {
      query = ctx.db
        .query("payoutBatches")
        .withIndex("by_tenant_and_status", (q) =>
          q.eq("tenantId", tenantId).eq("status", args.statusFilter)
        );
    }

    const paginated = await query
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      page: paginated.page.map((batch) => ({
        _id: batch._id,
        totalAmount: batch.totalAmount,
        affiliateCount: batch.affiliateCount,
        status: batch.status,
        generatedAt: batch.generatedAt,
        completedAt: batch.completedAt,
        batchCode: `BATCH-${batch._id.slice(-8).toUpperCase()}`,
      })),
      isDone: paginated.isDone,
      continueCursor: paginated.continueCursor,
    };
  },
});
```

**Key note on pagination + index switching:** When `statusFilter` is provided, we use `by_tenant_and_status` index. When no filter or "all", we use `by_tenant` index. Both queries need `.order("desc")` to sort by creation time. The `by_tenant_and_status` index is `["tenantId", "status"]` — this requires ordering to be done WITHOUT the status field in the index (since we want `_creationTime` order, not status alphabetical). Convex's `.order()` works on `_creationTime` by default.

#### Modified Query: `getBatchPayouts` — Add Payment Reference + Paid Date

Add `paymentReference` and `paidAt` to the return object:

```typescript
return {
  payoutId: payout._id,
  affiliateId: affiliate._id,
  name: affiliate.name,
  email: affiliate.email,
  amount: payout.amount,
  payoutMethod: affiliate.payoutMethod
    ? { type: affiliate.payoutMethod.type, details: affiliate.payoutMethod.details }
    : undefined,
  status: payout.status,
  commissionCount: commissionCounts.get(payout.affiliateId) ?? 0,
  paymentReference: payout.paymentReference ?? undefined,  // NEW
  paidAt: payout.paidAt ?? undefined,                    // NEW
};
```

Update the returns validator accordingly:
```typescript
returns: v.array(
    v.object({
      payoutId: v.id("payouts"),
      affiliateId: v.id("affiliates"),
      name: v.string(),
      email: v.string(),
      amount: v.number(),
      payoutMethod: v.optional(v.object({ type: v.string(), details: v.string() })),
      status: v.string(),
      commissionCount: v.number(),
      paymentReference: v.optional(v.string()),  // NEW
      paidAt: v.optional(v.number()),               // NEW
    })
  ),
```

#### Shared Formatting Utility: `src/lib/format.ts`

```typescript
export function formatCurrency(amount: number, currency = "PHP"): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyCompact(amount: number, currency = "PHP"): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
```

### ARCHITECTURE COMPLIANCE

| Aspect | Requirement |
|--------|-------------|
| Convex Functions | MODIFY `getPayoutBatches` (add pagination + status filter), MODIFY `getBatchPayouts` (add fields) |
| Route Structure | NEW route at `src/app/(auth)/payouts/history/` — within `(auth)` group, protected by proxy.ts |
| Route Protection | Inherited from `(auth)` route group — no additional configuration needed |
| Tenant Isolation | All queries enforce via `requireTenantId()` |
| Component Patterns | Use existing Card/Table/Badge/Dialog patterns from PayoutsClient.tsx |
| Shared Components | Extract format helpers and BatchStatusBadge to shared locations |
| No process.env | Convex queries do not access `process.env` |

### PREVIOUS STORY INTELLIGENCE

**From Story 13.4 (Payout Notification Email):**
- `markPayoutAsPaid` mutation schedules email after status update — no changes needed
- `markBatchAsPaid` mutation handles batch completion — no changes needed
- Both mutations already create audit log entries

**From Story 13.3 (Mark Payouts as Paid):**
- Batch Detail Dialog pattern established — reusable for history view
- `getBatchPayoutStatus` query returns `{ batchStatus, total, paid, pending }` for progress bar
- "Mark All as Paid" confirmation dialog pattern with payment reference input

**From Story 13.2 (Payout Batch CSV Download):**
- `getBatchPayouts` query provides data for both CSV download and batch detail view
- CSV download pattern: state-driven query → useEffect → generate CSV → trigger download
- `generatePayoutCsv` and `downloadCsvFromString` in `src/lib/csv-utils.ts`

**From Story 13.1 (Payout Batch Generation):**
- `getPayoutBatches` query already returns all batch data with computed `batchCode`
- Batch status values: "pending", "processing", "completed"

**From Code Reviews (across all stories):**
- Convex test suite has pre-existing `convex-test` version incompatibility — tests can be written but may not execute
- Pagination via `paginationOptsValidator` is the standard Convex pattern
- Status filter should use existing `by_tenant_and_status` index for efficiency

### ANTI-PATTERNS TO AVOID

1. **Do NOT duplicate the entire PayoutsClient.tsx** — Extract shared components and reuse
2. **Do NOT modify the existing payouts page layout** — Only add a "View History" link
3. **Do NOT create a new Convex file** — Modify existing `convex/payouts.ts`
4. **Do NOT skip pagination** — History can grow large; use Convex pagination
5. **Do NOT use `.filter()` for status filtering** — Use the `by_tenant_and_status` index instead
6. **Do NOT hardcode "completed" status** — Use the same status vocabulary: pending, processing, completed
7. **Do NOT forget the back navigation** — History page must link back to `/payouts`
8. **Do NOT use `process.env`** in Convex functions
9. **Do NOT create a new schema table** — All data is in existing `payouts` and `payoutBatches` tables
10. **Do NOT forget loading skeletons** — Match existing PayoutsClient pattern for loading states

### DESIGN REFERENCE — UX Screen Alignment

From `04-owner-payouts.html` "Payout History" section (line 920-1003):

| UX Element | HTML Reference | Implementation |
|------------|---------------|----------------|
| Section Title | `<h2>Payout History</h2>` | Page heading |
| Table Headers | Batch ID, Date, Affiliates, Commissions, Total Amount, Status | Same columns + Actions |
| Batch ID Style | `font-family: monospace; font-size: 12px; color: var(--text-muted)` | `font-mono text-xs text-muted-foreground` |
| Date Style | `font-size: 12px; color: var(--text-muted)` | `text-sm text-muted-foreground` |
| Amount Style | `font-variant-numeric: tabular-nums; font-weight: 700` | `font-bold tabular-nums` |
| Processing Badge | `badge-processing` (blue dot + blue bg + blue text) | `BatchStatusBadge status="processing"` |
| Paid Badge | `badge-paid` (gray dot + gray bg + gray text) | `BatchStatusBadge status="completed"` |
| View Button | `btn btn-outline btn-sm` | `Button variant="outline" size="sm"` with Eye icon |

**Status Badge Color Mapping:**
| Status | Tailwind Classes |
|--------|------------------|
| Pending | `border-amber-200 bg-amber-50 text-amber-700` with Clock icon |
| Processing | `border-blue-200 bg-blue-50 text-blue-700` with Loader2 spinner icon |
| Completed | `border-green-200 bg-green-50 text-green-700` with CheckCircle2 icon |

### TESTING APPROACH

1. **Unit Tests (convex/payouts.test.ts):**
   - `getPayoutBatches` returns batches sorted by generatedAt desc
   - `getPayoutBatches` with pagination returns correct page items
   - `getPayoutBatches` with statusFilter="completed" returns only completed batches
   - `getPayoutBatches` with statusFilter="processing" returns only processing batches
   - `getPayoutBatches` with statusFilter="all" returns all batches (same as no filter)
   - `getPayoutBatches` pagination isDone flag is correct on last page
   - `getPayoutBatches` continueCursor enables fetching next page
   - `getBatchPayouts` returns paymentReference for paid payouts
   - `getBatchPayouts` returns paidAt timestamp for paid payouts
   - `getBatchPayouts` returns undefined paymentReference for pending payouts
   - `getBatchPayouts` returns undefined paidAt for pending payouts

2. **Edge Cases:**
   - Zero batches → empty state with navigation link
   - Single page of results → pagination controls hidden or single page displayed
   - Status filter with no matching batches → empty state within tab
   - Batch with zero individual payouts (edge case from cancelled/empty generation)
   - Tenant isolation — query only returns batches for authenticated tenant

### ENVIRONMENT VARIABLES
No new environment variables needed.

### REFERENCES

- **Epic 13 Story Definition:** [Source: _bmad-output/planning-artifacts/epics.md#Story 13.5]
- **PRD FR49 (Payout History View):** [Source: _bmad-output/planning-artifacts/prd.md#FR49]
- **Architecture Document:** [Source: _bmad-output/planning-artifacts/architecture.md]
- **UX Screen:** [Source: _bmad-output/screens/04-owner-payouts.html#Payout History Section (line 920)]
- **UX Design Spec (Status Badges):** [Source: _bmad-output/planning-artifacts/ux-design-specification.md#StatusBadge (line 895)]
- **UX Design Spec (Batch History Table):** [Source: _bmad-output/planning-artifacts/ux-design-specification.md]
- **Convex Schema:** [Source: convex/schema.ts (payouts, payoutBatches)]
- **Existing Payout Queries:** [Source: convex/payouts.ts (getPayoutBatches, getBatchPayouts, getBatchPayoutStatus)]
- **Existing Payout Client:** [Source: src/app/(auth)/payouts/PayoutsClient.tsx]
- **Existing CSV Utils:** [Source: src/lib/csv-utils.ts]
- **Previous Story 13.1:** [Source: _bmad-output/implementation-artifacts/13-1-payout-batch-generation.md]
- **Previous Story 13.2:** [Source: _bmad-output/implementation-artifacts/13-2-payout-batch-csv-download.md]
- **Previous Story 13.3:** [Source: _bmad-output/implementation-artifacts/13-3-mark-payouts-as-paid.md]
- **Previous Story 13.4:** [Source: _bmad-output/implementation-artifacts/13-4-payout-notification-email.md]
- **Project Context:** [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

kimi-k2.5

### Debug Log References

- No debug issues encountered. Implementation followed Dev Notes specifications closely.

### Completion Notes List

1. **Task 6 (Shared Utilities)**: Successfully extracted format utilities and BatchStatusBadge to shared locations for reuse between PayoutsClient and PayoutHistoryClient.

2. **Task 2 (Pagination)**: Modified `getPayoutBatches` to use Convex's `paginationOptsValidator`. The query now returns `{ page, isDone, continueCursor }` instead of an array. Uses `by_tenant` index for unfiltered queries and `by_tenant_and_status` index when filtering.

3. **Task 3 (Enhanced getBatchPayouts)**: Added `paymentReference` and `paidAt` fields to the return type. These fields are properly populated from the payout records.

4. **Task 1 & 4 (History Page)**: Created the full `/payouts/history` route with:
   - Server Component wrapper (page.tsx)
   - Comprehensive Client Component with status tabs, pagination, batch detail dialog
   - Progress bar showing paid/total ratio
   - "Mark All as Paid" functionality
   - CSV download capability
   - Proper loading and empty states

5. **Task 5 (Navigation)**: Added "View Full History" button to the Recent Batches section on the main payouts page.

6. **Task 7 (Tests)**: Added comprehensive tests for:
   - Paginated query behavior
   - Status filtering (all, processing, completed)
   - Payment reference and paidAt fields

### File List

**Files Created:**
- `src/lib/format.ts` - Shared formatting utilities
- `src/lib/csv-utils.ts` - CSV generation utilities for payout downloads
- `src/lib/csv-utils.test.ts` - Tests for CSV utilities
- `src/components/shared/BatchStatusBadge.tsx` - Shared status badge component
- `src/app/(auth)/payouts/history/page.tsx` - Server Component wrapper for history page
- `src/app/(auth)/payouts/history/PayoutHistoryClient.tsx` - Main client component
- `convex/payouts.ts` - Payout queries and mutations (new file for Stories 13.1-13.5)
- `convex/payouts.test.ts` - Tests for payout queries and mutations (new file for Stories 13.1-13.5)

**Files Modified:**
- `src/app/(auth)/payouts/PayoutsClient.tsx` - Updated to use shared components and new query signature

### Change Log

**2026-03-18**: Story 13.5 implementation complete
- Created payout history view with pagination and status filtering
- Extracted shared utilities for reuse
- Enhanced backend queries with payment reference tracking
- Added comprehensive test coverage
- Status: ready-for-review

**2026-03-19**: Code review complete
- Fixed HIGH severity bug: Incorrect property names in toast handler
- Updated File List to include all created files
- All acceptance criteria verified as implemented
- Status: done
