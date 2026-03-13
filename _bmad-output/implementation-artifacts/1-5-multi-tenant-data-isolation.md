# Story 1.5: Multi-Tenant Data Isolation

Status: in-progress

## Story

As a **platform architect**,
I want every database query and mutation scoped to the authenticated tenant,
so that tenants can never access each other's data.

## Acceptance Criteria

1. **AC1: Query Tenant Filtering** — Given a tenant is authenticated
   **When** any query is executed
   **Then** results are filtered by `tenantId`
   **And** no cross-tenant data is returned

2. **AC2: Mutation Authorization** — Given a mutation is attempted on another tenant's data
   **When** the mutation is executed
   **Then** the operation fails with authorization error
   **And** no data is modified

3. **AC3: Security Audit Logging** — Given an unauthorized access attempt
   **When** the attempt is detected
   **Then** the attempt is logged for security audit with timestamp, user ID, attempted resource

4. **AC4: Tenant Context Helper** — Given an authenticated user
   **When** any Convex function needs tenant context
   **Then** `getTenantId(ctx)` helper returns the current tenant ID
   **And** the helper throws if user is not authenticated

5. **AC5: Cross-Tenant Prevention** — Given a user tries to access data from another tenant
   **When** the query/mutation is processed
   **Then** the system returns empty results (queries) or authorization error (mutations)
   **And** the attempt is logged

## Tasks/Subtasks

- [x] **Task 1: Create Tenant Context Helper** (AC: 4)
   - [x] 1.1 Create `convex/tenantContext.ts` file
   - [x] 1.2 Implement `getTenantId(ctx)` function that extracts tenant from authenticated user
   - [x] 1.3 Implement `requireTenantId(ctx)` that throws if not authenticated
   - [x] 1.4 Implement `getTenant(ctx)` that returns full tenant record
   - [x] 1.5 Export helper functions for use in other Convex functions

- [x] **Task 2: Create Tenant-Scoped Query Wrapper** (AC: 1, 5)
   - [x] 2.1 Create `tenantQuery` wrapper function in `convex/tenantContext.ts`
   - [x] 2.2 Wrapper automatically injects `tenantId` into query handler
   - [x] 2.3 Wrapper ensures all returned data is filtered by tenant
   - [x] 2.4 Create TypeScript type for tenant-scoped query handler

- [x] **Task 3: Create Tenant-Scoped Mutation Wrapper** (AC: 2, 5)
   - [x] 3.1 Create `tenantMutation` wrapper function in `convex/tenantContext.ts`
   - [x] 3.2 Wrapper validates `tenantId` ownership before allowing writes
   - [x] 3.3 Wrapper throws authorization error for cross-tenant attempts
   - [x] 3.4 Create TypeScript type for tenant-scoped mutation handler

- [x] **Task 4: Implement Security Audit Logging** (AC: 3)
   - [x] 4.1 Create `logSecurityEvent` internal mutation in `convex/audit.ts`
   - [x] 4.2 Log unauthorized access attempts with details
   - [x] 4.3 Include: timestamp, userId, tenantId, attemptedTenantId, action, resource
   - [x] 4.4 Integrate logging into tenant wrappers

- [x] **Task 5: Create Resource Ownership Validator** (AC: 2)
   - [x] 5.1 Create `validateTenantOwnership` helper function
   - [x] 5.2 Helper checks if a document belongs to current tenant
   - [x] 5.3 Support checking by document ID or by fetching and comparing tenantId
   - [x] 5.4 Throw descriptive error if ownership check fails

- [x] **Task 6: Apply Tenant Isolation to Existing Tables** (AC: 1, 2)
   - [x] 6.1 Update `convex/users.ts` to use tenant-scoped queries
   - [ ] 6.2 Update `convex/campaigns.ts` (when created) to use tenant wrappers
   - [x] 6.3 Update `convex/affiliates.ts` (when created) to use tenant wrappers
   - [ ] 6.4 Update all future Convex files to use tenant-scoped functions

- [ ] **Task 7: Write Tests** (AC: All)
   - [ ] 7.1 Test that authenticated user can only see their tenant's data
   - [ ] 7.2 Test that cross-tenant query returns empty results
   - [ ] 7.3 Test that cross-tenant mutation throws authorization error
   - [ ] 7.4 Test that unauthorized access is logged
   - [ ] 7.5 Test that unauthenticated requests throw error

### Review Follow-ups (AI)

The following issues were identified during code review and have been FIXED:

- [x] [AI-Review][HIGH] affiliates.ts not using tenant-scoped functions - FIXED
- [x] [AI-Review][HIGH] getAffiliate missing tenant validation - FIXED  
- [x] [AI-Review][HIGH] updateAffiliateStatus missing authorization check - FIXED
- [x] [AI-Review][MEDIUM] updateAffiliateProfile missing authorization - FIXED
- [x] [AI-Review][MEDIUM] updateAffiliatePassword missing authorization - FIXED
- [x] [AI-Review][MEDIUM] setAffiliatePassword missing authorization - FIXED
- [x] [AI-Review][MEDIUM] setAffiliateStatus missing authorization - FIXED
- [x] [AI-Review][MEDIUM] getAffiliateStats missing tenant validation - FIXED

The following issues remain OPEN (tests not implemented):

- [ ] [AI-Review][HIGH] Task 7: Write Tests - Tests need to be implemented

## Dev Notes

### Critical Architecture Patterns

**Multi-Tenant Data Isolation Strategy:**

This project uses **row-level security enforced at the application layer** via Convex functions. Every tenant-scoped table has a `tenantId` field, and all queries/mutations must filter by this field.

**File Structure:**
```
convex/
├── tenantContext.ts     # Tenant isolation helpers & wrappers
├── audit.ts           # Security audit logging
├── users.ts           # Updated: Use tenant-scoped queries
├── auth.ts            # Existing: Auth integration
└── schema.ts         # Existing: Schema with tenantId fields
```

### Previous Story Intelligence

**From Story 1.1 (Convex Schema Foundation):**
- Schema defines `tenantId: v.id("tenants")` on all tenant-scoped tables
- Index `by_tenant` exists on all tenant-scoped tables

**From Story 1.3 (SaaS Owner Authentication):**
- `getCurrentUser` query exists in `convex/auth.ts`
- User record has `tenantId` field linking to tenant
- Use `betterAuthComponent.getAuthUser(ctx)` to get user, then extract tenantId

### Implementation Pattern

```typescript
// convex/tenantContext.ts
export async function getTenantId(ctx): Promise<Id<"tenants"> | null> {
  const user = await getAuthenticatedUser(ctx);
  return user?.tenantId ?? null;
}

export async function requireTenantId(ctx): Promise<Id<"tenants">> {
  const tenantId = await getTenantId(ctx);
  if (!tenantId) {
    throw new Error("Unauthorized: Authentication required");
  }
  return tenantId;
}
```

### Anti-Patterns to Avoid

❌ DO NOT forget to filter by tenantId in queries — security vulnerability  
❌ DO NOT use `.filter()` instead of `.withIndex()` — performance issue  
❌ DO NOT expose tenant IDs in error messages — information leakage  
❌ DO NOT skip ownership validation in mutations — data corruption risk  

## Dev Agent Record

### Agent Model Used
Claude (GLM-5)

### Debug Log References
- Code review found syntax error in tenantContext.ts (fixed)
- Removed unused import in tenantContext.ts (fixed)

### Completion Notes List
- Task 1: Created `convex/tenantContext.ts` with tenant context helpers
- Task 2: Created `tenantQuery` and `tenantMutation` wrappers
- Task 3: Created `tenantMutation` wrappers with validation
- Task 4: Created `convex/audit.ts` with security event logging
- Task 5: Created `validateTenantOwnership` helper
- Task 6: Updated `convex/users.ts` with tenant-scoped functions

### File List
- `convex/tenantContext.ts` — Tenant isolation helpers, wrappers, and validators (NEW)
- `convex/audit.ts` — Security audit logging (NEW)
- `convex/users.ts` — Updated with tenant-scoped queries (UPDATED)
- `convex/affiliates.ts` — Updated with tenant-scoped authorization (UPDATED)
- `convex/schema.ts` — Updated auditLogs schema (UPDATED)

### Change Log
- 2026-03-13: Implemented multi-tenant data isolation system
- 2026-03-13: Fixed syntax error in tenantContext.ts (extra closing brace)
- 2026-03-13: Removed unused import in tenantContext.ts
- 2026-03-13: Code review - Added tenant authorization to all affiliate functions
- 2026-03-13: Code review - Fixed getAffiliate, updateAffiliateStatus, updateAffiliateProfile, updateAffiliatePassword, setAffiliatePassword, setAffiliateStatus, getAffiliateStats
