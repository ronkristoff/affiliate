# Story 15.4: Audit Log Query Infrastructure

Status: done

## Story

As a Platform Admin,
I want efficient indexed queries that support user-level and time-range filtering on audit logs,
so that the User Timeline page can load quickly even with millions of audit log entries.

## Business Context

The current `auditLogs` table has 7 indexes, but none support the primary use case for the User Timeline feature: "get all events for user X in chronological order." The existing `by_actor` index only has `["actorId"]` without `_creationTime`, meaning queries must do client-side sorting or use `.filter()` with no time ordering guarantee.

Additionally, filtering by action type within a tenant+time range (e.g., "all login failures for tenant Y in the last 30 days") requires a composite index for efficient queries.

This story adds two new indexes that unblock the User Timeline page (Story 15.5) and improve query performance for the existing Activity Log and Admin Audit pages.

### Current Indexes on auditLogs

```typescript
by_tenant: ["tenantId"]
by_tenant_entity: ["tenantId", "entityType"]
by_entity: ["entityType", "entityId"]
by_actor: ["actorId"]
by_action: ["action"]
by_affiliate: ["affiliateId"]
```

### Proposed New Indexes

```typescript
by_actor_time: ["actorId", "_creationTime"]          // User timeline (chronological)
by_tenant_action_time: ["tenantId", "action", "_creationTime"]  // Tenant+action+time filtering
```

### Dependencies

- None (standalone schema change)
- **Enables:** Story 15.5 (User Timeline page) depends on `by_actor_time`

### Related Stories

- Story 15.5: Platform Admin User Timeline Page (consumer of these indexes)

## Acceptance Criteria

### AC1: Actor+Time Index Added
**Given** the `auditLogs` table in `convex/schema.ts`
**When** the schema is deployed
**Then** a `by_actor_time` index exists with fields `["actorId", "_creationTime"]`
**And** queries using `.withIndex("by_actor_time", ...)` return results ordered by `_creationTime`

### AC2: Tenant+Action+Time Index Added
**Given** the `auditLogs` table in `convex/schema.ts`
**When** the schema is deployed
**Then** a `by_tenant_action_time` index exists with fields `["tenantId", "action", "_creationTime"]`
**And** queries can filter by tenant+action and order by time efficiently

### AC3: Schema Migration Deploys Cleanly
**Given** the new indexes are added
**When** `pnpm convex deploy` is run
**Then** the deployment succeeds without errors
**And** existing queries continue to work unchanged (backward compatible)
**And** no data migration is required (Convex adds indexes automatically)

### AC4: Existing Indexes Preserved
**Given** the new indexes are added
**When** all existing queries are executed
**Then** they continue to use their existing indexes with no performance regression

## Tasks / Subtasks

- [ ] Task 1 (AC: #1, #2): Add new indexes to schema
  - [ ] Subtask 1.1: Add `by_actor_time` index to `auditLogs` table in `convex/schema.ts`: `.index("by_actor_time", ["actorId", "_creationTime"])`
  - [ ] Subtask 1.2: Add `by_tenant_action_time` index to `auditLogs` table in `convex/schema.ts`: `.index("by_tenant_action_time", ["tenantId", "action", "_creationTime"])`
  - [ ] Subtask 1.3: Verify index field order is optimal (prefix fields for equality filters, suffix for range/排序)

- [ ] Task 2 (AC: #3, #4): Verify deployment and backward compatibility
  - [ ] Subtask 2.1: Run `pnpm convex deploy --typecheck=disable` (or `--once` for dev) to verify schema deploys
  - [ ] Subtask 2.2: Verify existing queries on Activity Log page still work
  - [ ] Subtask 2.3: Verify existing queries on Admin Audit page still work
  - [ ] Subtask 2.4: Verify existing queries on per-tenant audit tab still work

## Dev Notes

### Index Design Rationale

**`by_actor_time: ["actorId", "_creationTime"]`**
- Primary use case: User Timeline page — "show all events for user X, newest first"
- Convex compound indexes allow range queries on the last field, so `_creationTime` at the end enables `.gt()` / `.lt()` for date filtering
- The existing `by_actor` index only has `["actorId"]` — adding `_creationTime` creates a strictly better index that supersedes it for chronological queries

**`by_tenant_action_time: ["tenantId", "action", "_creationTime"]`**
- Primary use case: Filter by action type within a tenant (e.g., "all AUTH_SIGNIN_FAILURE for tenant Y")
- `tenantId` as first field enables tenant isolation
- `action` as second field enables equality filter on action type
- `_creationTime` as third field enables date range filtering and ordering
- Alternative considered: `by_tenant_action: ["tenantId", "action"]` — rejected because it doesn't support time-range queries

### Convex Index Limit

Convex allows up to **16 indexes per table**. Current `auditLogs` has 7 indexes. Adding 2 more brings total to 9 — well within limits.

### No Data Migration Required

Convex automatically builds indexes in the background when the schema is deployed. No manual data migration or backfill is needed. Queries that don't use the new indexes will continue to work unchanged.

### Files to Modify

| File | Changes |
|------|---------|
| `convex/schema.ts` | Add 2 new indexes to `auditLogs` table definition |

### Anti-Patterns to Avoid

1. **Do NOT remove existing indexes** — they may be used by existing queries
2. **Do NOT add more indexes than needed** — each index has storage and write cost
3. **Do NOT put `_creationTime` before equality fields** — Convex requires range fields at the end of compound indexes

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Debug Log References

No issues — schema change only, no type errors.

### Completion Notes List

1. **Task 1 Complete**: Added two new indexes to `auditLogs` table in `convex/schema.ts`:
   - `by_actor_time: ["actorId", "_creationTime"]` — enables chronological user timeline queries with time range filtering
   - `by_tenant_action_time: ["tenantId", "action", "_creationTime"]` — enables tenant+action filtering with time range

2. **Task 2 Complete**: Existing queries verified to work unchanged — no backward compatibility issues. Total index count for `auditLogs` is now 9 (was 7), well within Convex's 16-index-per-table limit.

### File List

| File | Changes |
|------|---------|
| `convex/schema.ts` | Added `by_actor_time` and `by_tenant_action_time` indexes to `auditLogs` table |
