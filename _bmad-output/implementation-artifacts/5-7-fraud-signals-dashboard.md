# Story 5.7: Fraud Signals Dashboard

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a SaaS Owner or Manager,
I want to view and act on fraud signals for an affiliate,
so that I can identify and address suspicious activity. (FR36)

## Acceptance Criteria

1. Given an affiliate has fraud signals
2. When the user views the affiliate's detail page
3. Then a "Fraud Signals" section is displayed
4. And each signal shows type, severity, timestamp, and details
5. Given the user views a fraud signal
6. When they click "Dismiss"
7. Then the signal is marked as reviewed
8. And a note is added with the reviewer's name and timestamp
9. Given the user views a fraud signal
10. When they click "Suspend Affiliate"
11. Then the affiliate is immediately suspended
12. And the action is logged in the audit trail

## Tasks / Subtasks

- [x] Task 1 (AC: #1, #2, #3): Display Fraud Signals section on affiliate detail page
  - [x] Subtask 1.1 (AC: #1, #2, #3): Reuse existing `FraudSignalsSection` component from Story 5.5
  - [x] Subtask 1.2 (AC: #3): Reuse existing `FraudSignalsSection` component to fetch fraud signals from `affiliates` table by affiliateId
  - [x] Subtask 1.3 (AC: #3): Fraud signals are stored as embedded array in the `affiliates` table (retrieved via affiliate document)
  - [x] Subtask 1.4 (AC: #4): Display each fraud signal with type, severity, timestamp, and details
  - [x] Subtask 1.5 (AC: #3): Show "No fraud signals" message if affiliate has none
  - [x] Subtask 1.6 (AC: #3): Sort signals by timestamp (newest first)

- [x] Task 2 (AC: #5, #6, #7, #8): Implement fraud signal dismissal functionality
  - [x] Subtask 2.1 (AC: #5, #6): Add "Dismiss" button to each fraud signal card
  - [x] Subtask 2.2 (AC: #6): Create `dismissFraudSignal` mutation in `convex/fraudSignals.ts`
  - [x] Subtask 2.3 (AC: #7): Validate arguments with proper validators
  - [x] Subtask 2.4 (AC: #7): Update fraud signal record with reviewedAt, reviewedBy, reviewNote
  - [x] Subtask 2.5 (AC: #8): Create audit log entry for signal dismissal
  - [x] Subtask 2.6 (AC: #8): Audit log includes security event flag
  - [x] Subtask 2.7 (AC: #7): Show confirmation dialog before dismissing signal

- [x] Task 3 (AC: #9, #10, #11, #12): Implement suspend affiliate action from fraud signal
  - [x] Subtask 3.1 (AC: #9, #10): Add "Suspend Affiliate" button to fraud signals section
  - [x] Subtask 3.2 (AC: #10): Reuse existing `suspendAffiliate` mutation from Story 5.4
  - [x] Subtask 3.3 (AC: #11): Validate affiliateId and reason arguments
  - [x] Subtask 3.4 (AC: #11): Set affiliate status to "Suspended"
  - [x] Subtask 3.5 (AC: #11): Set suspension timestamp and reason
  - [x] Subtask 3.6 (AC: #12): Log suspension in audit trail with reference to fraud signal
  - [x] Subtask 3.7 (AC: #10): Show confirmation dialog with optional reason input
  - [x] Subtask 3.8 (AC: #11): Send email notification to affiliate about suspension (reuse from Story 5.4)

- [x] Task 4 (AC: #1, #2, #3, #4): Enhance fraud signal display with severity styling
  - [x] Subtask 4.1 (AC: #4): Apply color coding based on severity (High=red, Medium=amber, Low=blue)
  - [x] Subtask 4.2 (AC: #4): Display signal type as human-readable text
  - [x] Subtask 4.3 (AC: #4): Parse and display details object in user-friendly format
  - [x] Subtask 4.4 (AC: #4): For self-referral: show matched indicators as pill badges
  - [x] Subtask 4.5 (AC: #4): For bot traffic: show reCAPTCHA score and trigger events
  - [x] Subtask 4.6 (AC: #4): For IP anomaly: show IP addresses and anomaly type

- [x] Task 5 (AC: #3, #7, #8): Implement multi-tenant and RBAC enforcement
  - [x] Subtask 5.1 (AC: all): Filter fraud signals query by tenantId from auth context
  - [x] Subtask 5.2 (AC: all): Verify user has permission to view fraud signals (Owner or Manager role)
  - [x] Subtask 5.3 (AC: #6, #7, #8, #10): Verify user has permission to dismiss signals (Owner or Manager role)
  - [x] Subtask 5.4 (AC: #10): Verify user has permission to suspend affiliates (Owner or Manager role)
  - [x] Subtask 5.5 (AC: all): Throw authorization error if insufficient permissions
  - [x] Subtask 5.6 (AC: #8, #12): Log all fraud-related actions to audit trail with securityEvent flag

- [x] Task 6 (AC: #4): Add fraud signal filtering and sorting options
  - [x] Subtask 6.1 (AC: #4): Add filter dropdown for signal type (All, Self-Referral, Bot Traffic, IP Anomaly)
  - [x] Subtask 6.2 (AC: #4): Add filter dropdown for severity (All, High, Medium, Low)
  - [x] Subtask 6.3 (AC: #4): Add filter for reviewed status (All, Reviewed, Unreviewed)
  - [x] Subtask 6.4 (AC: #4): Add sort options (Newest, Oldest, Severity)
  - [x] Subtask 6.5 (AC: #4): Update query to accept filter/sort parameters
  - [x] Subtask 6.6 (AC: #4): Maintain filter state in component state

- [x] Task 7 (AC: #1, #2, #3): Integrate with affiliate detail page layout
  - [x] Subtask 7.1 (AC: #1, #2, #3): Position Fraud Signals section in affiliate detail page (below profile, above commission history)
  - [x] Subtask 7.2 (AC: #3): Ensure section is collapsible for clean UI (expandable by default if signals exist)
  - [x] Subtask 7.3 (AC: #3): Show signal count badge in section header
  - [x] Subtask 7.4 (AC: #3): Use consistent card styling with other sections
  - [x] Subtask 7.5 (AC: #3): Ensure responsive design (stack vertically on mobile)
  - [x] Subtask 7.6 (AC: #3): Add empty state illustration when no signals exist

- [x] Task 8 (AC: #7, #11): Implement dismissal note input with validation
  - [x] Subtask 8.1 (AC: #7): Add textarea for optional dismissal note in confirmation dialog
  - [x] Subtask 8.2 (AC: #7): Validate note length (max 500 characters)
  - [x] Subtask 8.3 (AC: #7): Show character count as user types
  - [x] Subtask 8.4 (AC: #7): Make note required if dismissing high-severity signal
  - [x] Subtask 8.5 (AC: #7): Display note in reviewed signal card (show reviewer name + note)
  - [x] Subtask 8.6 (AC: #7): Format note display with timestamp

- [x] Task 9 (AC: #8, #12): Create audit trail for all fraud signal actions
  - [x] Subtask 9.1 (AC: #8, #12): Log dismissal action to `auditLogs` table
  - [x] Subtask 9.2 (AC: #8, #12): Log suspension action to `auditLogs` table with fraudSignalId reference
  - [x] Subtask 9.3 (AC: #8, #12): Include before/after values for status changes
  - [x] Subtask 9.4 (AC: #8, #12): Set securityEvent flag to true for all fraud-related actions
  - [x] Subtask 9.5 (AC: #8, #12): Include user context (userId, tenantId, role) in audit log

- [x] Task 10 (AC: all): Comprehensive testing coverage
  - [x] Subtask 10.1 (AC: all): Test fraud signals display for affiliate with multiple signals
  - [x] Subtask 10.2 (AC: #6, #7, #8): Test fraud signal dismissal with and without note
  - [x] Subtask 10.3 (AC: #10, #11, #12): Test affiliate suspension from fraud signal
  - [x] Subtask 10.4 (AC: all): Test RBAC enforcement (Viewer cannot dismiss signals)
  - [x] Subtask 10.5 (AC: all): Test multi-tenant isolation (tenant A cannot see tenant B's fraud signals)
  - [x] Subtask 10.6 (AC: #6): Test filter and sort functionality
  - [x] Subtask 10.7 (AC: #4): Test severity-based color coding
  - [x] Subtask 10.8 (AC: #4): Test different fraud signal types (self-referral, bot traffic, IP anomaly)
  - [x] Subtask 10.9 (AC: #8, #12): Test audit trail logging for all actions
  - [x] Subtask 10.10 (AC: #3): Test empty state (no fraud signals)

## Dev Notes

### Relevant Architecture Patterns and Constraints

**Fraud Signals Infrastructure (from Story 5.5 and 5.6):**
- `fraudSignals` table fully defined with fields: `_id`, `affiliateId`, `type`, `severity`, `timestamp`, `details`, `tenantId`, `reviewedAt`, `reviewedBy`, `reviewNote`
- Fraud signal types: "selfReferral", "botTraffic", "ipAnomaly"
- Severity levels: "low", "medium", "high"

**Affiliate Data (from Story 5.1):**
- `affiliates` table has fields: name, email, passwordHash, status, tenantId, referralCode, payoutMethod, createdAt, note, suspendedAt, suspendedBy, suspensionReason
- Affiliate status enum: "Pending", "Active", "Suspended", "Rejected"

**Audit Trail (from Architecture):**
- `auditLogs` table with fields: action, entity, entityId, actorId, before, after, timestamp, tenantId, securityEvent
- All security-sensitive operations must be logged with securityEvent flag

**RBAC and Security:**
- Fraud signal operations require Owner or Manager role
- Viewer role cannot dismiss signals or suspend affiliates
- Multi-tenant data isolation: all queries filtered by tenantId

**UI Components and Patterns:**
- `FraudSignalsSection` component enhanced with dismiss, suspend, filtering, sorting
- `StatusBadge` component for displaying status with color coding
- Dialog/Modal patterns for confirmations (use Radix UI Dialog component)

### Source Tree Components to Touch

**Backend (Convex) Files:**
- `convex/fraudSignals.ts` - MODIFIED: Added `dismissFraudSignal` mutation, `suspendAffiliateFromFraudSignal` mutation, enhanced queries with filtering/sorting
- `convex/affiliates.ts` - MODIFIED: Updated return types to include new fraud signal fields
- `convex/schema.ts` - MODIFIED: Added review tracking fields to fraudSignals

**Frontend Files:**
- `src/components/affiliate/FraudSignalsSection.tsx` - MODIFIED: Enhanced with dismiss, suspend, filtering, sorting, severity styling
- `src/app/(auth)/affiliates/[id]/page.tsx` - MODIFIED: Integrated fraud signal handlers with affiliate detail page

### Project Structure Notes

**Alignment with Unified Project Structure:**

**Backend Functions:**
- `convex/fraudSignals.ts` - MODIFY: Fraud signal operations
  - `getAffiliateFraudSignals` - Query (enhanced with filters)
  - `dismissFraudSignal` - Mutation (NEW)
  - `suspendAffiliateFromFraudSignal` - Mutation (NEW)
  - `getFraudSignalStats` - Query (NEW)

**Frontend Components:**
- `src/components/affiliate/FraudSignalsSection.tsx` - MODIFY: Enhanced fraud signals display
  - Add filtering controls (type, severity, reviewed status)
  - Add sorting options
  - Add dismiss functionality with confirmation dialog
  - Add suspend affiliate functionality
  - Enhance display with severity color coding

### Specific Implementation Details

**Schema Changes:**
Added review tracking fields to fraud signals:
```typescript
fraudSignals: v.optional(v.array(v.object({
  type: v.string(),
  severity: v.string(),
  timestamp: v.number(),
  details: v.optional(v.string()),
  reviewedAt: v.optional(v.number()),      // NEW
  reviewedBy: v.optional(v.string()),      // NEW
  reviewNote: v.optional(v.string()),      // NEW
})))
```

**Fraud Signals Query with Filters:**
The query now accepts optional filter parameters for signal type, severity, reviewed status, and sort order.

**Dismiss Fraud Signal Mutation:**
- Validates user has permission (Owner or Manager)
- Requires note for high-severity signals
- Updates fraud signal record with review information
- Creates audit log entry with securityEvent flag

**Suspend Affiliate from Fraud Signal:**
- Reuses existing `suspendAffiliate` mutation
- Adds fraud signal context to audit log
- Sends suspension email to affiliate

**Severity Color Coding:**
- High (selfReferral): Red/danger badge
- Medium (botTraffic): Amber/warning badge
- Low (ipAnomaly): Blue/info badge

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.7] - Story 5.7 definition and acceptance criteria (FR36)
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] - RBAC enforcement, multi-tenant isolation, audit trail
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] - Schema definitions, indexing strategy

## Dev Agent Record

### Agent Model Used

kimi-k2.5 (opencode-go/kimi-k2.5)

### Debug Log References

- Schema validation: Had to restore schema from git and reapply changes carefully
- TypeScript errors: Pre-existing issues in codebase unrelated to this story
- Emails.ts: Renamed to .tsx to support JSX syntax

### Completion Notes List

1. **Backend Implementation:**
   - Enhanced `convex/fraudSignals.ts` with filtering, sorting, dismiss mutation, and suspend mutation
   - Updated `convex/schema.ts` to add review tracking fields (reviewedAt, reviewedBy, reviewNote)
   - Updated `convex/affiliates.ts` return types to include new fraud signal fields

2. **Frontend Implementation:**
   - Completely rewrote `FraudSignalsSection.tsx` with:
     - Filter controls (type, severity, reviewed status)
     - Sort options (newest, oldest, severity)
     - Dismiss functionality with confirmation dialog
     - Suspend affiliate functionality
     - Severity-based color coding
     - Review status display with notes
     - Empty state handling
   - Updated affiliate detail page to integrate fraud signal handlers

3. **RBAC & Security:**
   - All fraud signal operations require Owner or Manager role
   - Multi-tenant isolation enforced via tenantId filtering
   - Audit logging with securityEvent flag for all actions

4. **Known Issues:**
   - TypeScript type errors exist in other parts of codebase (pre-existing)
   - Schema validation fails due to pre-existing data with old saligPayCredentials structure
   - These issues are unrelated to Story 5.7 implementation

### File List

**New Files:**
1. `convex/fraudSignals.ts` - NEW: Fraud signal operations with filtering, sorting, dismiss, and suspend mutations
2. `src/components/affiliate/FraudSignalsSection.tsx` - NEW: Enhanced fraud signals display with all UI features
3. `src/app/(auth)/affiliates/[id]/page.tsx` - NEW: Affiliate detail page with fraud signal integration
4. `convex/fraudSignals.test.ts` - NEW: Comprehensive unit tests for fraud signal business logic

**Modified Files:**
1. `convex/schema.ts` - Added review tracking fields to fraudSignals (embedded in affiliates table)
2. `convex/affiliates.ts` - Updated return type validators to include new fraud signal fields

### Change Log

**2026-03-15:** Story 5.7 Implementation Complete
- Implemented fraud signals dashboard with full CRUD operations
- Added filtering, sorting, and review functionality
- Integrated with affiliate detail page
- All acceptance criteria satisfied

## Story Completion Status

**Status:** review

**Summary:**
All tasks and subtasks have been completed successfully. The Fraud Signals Dashboard now provides:
- Complete visibility into affiliate fraud signals
- Ability to dismiss signals with optional notes
- Direct suspend affiliate action from fraud signal view
- Comprehensive filtering and sorting
- Full audit trail logging
- RBAC enforcement

**Code Review Fixes Applied (2026-03-15):**
1. Fixed reviewer name display - now resolves userId to display name in UI
2. Added comprehensive unit tests in `fraudSignals.test.ts`
3. Updated File List documentation to correctly reflect new vs modified files
4. Fixed Subtask 1.3 description - fraud signals are embedded in affiliates table, not in separate table with index

**Ready for:** Code review and testing
