---
title: "Owner Commissions Page"
slug: "owner-commissions-page"
created: "2026-03-20T00:00:00.000Z"
status: "completed"
stepsCompleted: [1, 2, 3, 4, 5, 6]
tech_stack: ["Next.js 16", "Convex", "TypeScript", "Tailwind CSS v4", "shadcn/ui", "nuqs", "sonner"]
files_to_modify: [
  "src/app/(auth)/commissions/page.tsx (NEW)",
  "convex/commissions.ts (ADDED: listCommissionsEnriched, getCommissionDetail, getCommissionStats)",
  "convex/commissionsExport.ts (NEW: exportCommissionsCSV)"
]
code_patterns: [
  "use client + Suspense with skeleton fallback",
  "useQuery(api.auth.getCurrentUser) for RBAC",
  "MetricCard with animated count-up for KPIs",
  "DataTable with column filters, sorting, StatusBadgeCell/AvatarCell/CurrencyCell/DateCell",
  "Drawer (vaul) for detail panels",
  "AlertDialog for destructive confirmations",
  "useMutation for approve/decline with toast feedback",
  "useAction for CSV export with downloadCsv helper",
  "nuqs for URL-persisted filter state"
]
test_patterns: ["Vitest with .test.ts suffix", "Convex tests in convex/*.test.ts"]
---

# Tech-Spec: Owner Commissions Page

**Created:** 2026-03-20T00:00:00.000Z

## Overview

### Problem Statement

The `/commissions` route returns 404. SaaS Owners need a full commissions management page to view, filter, review, approve/decline commissions, handle fraud-flagged items, and export data — matching the design reference at `_bmad-output/screens/03-owner-commissions.html`.

### Solution

Create a `/commissions` page at `src/app/(auth)/commissions/page.tsx`. The existing `listCommissions` query returns raw IDs (affiliateId, campaignId) without names — the table needs enriched data. We add 4 new Convex functions: `listCommissionsEnriched` (joins affiliate/campaign/conversion names), `getCommissionDetail` (single commission with full detail, no status restriction), `getCommissionStats` (aggregated KPI metrics), and `exportCommissionsCSV` (CSV export action). The page reuses existing UI components (MetricCard, DataTable, Drawer, AlertDialog).

### Scope

**In Scope:**
- 4 summary metric cards (Pending, Confirmed, Reversed, Flagged)
- Full commissions DataTable with columns: Date, Affiliate, Customer, Plan/Event, Campaign, Amount, Status
- Status filter (All, Pending, Confirmed, Reversed, Paid) + search by affiliate/customer/txId + campaign filter
- Commission detail drawer (works for ALL statuses, not just pending)
- Fraud-flagged drawer variant with evidence box
- Approve/Decline actions wired to `approveCommission`/`declineCommission` mutations
- "Override — Mark Legitimate" for fraud-flagged commissions (calls `approveCommission`)
- "Approve All Pending" bulk action with confirmation dialog + error recovery
- CSV export with backend action
- Fraud row highlighting (yellow background for flagged commissions)
- Client-side "Load more" pagination

**Out of Scope:**
- Creating new commission entries (that's webhook/conversion flow)
- Modifying the Convex schema
- Affiliate portal commission views (separate feature)
- Payout batch generation from commissions page
- Clearing fraud signals after override (future enhancement)

## Context for Development

### Codebase Patterns

**Page Architecture (confirmed from affiliates/page.tsx, campaigns/page.tsx, dashboard/page.tsx):**
- Pages live at `src/app/(auth)/<route>/page.tsx`, use `"use client"`, wrap content in `<Suspense>` with skeleton fallback
- Sticky top bar: `div.sticky.top-0.z-50.bg-[var(--bg-surface)].border-b.h-[60px].flex.items-center.px-8` with title left, actions right
- Page content area: `div.px-8.pt-6.pb-8`
- RBAC via `useQuery(api.auth.getCurrentUser)` — check `role === "owner" || role === "manager"`
- CSV export: `useAction(someExportAction)` → `downloadCsv(base64Data, filename)` from `@/lib/utils`
- Toast: `import { toast } from "sonner"` for success/error feedback

**MetricCard Usage (from dashboard/page.tsx):**
```tsx
<MetricCard label="Pending" numericValue={value} formatValue={formatCurrency}
  subtext="23 commissions" variant="yellow" isLoading={!data}
  icon={<Clock className="w-4 h-4" />} />
```
Variants: "blue" | "green" | "yellow" | "gray"

**DataTable Column Pattern (from affiliates/page.tsx):**
```tsx
const columns: TableColumn<Commission>[] = [
  { key: "date", header: "Date", sortable: true, sortField: "_creationTime",
    cell: (row) => <DateCell value={row._creationTime} format="short" /> },
  { key: "affiliate", header: "Affiliate", cell: (row) => <AvatarCell name={row.name} /> },
  { key: "amount", header: "Amount", align: "right", sortable: true,
    cell: (row) => <CurrencyCell amount={row.amount} /> },
  { key: "status", header: "Status", filterable: true, filterType: "select",
    filterOptions: [...], cell: (row) => <StatusBadgeCell status={row.status} statusConfig={...} /> },
];
```

**Drawer Pattern (from affiliates — uses vaul Drawer):**
- Open/close via state: `const [isOpen, setIsOpen] = useState(false)`
- `<Drawer open={isOpen} onOpenChange={setIsOpen}>`
- `<DrawerContent className="sm:max-w-xl">` for right-side detail panel

**AlertDialog Pattern (from alert-dialog.tsx):**
```tsx
<AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
  <AlertDialogContent>
    <AlertDialogHeader><AlertDialogTitle>...</AlertDialogTitle>
    <AlertDialogDescription>...</AlertDialogDescription></AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**StatusBadgeCell Custom Config (commission statuses):**
```tsx
const commissionStatusConfig = {
  pending: { label: "Pending", dotColor: "#f59e0b", bgClass: "bg-[#fef3c7]", textClass: "text-[#92400e]" },
  approved: { label: "Approved", dotColor: "#10b981", bgClass: "bg-[#d1fae5]", textClass: "text-[#065f46]" },
  confirmed: { label: "Confirmed", dotColor: "#10b981", bgClass: "bg-[#d1fae5]", textClass: "text-[#065f46]" },
  reversed: { label: "Reversed", dotColor: "#ef4444", bgClass: "bg-[#fee2e2]", textClass: "text-[#991b1b]" },
  declined: { label: "Declined", dotColor: "#ef4444", bgClass: "bg-[#fee2e2]", textClass: "text-[#991b1b]" },
  paid: { label: "Paid", dotColor: "#6b7280", bgClass: "bg-[#f3f4f6]", textClass: "text-[#374151]" },
};
```
Note: `approveCommission` sets status to `"approved"`. The reference shows "Confirmed" badge — we map `"approved"` → label "Approved" in the UI. If a separate "confirmed" status exists in data, it gets the same green styling.

**Fraud Row Highlighting:**
- Use `rowClassName` prop on DataTable: `rowClassName={(row) => row.isSelfReferral ? "!bg-[#fffbeb]" : ""}`

**Convex Backend — existing functions:**
- `listCommissions({ affiliateId?, campaignId?, status? })` → raw commissions (IDs only, no names)
- `approveCommission({ commissionId })` → `{ success, commissionId, newStatus: "approved" }`
- `declineCommission({ commissionId, reason })` → `{ success, commissionId, newStatus: "declined" }`
- `getCommissionForReview({ commissionId })` → enriched detail **BUT only returns pending commissions** (throws on non-pending)
- Commission indexes: `by_tenant`, `by_tenant_and_status`, `by_affiliate`, `by_campaign`

**Convex patterns from dashboardExport.ts:**
- CSV export uses `"use node"` action
- Auth check via `betterAuthComponent.getAuthUser(ctx)` + manual user lookup
- Runs queries internally via `ctx.runQuery(api.xxx.yyy, args)`
- Returns base64-encoded CSV string

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `_bmad-output/screens/03-owner-commissions.html` | Design reference — metrics, table, drawers, modals |
| `src/app/(auth)/affiliates/page.tsx` | Most complete page pattern — DataTable, filters, drawer, dialogs, CSV export |
| `src/app/(auth)/campaigns/page.tsx` | Simpler page pattern — top bar, Suspense, skeleton |
| `src/app/(auth)/dashboard/page.tsx` | MetricCard usage, formatCurrency, CSV export, FadeIn |
| `src/components/ui/MetricCard.tsx` | Metric card with animated count-up |
| `src/components/ui/DataTable.tsx` | Table with sorting, column filters, cell renderers, rowClassName |
| `src/components/ui/FilterChips.tsx` | Active filter chip display |
| `src/components/ui/drawer.tsx` | vaul Drawer for detail panels |
| `src/components/ui/alert-dialog.tsx` | AlertDialog for confirmations |
| `src/components/ui/badge.tsx` | Badge component |
| `src/components/ui/skeleton.tsx` | Loading skeleton |
| `src/components/ui/FadeIn.tsx` | Staggered entrance animation |
| `src/lib/utils.ts` | `cn()`, `downloadCsv()` |
| `convex/commissions.ts` | All existing commission queries/mutations (1245 lines) |
| `convex/dashboardExport.ts` | CSV export action pattern |
| `convex/schema.ts:300-325` | Commissions table + indexes |

### Technical Decisions

1. **Route:** `src/app/(auth)/commissions/page.tsx` — top-level route matching sidebar nav
2. **Default view:** All statuses, no pre-selected filter — metric cards give the summary
3. **Data enrichment (critical):** `listCommissions` returns raw IDs. A new `listCommissionsEnriched` query joins affiliate name/email + campaign name + conversion customer email in a single pass. This is the foundation for table columns, search, and CSV export.
4. **Drawer for all statuses:** Existing `getCommissionForReview` only works for pending. New `getCommissionDetail` query returns commission detail regardless of status.
5. **Status model:** `approveCommission` → `"approved"`. `declineCommission` → `"declined"`. Other statuses (`confirmed`, `reversed`, `paid`) are set by other flows (payout batches, webhooks). UI shows all with appropriate badge colors.
6. **"Override — Mark Legitimate":** Calls `approveCommission` — the commission is pending (flagged doesn't change status), so approval works. Future: add mutation to clear fraud signals.
7. **Approve All:** Iterates with error recovery — tracks successes/failures, reports both in toast.
8. **flaggedCount:** Counts commissions where `isSelfReferral === true` OR `fraudIndicators.length > 0`.
9. **Pagination:** Client-side "Load more" chunking. All data loaded in one query, sliced for display.

## Implementation Plan

### Tasks

- [x] Task 1: Add `listCommissionsEnriched` query to `convex/commissions.ts`
  - File: `convex/commissions.ts`
  - Action: Add a new public query that returns enriched commission data for the table. For each commission:
    1. Fetch affiliate via `ctx.db.get(commission.affiliateId)` → extract `name`, `email`
    2. Fetch campaign via `ctx.db.get(commission.campaignId)` → extract `name`
    3. If `commission.conversionId` exists, fetch conversion → extract `customerEmail`, `metadata.planId`
    4. Return enriched object with all commission fields + `affiliateName`, `affiliateEmail`, `campaignName`, `customerEmail`, `planEvent` (formatted as "{campaignName} · {eventType}" where eventType is derived from `eventMetadata.source`: "webhook" → "Subscription", "manual" → "Manual Entry", "api" → "API Triggered"; fallback to source value if unmapped)
  - Args: `{}` (no filters — client-side filtering)
  - Returns validator must list ALL fields explicitly (not spread). Include every field from the `listCommissions` return validator plus: `affiliateName: v.string()`, `affiliateEmail: v.string()`, `campaignName: v.string()`, `customerEmail: v.optional(v.string())`, `planEvent: v.string()`
  - Uses `getAuthenticatedUser(ctx)` for auth + tenant isolation
  - Orders by `_creationTime` desc
  - Notes: This is the critical data-enrichment query. All table columns, search, and CSV depend on it. Batch fetches affiliates/campaigns/conversions after collecting commissions to minimize N+1.

- [x] Task 2: Add `getCommissionDetail` query to `convex/commissions.ts`
  - File: `convex/commissions.ts`
  - Action: Add a new public query for the drawer that works for ALL statuses (unlike `getCommissionForReview` which only returns pending). Returns:
    1. All commission fields
    2. Enriched: `affiliateName`, `affiliateEmail`, `campaignName`
    3. If conversion exists: `customerEmail`, `planInfo` (plan name from metadata)
    4. `isSelfReferral`, `fraudIndicators` array
  - Args: `{ commissionId: v.id("commissions") }`
  - Returns: enriched commission object or `v.null()`
  - Tenant isolation enforced
  - No status restriction — works for pending, approved, confirmed, reversed, paid

- [x] Task 3: Add `getCommissionStats` query to `convex/commissions.ts`
  - File: `convex/commissions.ts`
  - Action: Add a new public query that aggregates commission stats in a single pass. Reads all commissions for the tenant via `by_tenant` index, then computes:
    - `pendingCount` + `pendingValue` (status === "pending")
    - `confirmedCountThisMonth` + `confirmedValueThisMonth` (status in ["approved", "confirmed"] + within current month)
    - `reversedCountThisMonth` + `reversedValueThisMonth` (status in ["reversed", "declined"] + within current month)
    - `flaggedCount` (`isSelfReferral === true` OR `(fraudIndicators ?? []).length > 0` — guard against undefined)
  - Returns validator: `v.object({ pendingCount: v.number(), pendingValue: v.number(), confirmedCountThisMonth: v.number(), confirmedValueThisMonth: v.number(), reversedCountThisMonth: v.number(), reversedValueThisMonth: v.number(), flaggedCount: v.number() })`
  - Uses `getAuthenticatedUser(ctx)` for auth + tenant isolation
  - "This month" = from start of current calendar month to now

- [x] Task 4: Add `exportCommissionsCSV` action to `convex/commissions.ts`
  - File: `convex/commissions.ts`
  - Action: Add a `"use node"` action that exports commissions as CSV. Follows `dashboardExport.ts` pattern:
    1. Auth via `betterAuthComponent.getAuthUser(ctx)` + `internal.users._getUserByEmailInternal`
    2. Calls `listCommissionsEnriched` internally to get enriched data
    3. Builds CSV rows: Date, Affiliate Name, Affiliate Email, Customer Email, Campaign, Amount, Status
    4. Returns base64-encoded CSV string
  - Args: `{ dateRange?: { start: v.number(), end: v.number() } }` (optional, defaults to last 30 days)
  - Returns: `v.string()` (base64 CSV)
  - Notes: Import `betterAuthComponent` statically at top of file

- [x] Task 5: Create `src/app/(auth)/commissions/page.tsx` — page shell with top bar and Suspense
  - File: `src/app/(auth)/commissions/page.tsx` (NEW)
  - Action: Create the page file with:
    1. `"use client"` directive
    2. `CommissionsContent` inner component (hooks live here)
    3. `CommissionsSkeleton` fallback component
    4. Default export wrapping in `<Suspense fallback={<CommissionsSkeleton />}>`
    5. Sticky top bar with "Commissions" title + "Export CSV" button (outline variant, Download icon)
  - Pattern: Copy structure from `campaigns/page.tsx` lines 59-87

- [x] Task 6: Add metric cards section to commissions page
  - File: `src/app/(auth)/commissions/page.tsx`
  - Action: Inside `CommissionsContent`, add 4 `<MetricCard>` in `grid grid-cols-4 gap-4`:
    1. **Pending Review** — `variant="yellow"`, `numericValue={stats?.pendingValue}`, `formatValue={formatCurrency}`, `subtext="{pendingCount} commissions"`, `icon={<Clock />}`
    2. **Confirmed (This Month)** — `variant="green"`, confirmed value/count
    3. **Reversed (This Month)** — `variant="red"`, reversed value/count
    4. **Flagged for Review** — `variant="gray"`, flagged count, `subtext="Needs attention"`
  - Data: `useQuery(api.commissions.getCommissionStats, {})` — skip until auth loaded via `"skip"` when user is undefined
  - Wrap in `<FadeIn>` for staggered entrance

- [x] Task 7: Add toolbar section — search + status filter pills + Approve All button
  - File: `src/app/(auth)/commissions/page.tsx`
  - Action: Add toolbar between metrics and table:
    1. Search input — client-side filter on enriched data fields: `affiliateName`, `affiliateEmail`, `customerEmail`, `eventMetadata.transactionId`
    2. Status filter pills: "All", "Pending", "Approved", "Reversed", "Paid" — toggle active state, client-side filter
    3. Campaign filter dropdown — options from `useQuery(api.campaigns.listCampaigns, {})`
    4. "Approve All Pending" button (primary, shown when `canManage && stats?.pendingCount > 0`)
  - State: `useState` for search query, status filter, campaign filter

- [x] Task 8: Add DataTable with commission columns (using enriched data)
  - File: `src/app/(auth)/commissions/page.tsx`
  - Action: Add `<DataTable>` with columns using enriched fields from `listCommissionsEnriched`:
    1. **Date** — `DateCell` format="short", sortable on `_creationTime`
    2. **Affiliate** — `AvatarCell name={row.affiliateName} email={row.affiliateEmail}`
    3. **Customer** — `<span>{row.customerEmail || "—"}</span>`
    4. **Plan / Event** — `<span>{row.planEvent}</span>` (e.g. "Summer 2026 · Subscription")
    5. **Campaign** — `<span>{row.campaignName}</span>`, filterable with select (campaign options from listCampaigns)
    6. **Amount** — `CurrencyCell amount={row.amount}`, align="right", sortable. Show negative with red color for reversed/declined.
    7. **Status** — `StatusBadgeCell` with `commissionStatusConfig`, filterable with select
  - Row click: opens commission detail drawer
  - `rowClassName`: fraud rows get `!bg-[#fffbeb]`
  - `actions`: [{ label: "View Detail", onClick: handleViewDetail }]
  - Data: `useQuery(api.commissions.listCommissionsEnriched, {})` — load all, filter client-side by status/search/campaign
  - Sort: client-side on `_creationTime` (desc default)

- [x] Task 9: Add commission detail drawer (works for ALL statuses)
  - File: `src/app/(auth)/commissions/page.tsx`
  - Action: Add a `<Drawer>` component for commission details using `getCommissionDetail`:
    1. **Amount hero section** — large formatted currency, commission rate info, status badge
    2. **Commission Details** section — rows for: Affiliate, Customer Email, Campaign, Plan/Event, SaligPay Tx ID, Date Created
    3. **Fraud Signals** section — green "No fraud signals detected" box when clean; yellow fraud evidence box when `isSelfReferral` or `fraudIndicators` present
    4. **Action buttons** (only for `status === "pending"`):
       - Normal: "Decline" (outline danger) + "Approve" (primary)
       - Fraud-flagged: "Decline Commission" (solid danger) + "Override — Mark Legitimate" (outline, calls `approveCommission`)
    5. For non-pending: no action buttons, just detail view

- [x] Task 10: Wire approve/decline mutations with confirmation dialogs
  - File: `src/app/(auth)/commissions/page.tsx`
  - Action: Add mutation handlers and confirmation dialogs:
    1. **Approve:** Call `useMutation(api.commissions.approveCommission)` with `{ commissionId }`, show success toast, close drawer
    2. **Decline:** Open `<AlertDialog>` with reason text input, then call `useMutation(api.commissions.declineCommission)` with `{ commissionId, reason }`, show success toast, close drawer + dialog
    3. **Override (fraud):** Same as Approve — calls `approveCommission`. Toast: "Commission marked as legitimate and approved."
    4. **Approve All:** Open `<AlertDialog>` showing count + total value + "Flagged commissions will be skipped" warning. On confirm:
       - Iterate non-flagged pending commissions
       - Track `{ success: number, failed: number, errors: string[] }`
       - Show final toast: "Approved {success} of {total} commissions" (or "{failed} failed" if any)
       - On partial failure: show error details in toast
    5. All mutations wrapped in try/catch with error toast
    6. Loading states with `Loader2` spinner during mutation

- [x] Task 11: Add CSV export wiring
  - File: `src/app/(auth)/commissions/page.tsx`
  - Action: Wire the "Export CSV" button:
    1. `useAction(api.commissions.exportCommissionsCSV)`
    2. On click: call action, get base64 string, call `downloadCsv(base64Data, "commissions")`
    3. Loading state with spinner, disabled during export
    4. Error handling with toast

- [x] Task 12: Add pagination / load-more footer
  - File: `src/app/(auth)/commissions/page.tsx`
  - Action: Add pagination footer below DataTable:
    1. "Showing X of Y commissions" text
    2. "Load 20 more (Z remaining)" button — increases `visibleCount` by 20
    3. Client-side chunking: `filteredData.slice(0, visibleCount)`
    4. Hide button when all commissions visible

- [x] Task 13: Add skeleton loading state
  - File: `src/app/(auth)/commissions/page.tsx`
  - Action: Create `CommissionsSkeleton` component:
    1. 4 metric card skeletons (Skeleton h-24 w-full in grid-cols-4)
    2. Toolbar skeleton (search bar + filter pills)
    3. Table skeleton (5 rows with Skeleton cells)
  - Pattern: From campaigns/page.tsx `CampaignOverviewSkeleton`

### Acceptance Criteria

- [x] AC1: Given the user navigates to `/commissions`, when the page loads, then 4 metric cards are displayed showing Pending Review, Confirmed (This Month), Reversed (This Month), and Flagged for Review with correct values from Convex
- [x] AC2: Given commissions exist in the database, when the page loads, then a DataTable displays all commissions with columns: Date, Affiliate (name + email), Customer (email), Plan/Event, Campaign, Amount, Status — with enriched data (not raw IDs)
- [x] AC3: Given the user clicks on a commission row, when the drawer opens, then commission details are displayed including affiliate name, customer email, campaign, amount, status, and date
- [x] AC4: Given a commission has `isSelfReferral === true` or non-empty `fraudIndicators`, when the drawer opens, then a yellow fraud evidence box is displayed showing the fraud indicators
- [x] AC5: Given a pending commission is shown in the drawer, when the user clicks "Approve", then the commission status changes to "approved" and a success toast appears
- [x] AC6: Given a pending commission is shown in the drawer, when the user clicks "Decline" and provides a reason, then the commission status changes to "declined" and a success toast appears
- [x] AC7: Given pending commissions exist, when the user clicks "Approve All Pending" and confirms, then all non-flagged pending commissions are approved and a success toast shows the count (with error recovery for partial failures)
- [x] AC8: Given the user clicks "Export CSV", when the export completes, then a CSV file is downloaded containing enriched commission data (affiliate names, campaign names, amounts, statuses)
- [x] AC9: Given the user selects a status filter (e.g., "Pending"), when the filter is applied, then only commissions with that status are shown in the table
- [x] AC10: Given the user types in the search box, when the search executes, then the table filters to show matching commissions by affiliate name, affiliate email, customer email, or transaction ID
- [x] AC11: Given fraud-flagged commissions exist, when viewing the table, then flagged rows have a yellow background highlight
- [x] AC12: Given more than 20 commissions exist, when the user scrolls to the bottom, then a "Load more" button appears that loads 20 additional commissions
- [x] AC13: Given the user has a "viewer" role, when viewing the page, then the "Approve All Pending" button is hidden and approve/decline actions are not shown in the drawer
- [x] AC14: Given a non-pending commission (approved/reversed/paid), when the user clicks the row, then the drawer opens showing details without approve/decline action buttons
- [x] AC15: Given a fraud-flagged commission, when the user clicks "Override — Mark Legitimate" in the drawer, then the commission is approved and a success toast appears

## Additional Context

### Dependencies

- **Convex backend functions (to create):** `listCommissionsEnriched`, `getCommissionDetail`, `getCommissionStats`, `exportCommissionsCSV`
- **Convex backend functions (already exist):** `approveCommission`, `declineCommission`, `listCommissions` (raw, used internally)
- **UI components (already exist):** MetricCard, DataTable (with all cell renderers), Drawer, AlertDialog, Badge, FilterChips, Skeleton, FadeIn
- **Utilities (already exist):** `cn()`, `downloadCsv()` from `@/lib/utils`; `formatCurrency` from dashboard
- **Other queries (already exist):** `campaigns.listCampaigns` for campaign filter options
- **No schema changes needed** — commissions table already has all required fields and indexes
- **No new npm packages needed**

### Testing Strategy

**Manual Testing Steps:**
1. Navigate to `/commissions` — verify 4 metric cards render with real data
2. Verify table shows enriched data (affiliate names, emails, campaign names — not raw IDs)
3. Click a pending commission row — verify drawer opens with details + Approve/Decline buttons
4. Click an approved commission row — verify drawer opens with details, NO action buttons
5. Click a fraud-flagged row — verify yellow drawer evidence box + "Override" button
6. Click "Approve" on pending — verify status changes to "approved", toast, table updates
7. Click "Decline" on pending — enter reason — verify status changes to "declined"
8. Click "Override — Mark Legitimate" on flagged — verify approves + toast
9. Click "Approve All Pending" — verify dialog — confirm — verify partial-failure toast if any fail
10. Click "Export CSV" — verify enriched CSV downloads
11. Apply status filter — verify table filters
12. Type in search — verify filters by affiliate name/email, customer email, tx ID
13. Verify fraud rows have yellow background
14. Test with viewer role — verify approve/decline hidden

**Unit Tests (future):**
- `convex/commissions.test.ts` — test `getCommissionStats` aggregation logic
- Test `listCommissionsEnriched` returns correct enriched fields
- Test edge cases: empty tenant, all commissions same status, timezone edge cases for "this month"

### Notes

- **High-risk item:** `listCommissionsEnriched` loads ALL commissions + does N affiliate/campaign/conversion lookups. For tenants with thousands of commissions, this is slow. Mitigation: client-side "Load more" limits render. Future: add server-side pagination.
- **High-risk item:** "Approve All" calls `approveCommission` in a loop — each sends an email. For 100+ approvals, many emails scheduled. Emails are async via `ctx.scheduler.runAfter(0, ...)` so they don't block. Consider batching in future.
- **Status clarification:** `approveCommission` sets status to `"approved"`. The reference design shows "Confirmed" badge. We map both `"approved"` and `"confirmed"` to green in the UI. `"approved"` = owner approved it. `"confirmed"` = may be set by other flows (payout batch, webhook). The distinction doesn't affect the commissions page.
- **Fraud override semantics:** "Override — Mark Legitimate" calls `approveCommission`. The commission is pending (flagged status doesn't change it from pending). After approval, fraud signals remain on the record but the commission is approved. Future: add mutation to clear fraud signals explicitly.
- **Currency:** Philippine Peso (₱) — `Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" })`
- **`getCommissionForReview` is NOT used** — it only returns pending commissions and throws otherwise. We replace it with the new `getCommissionDetail` which works for all statuses.

## Review Notes
- Adversarial review completed
- Findings: 10 total, 4 fixed, 3 accepted, 3 noise
- Resolution approach: auto-fix real + valid findings
- **Fixed:** F1 (capped `listCommissionsEnriched` to 500 limit + date range filter), F2 (added `bulkApproveCommissions` mutation), F7 (CSV export passes date range to query), F9 (added nuqs URL-persisted filter state)
- **Accepted:** F3 (stats query scalability — noted as known limitation), F5 ("Unknown" fallback is appropriate), F6 (Manual Entry default is correct)
- **Noise:** F4, F8, F10 (redundant casts, standard vaul behavior)
