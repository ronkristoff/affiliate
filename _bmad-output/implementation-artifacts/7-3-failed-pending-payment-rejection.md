# Story 7.3: Failed/Pending Payment Rejection

Status: done

## Story

As a platform system,
I want to detect and reject commission creation for payments with FAILED or PENDING status,
so that commissions are only created for confirmed payments. (FR24)

## Business Context

This story implements payment status validation in the Commission Engine to ensure financial integrity. The system must reject commission creation for non-confirmed payment statuses while maintaining proper audit trails.

**Key Business Value:**
- Prevents commission awards for failed transactions (no affiliate payout for failed payments)
- Prevents premature commission awards for pending payments (awaiting confirmation)
- Ensures commissions are only created for confirmed/successful payments
- Maintains complete audit trail for all payment status decisions

**Financial Accuracy Requirement:**
- Commission accuracy: 99.99% — financial precision mandatory
- No commission should ever be created for a payment that ultimately fails
- Pending payments should be tracked but not generate commissions until confirmed

**Dependencies:**
- **Story 7.1** (DONE) - Payment Updated Event Processing - established commission processing pipeline
- **Story 7.2** (DONE) - Subscription Lifecycle Event Processing - handles subscription events
- **Story 6.5** (DONE) - Mock Payment Webhook Processing - webhook normalization infrastructure

**Related Stories in Epic 7:**
- Story 7.4: Commission Reversal (for handling refunds after initial approval)
- Story 7.5: Event Deduplication
- Story 7.6: Raw Event Storage

## Acceptance Criteria

### AC1: Failed Payment Rejection
**Given** a `payment.updated` event with payment status "failed"
**When** the event is processed
**Then** no commission is created
**And** the event is logged in `rawWebhooks` with status "processed" and rejection reason "Payment failed"
**And** an audit log entry is created with action "commission_rejected_payment_failed"

### AC2: Pending Payment Rejection
**Given** a `payment.updated` event with payment status "pending"
**When** the event is processed
**Then** no commission is created
**And** the event is logged in `rawWebhooks` with status "processed" and reason "Payment pending confirmation"
**And** an audit log entry is created with action "commission_rejected_payment_pending"

### AC3: Completed Payment Processing
**Given** a `payment.updated` event with payment status "paid" (or "completed")
**When** the event is processed
**Then** a commission is created (subject to other validations from Story 7.1)
**And** the event is logged in `rawWebhooks` with status "processed"

### AC4: Subscription Event Payment Status Validation
**Given** a `subscription.created` or `subscription.updated` event with payment status "failed" or "pending"
**When** the event is processed
**Then** no commission is created
**And** the event is logged with appropriate rejection reason

### AC5: Idempotency
**Given** a duplicate payment event with the same eventId
**When** the event is processed
**Then** the duplicate is rejected
**And** no duplicate rejection log is created

### AC6: Audit Trail Completeness
**Given** any payment status rejection (failed or pending)
**When** the rejection is processed
**Then** the raw webhook is stored with rejection reason
**And** the status is set to "processed" (not "failed")
**And** the errorMessage field contains the specific rejection reason

## Tasks / Subtasks

- [x] Task 1 (AC: #1): Implement failed payment rejection in commission engine
  - [x] Subtask 1.1: Add explicit FAILED status check in `processPaymentUpdatedToCommission`
  - [x] Subtask 1.2: Create rejection reason constant for failed payments
  - [x] Subtask 1.3: Log to rawWebhooks with rejection reason "Payment failed"
  - [x] Subtask 1.4: Create audit log entry with action "commission_rejected_payment_failed"

- [x] Task 2 (AC: #2): Implement pending payment rejection in commission engine
  - [x] Subtask 2.1: Add explicit PENDING status check in `processPaymentUpdatedToCommission`
  - [x] Subtask 2.2: Create rejection reason constant for pending payments
  - [x] Subtask 2.3: Log to rawWebhooks with rejection reason "Payment pending confirmation"
  - [x] Subtask 2.4: Create audit log entry with action "commission_rejected_payment_pending"

- [x] Task 3 (AC: #3): Verify completed payment processing
  - [x] Subtask 3.1: Verify existing "paid" status handling in `processPaymentUpdatedToCommission`
  - [x] Subtask 3.2: Ensure "completed" status is also treated as valid
  - [x] Subtask 3.3: Add test case for "completed" status

- [x] Task 4 (AC: #4): Update subscription event processors
  - [x] Subtask 4.1: Update `processSubscriptionCreatedEvent` with explicit status logging
  - [x] Subtask 4.2: Update `processSubscriptionUpdatedEvent` with explicit status logging
  - [x] Subtask 4.3: Ensure consistent rejection reason format across all processors

- [x] Task 5 (AC: #5, #6): Enhance audit trail for rejections
  - [x] Subtask 5.1: Create helper function `logPaymentRejection` for consistent logging
  - [x] Subtask 5.2: Include payment ID, amount, and status in audit metadata
  - [x] Subtask 5.3: Verify errorMessage is set correctly in rawWebhooks

- [x] Task 6 (AC: all): Integration testing
  - [x] Subtask 6.1: Test payment.updated with "failed" status → no commission, logged
  - [x] Subtask 6.2: Test payment.updated with "pending" status → no commission, logged
  - [x] Subtask 6.3: Test payment.updated with "paid" status → commission created
  - [x] Subtask 6.4: Test payment.updated with "completed" status → commission created
  - [x] Subtask 6.5: Test subscription.created with "pending" status → no commission, logged
  - [x] Subtask 6.6: Test subscription.updated with "failed" status → no commission, logged
  - [x] Subtask 6.7: Verify audit log entries for all rejection cases

## Dev Notes

### Critical Architecture Patterns (MUST FOLLOW)

**From architecture.md:**
- Use `internalAction` for orchestration that calls external services
- Use `internalMutation` for database writes (private operations)
- Use `internalQuery` for internal reads
- Include tenant filtering for multi-tenant isolation
- Audit trail required for all commission events

**From project-context.md:**
- NEW Function Syntax Required with validators
- All functions MUST have argument and return validators using `v` from `convex/values`
- Use `internal` object from `_generated/api` for internal function calls

### Existing Code Analysis

**Current implementation in `convex/commissionEngine.ts`:**

The existing code already has basic payment status filtering:

```typescript
// In processPaymentUpdatedToCommission (line 162):
if (event.payment.status !== "paid") {
  console.log(`Webhook ${event.eventId}: Payment status is ${event.payment.status}, not creating conversion`);
  await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
    webhookId: rawWebhookId,
    status: "processed",
    errorMessage: `Payment status is ${event.payment.status} - no conversion created`,
  });
  return { conversionId: null, commissionId: null, processed: true, organic: false };
}
```

**What needs to be added for Story 7.3:**
1. Explicit handling for FAILED status with specific rejection reason
2. Explicit handling for PENDING status with specific rejection reason
3. Audit log entries for rejection decisions
4. Support for "completed" as valid status (in addition to "paid")

### Payment Status Types (from webhooks.ts)

```typescript
export type PaymentStatus = "paid" | "pending" | "failed";
```

**Status handling:**
- `"paid"` → Create commission (confirmed payment)
- `"completed"` → Create commission (alternative confirmed status)
- `"pending"` → Reject commission (awaiting confirmation)
- `"failed"` → Reject commission (payment failed)

### Implementation Approach

**Option A: Enhance existing status check with explicit rejection handling**

```typescript
// In processPaymentUpdatedToCommission
const paymentStatus = event.payment.status;

// Define valid confirmed statuses
const CONFIRMED_STATUSES = ["paid", "completed"] as const;

if (!CONFIRMED_STATUSES.includes(paymentStatus as any)) {
  // Determine rejection reason based on status
  let rejectionReason: string;
  let auditAction: string;
  
  if (paymentStatus === "failed") {
    rejectionReason = "Payment failed";
    auditAction = "commission_rejected_payment_failed";
  } else if (paymentStatus === "pending") {
    rejectionReason = "Payment pending confirmation";
    auditAction = "commission_rejected_payment_pending";
  } else {
    rejectionReason = `Payment status '${paymentStatus}' not confirmed`;
    auditAction = "commission_rejected_payment_unknown";
  }
  
  // Log rejection
  await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
    webhookId: rawWebhookId,
    status: "processed",
    errorMessage: rejectionReason,
  });
  
  // Create audit log for rejection
  await ctx.runMutation(internal.audit.logAuditEventInternal, {
    tenantId: event.tenantId as Id<"tenants">,
    action: auditAction,
    entityType: "payment",
    entityId: event.payment.id,
    actorType: "system",
    metadata: {
      paymentStatus,
      paymentAmount: event.payment.amount,
      currency: event.payment.currency,
      eventId: event.eventId,
    },
  });
  
  return { conversionId: null, commissionId: null, processed: true, organic: false };
}
```

**Option B: Create helper function for consistent rejection logging**

```typescript
/**
 * Helper function to log payment rejection with audit trail
 */
async function logPaymentRejection(
  ctx: any,
  args: {
    webhookId: Id<"rawWebhooks">;
    tenantId: Id<"tenants">;
    paymentId: string;
    paymentStatus: string;
    paymentAmount: number;
    currency: string;
    eventId: string;
  }
): Promise<void> {
  let rejectionReason: string;
  let auditAction: string;
  
  if (args.paymentStatus === "failed") {
    rejectionReason = "Payment failed";
    auditAction = "commission_rejected_payment_failed";
  } else if (args.paymentStatus === "pending") {
    rejectionReason = "Payment pending confirmation";
    auditAction = "commission_rejected_payment_pending";
  } else {
    rejectionReason = `Payment status '${args.paymentStatus}' not confirmed`;
    auditAction = "commission_rejected_payment_unknown";
  }
  
  // Update webhook status with rejection reason
  await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
    webhookId: args.webhookId,
    status: "processed",
    errorMessage: rejectionReason,
  });
  
  // Create audit log entry
  await ctx.runMutation(internal.audit.logAuditEventInternal, {
    tenantId: args.tenantId,
    action: auditAction,
    entityType: "payment",
    entityId: args.paymentId,
    actorType: "system",
    metadata: {
      paymentStatus: args.paymentStatus,
      paymentAmount: args.paymentAmount,
      currency: args.currency,
      eventId: args.eventId,
    },
  });
}
```

### Files to Modify

1. **`convex/commissionEngine.ts`** - Main changes:
   - Update `processPaymentUpdatedToCommission` with explicit status rejection
   - Update `processSubscriptionCreatedEvent` with explicit status rejection
   - Update `processSubscriptionUpdatedEvent` with explicit status rejection
   - Add helper function `logPaymentRejection` for consistent logging

2. **`convex/webhooks.ts`** - No changes needed:
   - `PaymentStatus` type already includes "paid", "pending", "failed"
   - `normalizeToBillingEvent` already handles status normalization

3. **`convex/audit.ts`** - Verify exists:
   - `logAuditEventInternal` mutation should exist for audit logging

### Constants for Rejection Reasons

```typescript
// Payment rejection reasons
export const PAYMENT_REJECTION_REASONS = {
  FAILED: "Payment failed",
  PENDING: "Payment pending confirmation",
  UNKNOWN: (status: string) => `Payment status '${status}' not confirmed`,
} as const;

// Audit actions for payment rejection
export const PAYMENT_REJECTION_AUDIT_ACTIONS = {
  FAILED: "commission_rejected_payment_failed",
  PENDING: "commission_rejected_payment_pending",
  UNKNOWN: "commission_rejected_payment_unknown",
} as const;

// Valid confirmed payment statuses
export const CONFIRMED_PAYMENT_STATUSES = ["paid", "completed"] as const;
```

### Processing Flow (Updated)

```
1. Webhook received at /api/webhooks/saligpay
   ↓
2. Parse JSON payload
   ↓
3. Check for duplicate eventId (checkEventIdExists)
   ↓ (if duplicate)
   └─→ Return 200, log duplicate, HALT
   ↓ (if new)
4. Store raw webhook with status "received"
   ↓
5. Normalize to BillingEvent format
   ↓
6. Route based on eventType:
   ├─→ payment.updated → processPaymentUpdatedToCommission
   ├─→ subscription.created → processSubscriptionCreatedEvent
   └─→ subscription.updated → processSubscriptionUpdatedEvent
   ↓
7. *** Story 7.3: Payment Status Validation ***
   Check payment.status:
   ├─→ "failed" → Log rejection, create audit entry, no commission
   ├─→ "pending" → Log rejection, create audit entry, no commission
   └─→ "paid"/"completed" → Continue to commission creation
   ↓
8. Process commission (Story 7.1/7.2 logic)
   ↓
9. Update webhook status to "processed"
   ↓
10. Return 200
```

### Previous Story Intelligence (Story 7.1 & 7.2)

**Critical patterns already implemented:**
1. **BillingEvent normalization** - `normalizeToBillingEvent()` in webhooks.ts
2. **Event deduplication** - `checkEventIdExists()` internal query
3. **Raw webhook storage** - `storeRawWebhook()` internal mutation
4. **Status update** - `updateWebhookStatus()` internal mutation
5. **Basic payment status check** - Already rejects non-"paid" status

**Files modified in previous stories:**
- `convex/commissionEngine.ts` - Payment and subscription event processing
- `convex/http.ts` - Updated webhook routing
- `convex/conversions.ts` - Conversion creation functions
- `convex/commissions.ts` - Commission creation functions

**Key learnings to apply:**
- Always return 200 status on webhooks (even on rejection)
- Store ALL webhooks for audit trail before processing
- Use internal functions for all processing steps
- Log rejection reasons internally, don't expose to client
- Reuse existing functions - don't reinvent

### Anti-Patterns to Avoid

1. **DON'T set webhook status to "failed"** - Use "processed" with errorMessage for rejections
2. **DON'T create commissions for pending payments** - Wait for confirmation
3. **DON'T skip audit logging** - All rejections must have audit trail
4. **DON'T use generic rejection messages** - Be specific about failed vs pending
5. **DON'T forget tenant isolation** - Include tenantId in audit logs
6. **DON'T throw errors for rejected payments** - Return gracefully with processed=true
7. **DON'T forget to handle "completed" status** - Some systems use this instead of "paid"

### Common Pitfalls

1. **Status string comparison**: Ensure case-insensitive comparison or normalize status to lowercase.

2. **Audit log entity type**: Use "payment" as entityType, not "commission" (since no commission is created).

3. **Webhook status**: Set to "processed" not "failed" - the webhook was processed successfully, it just resulted in a rejection.

4. **Error message field**: Use `errorMessage` field in rawWebhooks for rejection reason (it's not just for errors).

5. **Duplicate rejection logs**: Don't create audit logs for duplicate events - they're already logged as "duplicate" status.

### Testing Requirements

**Test file:** `convex/commissionEngine.test.ts` (extend existing)

**Test cases:**
1. `payment.updated` with "failed" status → no commission, rejection logged, audit entry created
2. `payment.updated` with "pending" status → no commission, rejection logged, audit entry created
3. `payment.updated` with "paid" status → commission created (existing behavior)
4. `payment.updated` with "completed" status → commission created
5. `subscription.created` with "pending" status → no commission, rejection logged
6. `subscription.updated` with "failed" status → no commission, rejection logged
7. `subscription.updated` with "paid" status → commission created (existing behavior)
8. Duplicate failed event → no duplicate rejection log
9. Verify audit log metadata includes payment ID, amount, and status
10. Verify rawWebhooks.errorMessage contains correct rejection reason

### Security Considerations

1. **Idempotency** - EventId deduplication prevents double logging
2. **Tenant isolation** - All queries filter by tenantId
3. **Audit trail** - All rejection decisions logged to auditLogs table
4. **Error hiding** - Never expose internal errors in webhook responses
5. **Financial integrity** - No commission can be created for failed/pending payments

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3] - Story definition and acceptance criteria (FR24)
- [Source: _bmad-output/planning-artifacts/architecture.md] - HTTP endpoint patterns, Convex function patterns
- [Source: _bmad-output/planning-artifacts/prd.md] - FR24 specification, commission accuracy requirements
- [Source: convex/schema.ts] - rawWebhooks table, auditLogs table
- [Source: convex/webhooks.ts] - PaymentStatus type, event normalization
- [Source: convex/commissionEngine.ts] - Existing payment.updated and subscription event processing
- [Source: convex/audit.ts] - Audit logging functions
- [Source: _bmad-output/implementation-artifacts/7-1-payment-updated-event-processing.md] - Previous story patterns
- [Source: _bmad-output/implementation-artifacts/7-2-subscription-lifecycle-event-processing.md] - Previous story patterns
- [Source: AGENTS.md] - Convex development patterns
- [Source: _bmad-output/project-context.md] - Technology stack, function syntax requirements

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

**Story 7.3 Implementation Summary:**
1. ✅ Added explicit payment status validation in commission engine functions
2. ✅ Created reusable helper function `logPaymentRejection()` for consistent logging
3. ✅ Added constants for payment statuses, rejection reasons, and audit actions
4. ✅ Updated all three commission engine functions to use the new validation logic
5. ✅ Ensured audit trail is created for all rejected payments (failed/pending)
6. ✅ Webhook status set to "processed" (not "failed") for rejected payments
7. ✅ Maintained backward compatibility with existing "paid" status handling
8. ✅ Added support for "completed" status as a valid payment status

**Technical Implementation Details:**
- Used `CONFIRMED_PAYMENT_STATUSES = ["paid", "completed"]` for validation
- Created specific rejection reasons for "failed" and "pending" statuses
- Audit log includes payment ID, amount, status, and rejection reason in metadata
- All rejection logic uses the same helper function for consistency
- No changes to webhooks.ts - existing logic already handles payment status correctly

**Key Design Decisions:**
1. Webhook status set to "processed" (not "failed") for rejected payments - the webhook was successfully processed, it just resulted in a rejection
2. Specific rejection reasons for failed vs pending payments - maintains clarity in audit logs
3. Audit action names include the specific rejection type (e.g., "commission_rejected_payment_failed")
4. Helper function encapsulates all rejection logging logic for maintainability

### File List

**Modified Files:**
1. `convex/commissionEngine.ts` - Main implementation file
   - Added `CONFIRMED_PAYMENT_STATUSES` constant (includes "paid" and "completed")
   - Added `PAYMENT_REJECTION_REASONS` constant for rejection messages
   - Added `PAYMENT_REJECTION_AUDIT_ACTIONS` constant for audit actions
   - Added `logPaymentRejection()` helper function for consistent logging
   - Updated `processPaymentUpdatedToCommission()` with explicit payment status validation
   - Updated `processSubscriptionCreatedEvent()` with explicit payment status validation
   - Updated `processSubscriptionUpdatedEvent()` with explicit payment status validation

**New Files:**
1. `convex/commissionEngine.test.ts` - Story 7.3 test suite
   - AC #1: Failed payment rejection test
   - AC #2: Pending payment rejection test
   - AC #3: Completed payment processing test (including "completed" status)
   - AC #4: Subscription event payment status validation tests
   - AC #6: Audit trail completeness test

**Test Files:**
- Existing tests in `convex/webhooks.test.ts` already cover payment status handling
- Tests verify that pending/failed payments don't create conversions

## Change Log

**2026-03-15:**
- ✅ Implemented Story 7.3: Failed/Pending Payment Rejection
- ✅ Added explicit payment status validation in commission engine functions
- ✅ Created `logPaymentRejection()` helper function for consistent audit logging
- ✅ Updated `processPaymentUpdatedToCommission()`, `processSubscriptionCreatedEvent()`, and `processSubscriptionUpdatedEvent()`
- ✅ Added support for "completed" payment status as valid (in addition to "paid")
- ✅ Webhook status set to "processed" (not "failed") for rejected payments
- ✅ Audit log entries created for all payment rejections with specific action types
- ✅ Maintained backward compatibility with existing payment processing logic

**2026-03-15 (Code Review Fixes):**
- ✅ Exported constants for use by other modules (CONFIRMED_PAYMENT_STATUSES, PAYMENT_REJECTION_REASONS, PAYMENT_REJECTION_AUDIT_ACTIONS)
- ✅ Fixed organic conversion status to use CONFIRMED_PAYMENT_STATUSES (supports "completed" status)
- ✅ Added Story 7.3 specific tests in `convex/commissionEngine.test.ts`
- ✅ Updated File List to include new test file
