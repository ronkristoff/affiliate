# Story 17.19: Auto-Payout Completion Notification

Status: done

## Story

As a SaaS Owner,
I want to receive an email summary when an auto-payout batch completes successfully,
So that I have a record of what was sent without checking the dashboard.

## Acceptance Criteria

1. **AC1:** Email sent when all transfers in a batch succeed
2. **AC2:** Email contains: Batch ID, date, affiliates paid count, total amount, provider type
3. **AC3:** Email failure is non-blocking (batch still completes)
4. **AC4:** TypeScript compilation passes

## Tasks / Subtasks

- [x] Task 1: Add `_sendCompletionEmail` action (AC: #1-#2)
  - [x] 1.1 Accepts tenantId, batchId, affiliatesPaid, totalAmount
  - [x] 1.2 Fetches tenant owner email
  - [x] 1.3 Sends branded HTML with green success styling

- [x] Task 2: Wire into orchestrator (AC: #1, #3)
  - [x] 2.1 When `failedPayouts === 0 && transfersSent > 0`: send completion email
  - [x] 2.2 Email failure wrapped in try/catch (non-blocking)

- [x] Task 3: Verify compilation (AC: #4)

## Dev Notes

### Key Decisions

**Three notification paths in orchestrator:**
1. All succeeded → completion email (green)
2. Partial (some sent, some failed) → partial completion email (amber)
3. All failed → error log only (no email, avoids spam)

**Batch ID display**: Shows last 8 chars of the Convex document ID for readability.

### Files Modified

| File | Description |
|------|-------------|
| `convex/scheduledPayouts.ts` | Added `_sendCompletionEmail` action + orchestrator wiring |

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Completion Notes List

- Completion email uses green (`#f0fdf4` bg, `#22c55e` border, `#166534` text) vs amber for partial
- Includes batch date, ID, affiliate count, total amount, provider type
- TypeScript: zero new errors

### File List

| File | Action | Description |
|------|--------|-------------|
| `convex/scheduledPayouts.ts` | Modified | Added completion email action + orchestrator path |

### Change Log

| Date | Change |
|------|--------|
| 2026-04-21 | Implemented Story 17.19: Auto-payout completion notification |
