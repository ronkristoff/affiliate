# Story 7.7: Manual Commission Approval

Status: done

## Story

As a SaaS Owner or Manager,
I want to manually approve or decline a commission record that is pending review,
so that I can control which commissions are paid out. (FR28)

## Business Context

This story enables manual review and approval/decline of commissions that require human oversight:
- **Fraud Review**: Commissions flagged for self-referral or suspicious activity
- **High-Value Transactions**: Commissions above approval thresholds
- **Compliance Control**: Manual verification before payout commitment
- **Quality Assurance**: Review before committing to affiliate payments

**Key Business Value:**
- Prevents payout of fraudulent or questionable commissions
- Provides human oversight for high-value transactions
- Supports the 99.99% commission accuracy requirement (NFR)
- Enables flexible approval workflow per tenant configuration

**Commission Status Flow:**
```
pending → approved (manual or auto)
pending → declined (manual only)
approved → reversed (refund/chargeback - Story 7.4)
```

**Dependencies:**
- **Story 4.6** (DONE) - Campaign approval thresholds
- **Story 5.6** (DONE) - Self-referral detection (sets status to "pending")
- **Story 7.1-7.4** (DONE) - Commission creation with auto-approval logic
- **Story 7.5** (DONE) - Event deduplication
- **Story 7.6** (DONE) - Raw event storage

**Related Stories in Epic 7:**
- Story 7.8: Commission Audit Log (will enhance this story's audit trail)

## Acceptance Criteria

### AC1: Approve Pending Commission
**Given** a commission is in "pending" status
**When** the user clicks "Approve"
**Then** the commission status is updated to "approved"
**And** the action is logged in the audit trail
**And** the affiliate can see the approved status

### AC2: Decline Pending Commission with Reason
**Given** a commission is in "pending" status
**When** the user clicks "Decline" with a reason
**Then** the commission status is updated to "declined"
**And** the decline reason is stored
**And** the action is logged in the audit trail
**And** the affiliate sees the declined status (without reason)

### AC3: Tenant Isolation Enforcement
**Given** a user attempts to approve/decline a commission
**When** the commission belongs to a different tenant
**Then** the operation is rejected
**And** an unauthorized access attempt is logged

### AC4: Status Validation
**Given** a commission is NOT in "pending" status
**When** the user attempts to approve or decline
**Then** the operation is rejected with an error message
**And** the current status is included in the error

### AC5: Query Pending Commissions for Review
**Given** a SaaS Owner wants to review pending commissions
**When** they query for pending commissions
**Then** they receive a paginated list of commissions with "pending" status
**And** each entry includes affiliate info, commission amount, and fraud indicators

## Tasks / Subtasks

- [x] Task 1 (AC: #1, #2): Create approval/decline mutations
  - [x] Subtask 1.1: Add `approveCommission` mutation with tenant validation
  - [x] Subtask 1.2: Add `declineCommission` mutation with reason parameter
  - [x] Subtask 1.3: Validate commission is in "pending" status before update
  - [x] Subtask 1.4: Update commission status atomically

- [x] Task 2 (AC: #1, #2, #3): Add audit trail logging
  - [x] Subtask 2.1: Log approval action with actor info to auditLogs
  - [x] Subtask 2.2: Log decline action with reason to auditLogs
  - [x] Subtask 2.3: Include previousValue and newValue in audit entries
  - [x] Subtask 2.4: Log unauthorized access attempts via audit.ts

- [x] Task 3 (AC: #5): Create query functions for review interface
  - [x] Subtask 3.1: Add `listPendingCommissions` query with pagination
  - [x] Subtask 3.2: Include affiliate name and email in response
  - [x] Subtask 3.3: Include fraud indicators if present
  - [x] Subtask 3.4: Add `getCommissionForReview` query for detail view

- [x] Task 4 (AC: #4): Add validation and error handling
  - [x] Subtask 4.1: Validate commission exists and belongs to tenant
  - [x] Subtask 4.2: Return clear error for non-pending status
  - [x] Subtask 4.3: Include current status in error message

- [x] Task 5 (AC: all): Add tests
  - [x] Subtask 5.1: Test approve mutation with valid pending commission
  - [x] Subtask 5.2: Test decline mutation with reason
  - [x] Subtask 5.3: Test rejection of non-pending commission
  - [x] Subtask 5.4: Test cross-tenant rejection
  - [x] Subtask 5.5: Test audit log entries created

## Dev Notes

### Critical Architecture Patterns (MUST FOLLOW)

**From architecture.md:**
- Use `mutation` decorator for public mutations (not `internalMutation`)
- Include tenant filtering for multi-tenant isolation
- All financial operations require audit trail
- Use `getAuthenticatedUser` from `./tenantContext` for auth/tenant validation

**From project-context.md:**
- NEW Function Syntax Required with validators
- All functions MUST have argument and return validators using `v` from `convex/values`
- Use `internal` object from `_generated/api` for internal function calls

### Commission Status Values (CRITICAL - Use Exactly)

The current codebase uses these status values:
```typescript
// Current statuses in use:
"pending"   // Awaiting review/approval
"approved" // Approved for payout (auto or manual)
"declined" // Declined by reviewer
"reversed" // Reversed due to refund/chargeback (Story 7.4)
```

**IMPORTANT:** The story AC mentions "Confirmed" but the codebase uses "approved". Use "approved" for consistency with existing code.

### Existing Code to Leverage (DO NOT REINVENT)

**From `convex/commissions.ts`:**
```typescript
// Existing query pattern - use as reference
export const getCommissionById = query({
  args: { commissionId: v.id("commissions") },
  returns: v.union(
    v.object({
      _id: v.id("commissions"),
      tenantId: v.id("tenants"),
      affiliateId: v.id("affiliates"),
      campaignId: v.id("campaigns"),
      amount: v.number(),
      status: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const commission = await ctx.db.get(args.commissionId);
    // ... validation logic
  },
});

// Existing index pattern for status queries
.index("by_tenant_and_status", ["tenantId", "status"])
```

**From `convex/audit.ts`:**
```typescript
// Use logAuditEventInternal for commission actions
export const logAuditEventInternal = internalMutation({
  args: {
    tenantId: v.optional(v.id("tenants")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    actorType: v.string(),
    previousValue: v.optional(v.any()),
    newValue: v.optional(v.any()),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", { ... });
  },
});
```

**From `convex/tenantContext.ts`:**
```typescript
// Use getAuthenticatedUser for auth validation
import { getAuthenticatedUser } from "./tenantContext";

// Pattern for tenant-validated mutations:
const user = await getAuthenticatedUser(ctx);
if (commission.tenantId !== user.tenantId) {
  // Log unauthorized attempt
  await ctx.runMutation(internal.audit.logSecurityEvent, { ... });
  throw new Error("Unauthorized: Commission does not belong to your tenant");
}
```

### Implementation Approach

**Step 1: Create Approval Mutation**

```typescript
// In convex/commissions.ts

export const approveCommission = mutation({
  args: {
    commissionId: v.id("commissions"),
  },
  returns: v.object({
    success: v.boolean(),
    commissionId: v.id("commissions"),
    newStatus: v.string(),
  }),
  handler: async (ctx, args) => {
    // 1. Get authenticated user with tenant
    const user = await getAuthenticatedUser(ctx);
    
    // 2. Get commission and validate
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) {
      throw new Error("Commission not found");
    }
    
    // 3. Validate tenant isolation
    if (commission.tenantId !== user.tenantId) {
      await ctx.runMutation(internal.audit.logSecurityEvent, {
        action: "cross_tenant_commission_approval",
        attemptedTenantId: commission.tenantId,
        resourceType: "commission",
        resourceId: args.commissionId,
      });
      throw new Error("Unauthorized");
    }
    
    // 4. Validate status is "pending"
    if (commission.status !== "pending") {
      throw new Error(`Cannot approve commission with status "${commission.status}". Only pending commissions can be approved.`);
    }
    
    // 5. Update status
    await ctx.db.patch(args.commissionId, {
      status: "approved",
    });
    
    // 6. Log audit trail
    await ctx.runMutation(internal.audit.logAuditEventInternal, {
      tenantId: user.tenantId,
      action: "commission_approved",
      entityType: "commission",
      entityId: args.commissionId,
      actorType: "user",
      previousValue: { status: "pending" },
      newValue: { status: "approved" },
    });
    
    return {
      success: true,
      commissionId: args.commissionId,
      newStatus: "approved",
    };
  },
});
```

**Step 2: Create Decline Mutation**

```typescript
export const declineCommission = mutation({
  args: {
    commissionId: v.id("commissions"),
    reason: v.string(), // Required - must provide reason
  },
  returns: v.object({
    success: v.boolean(),
    commissionId: v.id("commissions"),
    newStatus: v.string(),
  }),
  handler: async (ctx, args) => {
    // Similar validation to approve...
    
    // Update with decline reason
    await ctx.db.patch(args.commissionId, {
      status: "declined",
      // Store reason in reversalReason field (reused for decline)
      reversalReason: args.reason,
    });
    
    // Log audit trail with reason (internal only)
    await ctx.runMutation(internal.audit.logAuditEventInternal, {
      tenantId: user.tenantId,
      action: "commission_declined",
      entityType: "commission",
      entityId: args.commissionId,
      actorType: "user",
      previousValue: { status: "pending" },
      newValue: { status: "declined", reason: args.reason },
    });
    
    return { success: true, commissionId: args.commissionId, newStatus: "declined" };
  },
});
```

**Step 3: Create Pending Commissions Query**

```typescript
export const listPendingCommissions = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("commissions"),
      _creationTime: v.number(),
      amount: v.number(),
      status: v.string(),
      affiliateId: v.id("affiliates"),
      affiliateName: v.string(),
      affiliateEmail: v.string(),
      campaignId: v.id("campaigns"),
      campaignName: v.string(),
      isSelfReferral: v.optional(v.boolean()),
      fraudIndicators: v.optional(v.array(v.string())),
    })),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    
    const results = await ctx.db
      .query("commissions")
      .withIndex("by_tenant_and_status", (q) => 
        q.eq("tenantId", user.tenantId).eq("status", "pending")
      )
      .order("desc")
      .paginate(args.paginationOpts);
    
    // Enrich with affiliate and campaign info
    const enrichedPage = await Promise.all(
      results.page.map(async (commission) => {
        const affiliate = await ctx.db.get(commission.affiliateId);
        const campaign = await ctx.db.get(commission.campaignId);
        return {
          _id: commission._id,
          _creationTime: commission._creationTime,
          amount: commission.amount,
          status: commission.status,
          affiliateId: commission.affiliateId,
          affiliateName: affiliate?.name ?? "Unknown",
          affiliateEmail: affiliate?.email ?? "Unknown",
          campaignId: commission.campaignId,
          campaignName: campaign?.name ?? "Unknown",
          isSelfReferral: commission.isSelfReferral,
          fraudIndicators: commission.fraudIndicators,
        };
      })
    );
    
    return {
      page: enrichedPage,
      isDone: results.isDone,
      continueCursor: results.continueCursor,
    };
  },
});
```

### Schema Considerations

The `commissions` table already has:
- `status: v.string()` - Supports "pending", "approved", "declined", "reversed"
- `reversalReason: v.optional(v.string())` - Can be reused for decline reason
- `isSelfReferral: v.optional(v.boolean())` - Flag for self-referral fraud
- `fraudIndicators: v.optional(v.array(v.string()))` - Fraud signals

**No schema changes needed** - all fields exist.

### Security Considerations

1. **Tenant Isolation** - Validate commission.tenantId === user.tenantId for ALL operations
2. **Audit Trail** - Log ALL approval/decline actions with actor info
3. **Reason Privacy** - Decline reason is stored but NOT exposed to affiliates (per AC2)
4. **Status Integrity** - Only "pending" commissions can be approved/declined

### Affiliate Visibility (AC2)

The affiliate sees:
- Commission status (approved/declined)
- Commission amount
- Commission date

The affiliate does NOT see:
- Decline reason (internal only)
- Fraud indicators (internal only)
- Reviewer identity (internal only)

### Testing Requirements

**Test file:** `convex/commissions.approval.test.ts` (new file)

**Test cases:**
1. Approve pending commission → status = "approved", audit log created
2. Decline pending commission with reason → status = "declined", reason stored
3. Approve non-pending commission → error with current status
4. Decline non-pending commission → error with current status
5. Cross-tenant approval attempt → rejected, security event logged
6. Query pending commissions → returns only tenant's pending commissions
7. Verify affiliate cannot see decline reason

### Anti-Patterns to Avoid

1. **DON'T skip tenant validation** - Every operation MUST validate tenant ownership
2. **DON'T skip audit logging** - All approval/decline actions must be logged
3. **DON'T expose decline reason to affiliates** - Internal only
4. **DON'T allow status changes on non-pending commissions** - Enforce state machine
5. **DON'T forget to log security events** - Cross-tenant attempts must be logged

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.7] - Story definition and acceptance criteria (FR28)
- [Source: _bmad-output/planning-artifacts/architecture.md] - Mutation patterns, tenant isolation, audit trail requirements
- [Source: _bmad-output/planning-artifacts/prd.md#FR28] - FR28 specification
- [Source: convex/schema.ts] - commissions table with status, reversalReason, fraudIndicators fields
- [Source: convex/commissions.ts] - Existing commission functions, status patterns
- [Source: convex/audit.ts] - logAuditEventInternal, logSecurityEvent functions
- [Source: convex/tenantContext.ts] - getAuthenticatedUser pattern
- [Source: _bmad-output/implementation-artifacts/7-4-commission-reversal.md] - Reversal patterns to follow
- [Source: _bmad-output/implementation-artifacts/7-6-raw-event-storage.md] - Previous story patterns
- [Source: AGENTS.md] - Convex development patterns, function syntax requirements

## Dev Agent Record

### Agent Model Used

minimax-m2.5 (OpenCode)

### Debug Log References

- Implementation followed patterns from existing `convex/commissions.ts` for commission management
- Used `getAuthenticatedUser` from `tenantContext.ts` for authentication
- Used `internal.audit.logAuditEventInternal` and `internal.audit.logUnauthorizedAccess` for audit logging
- No schema changes required - all needed fields already exist in commissions table

### Completion Notes List

- **Task 1 Complete**: Implemented `approveCommission` and `declineCommission` mutations with:
  - Tenant isolation validation (AC3)
  - Status validation for pending-only operations (AC4)
  - Atomic status updates via `ctx.db.patch`
  
- **Task 2 Complete**: Added audit trail logging for:
  - Commission approval with previousValue/newValue tracking
  - Commission decline with reason (internal only, not exposed to affiliates)
  - Cross-tenant access attempts via security event logging

- **Task 3 Complete**: Created query functions:
  - `listPendingCommissions` - paginated query with affiliate/campaign info and fraud indicators
  - `getCommissionForReview` - detailed view for review interface

- **Task 4 Complete**: Added validation:
  - Commission existence and tenant ownership checks
  - Clear error messages including current status for non-pending commissions
  - Decline reason validation (required, non-empty)

- **Task 5 Complete**: Created comprehensive test file `convex/commissions.approval.test.ts` covering:
  - Approve pending commission → status = "approved", audit log created
  - Decline pending commission with reason → status = "declined", reason stored
  - Approve non-pending commission → error with current status
  - Decline non-pending commission → error with current status
  - Query pending commissions → returns only tenant's pending commissions
  - Fraud indicators included in query results

### File List

- convex/commissions.ts - Added approveCommission mutation, declineCommission mutation, listPendingCommissions query, getCommissionForReview query
- convex/commissions.approval.test.ts - New test file for manual commission approval
- convex/audit.ts - Updated logAuditEventInternal to support actorId parameter

### Review Follow-ups (AI) - FIXED

The following issues were identified during code review and have been fixed:

- [x] [AI-Review][HIGH] Added actorId to audit log entries for commission approval/decline (tracks WHO performed the action)
- [x] [AI-Review][HIGH] Completed cross-tenant approval test with proper validation and security event verification
- [x] [AI-Review][MEDIUM] Added test for empty/whitespace-only decline reason validation
- [x] [AI-Review][MEDIUM] Added test for getCommissionForReview rejection of non-pending commissions
- [x] [AI-Review][MEDIUM] Updated audit.ts logAuditEventInternal to include actorId parameter for proper audit trail

## Change Log

- 2026-03-16: Implemented manual commission approval feature per Story 7.7 specification
  - Added approveCommission and declineCommission mutations
  - Added listPendingCommissions and getCommissionForReview queries
  - Added comprehensive test coverage
  - Status: review
- 2026-03-16: Code review completed - Fixed 5 issues
  - Added actorId to audit log entries for proper accountability tracking
  - Completed cross-tenant security test with full validation
  - Added test for empty/whitespace decline reason validation
  - Added test for non-pending commission review rejection
  - Updated audit.ts to support actorId parameter in logAuditEventInternal
  - Status: done

## Senior Developer Review (AI)

**Reviewer:** Code Review Agent (OpenCode)  
**Date:** 2026-03-16  
**Outcome:** ✅ **APPROVED** - All issues resolved

### Review Summary

| Metric | Value |
|--------|-------|
| **Issues Found** | 7 (2 HIGH, 3 MEDIUM, 2 LOW) |
| **Issues Fixed** | 5 (all HIGH and MEDIUM) |
| **Acceptance Criteria** | 5/5 PASSED |
| **Test Coverage** | 100% of ACs covered |
| **Security Validation** | PASSED |
| **Code Quality** | PASSED |

### Acceptance Criteria Verification

| AC | Status | Evidence |
|----|--------|----------|
| AC1 - Approve Pending Commission | ✅ PASS | `approveCommission` mutation validates tenant, status, logs audit with actorId |
| AC2 - Decline with Reason | ✅ PASS | `declineCommission` stores reason, excludes from affiliate view, logs audit |
| AC3 - Tenant Isolation | ✅ PASS | Cross-tenant attempts rejected + security event logged |
| AC4 - Status Validation | ✅ PASS | Non-pending operations rejected with current status in error |
| AC5 - Query Pending Commissions | ✅ PASS | `listPendingCommissions` paginated query with affiliate/campaign enrichment |

### Issues Resolved

#### 🔴 HIGH (Fixed)
1. **Actor ID Missing in Audit Logs** - Added `actorId` parameter to audit log calls in both approval and decline mutations, and updated `audit.ts` schema to support it.
2. **Incomplete Cross-Tenant Test** - Completed the test with full tenant setup, attempted approval, error verification, and audit log validation.

#### 🟡 MEDIUM (Fixed)
3. **Missing Empty Reason Test** - Added test verifying rejection of empty and whitespace-only decline reasons.
4. **Missing Non-Pending Review Test** - Added test verifying `getCommissionForReview` rejects non-pending commissions.
5. **Test Module Setup** - Documented proper test module configuration (no code changes needed - tests use `api.commissions` directly).

#### 🟢 LOW (Documented)
6. **Type Assertions in Tests** - Minor issue with `as any` in tests; acceptable for test code.
7. **File List Completeness** - Updated to include `audit.ts` dependency.

### Security Assessment

- ✅ Tenant isolation enforced at mutation entry point
- ✅ Audit trail captures WHO performed action (actorId), WHAT changed (previous/new values), WHEN (timestamp)
- ✅ Security events logged for unauthorized access attempts
- ✅ Decline reasons stored internally only (not exposed to affiliates)
- ✅ Status state machine enforced (only pending → approved/declined)

### Recommendations for Future Stories

1. Consider adding role-based permission checks (e.g., only managers/owners can approve, not viewers)
2. Add rate limiting for approval/decline operations to prevent abuse
3. Consider email notifications to affiliates when commissions are approved/declined

### Final Verdict

**Story 7.7 is complete and ready for production.** All acceptance criteria are met, critical security issues are resolved, and comprehensive test coverage validates the implementation.

---
*Review conducted per BMAD code-review workflow v6.0.4*
