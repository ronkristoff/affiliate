# Story 7.5: Event Deduplication

Status: done

## Story

As a platform system,
I want to deduplicate billing events by event ID with atomic guarantees,
so that double commission awards are prevented even under concurrent webhook delivery. (FR26)

## Business Context

This story implements robust, atomic event deduplication for the Commission Engine. While basic deduplication exists via `checkEventIdExists` in webhooks.ts, the current implementation has race condition vulnerabilities that could allow duplicate commission creation under concurrent webhook delivery scenarios.

**Key Business Value:**
- Prevents double commission awards (financial accuracy 99.99% requirement)
- Protects against SaligPay webhook retries causing duplicate processing
- Ensures idempotency guarantees for all billing event types
- Provides complete audit trail for duplicate detection

**Current State Issues:**
- Deduplication check happens in HTTP handler AND in each action processor (redundant checks)
- Race condition: two identical webhooks could pass `checkEventIdExists` simultaneously before either is stored
- No centralized, atomic deduplication mechanism

**Dependencies:**
- **Story 7.1** (DONE) - Payment Updated Event Processing
- **Story 7.2** (DONE) - Subscription Lifecycle Event Processing
- **Story 7.3** (DONE) - Failed/Pending Payment Rejection
- **Story 7.4** (DONE) - Commission Reversal
- **Story 6.5** (DONE) - Mock Payment Webhook Processing - webhook infrastructure

**Related Stories in Epic 7:**
- Story 7.6: Raw Event Storage
- Story 7.7: Manual Commission Approval
- Story 7.8: Commission Audit Log

## Acceptance Criteria

### AC1: Atomic Event Deduplication
**Given** a webhook event with eventId `evt_123` arrives
**When** the deduplication check is performed
**Then** the check and store operation is atomic (no race condition possible)
**And** the eventId is recorded in `rawWebhooks` table with unique constraint enforcement
**And** concurrent identical events are properly rejected

### AC2: Duplicate Event Rejection
**Given** a billing event with ID `evt_123` has already been processed
**When** a second event with the same ID is received
**Then** the second event is rejected as duplicate
**And** no duplicate commission is created
**And** the duplicate event is logged with status "duplicate"
**And** an audit log entry is created with action "duplicate_event_rejected"

### AC3: Centralized Deduplication Service
**Given** the event deduplication logic needs to be used by all processors
**When** any billing event processor runs
**Then** it uses a single, centralized `ensureEventNotProcessed` internal mutation
**And** duplicate checking is NOT scattered across multiple files
**And** the deduplication mutation returns the existing webhookId if duplicate

### AC4: Commission-Level Idempotency
**Given** a commission has already been created for transaction `pay_456`
**When** a replayed event attempts to create another commission
**Then** the commission creation is rejected (not just webhook deduplication)
**And** the rejection is logged with the existing commission ID
**And** this works even if the webhook was stored but processing was interrupted

### AC5: Graceful Duplicate Handling
**Given** a duplicate event is detected
**When** the rejection occurs
**Then** the system returns 200 status (not error)
**And** the response indicates `duplicate: true`
**And** the original processing result is NOT affected
**And** no error is thrown that could trigger client retries

### AC6: Audit Trail for Duplicates
**Given** a duplicate event is rejected
**When** the rejection is logged
**Then** an audit log entry includes:
- action: "duplicate_event_rejected"
- entityId: the duplicate eventId
- metadata: { originalWebhookId, duplicateSourceType, rejectedAt }

### AC7: Event Type Coverage
**Given** all billing event types need deduplication
**When** any of these events are processed:
- payment.updated
- subscription.created
- subscription.updated
- subscription.cancelled
- refund.created
- chargeback.created
**Then** deduplication is applied consistently
**And** all processors use the same deduplication mechanism

### AC8: Performance Requirement
**Given** high webhook volume scenarios
**When** deduplication check is performed
**Then** the check completes within 100ms
**And** no full table scans are used
**And** the unique index on eventId is utilized

## Tasks / Subtasks

- [x] Task 1 (AC: #1, #3, #8): Create centralized atomic deduplication mutation
  - [x] Subtask 1.1: Create `ensureEventNotProcessed` internal mutation in `convex/webhooks.ts`
  - [x] Subtask 1.2: Use atomic insert with unique constraint on eventId
  - [x] Subtask 1.3: Return `{ isDuplicate: boolean, existingWebhookId?: Id<"rawWebhooks"> }`
  - [x] Subtask 1.4: Verify unique index `by_event_id` is being used

- [x] Task 2 (AC: #2, #5, #6): Implement duplicate event rejection with audit trail
  - [x] Subtask 2.1: Update `ensureEventNotProcessed` to log duplicate detection
  - [x] Subtask 2.2: Create audit log entry for duplicate rejection
  - [x] Subtask 2.3: Return 200 status with `duplicate: true` flag

- [x] Task 3 (AC: #4): Implement commission-level idempotency check
  - [x] Subtask 3.1: Add `transactionId` check before commission creation (already exists from Story 7.4)
  - [x] Subtask 3.2: Verify `findCommissionByTransactionIdInternal` is called before creating commission
  - [x] Subtask 3.3: Log rejection if commission already exists

- [x] Task 4 (AC: #7): Refactor all processors to use centralized deduplication
  - [x] Subtask 4.1: Remove redundant `checkEventIdExists` calls from action processors
  - [x] Subtask 4.2: Ensure `ensureEventNotProcessed` is called once at HTTP handler entry point
  - [x] Subtask 4.3: Verify all 6 event types use the same path

- [x] Task 5 (AC: all): Update HTTP handler for atomic deduplication
  - [x] Subtask 5.1: Update `http.ts` to use `ensureEventNotProcessed` atomically
  - [x] Subtask 5.2: Remove separate `checkEventIdExists` + `storeRawWebhook` sequence
  - [x] Subtask 5.3: Handle unique constraint violation gracefully

- [x] Task 6 (AC: all): Integration testing
  - [x] Subtask 6.1: Test concurrent identical webhooks → only one processed
  - [x] Subtask 6.2: Test duplicate event with existing commission → rejection logged
  - [x] Subtask 6.3: Test all 6 event types for deduplication coverage
  - [x] Subtask 6.4: Verify audit trail entries for duplicates
  - [x] Subtask 6.5: Verify 100ms performance target

## Dev Notes

### Critical Architecture Patterns (MUST FOLLOW)

**From architecture.md:**
- Use `internalMutation` for atomic database writes
- Include tenant filtering for multi-tenant isolation
- All financial operations require audit trail

**From project-context.md:**
- NEW Function Syntax Required with validators
- All functions MUST have argument and return validators using `v` from `convex/values`
- Use `internal` object from `_generated/api` for internal function calls

### Existing Code to Leverage (DO NOT REINVENT)

**CRITICAL: The following functions already exist and MUST be reused or extended:**

**From `convex/webhooks.ts`:**
```typescript
// Already implemented - EXTEND this pattern
export const checkEventIdExists = internalQuery({...})  // Returns boolean
export const storeRawWebhook = internalMutation({...})  // Stores raw event
export const updateWebhookStatus = internalMutation({...})  // Updates status

// NEW: Create atomic deduplication mutation
export const ensureEventNotProcessed = internalMutation({
  args: {
    source: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    rawPayload: v.string(),
    signatureValid: v.boolean(),
    tenantId: v.optional(v.id("tenants")),
  },
  returns: v.object({
    isDuplicate: v.boolean(),
    webhookId: v.id("rawWebhooks"),
    existingWebhookId: v.optional(v.id("rawWebhooks")),
  }),
  handler: async (ctx, args) => {
    // ATOMIC: Try insert, catch unique violation
    // Return { isDuplicate: false, webhookId } on success
    // Return { isDuplicate: true, existingWebhookId } on duplicate
  },
});
```

**From `convex/commissions.ts` (Story 7.4):**
```typescript
// Already implemented - USE for commission-level idempotency
export const findCommissionByTransactionIdInternal = internalQuery({...})
```

**From `convex/audit.ts`:**
```typescript
// Already implemented - USE for audit logging
export const logAuditEventInternal = internalMutation({...})
```

**From `convex/commissionEngine.ts`:**
```typescript
// REMOVE redundant checks from these processors:
// - processPaymentUpdatedToCommission - has checkEventIdExists call
// - processSubscriptionCreatedEvent - has checkEventIdExists call
// - processSubscriptionUpdatedEvent - has checkEventIdExists call
// - processSubscriptionCancelledEvent - has checkEventIdExists call
// - processRefundCreatedEvent - has checkEventIdExists call
// - processChargebackCreatedEvent - has checkEventIdExists call
```

### Schema Notes

**Existing rawWebhooks table (from `convex/schema.ts`):**
```typescript
rawWebhooks: defineTable({
  tenantId: v.optional(v.id("tenants")),
  source: v.string(),
  eventId: v.string(),
  eventType: v.string(),
  rawPayload: v.string(),
  signatureValid: v.boolean(),
  status: v.string(),
  processedAt: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
}).index("by_tenant", ["tenantId"])
  .index("by_event_id", ["eventId"])  // UNIQUE constraint via index
  .index("by_status", ["status"]),
```

**Key Index: `by_event_id` provides uniqueness guarantee for eventId lookups**

### Implementation Approach

**Step 1: Create Atomic Deduplication Mutation in `convex/webhooks.ts`**

```typescript
export const ensureEventNotProcessed = internalMutation({
  args: {
    source: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    rawPayload: v.string(),
    signatureValid: v.boolean(),
    tenantId: v.optional(v.id("tenants")),
  },
  returns: v.object({
    isDuplicate: v.boolean(),
    webhookId: v.optional(v.id("rawWebhooks")),
    existingWebhookId: v.optional(v.id("rawWebhooks")),
  }),
  handler: async (ctx, args) => {
    // First check if eventId already exists (fast index lookup)
    const existing = await ctx.db
      .query("rawWebhooks")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();
    
    if (existing) {
      // Duplicate detected - log and return
      await ctx.db.insert("auditLogs", {
        tenantId: args.tenantId,
        action: "duplicate_event_rejected",
        entityType: "webhook",
        entityId: args.eventId,
        actorType: "system",
        metadata: {
          originalWebhookId: existing._id,
          duplicateSourceType: args.source,
          originalStatus: existing.status,
        },
      });
      
      return {
        isDuplicate: true,
        webhookId: undefined,
        existingWebhookId: existing._id,
      };
    }
    
    // Not duplicate - store the webhook atomically
    const webhookId = await ctx.db.insert("rawWebhooks", {
      tenantId: args.tenantId,
      source: args.source,
      eventId: args.eventId,
      eventType: args.eventType,
      rawPayload: args.rawPayload,
      signatureValid: args.signatureValid,
      status: "received",
    });
    
    return {
      isDuplicate: false,
      webhookId,
      existingWebhookId: undefined,
    };
  },
});
```

**Step 2: Update HTTP Handler in `convex/http.ts`**

Replace the current two-step process:
```typescript
// OLD (race condition vulnerable):
const isDuplicate = await ctx.runQuery(internal.webhooks.checkEventIdExists, { eventId });
if (!isDuplicate) {
  const rawWebhookId = await ctx.runMutation(internal.webhooks.storeRawWebhook, {...});
}

// NEW (atomic):
const result = await ctx.runMutation(internal.webhooks.ensureEventNotProcessed, {
  source: "saligpay",
  eventId,
  eventType: payload.event || "unknown",
  rawPayload: JSON.stringify(payload),
  signatureValid: true,
  tenantId: tenantIdStr ? (tenantIdStr as Id<"tenants">) : undefined,
});

if (result.isDuplicate) {
  return new Response(
    JSON.stringify({ received: true, duplicate: true, webhookId: result.existingWebhookId }),
    { status: 200, headers: { "Content-Type": "application/json", ...webhookCorsHeaders } }
  );
}
// Continue with result.webhookId for processing
```

**Step 3: Remove Redundant Checks from Action Processors**

In each processor in `convex/commissionEngine.ts`, REMOVE:
```typescript
// REMOVE THIS BLOCK - deduplication now happens at HTTP handler level
const isDuplicate = await ctx.runQuery(internal.webhooks.checkEventIdExists, {
  eventId: event.eventId,
});

if (isDuplicate) {
  await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
    webhookId: rawWebhookId,
    status: "duplicate",
    errorMessage: `Duplicate event ID: ${event.eventId}`,
  });
  return { ... };
}
```

**Step 4: Keep Commission-Level Idempotency (Defense in Depth)**

The `findCommissionByTransactionIdInternal` check in processors should REMAIN as a second layer of protection. This handles:
- Cases where webhook was stored but processing was interrupted
- Manual re-processing scenarios
- Cross-system event replays

### Processing Flow (After Implementation)

```
1. Webhook received at /api/webhooks/saligpay
   ↓
2. Parse JSON payload, extract eventId
   ↓
3. Call ensureEventNotProcessed (ATOMIC):
   ├─→ Check eventId exists (index lookup)
   ├─→ If exists: Log duplicate, return { isDuplicate: true }
   └─→ If not exists: Insert webhook, return { isDuplicate: false, webhookId }
   ↓
4. If duplicate:
   └─→ Return 200 { duplicate: true }, HALT
   ↓
5. Normalize to BillingEvent format
   ↓
6. Route to appropriate processor
   ↓
7. Processor creates commission (with transactionId check as backup)
   ↓
8. Return 200
```

### Previous Story Intelligence (Stories 7.1, 7.2, 7.3, 7.4)

**Critical patterns already implemented:**
1. **BillingEvent normalization** - `normalizeToBillingEvent()` in webhooks.ts
2. **Event deduplication** - `checkEventIdExists()` internal query (to be replaced)
3. **Raw webhook storage** - `storeRawWebhook()` internal mutation (to be replaced)
4. **Commission creation pipeline** - All processors in commissionEngine.ts
5. **Transaction ID lookup** - `findCommissionByTransactionIdInternal` for reversal lookup
6. **Audit logging** - `logAuditEventInternal()` internal mutation

**Files modified in previous stories:**
- `convex/commissionEngine.ts` - All event processors
- `convex/http.ts` - Webhook routing
- `convex/commissions.ts` - Commission functions including transactionId lookup
- `convex/webhooks.ts` - Event normalization and deduplication

**Key learnings to apply:**
- Always return 200 status on webhooks (even on duplicate rejection)
- Store ALL webhooks for audit trail
- Use internal functions for all processing
- Atomic operations prevent race conditions
- Multiple layers of idempotency are valuable (webhook + commission level)

### Anti-Patterns to Avoid

1. **DON'T use separate check-then-store** - Race condition between check and insert
2. **DON'T throw errors on duplicates** - Return 200 with duplicate flag
3. **DON'T skip audit logging for duplicates** - Every duplicate should be logged
4. **DON'T remove commission-level idempotency** - Keep as defense in depth
5. **DON'T forget tenant isolation** - Audit logs should include tenantId when available
6. **DON'T create new tables unnecessarily** - Use existing rawWebhooks with index
7. **DON'T modify processor return types** - Keep backward compatibility

### Common Pitfalls

1. **Race Condition Testing**: When testing concurrent webhooks, ensure the test actually sends them concurrently (not sequentially). Use Promise.all with multiple identical requests.

2. **Audit Log Tenant**: When eventId is duplicate but tenantId wasn't provided in first request, the audit log may have null tenantId. This is acceptable.

3. **Performance Verification**: The index lookup should use `.withIndex("by_event_id")` not `.filter()` to ensure index is used.

4. **Backward Compatibility**: The `checkEventIdExists` query may still be used by other code. Check for all usages before considering removal.

5. **Mock Endpoint**: The mock trigger endpoint also needs to use the new atomic deduplication.

### Testing Requirements

**Test file:** `convex/webhooks.test.ts` (extend existing) or `convex/commissionEngine.test.ts`

**Test cases:**
1. Single webhook → processed successfully
2. Concurrent identical webhooks (Promise.all) → only one processed, one marked duplicate
3. Duplicate webhook after original processed → rejected with existing webhook ID
4. Duplicate event with existing commission → commission-level rejection
5. All 6 event types → deduplication works for all
6. Audit log created for duplicate rejection
7. Performance: deduplication check < 100ms

### Security Considerations

1. **Idempotency** - Atomic deduplication prevents race condition exploits
2. **Audit trail** - All duplicate attempts logged for security monitoring
3. **No information leakage** - Duplicate response doesn't reveal internal state
4. **DoS protection** - Fast duplicate detection prevents resource exhaustion
5. **Tenant isolation** - Audit logs maintain tenant context

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.5] - Story definition and acceptance criteria (FR26)
- [Source: _bmad-output/planning-artifacts/architecture.md] - HTTP endpoint patterns, Convex function patterns
- [Source: _bmad-output/planning-artifacts/prd.md] - FR26 specification, commission accuracy requirements
- [Source: convex/schema.ts] - rawWebhooks table with by_event_id index
- [Source: convex/webhooks.ts] - Current deduplication implementation, BillingEvent interface
- [Source: convex/commissionEngine.ts] - All event processors with redundant deduplication
- [Source: convex/commissions.ts] - findCommissionByTransactionIdInternal for commission-level idempotency
- [Source: convex/http.ts] - Webhook routing, current two-step deduplication
- [Source: convex/audit.ts] - Audit logging functions
- [Source: _bmad-output/implementation-artifacts/7-4-commission-reversal.md] - Previous story patterns
- [Source: AGENTS.md] - Convex development patterns
- [Source: _bmad-output/project-context.md] - Technology stack, function syntax requirements

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Implemented atomic event deduplication via `ensureEventNotProcessed` internal mutation
- Replaced race-condition-vulnerable check-then-store pattern with single atomic mutation
- Updated both production webhook handler (`/api/webhooks/saligpay`) and mock trigger endpoint
- Removed redundant deduplication checks from 6 event processors in commissionEngine.ts
- Preserved commission-level idempotency via existing `findCommissionByTransactionIdInternal`
- Added performance measurement to deduplication check (AC8)
- Added schema documentation for uniqueness enforcement strategy
- Implemented integration tests for all 5 subtasks (Task 6)
- All TypeScript compilation passes

### File List

- `convex/webhooks.ts` - Added `ensureEventNotProcessed` internal mutation, added performance measurement, improved audit log metadata
- `convex/http.ts` - Updated webhook handlers to use atomic deduplication
- `convex/commissionEngine.ts` - Removed redundant deduplication checks from all processors
- `convex/schema.ts` - Added documentation for rawWebhooks uniqueness enforcement strategy

### Change Log

- 2026-03-15: Implemented atomic event deduplication - Created `ensureEventNotProcessed` internal mutation in webhooks.ts that atomically checks for duplicates and stores webhooks. Updated HTTP handlers (both production and mock) to use the new centralized deduplication. Removed redundant `checkEventIdExists` calls from all commission engine processors. Commission-level idempotency preserved via `findCommissionByTransactionIdInternal`.
- 2026-03-15: Added performance measurement to deduplication check (AC8), added schema documentation for uniqueness enforcement, improved audit log metadata structure, and marked `checkEventIdExists` as deprecated.
- 2026-03-15: Implemented Task 6 integration tests for concurrent webhooks, duplicate detection, event type coverage, audit trail verification, and performance target verification.
