# Story 7.2: Subscription Lifecycle Event Processing

Status: done

## Story

As a platform system,
I want to process subscription billing lifecycle events and adjust commission records accordingly,
so that commissions accurately reflect subscription state changes. (FR23)

## Business Context

This story extends the Commission Engine to handle subscription lifecycle events from SaligPay. While Story 7.1 handles one-time `payment.updated` events, this story processes recurring subscription events to:

1. Create commissions on subscription renewals (recurring commissions)
2. Adjust commissions when customers upgrade their plans
3. Adjust commissions when customers downgrade their plans
4. Stop future recurring commissions on cancellations while preserving pending ones

**Key Business Value:**
- Enables affiliates to earn recurring revenue on subscription products
- Ensures commission accuracy when subscription values change
- Maintains financial integrity for SaaS businesses with subscription models
- Supports the "recurring commission" campaign feature (Story 4.4)

**Dependencies:**
- **Story 7.1** (DONE) - Payment Updated Event Processing - established the commission processing pipeline
- **Story 4.4** (DONE) - Recurring Commission Support - campaign configuration for recurring commissions
- **Story 6.5** (DONE) - Mock Payment Webhook Processing - webhook normalization infrastructure

**Related Stories in Epic 7:**
- Story 7.3: Failed/Pending Payment Rejection
- Story 7.4: Commission Reversal
- Story 7.5: Event Deduplication

## Acceptance Criteria

### AC1: Subscription Renewal Commission Creation
**Given** a `subscription.updated` renewal event with attribution data and an active campaign with recurring commissions enabled
**When** the event is processed
**Then** a new commission is created for the renewal payment
**And** the commission uses the recurring rate (same as initial, reduced, or custom per campaign config)

### AC2: No Commission for Renewals Without Recurring Enabled
**Given** a `subscription.updated` renewal event with a campaign that has recurring commissions disabled
**When** the event is processed
**Then** no commission is created for the renewal
**And** the event is logged with the reason

### AC3: Subscription Upgrade Commission Adjustment
**Given** a `subscription.updated` upgrade event (plan change to higher value)
**When** the event is processed
**Then** the existing pending commission is adjusted to reflect the new plan value
**And** an audit log entry records the adjustment with before/after amounts

### AC4: Subscription Downgrade Commission Adjustment
**Given** a `subscription.updated` downgrade event (plan change to lower value)
**When** the event is processed
**Then** the existing pending commission is adjusted to reflect the new plan value
**And** an audit log entry records the adjustment with before/after amounts

### AC5: Subscription Cancellation Handling
**Given** a `subscription.cancelled` event
**When** the event is processed
**Then** no new commission is created for future renewals
**And** existing pending commissions are preserved (not automatically reversed)
**And** the subscription is marked as cancelled for attribution reference

### AC6: Subscription Creation
**Given** a `subscription.created` event with attribution data
**When** the event is processed
**Then** a conversion is created (if not exists)
**And** a commission is created if the initial payment status is "paid"
**And** the subscription metadata is stored for future renewal reference

### AC7: Idempotency
**Given** a duplicate subscription event with the same eventId
**When** the event is processed
**Then** the duplicate is rejected
**And** no duplicate commission or adjustment is created

## Tasks / Subtasks

- [x] Task 1 (AC: #1, #2): Implement subscription renewal commission processing
  - [x] Subtask 1.1: Create `processSubscriptionUpdatedEvent` internal action in `convex/commissionEngine.ts`
  - [x] Subtask 1.2: Detect renewal vs plan change in subscription.updated events
  - [x] Subtask 1.3: Check campaign `recurringCommission` flag before creating renewal commission
  - [x] Subtask 1.4: Apply `recurringRate` or `recurringRateType` from campaign config
  - [x] Subtask 1.5: Log events for campaigns with recurring disabled

- [x] Task 2 (AC: #3, #4): Implement plan change commission adjustment
  - [x] Subtask 2.1: Detect upgrade vs downgrade from subscription event metadata
  - [x] Subtask 2.2: Find existing pending commission for the subscription
  - [x] Subtask 2.3: Create adjustment record with before/after amounts
  - [x] Subtask 2.4: Update commission amount to reflect new plan value
  - [x] Subtask 2.5: Create audit log entry for the adjustment

- [x] Task 3 (AC: #5): Implement subscription cancellation handling
  - [x] Subtask 3.1: Create `processSubscriptionCancelledEvent` internal action
  - [x] Subtask 3.2: Mark subscription as cancelled in conversions metadata
  - [x] Subtask 3.3: Preserve existing pending commissions (no automatic reversal)
  - [x] Subtask 3.4: Log cancellation for audit trail

- [x] Task 4 (AC: #6): Implement subscription creation handling
  - [x] Subtask 4.1: Create `processSubscriptionCreatedEvent` internal action
  - [x] Subtask 4.2: Store subscription metadata for renewal reference
  - [x] Subtask 4.3: Create initial commission if payment status is "paid"

- [x] Task 5 (AC: #7): Idempotency verification
  - [x] Subtask 5.1: Reuse existing `checkEventIdExists` from webhooks.ts
  - [x] Subtask 5.2: Verify duplicate rejection returns early

- [x] Task 6 (AC: all): Update HTTP handler to route subscription events
  - [x] Subtask 6.1: Update `http.ts` to route `subscription.created` to new processor
  - [x] Subtask 6.2: Update `http.ts` to route `subscription.updated` to new processor
  - [x] Subtask 6.3: Update `http.ts` to route `subscription.cancelled` to new processor

- [x] Task 7 (AC: all): Integration testing
  - [x] Subtask 7.1: Test renewal with recurring enabled → commission created
  - [x] Subtask 7.2: Test renewal with recurring disabled → no commission
  - [x] Subtask 7.3: Test upgrade with pending commission → adjusted
  - [x] Subtask 7.4: Test downgrade with pending commission → adjusted
  - [x] Subtask 7.5: Test cancellation → no future commissions, pending preserved
  - [x] Subtask 7.6: Test duplicate subscription event → rejected

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

**From `convex/commissionEngine.ts` (Story 7.1):**
```typescript
// Already implemented - EXTEND this pattern
export const processPaymentUpdatedToCommission = internalAction({...})
```

**From `convex/commissions.ts`:**
```typescript
// Already implemented - DO NOT recreate
export const createCommissionFromConversionInternal = internalMutation({...})
export const getCommissionInternal = internalQuery({...})
```

**From `convex/conversions.ts`:**
```typescript
// Already implemented - DO NOT recreate
export const createOrganicConversion = internalMutation({...})
export const createConversionWithAttribution = internalMutation({...})
export const findAffiliateByCodeInternal = internalQuery({...})
export const getReferralLinkByCodeInternal = internalQuery({...})
export const findRecentClickInternal = internalQuery({...})
```

### Schema Notes

**Campaign fields for recurring commissions (from `convex/schema.ts`):**
```typescript
campaigns: {
  // ... other fields
  recurringCommission: v.boolean(),          // Whether to pay on renewals
  recurringRate: v.optional(v.number()),     // Custom recurring rate
  recurringRateType: v.optional(v.string()), // "same", "reduced", "custom"
  commissionType: v.string(),                // "percentage" or "flatFee"
  commissionValue: v.number(),               // Default commission rate/value
}
```

**Conversions table (subscription metadata):**
```typescript
conversions: {
  // ... other fields
  metadata: v.optional(v.object({
    orderId: v.optional(v.string()),
    products: v.optional(v.array(v.string())),
    // Add subscription tracking:
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    planId: v.optional(v.string()),
  })),
}
```

**BillingEvent subscription structure (from `webhooks.ts`):**
```typescript
interface BillingEvent {
  // ... other fields
  subscription?: {
    id: string;
    status: SubscriptionStatus; // "active" | "cancelled" | "past_due"
    planId?: string;
  };
}
```

### Implementation Approach

**Extend `convex/commissionEngine.ts` with new actions:**

1. **`processSubscriptionCreatedEvent`** - Handle new subscriptions
   - Similar to `processPaymentUpdatedToCommission`
   - Store subscription metadata for renewal tracking
   - Create initial commission if payment is "paid"

2. **`processSubscriptionUpdatedEvent`** - Handle renewals and plan changes
   - Detect event type: renewal vs upgrade vs downgrade
   - For renewals: Check `recurringCommission` flag, apply `recurringRate`
   - For plan changes: Find pending commission, adjust amount, create audit log

3. **`processSubscriptionCancelledEvent`** - Handle cancellations
   - Mark subscription as cancelled
   - Preserve pending commissions
   - No automatic reversals

### Event Detection Logic

**Determine subscription event subtype:**
```typescript
function detectSubscriptionChangeType(
  event: BillingEvent,
  previousSubscription?: { planId: string; amount: number }
): "renewal" | "upgrade" | "downgrade" {
  // If no previous subscription, this is a renewal (recurring payment)
  if (!previousSubscription) {
    return "renewal";
  }
  
  // Compare plan values to determine upgrade/downgrade
  const currentAmount = event.payment.amount;
  const previousAmount = previousSubscription.amount;
  
  if (currentAmount > previousAmount) {
    return "upgrade";
  } else if (currentAmount < previousAmount) {
    return "downgrade";
  }
  
  // Same amount = renewal
  return "renewal";
}
```

### Recurring Commission Calculation

**Apply campaign's recurring rate settings:**
```typescript
function calculateRecurringCommissionAmount(
  saleAmount: number,
  campaign: Doc<"campaigns">
): number {
  if (!campaign.recurringCommission) {
    return 0; // No commission for non-recurring campaigns
  }
  
  let rate: number;
  
  switch (campaign.recurringRateType) {
    case "same":
      rate = campaign.commissionValue;
      break;
    case "reduced":
      // Default reduced rate is 50% of initial
      rate = campaign.recurringRate ?? (campaign.commissionValue * 0.5);
      break;
    case "custom":
      rate = campaign.recurringRate ?? campaign.commissionValue;
      break;
    default:
      rate = campaign.commissionValue;
  }
  
  if (campaign.commissionType === "percentage") {
    return saleAmount * (rate / 100);
  } else {
    return rate; // flatFee
  }
}
```

### Commission Adjustment for Plan Changes

**When upgrading or downgrading:**
```typescript
async function adjustCommissionForPlanChange(
  ctx: any,
  args: {
    commissionId: Id<"commissions">;
    newAmount: number;
    adjustmentType: "upgrade" | "downgrade";
    tenantId: Id<"tenants">;
  }
): Promise<void> {
  const existingCommission = await ctx.db.get(args.commissionId);
  
  if (!existingCommission || existingCommission.status !== "pending") {
    // Only adjust pending commissions
    return;
  }
  
  const previousAmount = existingCommission.amount;
  
  // Update commission amount
  await ctx.db.patch(args.commissionId, {
    amount: args.newAmount,
  });
  
  // Create audit log
  await ctx.db.insert("auditLogs", {
    tenantId: args.tenantId,
    action: "commission_adjusted",
    entityType: "commission",
    entityId: args.commissionId,
    actorType: "system",
    previousValue: { amount: previousAmount },
    newValue: { amount: args.newAmount },
    metadata: {
      adjustmentType: args.adjustmentType,
    },
  });
}
```

### HTTP Handler Updates

**Update `convex/http.ts` webhook handler:**
```typescript
// In the webhook handler, after normalization:
if (billingEvent.eventType === "payment.updated") {
  await ctx.runAction(internal.commissionEngine.processPaymentUpdatedToCommission, {
    webhookId: rawWebhookId,
    billingEvent,
  });
} else if (billingEvent.eventType === "subscription.created") {
  await ctx.runAction(internal.commissionEngine.processSubscriptionCreatedEvent, {
    webhookId: rawWebhookId,
    billingEvent,
  });
} else if (billingEvent.eventType === "subscription.updated") {
  await ctx.runAction(internal.commissionEngine.processSubscriptionUpdatedEvent, {
    webhookId: rawWebhookId,
    billingEvent,
  });
} else if (billingEvent.eventType === "subscription.cancelled") {
  await ctx.runAction(internal.commissionEngine.processSubscriptionCancelledEvent, {
    webhookId: rawWebhookId,
    billingEvent,
  });
}
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
   ├─→ subscription.created → processSubscriptionCreatedEvent (NEW)
   ├─→ subscription.updated → processSubscriptionUpdatedEvent (NEW)
   └─→ subscription.cancelled → processSubscriptionCancelledEvent (NEW)
   ↓
7. Process subscription event:
   ├─→ Check attribution data
   ├─→ Validate affiliate and campaign
   ├─→ Apply recurring commission rules
   ├─→ Adjust commissions for plan changes
   └─→ Create audit logs
   ↓
8. Update webhook status to "processed"
   ↓
9. Return 200
```

### Previous Story Intelligence (Story 7.1)

**Critical patterns already implemented:**
1. **BillingEvent normalization** - `normalizeToBillingEvent()` in webhooks.ts
2. **Event deduplication** - `checkEventIdExists()` internal query
3. **Raw webhook storage** - `storeRawWebhook()` internal mutation
4. **Commission creation pipeline** - `processPaymentUpdatedToCommission()` action
5. **Campaign status validation** - `canCampaignEarnCommissions()` query

**Files modified in Story 7.1:**
- `convex/commissionEngine.ts` - New file with payment processing action
- `convex/http.ts` - Updated to route payment.updated events

**Key learnings to apply:**
- Always return 200 status on webhooks (even on error)
- Store ALL webhooks for audit trail before processing
- Use internal functions for all processing steps
- Log errors internally, don't expose to client
- Reuse existing functions - don't reinvent

### Anti-Patterns to Avoid

1. **DON'T create duplicate functions** - Reuse existing infrastructure from webhooks.ts and commissions.ts
2. **DON'T create commissions for non-recurring campaigns on renewals** - Check `recurringCommission` flag
3. **DON'T adjust non-pending commissions** - Only pending commissions can be adjusted
4. **DON'T reverse commissions on cancellation** - Preserve pending commissions
5. **DON'T forget tenant isolation** - All queries must filter by tenantId
6. **DON'T use campaign.commissionRate** - Schema uses `commissionValue` not `commissionRate`
7. **DON'T expose internal errors in webhook responses** - Always return 200

### Common Pitfalls

1. **Recurring rate calculation**: Check `recurringRateType` ("same", "reduced", "custom") before applying rate.

2. **Plan change detection**: Need to compare previous vs current subscription data. May need to store previous state in conversion metadata.

3. **Commission adjustment**: Only PENDING commissions can be adjusted. Approved/confirmed commissions require reversal flow (Story 7.4).

4. **Subscription metadata tracking**: Store subscription ID in conversion metadata to link renewals to original conversion.

5. **Amount conversion**: Webhook amounts are in cents. Divide by 100 for currency units.

### Testing Requirements

**Test file:** `convex/commissionEngine.test.ts` (extend existing)

**Test cases:**
1. `subscription.updated` renewal with recurring enabled → commission created
2. `subscription.updated` renewal with recurring disabled → no commission
3. `subscription.updated` upgrade with pending commission → adjusted upward
4. `subscription.updated` downgrade with pending commission → adjusted downward
5. `subscription.updated` with no pending commission → new commission created
6. `subscription.cancelled` → no new commissions, pending preserved
7. `subscription.created` with paid status → initial commission created
8. `subscription.created` with pending status → conversion only, no commission
9. Duplicate subscription event → rejected
10. Subscription event for paused campaign → commission blocked
11. Subscription event for archived campaign → commission blocked

### Security Considerations

1. **Idempotency** - EventId deduplication prevents double commission awards
2. **Tenant isolation** - All queries filter by tenantId from webhook metadata
3. **Affiliate validation** - Only active affiliates earn commissions
4. **Campaign validation** - Only active campaigns with recurring enabled earn renewal commissions
5. **Audit trail** - All commission adjustments logged to auditLogs table
6. **Error hiding** - Never expose internal errors in webhook responses

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.2] - Story definition and acceptance criteria (FR23)
- [Source: _bmad-output/planning-artifacts/architecture.md] - HTTP endpoint patterns, Convex function patterns
- [Source: _bmad-output/planning-artifacts/prd.md] - FR23 specification, subscription lifecycle requirements
- [Source: convex/schema.ts] - campaigns table (recurringCommission fields), commissions table, conversions table
- [Source: convex/webhooks.ts] - BillingEvent interface, event normalization, deduplication
- [Source: convex/commissionEngine.ts] - Existing payment.updated processing (Story 7.1)
- [Source: convex/commissions.ts] - Commission creation and management functions
- [Source: convex/http.ts] - Webhook routing and handling
- [Source: _bmad-output/implementation-artifacts/7-1-payment-updated-event-processing.md] - Previous story patterns
- [Source: _bmad-output/implementation-artifacts/4-4-recurring-commission-support.md] - Recurring commission config
- [Source: AGENTS.md] - Convex development patterns
- [Source: _bmad-output/project-context.md] - Technology stack, function syntax requirements

## Change Log

- **2026-03-15**: Completed implementation of Story 7.2 - Subscription Lifecycle Event Processing
  - Implemented `processSubscriptionCreatedEvent` internal action for handling new subscriptions
  - Implemented `processSubscriptionUpdatedEvent` internal action for handling renewals and plan changes
  - Implemented `processSubscriptionCancelledEvent` internal action for handling cancellations
  - Added helper functions for subscription event detection and commission calculation
  - Updated Convex schema to support subscription metadata in conversions and commissions
  - Updated HTTP handler to route subscription events to appropriate processors
  - Added comprehensive integration tests for subscription lifecycle scenarios
  - All acceptance criteria satisfied and code compiles successfully

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

- `convex/commissionEngine.ts` - Added `processSubscriptionCreatedEvent`, `processSubscriptionUpdatedEvent`, and `processSubscriptionCancelledEvent` internal actions; added helper functions for subscription event detection and commission calculation
- `convex/schema.ts` - Updated conversions table metadata to support subscriptionId, planId, and subscriptionStatus fields; updated commissions table eventMetadata to support subscriptionId
- `convex/conversions.ts` - Updated `createConversionWithAttribution`, `createOrganicConversion`, and `createConversion` functions to support subscription metadata fields
- `convex/commissions.ts` - Updated `createCommissionFromConversionInternal` to support subscriptionId in eventMetadata
- `convex/http.ts` - Updated webhook handler to route subscription.created, subscription.updated, and subscription.cancelled events to new processors
- `convex/commissionEngine.test.ts` - Added integration tests for Story 7.2 subscription lifecycle events
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated story status from "ready-for-dev" to "in-progress"
