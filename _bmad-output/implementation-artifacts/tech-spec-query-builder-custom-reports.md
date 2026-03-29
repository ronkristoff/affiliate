---
title: "Query Builder for Custom Reports"
slug: "query-builder-custom-reports"
created: "2026-03-29"
status: "implementation-complete"
stepsCompleted: [1, 2, 3, 4]
tech_stack: ["Next.js 16 (App Router)", "Convex 1.32", "TypeScript 5.9", "Tailwind CSS v4", "Radix UI", "Sonner", "Better Auth"]
files_to_modify: ["convex/schema.ts", "convex/queryBuilder.ts", "src/app/(auth)/reports/query-builder/page.tsx", "src/components/query-builder/*.tsx", "src/components/shared/Sidebar.tsx", "src/hooks/useQueryBuilder.ts"]
code_patterns: ["convex-new-function-syntax", "rbac-authenticated-user", "date-range-validator", "pagination-opts-validator", "tenantstats-read-for-summary", "suspense-boundary-wrapper", "datatable-url-state-hook", "async-export-with-storage"]
test_patterns: ["vitest-globals", "frontend-unit-no-rendering"]
---

# Tech-Spec: Query Builder for Custom Reports

**Created:** 2026-03-29

## Overview

### Problem Statement

SaaS Owners need flexible custom reporting beyond the pre-built report pages. Currently, they can only view fixed reports (commissions, payouts, affiliates, campaigns, funnel, fraud) with no ability to:
- Combine data from multiple tables
- Apply custom filters and logic
- Create aggregations tailored to their specific business questions
- Save and share custom report configurations with team members

This limits their ability to do ad-hoc business intelligence analysis.

### Solution

Build a **Query Builder** page under Reports where SaaS Owners can:

**UI Approach: Hybrid**
- **Wizard Flow** — Start with "What do you want to know?" guided questions for beginners
- **Advanced Mode** — Toggle to "Advanced" for power users to manually build queries
- **Pre-built Templates** — Start with 5 templates covering 80% of use cases

**Features:**
1. **Select Tables** — Choose from a curated subset of core tables (not all 30+ tables exposed)
2. **Choose Columns** — Select which fields to display
3. **Add Filters** — Apply conditions with various operators (equals, contains, greater than, etc.)
4. **Add Joins** — Connect related tables (e.g., clicks → conversions → commissions)
5. **Apply Aggregations** — Use COUNT, SUM, AVG, MIN, MAX on numeric fields
6. **Group By** — Group results by one or more fields
7. **Save Configurations** — Store report definitions for reuse with names
8. **Share with Team** — Allow team members (owner/manager roles) to access saved reports
9. **Export** — Download results as CSV/Excel
   - Small datasets (<=5k rows): Direct download
   - Large datasets (>5k rows): Async export → Convex storage → download link
10. **Query Performance**
    - Results paginated (100 rows per page)
    - Query timeout: 60 seconds max
    - Max 3 concurrent exports per tenant

### Scope

**In Scope:**
- Query Builder UI at `/reports/query-builder`
- Hybrid UI: Wizard flow (default) + Advanced mode toggle
- Pre-built report templates (5 templates):
  1. Top Affiliates by Revenue
  2. Campaign Performance Summary
  3. Conversion Funnel Analysis
  4. Payout History
  5. Commission Status Breakdown
- Curated table selection (tenants, users, campaigns, affiliates, clicks, conversions, commissions, payouts, payoutBatches, auditLogs — ~10 tables)
- Filter builder with operators: equals, not equals, contains, greater than, less than, between, in list, is null, is not null
- Table joins (left join pattern) via UI selection
- Aggregations: COUNT, SUM, AVG, MIN, MAX
- GROUP BY functionality
- Save custom report configurations to database
- Share saved reports with team members (view-only access)
- Full data export (CSV/Excel) - no row limit
  - Export runs asynchronously for large datasets (>5k rows)
  - Export generates file in Convex storage, provides download link
  - Export rate limited: max 3 concurrent exports per tenant
- Integration with existing sidebar navigation

**Out of Scope:**
- Full SQL-like subqueries (Option C)
- Cross-tenant visibility for Platform Admin
- Scheduled report generation/email delivery
- Real-time query results streaming
- Visual chart generation from query results (future)
- Public API for third-party integrations

## Context for Development

### Codebase Patterns

- **Convex new function syntax** — All queries/mutations use `query({ args, returns, handler })` pattern
- **Validators required** — ALL functions must have `args` and `returns` validators
- **RBAC pattern** — `getAuthenticatedUser(ctx)` + role check (`owner`/`manager` for sensitive data)
- **Date range pattern** — Shared `dateRangeValidator = v.optional(v.object({ start: v.number(), end: v.number() }))`
- **Pagination pattern** — `paginationOptsValidator` from `convex/server`; returns `{ page, isDone, continueCursor }`
- **Export pattern** — Actions with `"use node"` directive, return base64-encoded CSV; RBAC via `betterAuthComponent.getAuthUser(ctx)`
- **Suspense boundaries** — Client components using hooks MUST be wrapped in `<Suspense>` with skeleton fallbacks
- **Button motion** — All buttons use `<Button>` from `@/components/ui/button` with built-in `btn-motion` CSS
- **No unbounded `.collect()`** — High-volume tables must use `.take(N)`, `.paginate()`, or read from `tenantStats`
- **UI Components** — Uses Radix UI primitives with Tailwind CSS v4 (multi-select, dialog, popover, etc.)

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `convex/schema.ts` | Database schema - add `savedQueries` table |
| `convex/reports.ts` | Existing report queries - pattern reference for query structure |
| `convex/reportsExport.ts` | Export logic - pattern for CSV generation with RBAC |
| `src/app/(auth)/reports/layout.tsx` | Reports layout wrapper |
| `src/app/(auth)/reports/affiliates/page.tsx` | Example report page with date range, export, RBAC |
| `src/components/shared/Sidebar.tsx` | Navigation - add query-builder link |
| `src/components/ui/DataTable.tsx` | Table component for results display |
| `src/components/ui/multi-select.tsx` | For table/column selection |
| `src/hooks/useDateRange.ts` | Date range hook pattern |
| `src/hooks/useDataTableUrlState.ts` | URL state pattern for tables |

### Technical Decisions

- **Table Selection:** Curated whitelist of 10 tables (tenants, users, campaigns, affiliates, clicks, conversions, commissions, payouts, payoutBatches, auditLogs) — no admin/internal tables
- **Query Execution:** Dynamic query builder translates UI config to Convex API calls with parameterization; validated server-side
- **Saved Queries Storage:** New `savedQueries` table in schema with tenant-scoped access
- **Export Strategy:** 
  - Small (<=5k rows): Direct base64 CSV download
  - Large (>5k rows): Async action → Convex storage → signed URL download
- **UI Approach:** Hybrid - Wizard flow for beginners, Advanced mode toggle for power users
- **Pre-built Templates:** 5 templates covering 80% of use cases (Top Affiliates, Campaign Performance, Conversion Funnel, Payout History, Commission Status)
- **Column Metadata:** Define exposed columns per table with name, type (string, number, boolean, date), and description for user display
- **Query State Persistence:** URL state sync for query builder (tables, columns, filters, etc.) so users can share URLs

### Pre-built Template Definitions

| Template Name | Table | Columns | Filters | Aggregations | Group By |
|--------------|-------|---------|---------|--------------|----------|
| Top Affiliates by Revenue | affiliates, commissions | name, email, status | status = 'active' | SUM(commission.amount) | affiliateId |
| Campaign Performance | campaigns, clicks, conversions | name, status, clicks, conversions, conversionRate | date range | COUNT, AVG | campaignId |
| Conversion Funnel | clicks, conversions, commissions | - | date range | COUNT | stage |
| Payout History | payouts, affiliates | affiliate name, amount, status, paidAt | date range | SUM(amount) | status |
| Commission Status | commissions | affiliateId, campaignId, amount, status | date range | COUNT, SUM | status |

### Column Metadata Reference

| Table | Exposed Columns |
|-------|----------------|
| affiliates | name, email, status, referralCode, createdAt |
| campaigns | name, status, description, createdAt |
| clicks | affiliateId, campaignId, clickedAt, ipAddress, userAgent |
| conversions | affiliateId, campaignId, convertedAt, conversionValue |
| commissions | affiliateId, campaignId, amount, status, createdAt |
| payouts | affiliateId, amount, status, createdAt, paidAt |
| payoutBatches | status, totalAmount, createdAt |
| auditLogs | action, actorId, tenantId, createdAt |

## Implementation Plan

### Tasks

#### Phase 1: Backend Foundation

- [x] Task 1: Add `savedQueries` table to schema
  - File: `convex/schema.ts`
  - Action: Add new table with fields: tenantId, name, description, queryConfig (JSON), createdBy, createdAt, updatedAt, isShared, sharedWithRoles
  - Notes: Index by tenant for fast lookups, index on sharedWithRoles for sharing queries

- [x] Task 2: Create query builder Convex functions
  - File: `convex/queryBuilder.ts`
  - Action: Create new file with:
    - `getTableMetadata` query: Returns columns, types for whitelisted tables
    - `executeQuery` mutation: Validates and executes dynamic query from config
    - `saveQuery` mutation: Saves query config to database
    - `updateSavedQuery` mutation: Update existing saved query
    - `listSavedQueries` query: Returns saved queries for tenant
    - `deleteSavedQuery` mutation: Deletes saved query
    - `shareSavedQuery` mutation: Updates sharedWithRoles
    - `validateQueryConfig` internal: Validates query config structure on load
  - Notes: Must validate query config against whitelisted tables/columns, enforce tenant isolation, validate operator-column type compatibility, detect circular joins

- [x] Task 3: Create export action for query results
  - File: `convex/queryBuilderExport.ts`
  - Action: Create export action for CSV format
  - Notes: Use Convex storage for large exports, max 3 concurrent per tenant

- [x] Task 3c: Add export cleanup cron job
  - File: `convex/crons.ts`
  - Action: Add scheduled function to delete export files older than 7 days
  - Notes: Prevent storage bloat from old exports

- [x] Task 3b: Add query cost estimator
  - File: `convex/queryBuilder.ts`
  - Action: Add internal function to estimate query complexity based on tables, joins, filters
  - Notes: Return complexity score, warn if exceeds threshold

#### Phase 2: Frontend Core

- [x] Task 4: Add query-builder route
  - File: `src/app/(auth)/reports/query-builder/page.tsx`
  - Action: Create new page with Suspense wrapper and main QueryBuilder component
  - Notes: Follow pattern from existing report pages

- [x] Task 5: Create QueryBuilder hook
  - File: `src/hooks/useQueryBuilder.ts`
  - Action: Create custom hook for query state management with URL state sync
  - Notes: Handle table selection, column selection, filters, joins, aggregations, groupBy, sync to URL for shareable links

- [x] Task 6: Create TableSelector component
  - File: `src/components/query-builder/TableSelector.tsx`
  - Action: Create dropdown for table selection with search
  - Notes: Use existing multi-select pattern, show table description

- [x] Task 7: Create ColumnSelector component
  - File: `src/components/query-builder/ColumnSelector.tsx`
  - Action: Create multi-select for columns based on selected table
  - Notes: Show column name, type, description

- [x] Task 8: Create FilterBuilder component
  - File: `src/components/query-builder/FilterBuilder.tsx`
  - Action: Create UI for adding/editing filters with operators and value inputs
  - Notes: Support operators: equals, not_equals, contains, gt, lt, gte, lte, between, in_list, is_null, is_not_null. Input types: text for string, number input for numeric, date picker for date, multi-select for "in_list"

- [x] Task 9: Create JoinBuilder component
  - File: `src/components/query-builder/JoinBuilder.tsx`
  - Action: Create UI for adding table joins with field selection
  - Notes: Support left join, show available join fields (e.g., affiliateId), allow user to select which fields to join on

- [x] Task 10: Create AggregationBuilder component
  - File: `src/components/query-builder/AggregationBuilder.tsx`
  - Action: Create UI for adding aggregations and GROUP BY
  - Notes: Support COUNT, SUM, AVG, MIN, MAX

- [x] Task 11: Create ResultsTable component
  - File: `src/components/query-builder/ResultsTable.tsx`
  - Action: Display query results with pagination
  - Notes: Use existing DataTable component, add pagination controls

#### Phase 3: Saved Reports & Sharing

- [x] Task 12: Create SavedQueriesList component
  - File: `src/components/query-builder/SavedQueriesList.tsx`
  - Action: Display saved queries with load/delete/share options
  - Notes: Show query name, description, created date, share status

- [x] Task 13: Create SaveQueryDialog component
  - File: `src/components/query-builder/SaveQueryDialog.tsx`
  - Action: Dialog for saving current query with name/description
  - Notes: Use existing dialog pattern

- [x] Task 14: Create ShareQueryDialog component
  - File: `src/components/query-builder/ShareQueryDialog.tsx`
  - Action: Dialog for sharing with team members
  - Notes: Select roles (manager, viewer), show shared users

#### Phase 4: Pre-built Templates & Export

- [x] Task 15: Create TemplateGallery component
  - File: `src/components/query-builder/TemplateGallery.tsx`
  - Action: Display 5 pre-built templates as clickable cards
  - Notes: Templates: Top Affiliates by Revenue, Campaign Performance, Conversion Funnel, Payout History, Commission Status

- [x] Task 16: Create ExportButton component
  - File: `src/components/query-builder/QueryExportButton.tsx`
  - Action: Handle both direct and async export
  - Notes: Show progress for async, provide download link

#### Phase 5: Integration

- [x] Task 17: Add query-builder to sidebar
  - File: `src/components/shared/Sidebar.tsx`
  - Action: Add navigation link at /reports/query-builder under Reports section
  - Notes: Add after "Fraud" link

- [x] Task 18: Create WizardFlow component (optional for MVP)
  - File: `src/components/query-builder/WizardFlow.tsx`
  - Action: Create guided "What do you want to know?" wizard
  - Notes: Map questions to templates/configs

### Acceptance Criteria

#### Query Execution
- [x] AC1: Given a user selects a table, when they click "Run Query", then results display within 60 seconds
- [x] AC2: Given a user adds a filter with "equals" operator, when running query, then only matching records are returned
- [x] AC3: Given a user adds aggregation (SUM amount), when running query, then correct aggregated value is displayed
- [x] AC4: Given a user adds GROUP BY on status field, when running query, then results are grouped correctly

#### Saved Queries
- [x] AC5: Given a user creates a query, when they click "Save", then query is persisted to database with name
- [x] AC6: Given a user has saved queries, when they visit query builder, then saved queries are listed
- [x] AC7: Given a user clicks on a saved query, when loading, then query config is restored
- [x] AC8: Given a user deletes a saved query, when confirmed, then query is removed from database

#### Sharing
- [x] AC9: Given an owner shares a query with manager, when manager visits, then they can view (not edit) the query
- [x] AC10: Given a query is shared with viewer role, when viewer visits, then they can view and export but not edit/delete

#### Export
- [x] AC11: Given a query returns <=5k rows, when user clicks "Export", then file downloads immediately
- [x] AC12: Given a query returns >5k rows, when user clicks "Export", then export runs async and user receives download link
- [ ] AC13: Given a user has 3 concurrent exports, when they start 4th, then error message is shown

#### Templates
- [x] AC14: Given a user clicks a template card, when loaded, then query is pre-populated with template config
- [x] AC15: Given a user modifies a template query, when they save, then it's saved as new query (not overwriting template)

#### Security
- [x] AC16: Given a user tries to query admin tables (not whitelisted), when they select, then query is rejected with error
- [x] AC17: Given a user from tenant A tries to access tenant B's saved query, when attempted, then access denied error shown
- [x] AC20: Given a user adds "contains" filter on numeric column, when running query, then error shown (operator not valid for type)
- [x] AC21: Given query execution exceeds 60 seconds, when timeout occurs, then error message shown with suggestion to add filters or reduce complexity

#### Reliability
- [x] AC22: Given network fails during export, when user retries, then previously stored export is available for download
- [x] AC24: Given a saved query has corrupted queryConfig JSON, when user loads it, then error message shown and query not executed

#### UI/UX
- [x] AC18: Given a user starts in wizard mode, when they toggle to "Advanced", then they can manually edit all query parts
- [x] AC19: Given query returns results, when pagination exists, then user can navigate between pages

#### Aggregation Edge Cases
- [x] AC23: Given a user adds SUM aggregation without GROUP BY, when running query, then a single row with total is returned

## Additional Context

### Dependencies

- **No external libraries required** - Uses existing UI components (Radix UI, Tailwind)
- **Convex storage** - For async export large files (already available in Convex)
- **No new services** - All functionality uses existing infrastructure

### Testing Strategy

**Unit Tests:**
- Test query config validation (ensure whitelisted tables only)
- Test filter operator logic
- Test aggregation calculations
- Test saved query CRUD operations

**Integration Tests:**
- Test query execution end-to-end
- Test export flow (small and large datasets)
- Test sharing permissions

**Manual Testing:**
- Test query builder with all filter operators
- Test complex joins (3+ tables)
- Test pagination with large result sets
- Test async export with >5k rows
- Test cross-tenant access denial

### Notes

**High-Risk Items:**
- Dynamic query execution could be a security risk - MUST validate all table/column names server-side
- Large result sets could cause memory issues - enforce timeout and result limits
- Complex joins across multiple tables could be slow - consider query complexity limits
- **NEW:** Query complexity could cause timeouts - add complexity estimator, warn users
- **NEW:** Export network failures could lose data - store in Convex, provide download link
- **NEW:** Saved query config could be corrupted - validate structure on load
- **Timeout Handling:** Query timeout is enforced at Convex level (60s). If exceeded, error returned with suggestion to simplify query. No partial results - user must optimize and retry.

**Security Controls (Enhanced):**
- Server-side whitelist validation for ALL tables and columns
- Tenant isolation enforced on every query execution
- Query complexity limits: max 3 joins, 60s timeout, 100 rows/page
- Export rate limiting: max 3 concurrent per tenant
- Sharing restricted to tenant boundary only
- Operator-column type validation (e.g., no "contains" on numeric fields)

**Known Limitations:**
- Pre-built templates limited to 5 for MVP (expandable)
- Wizard mode is basic - maps to templates only (advanced wizard in future)
- No support for subqueries (out of scope)

**Future Considerations:**
- Add more templates based on user feedback
- Enhance wizard with more guided questions
- Add scheduled report delivery (email)
- Add chart visualization from results
- Add public API for third-party integrations
- Add query complexity estimator UI warning
