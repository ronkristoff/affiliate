# Story 15.7: Audit Log Housekeeping

Status: ready-for-dev

## Story

As a Platform Engineer,
I want old audit log entries to be automatically purged and dead code to be cleaned up,
so that the auditLogs table doesn't grow indefinitely and the codebase stays maintainable.

## Business Context

The `auditLogs` table currently has **no retention policy**. Every audit event is stored indefinitely. At scale (thousands of tenants, millions of events), this creates:

1. **Storage cost growth** — unbounded table size
2. **Query performance degradation** — larger indexes, slower scans
3. **Compliance risk** — GDPR requires data retention limits

Other tables in the system have cleanup crons (`loginAttempts` cleaned hourly, `notifications` cleaned after 30 days, `queryExports` cleaned after 24 hours). The `auditLogs` table needs a similar retention policy.

Additionally, the codebase has accumulated dead code and inconsistencies:
- **Dead `SecurityEventType` values** — 5 types defined but never called
- **Duplicate `_logAuditEventInternal`** — exists in both `convex/tenants.ts` and `convex/audit.ts`

### Dependencies

- None (standalone)

### Related Stories

- All Epic 15 stories (cleanup after the main logging work is done)

## Acceptance Criteria

### AC1: Audit Log Retention Cron
**Given** the system has audit log entries older than the retention period
**When** the retention cron job runs
**Then** entries older than 12 months are deleted
**And** the retention period is configurable via a constant (default: 12 months)

### AC2: Tenant-Scoped Deletion
**Given** the retention cron runs
**When** deleting old entries
**Then** deletion is batched by tenant (process one tenant at a time)
**And** each batch deletes at most 500 entries per cron execution (to avoid timeouts)
**And** the cron tracks which tenant was last processed and continues from there

### AC3: Dead SecurityEventType Values Cleaned
**Given** the `SecurityEventType` union in `convex/audit.ts`
**When** the cleanup is complete
**Then** dead types are removed: `cross_tenant_query`, `cross_tenant_mutation`, `authentication_failure`, `session_expired`, `invalid_token`
**And** remaining types still used: `unauthorized_access_attempt`
**And** any new auth-related types from Story 15.2 are properly categorized

### AC4: Duplicate Audit Function Eliminated
**Given** `convex/tenants.ts` has its own `_logAuditEventInternal` (line 1447)
**When** the cleanup is complete
**Then** `convex/tenants.ts` delegates to `convex/audit.ts` `logAuditEventInternal`
**And** no duplicate audit logging logic exists

## Tasks / Subtasks

- [ ] Task 1 (AC: #1, #2): Create audit log retention cron
  - [ ] Subtask 1.1: Add `purgeOldAuditLogs` internalMutation in `convex/audit.ts`
  - [ ] Subtask 1.2: Args: `{ tenantId: v.id("tenants"), cutoffTime: v.number(), batchSize: v.number() }`
  - [ ] Subtask 1.3: Query `auditLogs` by `by_tenant` index, filter for `_creationTime < cutoffTime`
  - [ ] Subtask 1.4: Delete up to `batchSize` entries (500 max) and return count deleted + whether more remain
  - [ ] Subtask 1.5: Add `retentionPolicyConfig` constant: `AUDIT_LOG_RETENTION_MONTHS = 12`

- [ ] Task 2 (AC: #2): Wire cron schedule
  - [ ] Subtask 2.1: Add cron job in `convex/crons.ts` — run daily (e.g., 3:00 AM UTC)
  - [ ] Subtask 2.2: Cron discovers tenants needing cleanup and processes one tenant per execution
  - [ ] Subtask 2.3: Use `crons.daily("audit-log-retention", { hour: 3 }, internal.audit.purgeOldAuditLogs, ...)` or equivalent
  - [ ] Subtask 2.4: Log purge counts for monitoring

- [ ] Task 3 (AC: #3): Clean dead SecurityEventType values
  - [ ] Subtask 3.1: In `convex/audit.ts`, remove dead types from `SecurityEventType` union
  - [ ] Subtask 3.2: Update type to only include `unauthorized_access_attempt` (and any auth types from Story 15.2 if applicable)
  - [ ] Subtask 3.3: Verify no callers reference removed types
  - [ ] Subtask 3.4: Update `AUDIT_ACTION_LABELS` in `src/lib/audit-constants.ts` to remove dead labels (`security_cross_tenant_query`, `security_cross_tenant_mutation`, `security_authentication_failure`)

- [ ] Task 4 (AC: #4): Refactor duplicate audit function
  - [ ] Subtask 4.1: In `convex/tenants.ts`, replace `_logAuditEventInternal` calls with `ctx.runMutation(internal.audit.logAuditEventInternal, ...)`
  - [ ] Subtask 4.2: Remove the duplicate `_logAuditEventInternal` function from `convex/tenants.ts`
  - [ ] Subtask 4.3: Verify all callers in `tenants.ts` still work with the centralized function

## Dev Notes

### Retention Cron Design

**Why tenant-scoped?** Deleting all old audit logs in a single cron execution could timeout if millions of entries exist. By processing one tenant at a time, each execution stays well within Convex's function limits (10 minutes for mutations, 5 minutes for queries).

**Cron flow:**
```
Daily at 3:00 AM UTC:
1. Get list of all tenants (or use a cursor to track position)
2. Pick next tenant in rotation
3. Calculate cutoff: Date.now() - (12 * 30 * 24 * 60 * 60 * 1000) // 12 months
4. Query auditLogs by_tenant, filter _creationTime < cutoff, take(500)
5. Delete each entry
6. If more entries remain for this tenant, re-schedule immediately for same tenant
7. If done, move to next tenant
```

**Alternative:** Use Convex's `_scheduledFunctions` system table to track cleanup state, or use a simple `platformSettings` flag.

### Files to Modify

| File | Changes |
|------|---------|
| `convex/audit.ts` | Add `purgeOldAuditLogs` internalMutation, clean dead SecurityEventType values |
| `convex/crons.ts` | Add daily retention cron job |
| `convex/tenants.ts` | Replace duplicate `_logAuditEventInternal` with centralized call |
| `src/lib/audit-constants.ts` | Remove dead security action labels |

### Anti-Patterns to Avoid

1. **Do NOT delete ALL old entries in one execution** — always batch
2. **Do NOT use unbounded `.collect()`** — always `.take(N)`
3. **Do NOT make retention period user-configurable yet** — constant is sufficient for now
4. **Do NOT delete entries that are referenced by active investigations** — no way to track this yet, so keep retention period generous (12 months)
5. **Do NOT change the retention period without updating compliance documentation**

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

| File | Changes |
|------|---------|
