# Story 9.5: CSV Export

Status: done

## Story

As a SaaS Owner or Manager,
I want to export report data as CSV from the main Reports page,
so that I can analyze data externally or share with stakeholders. (FR62)

## Acceptance Criteria

### AC1: Reports Index Page with Export Button
**Given** the user is on the main Reports page at `/reports`
**When** the page loads
**Then** key program metrics are displayed (MRR influenced, conversions, commissions)
**And** an "Export CSV" button is visible in the topbar
**And** the button is only visible to owners and managers (RBAC)

### AC2: CSV Export with Current View Data
**Given** the user clicks "Export CSV"
**When** the export is triggered
**Then** a CSV file is generated with all program-level metrics
**And** the CSV includes: date range, clicks, conversions, commissions, top affiliates
**And** the file is named `program-report-YYYY-MM-DD.csv`

### AC3: Date Range Filtering in Export
**Given** a date range filter is applied on the Reports page
**When** the user exports
**Then** the CSV contains only data from the selected date range
**And** the date range is included in the CSV header

### AC4: Export Actions Already Exist
**Given** the existing export actions in `convex/reports.ts`
**When** implementing this story
**Then** reuse `exportCampaignPerformanceCSV` and `exportAffiliatePerformanceCSV` patterns
**And** create a new `exportProgramReportCSV` action for the Reports index page

### AC5: Loading State and Error Handling
**Given** the user clicks "Export CSV"
**When** the export is in progress
**Then** the button shows a loading spinner
**And** the button is disabled during export
**When** an error occurs
**Then** a toast notification shows the error message
**And** the button returns to normal state

## Tasks / Subtasks

- [x] Task 1: Create Reports Index Page (AC: #1)
  - [x] 1.1 Create `/reports/page.tsx` with program-level metrics
  - [x] 1.2 Add DateRangeSelector component
  - [x] 1.3 Display summary metrics (MRR influenced, conversions, commissions, conversion rate)
  - [x] 1.4 Add Export CSV button in page header
  - [x] 1.5 Implement RBAC - only show export to owners/managers

- [x] Task 2: Create Program Report Export Action (AC: #2, #3, #4)
  - [x] 2.1 Create `exportProgramReportCSV` action in `convex/reports.ts`
  - [x] 2.2 Fetch aggregated program metrics for date range
  - [x] 2.3 Format data as CSV with proper headers
  - [x] 2.4 Include top affiliates and campaign breakdown in CSV
  - [x] 2.5 Return base64 encoded CSV string

- [x] Task 3: Wire Export Button to Action (AC: #2, #5)
  - [x] 3.1 Use `useAction` hook to call `exportProgramReportCSV`
  - [x] 3.2 Handle loading state during export
  - [x] 3.3 Decode base64 response and trigger file download
  - [x] 3.4 Generate filename with current date
  - [x] 3.5 Show success/error toast notifications

- [x] Task 4: Update Navigation (AC: #1)
  - [x] 4.1 Ensure sidebar "Reports" link points to `/reports`
  - [x] 4.2 Add sub-navigation for Campaign Performance and Affiliate Performance

- [x] Task 5: Add Export Helper Utility (AC: #2)
  - [x] 5.1 Create reusable `downloadCsv` utility function in `src/lib/utils.ts`
  - [x] 5.2 Extract common export logic from existing reports pages
  - [x] 5.3 Update Campaign and Affiliate reports to use utility (optional refactor)

## Dev Notes

### CRITICAL: What's Already Implemented - DO NOT Recreate

The following CSV export functionality **ALREADY EXISTS** and must be leveraged:

| Component | Location | Status |
|-----------|----------|--------|
| Campaign Export Action | `convex/reports.ts` → `exportCampaignPerformanceCSV` | ✅ EXISTS |
| Affiliate Export Action | `convex/reports.ts` → `exportAffiliatePerformanceCSV` | ✅ EXISTS |
| Campaign Export UI | `src/app/(auth)/reports/campaigns/page.tsx` | ✅ EXISTS |
| Affiliate Export UI | `src/app/(auth)/reports/affiliates/page.tsx` | ✅ EXISTS |
| Date Range Hook | `src/hooks/useDateRange.ts` | ✅ EXISTS |
| Date Range Selector | `src/app/(auth)/dashboard/components/DateRangeSelector.tsx` | ✅ EXISTS |

### What's Missing and Needs Implementation

1. **Reports Index Page** (`/reports/page.tsx`) - Does NOT exist
2. **Program-level Export Action** (`exportProgramReportCSV`) - Does NOT exist
3. **Dashboard Quick Actions link** points to `/reports?export=true` - page doesn't handle this

### Implementation Pattern for Export Actions

Follow the existing pattern from `convex/reports.ts`:

```typescript
export const exportProgramReportCSV = action({
  args: {
    tenantId: v.id("tenants"),
    dateRange: dateRangeValidator,
  },
  returns: v.string(), // Base64 encoded CSV
  handler: async (ctx, args): Promise<string> => {
    // 1. Authenticate user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // 2. Get user and verify tenant + RBAC
    const user = await ctx.runQuery(internal.users._getUserByAuthIdInternal, {
      authId: identity.subject,
    });
    if (!user || user.tenantId !== args.tenantId) throw new Error("Unauthorized");
    if (user.role !== "owner" && user.role !== "manager") {
      throw new Error("Forbidden: Only owners and managers can export");
    }

    // 3. Fetch data and build CSV
    // ... fetch metrics, format as CSV ...

    // 4. Return base64 encoded
    return Buffer.from(csv).toString("base64");
  },
});
```

### CSV Format for Program Report

```csv
# Program Performance Report
# Generated: 2026-03-17
# Date Range: 2026-02-15 to 2026-03-17

Summary Metrics
Metric,Value
MRR Influenced,48220
Total Clicks,7420
Total Conversions,312
Conversion Rate,4.2%
Total Commissions,9644

Top Affiliates
Name,Email,Clicks,Conversions,Commission
"RJ Santos",rj@example.com,145,38,12480
"Jamie Mendoza",jamie@example.com,98,24,8120
...

Campaign Performance
Campaign,Clicks,Conversions,Commission
"Main Affiliate Program",5200,220,6500
...
```

### Frontend Export Pattern

Follow the existing pattern from campaign/affiliate reports:

```typescript
// In page component
const exportCSV = useAction(api.reports.exportProgramReportCSV);
const [isExporting, setIsExporting] = useState(false);

const handleExport = async () => {
  if (!tenantId) return;

  setIsExporting(true);
  try {
    const base64Data = await exportCSV({
      tenantId,
      dateRange: queryDateRange,
    });

    // Decode and download
    const csvContent = atob(base64Data);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().split("T")[0];
    link.href = url;
    link.download = `program-report-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("CSV exported successfully");
  } catch (error) {
    console.error("Export failed:", error);
    toast.error("Failed to export CSV");
  } finally {
    setIsExporting(false);
  }
};
```

### File Structure

```
src/app/(auth)/reports/
├── page.tsx                    # NEW: Reports index with Export CSV
├── campaigns/
│   ├── page.tsx               # EXISTS: Campaign Performance with Export
│   └── components/
├── affiliates/
│   ├── page.tsx               # EXISTS: Affiliate Performance with Export
│   └── components/

convex/
└── reports.ts                  # ADD: exportProgramReportCSV action
```

### UX Design Reference

Based on `_bmad-output/screens/06-owner-reports.html`:
- Topbar with "Export CSV" button
- Period tabs (7 days, 30 days, 90 days, 12 months, All time)
- Campaign filter dropdown
- Metrics grid: MRR Influenced, New Conversions, Commissions Confirmed, Click-to-Signup Rate
- MRR Chart
- Conversion Funnel
- Top Affiliates by Revenue table
- Commissions by Plan breakdown

### Previous Story Learnings (from 9-4-date-range-filtering)

**What Worked Well:**
- Shared `useDateRange` hook for global date range consistency
- URL params preserve state for shareable links
- RBAC implementation for export functionality
- Toast notifications for success/error feedback

**Common Mistakes to Avoid:**
- Do NOT create new date range logic - use existing `useDateRange` hook
- Do NOT skip RBAC checks - always verify owner/manager role for exports
- Do NOT forget loading states - show spinner during export
- Do NOT hardcode date ranges - use the selected date range from the selector

### Anti-Pattern Prevention

**DO NOT:**
- Recreate existing export actions - use `exportCampaignPerformanceCSV` and `exportAffiliatePerformanceCSV` as patterns
- Create duplicate date range logic - use `useDateRange` hook
- Skip authentication in actions - always verify user identity
- Forget error handling - wrap in try/catch with toast notifications
- Export sensitive data for viewers - enforce RBAC

### Testing Checklist

- [ ] Reports index page loads at `/reports`
- [ ] Export CSV button visible for owners/managers
- [ ] Export CSV button hidden for viewers
- [ ] Clicking Export triggers file download
- [ ] CSV filename includes current date
- [ ] CSV contains data for selected date range
- [ ] Loading spinner shown during export
- [ ] Success toast shown after export
- [ ] Error toast shown on failure
- [ ] Date range selector updates export data
- [ ] Mobile responsive (export button accessible)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#L1641-1657`] - Story definition and acceptance criteria
- [Source: `convex/reports.ts#L1711-1868`] - Existing export actions to use as patterns
- [Source: `src/app/(auth)/reports/campaigns/page.tsx#L64-126`] - Existing export UI implementation
- [Source: `src/app/(auth)/reports/affiliates/page.tsx#L85-114`] - Existing export UI implementation
- [Source: `src/hooks/useDateRange.ts`] - Shared date range hook
- [Source: `_bmad-output/screens/06-owner-reports.html`] - UX design for Reports page
- [Source: `_bmad-output/project-context.md`] - Technology stack and coding standards
- [Source: `_bmad-output/implementation-artifacts/9-4-date-range-filtering.md`] - Previous story patterns

## Dev Agent Record

### Agent Model Used

kimi-k2.5

### Debug Log References

### Completion Notes List

1. **Task 1 Complete** - Created `/reports/page.tsx` with:
   - Program-level summary metrics (MRR Influenced, Clicks, Conversions, Commissions)
   - Date range selector with campaign filter
   - Export CSV button with RBAC (only owners/managers)
   - Top affiliates table
   - Navigation cards to Campaign and Affiliate reports

2. **Task 2 Complete** - Created Convex functions:
   - `getProgramSummaryMetrics` - Aggregated program metrics with period-over-period comparison
   - `getTopAffiliatesByRevenue` - Top performing affiliates by commission
   - `exportProgramReportCSV` - CSV export action with proper formatting

3. **Task 3 Complete** - Export functionality:
   - Uses `useAction` hook for `exportProgramReportCSV`
   - Loading state with spinner on button
   - Base64 decoding and file download
   - Date-stamped filename (`program-report-YYYY-MM-DD.csv`)
   - Toast notifications for success/error

4. **Task 4 Complete** - Navigation updates:
   - Sidebar "Reports" link now points to `/reports`
   - Sub-navigation cards on Reports page for Campaign and Affiliate performance

### File List

- `src/app/(auth)/reports/page.tsx` (NEW) - Reports index page with metrics and export
- `convex/reports.ts` (MODIFIED) - Added `getProgramSummaryMetrics`, `getTopAffiliatesByRevenue`, `exportProgramReportCSV`
- `src/components/shared/SidebarNav.tsx` (MODIFIED) - Updated Reports link to `/reports`
- `src/lib/utils.ts` (MODIFIED) - Added `downloadCsv` and `decodeCsvContent` utilities
- `src/app/(auth)/reports/campaigns/page.tsx` (MODIFIED) - Refactored to use `downloadCsv` utility
- `src/app/(auth)/reports/affiliates/page.tsx` (MODIFIED) - Refactored to use `downloadCsv` utility

### Change Log

- 2026-03-17: Implemented CSV export functionality for program-level reports
- Added Reports index page with summary metrics and top affiliates table
- Created export action following existing patterns from campaign/affiliate reports
- Updated navigation to use new Reports index page
- 2026-03-17: Code Review Fixes - Added campaign filter info to CSV header, extracted `downloadCsv` utility for reuse across all report pages
