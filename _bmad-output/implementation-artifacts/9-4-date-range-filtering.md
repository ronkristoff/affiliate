# Story 9.4: Date Range Filtering

Status: done

## Story

As a SaaS Owner or Manager,
I want to filter all reports by date range with a custom date picker,
so that I can analyze performance over specific periods beyond preset options. (FR61)

## Acceptance Criteria

### AC1: Date Range Selector with Preset Options
**Given** the user is on any Reports page
**When** they click the date range selector
**Then** a dropdown is displayed with options: Last 7 days, Last 30 days, Last 90 days, Custom
**And** preset options immediately apply the filter
**And** the URL is updated with the selected range

### AC2: Custom Date Picker
**Given** the user clicks "Custom" option
**When** the custom option is selected
**Then** a date picker popover appears
**And** the user can select start and end dates
**And** dates are constrained to valid ranges (start ≤ end, not future dates)
**And** applying the selection updates all metrics on the page

### AC3: URL Parameter Preservation
**Given** the user selects a date range (preset or custom)
**When** the selection is applied
**Then** the URL is updated to preserve the selection
**And** refreshing the page restores the previous date range
**And** preset ranges use `?range=7d` format
**And** custom ranges use `?start=TIMESTAMP&end=TIMESTAMP` format

### AC4: Global Date Range Consistency
**Given** the user sets a date range on any reports page
**When** they navigate to another reports page
**Then** the same date range is maintained across all reports pages
**And** Dashboard, Campaign Performance, and Affiliate Performance all respect the date range

### AC5: Backend Query Compatibility
**Given** custom date range parameters are passed to backend queries
**When** the queries execute
**Then** all existing queries properly filter by the date range
**And** no additional backend changes are needed (queries already support dateRange)

### AC6: Mobile Responsive
**Given** a user accesses reports on mobile
**When** they interact with the date range selector
**Then** the UI is fully responsive and usable on mobile devices
**And** the date picker adapts to smaller screens

## Tasks / Subtasks

- [x] Task 1: Enhance DateRangeSelector with Custom Option (AC: #1, #2)
  - [x] 1.1 Add "Custom" option to dateRangeOptions array
  - [x] 1.2 Create Date Picker Popover using Radix UI Popover
  - [x] 1.3 Integrate date picker with start/end date inputs
  - [x] 1.4 Add validation for start ≤ end date constraint
  - [x] 1.5 Add max date constraint (cannot select future dates)
  - [x] 1.6 Show selected custom range in dropdown trigger button
  - [x] 1.7 Handle apply/cancel actions for custom picker

- [x] Task 2: Update URL Parameter Handling (AC: #3)
  - [x] 2.1 Support `?start=TIMESTAMP&end=TIMESTAMP` URL params for custom ranges
  - [x] 2.2 Support `?range=7d|30d|90d|thisMonth|lastMonth` for presets
  - [x] 2.3 Read URL params on component mount to restore state
  - [x] 2.4 Update URL on date range change without page reload
  - [x] 2.5 Handle invalid URL params gracefully (fallback to default)

- [x] Task 3: Create Shared Date Range Hook (AC: #3, #4)
  - [x] 3.1 Create `useDateRange` hook in `src/hooks/useDateRange.ts`
  - [x] 3.2 Centralize URL param reading/writing logic
  - [x] 3.3 Provide consistent date range state across pages
  - [x] 3.4 Export helper functions for date calculations

- [x] Task 4: Update Reports Pages for Global Consistency (AC: #4)
  - [x] 4.1 Update Dashboard page to use enhanced DateRangeSelector
  - [x] 4.2 Update Campaign Performance page for custom ranges
  - [x] 4.3 Update Affiliate Performance page for custom ranges
  - [x] 4.4 Ensure date range persists across navigation between reports

- [x] Task 5: Add Date Range Display Components (AC: #1, #2)
  - [x] 5.1 Display current date range label in page header
  - [x] 5.2 Show formatted date range in metric cards context
  - [x] 5.3 Add visual indicator when custom range is active

- [x] Task 6: Mobile Responsive Design (AC: #6)
  - [x] 6.1 Ensure dropdown fits on mobile screens
  - [x] 6.2 Make date picker popover scrollable if needed
  - [x] 6.3 Test on mobile viewport sizes (375px+)

- [x] Task 7: Add Accessibility Support
  - [x] 7.1 Ensure date picker is keyboard navigable
  - [x] 7.2 Add ARIA labels for screen readers
  - [x] 7.3 Ensure focus management on open/close

## Dev Notes

### CRITICAL: Existing Infrastructure - DO NOT Recreate

The following already exist and MUST be leveraged:

| Component | Location | Purpose |
|-----------|----------|---------|
| DateRangeSelector | `src/app/(auth)/dashboard/components/DateRangeSelector.tsx` | ENHANCE this - do NOT recreate |
| MetricCard | `src/app/(auth)/dashboard/components/MetricCard.tsx` | Reuse for summary cards |
| Campaign Reports Page | `src/app/(auth)/reports/campaigns/page.tsx` | Already uses DateRangeSelector |
| Affiliate Reports Page | `src/app/(auth)/reports/affiliates/page.tsx` | Already uses DateRangeSelector |
| Dashboard Page | `src/app/(auth)/dashboard/page.tsx` | Already uses DateRangeSelector |
| Convex Reports Queries | `convex/reports.ts` | Already supports `dateRange` param |
| Radix UI Popover | `src/components/ui/popover.tsx` | Use for custom date picker |
| Calendar Component | Check if exists in `src/components/ui/` | For date picker UI |

### Previous Story Learnings (from 9-3-affiliate-performance-metrics)

**What Worked Well:**
- Date range filtering passed to all queries consistently
- URL params preserve state for shareable links
- Period-over-period comparison provides useful context
- Reusing components from previous stories (DateRangeSelector)

**Common Mistakes to Avoid:**
- Do NOT skip URL params for filters - preserve state in URL
- Do NOT create duplicate components - enhance existing ones
- Do NOT forget loading states - show skeletons while fetching
- Do NOT break existing date range functionality - add Custom option alongside presets

### Current DateRangeSelector Implementation

The existing `DateRangeSelector` in `src/app/(auth)/dashboard/components/DateRangeSelector.tsx` has:
- Preset options: 7d, 30d, 90d, thisMonth, lastMonth
- URL param support via `?range=VALUE`
- Dropdown using Radix UI DropdownMenu

**Required Enhancement:**
Add "Custom" option that opens a date picker popover for selecting start/end dates.

### Implementation Pattern

```typescript
// Enhanced dateRangeOptions array
const dateRangeOptions: DateRangeOption[] = [
  { label: "Last 7 days", value: "7d", getRange: () => ({ start: now - 7d, end: now }) },
  { label: "Last 30 days", value: "30d", getRange: () => ({ start: now - 30d, end: now }) },
  { label: "Last 90 days", value: "90d", getRange: () => ({ start: now - 90d, end: now }) },
  { label: "Custom", value: "custom", getRange: () => null }, // Opens date picker
];

// URL params for custom range
// ?start=1699488000000&end=1702166400000
```

### Date Picker Implementation

Use Radix UI Popover with a simple date input:

```typescript
// Pseudocode for custom date picker
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">
      {customRangeLabel || "Select dates"}
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <div className="grid gap-4">
      <div>
        <Label>Start Date</Label>
        <Input type="date" value={startDate} onChange={...} />
      </div>
      <div>
        <Label>End Date</Label>
        <Input type="date" value={endDate} onChange={...} />
      </div>
      <div className="flex gap-2">
        <Button onClick={handleApply}>Apply</Button>
        <Button variant="outline" onClick={handleCancel}>Cancel</Button>
      </div>
    </div>
  </PopoverContent>
</Popover>
```

### URL Parameter Strategy

| Selection Type | URL Format | Example |
|----------------|------------|---------|
| Preset | `?range=VALUE` | `?range=30d` |
| Custom | `?start=TS&end=TS` | `?start=1699488000000&end=1702166400000` |
| Default | No params | Falls back to 30 days |

### Backend Query Compatibility

All existing Convex queries in `convex/reports.ts` already support the `dateRange` parameter:

```typescript
// Existing pattern - no changes needed
export const getCampaignPerformanceList = query({
  args: {
    tenantId: v.id("tenants"),
    dateRange: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    // ...
  },
  handler: async (ctx, args) => {
    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;
    // Filter data by date range...
  },
});
```

### UI Design Reference

**Date Range Selector:**
- Trigger button shows current selection (e.g., "Last 30 days" or "Nov 1 - Dec 15, 2024")
- Dropdown menu with preset options
- "Custom" option at bottom with calendar icon
- Custom picker popover with start/end inputs

**Color System (CSS Variables):**
```css
--brand-primary: #10409a;
--brand-secondary: #1659d6;
--text-heading: #333333;
--text-body: #474747;
--text-muted: #6b7280;
--bg-surface: #ffffff;
--border: #e5e7eb;
```

**Typography:**
- Button text: 13px, weight 500
- Dropdown items: 13px
- Date labels: 12px, weight 500

### File Structure

```
src/
├── app/(auth)/
│   ├── dashboard/
│   │   └── components/
│   │       └── DateRangeSelector.tsx    # ENHANCE: Add custom picker
│   └── reports/
│       ├── campaigns/page.tsx           # Update for custom ranges
│       └── affiliates/page.tsx          # Update for custom ranges
│
├── hooks/
│   └── useDateRange.ts                  # NEW: Shared hook
│
└── components/ui/
    └── popover.tsx                      # Use for date picker
```

### Anti-Pattern Prevention

**DO NOT:**
- Recreate DateRangeSelector - enhance the existing one
- Modify backend queries - they already support dateRange
- Break existing preset functionality - add Custom alongside
- Skip URL params - always preserve state in URL
- Use heavy date picker libraries - use native HTML5 date inputs
- Forget mobile responsiveness - test on small screens
- Omit accessibility - add ARIA labels and keyboard support

### Testing Checklist

- [ ] Preset options still work (7d, 30d, 90d, thisMonth, lastMonth)
- [ ] Custom date picker opens on click
- [ ] Custom range applies to all metrics
- [ ] URL params update correctly for presets
- [ ] URL params update correctly for custom ranges
- [ ] Page refresh restores date range
- [ ] Navigation between reports preserves date range
- [ ] Start date cannot be after end date
- [ ] Cannot select future dates
- [ ] Mobile responsive (test at 375px width)
- [ ] Keyboard navigation works
- [ ] Screen reader compatible

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#L1622-1638`] - Story definition and acceptance criteria
- [Source: `src/app/(auth)/dashboard/components/DateRangeSelector.tsx`] - Existing component to enhance
- [Source: `convex/reports.ts`] - Backend queries already support dateRange
- [Source: `_bmad-output/implementation-artifacts/9-3-affiliate-performance-metrics.md`] - Previous story patterns
- [Source: `_bmad-output/project-context.md`] - Technology stack and coding standards
- [Source: `_bmad-output/planning-artifacts/architecture.md`] - Project structure and boundaries

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Code Review Information

- **Reviewer**: bmad-agent-bmm-dev (AI)
- **Review Date**: 2026-03-16
- **Issues Found**: 3 HIGH, 5 MEDIUM
- **Issues Fixed**: 8/8 (100%)
- **Status After Review**: Approved with fixes applied

### Debug Log References

### Completion Notes List

- Implemented custom date range selection with Radix UI Popover
- Enhanced DateRangeSelector component with custom date picker
- Created shared useDateRange hook for global date range consistency
- Updated Dashboard, Campaign Reports, and Affiliate Reports pages
- Added date range display in page headers
- Implemented URL parameter handling for both presets and custom ranges
- Added validation for date constraints (start ≤ end, no future dates)
- Added ARIA labels and keyboard navigation support

### File List

- src/components/ui/popover.tsx (NEW)
- src/hooks/useDateRange.ts (NEW)
- src/hooks/useDateRange.test.ts (NEW - tests added during review)
- src/app/(auth)/dashboard/components/DateRangeSelector.tsx (MODIFIED)
- src/app/(auth)/dashboard/page.tsx (MODIFIED)
- src/app/(auth)/reports/campaigns/page.tsx (MODIFIED)
- src/app/(auth)/reports/affiliates/page.tsx (MODIFIED)

## Review Follow-ups (AI)

The following issues were identified and fixed during code review:

### CRITICAL Issues Fixed

- [x] **[CRITICAL] setDateRange did NOT update URL params** - Fixed by adding `updateUrlWithDateRange()` helper function in useDateRange hook that updates URL when setDateRange is called (AC3, AC4 now working)
- [x] **[HIGH] URL updates bypassed useDateRange hook** - Fixed DateRangeSelector to not directly manipulate URL via router.push(); URL management is now centralized in useDateRange hook
- [x] **[HIGH] Parent onChange callbacks passed wrong isCustom/preset values** - Fixed handleDateRangeChange callbacks in campaigns/page.tsx and affiliates/page.tsx to use values passed from DateRangeSelector instead of reading stale searchParams

### MEDIUM Issues Fixed

- [x] **[MEDIUM] "Last Month" calculation bug in January** - Fixed in both useDateRange.ts and DateRangeSelector.tsx to correctly handle year boundary using proper date arithmetic
- [x] **[MEDIUM] Date validation used inconsistent end-of-day logic** - Fixed to compare dates at midnight instead of end-of-day, allowing "today" to be selectable as end date
- [x] **[MEDIUM] Missing ARIA live region for error messages** - Added `<div aria-live="polite" aria-atomic="true">` wrapper around error messages in custom date picker (AC7)
- [x] **[MEDIUM] Missing keyboard navigation to close picker** - Added Escape key handler useEffect that closes custom date picker (AC7)
- [x] **[MEDIUM] Missing tests for date range feature** - Created comprehensive test file `src/hooks/useDateRange.test.ts` with tests for initialization, preset parsing, custom ranges, URL updates, and helper functions

### Code Quality Improvements

- [x] Removed unused router import from DateRangeSelector.tsx
- [x] Updated DateRangeSelectorProps interface to include isCustom and preset fields
- [x] Removed unused useSearchParams import from campaigns/page.tsx

## Change Log

- 2026-03-16: Implemented date range filtering feature with custom date picker option
- 2026-03-16: Code review completed - 3 HIGH and 5 MEDIUM issues fixed
