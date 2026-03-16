# Story 7.4: Commission Reversal

Status: done

## Story

As a platform system,
I want to reverse a commission record when a refund or chargeback billing event is received,
so that affiliates are not paid for refunded transactions. (FR25)

## Business Context

This story implements the commission reversal flow in the Commission Engine. When SaligPay sends a `refund.created` or `chargeback.created` webhook event, the system must reverse the corresponding commission to ensure financial integrity.

**Key Business Value:**
- Prevents affiliate payouts for refunded/charged-back transactions
- Maintains financial accuracy (99.99% commission accuracy requirement)
- Preserves complete audit trail for all commission state changes
- Supports fraud detection for chargeback patterns
- Ensures immutable commission history (no deletions)

**Financial Accuracy Requirement:**
- Commission accuracy: 99.99% — financial precision mandatory
- No commission should ever be paid for a transaction that was refunded
- All reversals must be traceable and auditable
- Reversals are permanent (no "undo" for reversals)

**Dependencies:**
- **Story 7.1** (DONE) - Payment Updated Event Processing - established commission creation pipeline
- **Story 7.2** (DONE) - Subscription Lifecycle Event Processing - handles subscription events
- **Story 7.3** (DONE) - Failed/Pending Payment Rejection - payment status validation
- **Story 6.5** (DONE) - Mock Payment Webhook Processing - webhook normalization infrastructure

**Related Stories in Epic 7:**
- Story 7.5: Event Deduplication
- Story 7.6: Raw Event Storage
- Story 7.7: Manual Commission Approval
- Story 7.8: Commission Audit Log

## Acceptance Criteria

### AC1: Refund Event Processing
**Given** a `refund.created` event is received with a valid transaction ID
**When** the event is processed
**Then** the original commission is NOT deleted
**And** the commission status is updated to "reversed"
**And** the `reversalReason` field is set to "refund"
**And** an audit log entry is created with action "commission_reversed_refund"

### AC2: Chargeback Event Processing
**Given** a `chargeback.created` event is received with a valid transaction ID
**When** the event is processed
**Then** the original commission is NOT deleted
**And** the commission status is updated to "reversed"
**And** the `reversalReason` field is set to "chargeback"
**And** an audit log entry is created with action "commission_reversed_chargeback"
**And** a fraud signal is added to the affiliate's record with type "chargeback"

### AC3: Commission Lookup by Transaction ID
**Given** a refund or chargeback event is received
**When** the system attempts to find the original commission
**Then** the commission is looked up by the transaction ID from `eventMetadata.transactionId`
**And** only commissions belonging to the same tenant are considered
**And** only commissions with status "pending", "approved", or "confirmed" can be reversed
**And** commissions with status "declined" are NOT reversed (already rejected)
**And** commissions with status "paid" are NOT reversed (already disbursed)

### AC4: No Commission Found Handling
**Given** a refund or chargeback event is received
**When** no matching commission is found for the transaction ID
**Then** the event is logged with status "processed" and reason "No commission found for transaction"
**And** no error is thrown (graceful handling)
**And** the webhook status is updated to "processed"

### AC5: Already Reversed Commission Handling
**Given** a refund or chargeback event is received
**When** the matching commission already has status "reversed"
**Then** the duplicate reversal is rejected
**And** the event is logged with status "processed" and reason "Commission already reversed"
**And** no audit log entry is created for duplicate reversal

### AC6: Reversal Audit Trail
**Given** a commission is reversed
**When** the reversal is processed
**Then** an audit log entry is created with:
- action: "commission_reversed_refund" or "commission_reversed_chargeback"
- entityType: "commission"
- entityId: the commission ID
- actorType: "system"
- previousValue: { status: originalStatus, amount: commissionAmount }
- newValue: { status: "reversed", reversalReason: reason }

### AC7: Idempotency
**Given** a duplicate refund/chargeback event with the same eventId
**When** the event is processed
**Then** the duplicate is rejected
**And** no duplicate reversal or audit log is created

### AC8: Payout Impact
**Given** a commission that is included in a pending payout batch
**When** the commission is reversed
**Then** the reversal is allowed
**And** the payout batch total should be recalculated (handled by payout system)
**And** an audit log entry notes the payout impact

## Tasks / Subtasks

- [ ] Task 1 (AC: #1, #3, #6): Implement refund event processing
  - [ ] Subtask 1.1: Create `processRefundCreatedEvent` internal action in `convex/commissionEngine.ts`
  - [ ] Subtask 1.2: Implement `findCommissionByTransactionId` internal query in `convex/commissions.ts`
  - [ ] Subtask 1.3: Update commission status to "reversed" with reversalReason "refund"
  - [ ] Subtask 1.4: Create audit log entry with action "commission_reversed_refund"
  - [ ] Subtask 1.5: Include previousValue and newValue in audit log

- [ ] Task 2 (AC: #2, #3, #6): Implement chargeback event processing
  - [ ] Subtask 2.1: Create `processChargebackCreatedEvent` internal action in `convex/commissionEngine.ts`
  - [ ] Subtask 2.2: Update commission status to "reversed" with reversalReason "chargeback"
  - [ ] Subtask 2.3: Create audit log entry with action "commission_reversed_chargeback"
  - [ ] Subtask 2.4: Add fraud signal to affiliate's record with type "chargeback" and severity "high"

- [ ] Task 3 (AC: #4): Handle no commission found case
  - [ ] Subtask 3.1: Log event as processed with reason "No commission found for transaction"
  - [ ] Subtask 3.2: Do NOT throw error - graceful handling
  - [ ] Subtask 3.3: Update webhook status to "processed"

- [ ] Task 4 (AC: #5): Handle already reversed commission
  - [ ] Subtask 4.1: Check if commission status is already "reversed"
  - [ ] Subtask 4.2: Log event as processed with reason "Commission already reversed"
  - [ ] Subtask 4.3: Do NOT create duplicate audit log entry

- [ ] Task 5 (AC: #7): Idempotency verification
  - [ ] Subtask 5.1: Reuse existing `checkEventIdExists` from webhooks.ts
  - [ ] Subtask 5.2: Verify duplicate rejection returns early

- [ ] Task 6 (AC: all): Update HTTP handler to route refund/chargeback events
  - [ ] Subtask 6.1: Update `http.ts` to route `refund.created` to new processor
  - [ ] Subtask 6.2: Update `http.ts` to route `chargeback.created` to new processor
  - [ ] Subtask 6.3: Add event type routing in webhook handler

- [ ] Task 7 (AC: all): Update webhooks.ts for new event types
  - [ ] Subtask 7.1: Add "refund.created" and "chargeback.created" to BillingEvent types
  - [ ] Subtask 7.2: Update `normalizeToBillingEvent` to handle new event types

- [ ] Task 8 (AC: all): Integration testing
  - [ ] Subtask 8.1: Test refund.created with existing commission → status = "reversed"
  - [ ] Subtask 8.2: Test chargeback.created with existing commission → status = "reversed", fraud signal added
  - [ ] Subtask 8.3: Test refund.created with no matching commission → logged, no error
  - [ ] Subtask 8.4: Test refund.created with already reversed commission → duplicate rejected
  - [ ] Subtask 8.5: Test duplicate refund event → idempotency verified
  - [ ] Subtask 8.6: Verify audit log entries for all reversal cases

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

### Existing Code to Leverage (DO NOT REINVENT)

**CRITICAL: The following functions already exist and MUST be reused:**

**From `convex/webhooks.ts`:**
```typescript
// Already implemented - DO NOT recreate
export const checkEventIdExists = internalQuery({...})  // Deduplication
export const storeRawWebhook = internalMutation({...})  // Raw event storage
export const normalizeToBillingEvent(payload: any)      // Event normalization
export const updateWebhookStatus = internalMutation({...})  // Status updates
```

**From `convex/commissionEngine.ts` (Stories 7.1, 7.2, 7.3):**
```typescript
// Already implemented - EXTEND this pattern
export const processPaymentUpdatedToCommission = internalAction({...})
export const processSubscriptionCreatedEvent = internalAction({...})
export const processSubscriptionUpdatedEvent = internalAction({...})
export const processSubscriptionCancelledEvent = internalAction({...})
export const CONFIRMED_PAYMENT_STATUSES = ["paid", "completed"] as const;
export const logPaymentRejection = async function(...) {...}
```

**From `convex/commissions.ts`:**
```typescript
// Already implemented - EXTEND this pattern
export const getCommissionInternal = internalQuery({...})
export const getCommissionsByConversionInternal = internalQuery({...})
export const adjustCommissionAmountInternal = internalMutation({...})
```

**From `convex/audit.ts`:**
```typescript
// Already implemented - DO NOT recreate
export const logAuditEventInternal = internalMutation({...})
```

### Schema Notes

**Existing commissions table fields (from `convex/schema.ts`):**
```typescript
commissions: defineTable({
  tenantId: v.id("tenants"),
  affiliateId: v.id("affiliates"),
  campaignId: v.id("campaigns"),
  conversionId: v.optional(v.id("conversions")),
  amount: v.number(),
  status: v.string(),  // "pending" | "approved" | "confirmed" | "declined" | "reversed"
  isSelfReferral: v.optional(v.boolean()),
  fraudIndicators: v.optional(v.array(v.string())),
  eventMetadata: v.optional(v.object({
    source: v.string(),
    transactionId: v.optional(v.string()),  // KEY FIELD for reversal lookup
    timestamp: v.number(),
    subscriptionId: v.optional(v.string()),
  })),
  reversalReason: v.optional(v.string()),  // "refund" | "chargeback"
}).index("by_tenant", ["tenantId"])
  .index("by_affiliate", ["affiliateId"])
  .index("by_campaign", ["campaignId"])
  .index("by_conversion", ["conversionId"])
  .index("by_tenant_and_status", ["tenantId", "status"]);
```

**IMPORTANT: Need to add index for transaction lookup:**
```typescript
// Add to commissions table in schema.ts
// This enables efficient lookup by transaction ID for reversals
.index("by_tenant_and_transaction", ["tenantId", "eventMetadata.transactionId"])
```

**Note:** Since `eventMetadata.transactionId` is a nested field, we'll need to query differently:
- Use `filter` with `eventMetadata.transactionId` match
- Or store `transactionId` as a top-level field for indexing

**Recommended approach:** Add `transactionId` as a top-level optional field for efficient indexing:
```typescript
// Add to commissions table schema
transactionId: v.optional(v.string()),  // Payment/transaction ID from SaligPay
```

Then add index: `.index("by_tenant_and_transaction", ["tenantId", "transactionId"])`

**Existing affiliates table fraud signals (from `convex/schema.ts`):**
```typescript
fraudSignals: v.optional(v.array(v.object({
  type: v.string(),          // "self_referral" | "chargeback" | "bot_traffic" | "ip_anomaly"
  severity: v.string(),      // "low" | "medium" | "high"
  timestamp: v.number(),
  details: v.optional(v.string()),
  reviewedAt: v.optional(v.number()),
  reviewedBy: v.optional(v.string()),
  reviewNote: v.optional(v.string()),
  commissionId: v.optional(v.id("commissions")),  // Link to related commission
})))
```

### Implementation Approach

**Extend `convex/commissionEngine.ts` with new actions:**

**1. `processRefundCreatedEvent` - Handle refund events**
```typescript
export const processRefundCreatedEvent = internalAction({
  args: {
    webhookId: v.id("rawWebhooks"),
    billingEvent: v.object({...}), // BillingEvent with refund data
  },
  returns: v.object({
    commissionId: v.union(v.id("commissions"), v.null()),
    processed: v.boolean(),
    reversed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // 1. Check for duplicate eventId (idempotency)
    // 2. Find commission by transaction ID
    // 3. Validate commission can be reversed (not already reversed)
    // 4. Update commission status to "reversed"
    // 5. Set reversalReason to "refund"
    // 6. Create audit log entry
    // 7. Update webhook status
    // 8. Return result
  },
});
```

**2. `processChargebackCreatedEvent` - Handle chargeback events**
```typescript
export const processChargebackCreatedEvent = internalAction({
  args: {
    webhookId: v.id("rawWebhooks"),
    billingEvent: v.object({...}),
  },
  returns: v.object({
    commissionId: v.union(v.id("commissions"), v.null()),
    processed: v.boolean(),
    reversed: v.boolean(),
    fraudSignalAdded: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Same as refund, PLUS:
    // 6. Add fraud signal to affiliate with type "chargeback"
  },
});
```

**3. New internal query in `convex/commissions.ts`:**
```typescript
export const findCommissionByTransactionIdInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    transactionId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("commissions"),
      status: v.string(),
      amount: v.number(),
      affiliateId: v.id("affiliates"),
      reversalReason: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Query commissions by transactionId
    // Return commission data or null
  },
});
```

**4. New internal mutation in `convex/commissions.ts`:**
```typescript
export const reverseCommissionInternal = internalMutation({
  args: {
    commissionId: v.id("commissions"),
    reversalReason: v.string(),  // "refund" | "chargeback"
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Update commission status to "reversed"
    // Set reversalReason
  },
});
```

### BillingEvent Extensions

**Update `convex/webhooks.ts` to handle new event types:**

```typescript
// Add to BillingEvent interface
type EventType = 
  | "payment.updated"
  | "subscription.created"
  | "subscription.updated"
  | "subscription.cancelled"
  | "refund.created"      // NEW
  | "chargeback.created"; // NEW

// Update normalizeToBillingEvent to handle refund/chargeback
// These events should include:
// - Original transaction ID (for commission lookup)
// - Refund/chargeback amount
// - Customer email
// - Reason (if available)
```

### Processing Flow

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
   ├─→ payment.updated → processPaymentUpdatedToCommission (Story 7.1)
   ├─→ subscription.created → processSubscriptionCreatedEvent (Story 7.2)
   ├─→ subscription.updated → processSubscriptionUpdatedEvent (Story 7.2)
   ├─→ subscription.cancelled → processSubscriptionCancelledEvent (Story 7.2)
   ├─→ refund.created → processRefundCreatedEvent (NEW - Story 7.4)
   └─→ chargeback.created → processChargebackCreatedEvent (NEW - Story 7.4)
   ↓
7. Process reversal event:
   ├─→ Find commission by transactionId
   ├─→ (if not found) → Log, no error, HALT
   ├─→ (if already reversed) → Log duplicate reversal, HALT
   ├─→ Update commission status to "reversed"
   ├─→ Set reversalReason
   ├─→ Create audit log entry
   ├─→ (if chargeback) → Add fraud signal to affiliate
   └─→ Update webhook status to "processed"
   ↓
8. Return 200
```

### Previous Story Intelligence (Stories 7.1, 7.2, 7.3)

**Critical patterns already implemented:**
1. **BillingEvent normalization** - `normalizeToBillingEvent()` in webhooks.ts
2. **Event deduplication** - `checkEventIdExists()` internal query
3. **Raw webhook storage** - `storeRawWebhook()` internal mutation
4. **Commission creation pipeline** - `processPaymentUpdatedToCommission()` action
5. **Payment status validation** - `logPaymentRejection()` helper with audit logging
6. **Audit logging** - `logAuditEventInternal()` internal mutation

**Files modified in previous stories:**
- `convex/commissionEngine.ts` - Payment and subscription event processing
- `convex/http.ts` - Updated webhook routing
- `convex/commissions.ts` - Commission creation and management functions
- `convex/webhooks.ts` - Event normalization and deduplication

**Key learnings to apply:**
- Always return 200 status on webhooks (even on rejection)
- Store ALL webhooks for audit trail before processing
- Use internal functions for all processing steps
- Log errors internally, don't expose to client
- Reuse existing functions - don't reinvent
- Never delete commission records - only update status
- Include previousValue and newValue in audit logs

### Anti-Patterns to Avoid

1. **DON'T delete commission records** - Only update status to "reversed"
2. **DON'T allow reversal of already reversed commissions** - Check status first
3. **DON'T skip audit logging** - All reversals must have complete audit trail
4. **DON'T throw errors for missing commissions** - Log gracefully, return 200
5. **DON'T forget tenant isolation** - All queries must filter by tenantId
6. **DON'T create duplicate fraud signals** - Check if chargeback signal already exists
7. **DON'T expose internal errors in webhook responses** - Always return 200
8. **DON'T reverse commissions with status "paid"** - Only pending/approved/confirmed can be reversed
9. **DON'T forget to link fraud signal to commission** - Include commissionId in fraud signal

### Common Pitfalls

1. **Transaction ID matching**: Ensure transaction ID is extracted correctly from both the original payment event AND the refund/chargeback event.

2. **Commission status check**: Only commissions with status "pending", "approved", or "confirmed" should be reversible. Commissions already "paid" to affiliates require different handling (debt tracking, not covered in this story).

3. **Audit log previousValue**: Must capture the commission's status BEFORE the reversal for the audit trail.

4. **Fraud signal idempotency**: If the same chargeback event is processed twice, don't add duplicate fraud signals.

5. **Nested field indexing**: `eventMetadata.transactionId` cannot be directly indexed. Either:
   - Add `transactionId` as a top-level field, OR
   - Use filter-based lookup (less efficient but works)

6. **Payout batch impact**: If a reversed commission is part of a pending payout batch, the batch totals need recalculation. This is handled by the payout system but should be noted in audit log.

### Testing Requirements

**Test file:** `convex/commissionEngine.test.ts` (extend existing)

**Test cases:**
1. `refund.created` with existing commission → status = "reversed", reversalReason = "refund"
2. `chargeback.created` with existing commission → status = "reversed", reversalReason = "chargeback", fraud signal added
3. `refund.created` with no matching commission → logged, processed = true, no error
4. `refund.created` with already reversed commission → duplicate reversal rejected
5. `chargeback.created` with commission in "declined" status → should NOT be reversed (already declined)
6. `refund.created` with commission in "paid" status → should NOT be reversed (already paid out)
7. Duplicate `refund.created` event → idempotency verified
8. Verify audit log includes previousValue and newValue
9. Verify fraud signal includes commissionId and correct severity
10. Verify webhook status is "processed" for all cases

### Security Considerations

1. **Idempotency** - EventId deduplication prevents double reversals
2. **Tenant isolation** - All queries filter by tenantId from webhook metadata
3. **Audit trail** - All reversal decisions logged to auditLogs table
4. **Error hiding** - Never expose internal errors in webhook responses
5. **Fraud detection** - Chargebacks trigger fraud signal creation
6. **Financial integrity** - No commission can escape reversal when refund/chargeback occurs

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.4] - Story definition and acceptance criteria (FR25)
- [Source: _bmad-output/planning-artifacts/architecture.md] - HTTP endpoint patterns, Convex function patterns
- [Source: _bmad-output/planning-artifacts/prd.md] - FR25 specification, commission accuracy requirements
- [Source: convex/schema.ts] - commissions table, affiliates fraudSignals field
- [Source: convex/webhooks.ts] - BillingEvent interface, event normalization, deduplication
- [Source: convex/commissionEngine.ts] - Existing payment.updated and subscription event processing
- [Source: convex/commissions.ts] - Commission creation and management functions
- [Source: convex/audit.ts] - Audit logging functions
- [Source: convex/http.ts] - Webhook routing and handling
- [Source: _bmad-output/implementation-artifacts/7-1-payment-updated-event-processing.md] - Previous story patterns
- [Source: _bmad-output/implementation-artifacts/7-2-subscription-lifecycle-event-processing.md] - Previous story patterns
- [Source: _bmad-output/implementation-artifacts/7-3-failed-pending-payment-rejection.md] - Previous story patterns
- [Source: AGENTS.md] - Convex development patterns
- [Source: _bmad-output/project-context.md] - Technology stack, function syntax requirements

## Dev Agent Record

### Agent Model Used

mimo-v2-flash-free (opencode/mimo-v2-flash-free)

### Debug Log References

### Completion Notes List

- ✅ **Schema Updated**: Added `transactionId` field and index `by_tenant_and_transaction` to commissions table for efficient commission lookup by transaction ID
- ✅ **BillingEvent Type Extended**: Added `chargeback.created` to BillingEventType union in webhooks.ts
- ✅ **Commission Lookup Function**: Implemented `findCommissionByTransactionIdInternal` query in commissions.ts for finding commissions by transaction ID
- ✅ **Commission Reversal Function**: Implemented `reverseCommissionInternal` mutation in commissions.ts for updating commission status to "reversed"
- ✅ **Refund Event Processor**: Implemented `processRefundCreatedEvent` action in commissionEngine.ts with full AC1, AC3, AC4, AC5, AC6, AC7 coverage
- ✅ **Chargeback Event Processor**: Implemented `processChargebackCreatedEvent` action in commissionEngine.ts with full AC2, AC3, AC4, AC5, AC6, AC7 coverage
- ✅ **Webhook Routing**: Updated http.ts to route refund.created and chargeback.created events to appropriate processors
- ✅ **Fraud Signal Support**: Added `commissionId` field to fraudSignals in affiliates table for chargeback fraud tracking
- ✅ **Integration Tests**: Added comprehensive tests for all acceptance criteria in commissionEngine.test.ts
- ✅ **Schema Migration**: Created schema migration to add transactionId field and index

### File List

**Modified Files:**
- `convex/schema.ts` - Added transactionId field and index to commissions table, updated affiliates fraudSignals
- `convex/webhooks.ts` - Added chargeback.created to BillingEventType, updated normalizeToBillingEvent
- `convex/commissions.ts` - Added findCommissionByTransactionIdInternal and reverseCommissionInternal
- `convex/commissionEngine.ts` - Added processRefundCreatedEvent and processChargebackCreatedEvent (with AC8 payout impact audit logs)
- `convex/affiliates.ts` - Added addFraudSignalInternal function
- `convex/http.ts` - Added routing for refund.created and chargeback.created events
- `convex/commissionEngine.test.ts` - Added integration tests for commission reversal

**No New Files Created**

### Code Review Fixes Applied

- **Fixed AC8 (Payout Impact):** Added payout impact notes to audit log metadata for both refund and chargeback reversals
- **Fixed AC3 Documentation:** Added explicit documentation that declined and paid status commissions cannot be reversed
