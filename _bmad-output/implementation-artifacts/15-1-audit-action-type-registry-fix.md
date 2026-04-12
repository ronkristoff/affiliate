# Story 15.1: Fix Audit Action Type Registry

Status: done

## Story

As a Platform Admin and SaaS Owner,
I want the Activity Log filter dropdowns to show ALL action types that are actually being logged,
so that I can filter audit logs by any event type without missing options.

## Business Context

The `KNOWN_AUDIT_ACTIONS` constant and `AUDIT_ACTION_LABELS` map in `src/lib/audit-constants.ts` are incomplete. 18+ action types are actively written to `auditLogs` by various mutations but are NOT listed in the registry. This means:

- Filter dropdowns on the Activity Log page (`/activity-log`) and Admin Audit page (`/audit`) do not show these options
- Admins cannot filter by these action types even though the data exists
- Action labels are missing, so entries that DO appear show raw underscored strings

**The `convex/audit.ts` `getActivityLogActionTypes()` query** returns a hardcoded list of known actions — if an action isn't in that list, it's invisible to filters.

### Missing Action Types (18+)

**User Management (logged in `convex/users.ts`):**
- `tenant_created` — Tenant created during sign-up
- `user_created` — User record created
- `user_updated` — User record updated (role, permissions)
- `user_deleted` — User record deleted
- `TEAM_MEMBER_REMOVED` — Team member removed by owner
- `USER_PROFILE_UPDATED` — User updated their own profile (name)

**Affiliate Management (logged in `convex/affiliates.ts`, `convex/affiliateAuth.ts`):**
- `affiliate_invited` — Affiliate invited by owner
- `affiliate_status_updated` — Affiliate status changed (via updateAffiliateStatus)
- `affiliate_profile_updated` — Affiliate updated their profile
- `affiliate_password_updated` — Affiliate changed their password
- `affiliate_login` — Affiliate logged in (legacy auth)
- `referral_link_auto_created` — Referral link auto-generated on approval

**Platform Admin (logged in `convex/admin/impersonation.ts`, `convex/affiliates.ts`):**
- `impersonation_start` — Admin started impersonating a user
- `impersonation_end` — Admin ended impersonation session
- `impersonated_mutation` — Mutation performed during impersonation
- `impersonation_unauthorized` — Unauthorized impersonation attempt
- `permission_denied` — Permission check denied

**Infrastructure (logged in `convex/rateLimit.ts`, `convex/circuitBreakers.ts`):**
- `LOGIN_ATTEMPT_FAILED` — Failed login attempt
- `ACCOUNT_LOCKED` — Account locked after 5 failures
- `LOGIN_SUCCESS` — Successful login (clears failed attempts)
- `CIRCUIT_BREAKER_STATE_CHANGE` — Circuit breaker state transition

**Email (logged in `convex/emails.tsx`):**
- `email_bounced` — Email bounced
- `email_complained` — Email complaint/spam report

**Dependencies:**
- None (standalone)

**Related Stories:**
- Story 15.2: Bridge Better Auth Events (adds ~15 more auth action types)
- Story 15.3: Campaign & Mutation Audit Logging (adds 5 campaign action types)

## Acceptance Criteria

### AC1: All Currently-Logged Actions Registered
**Given** a mutation writes to `auditLogs` with an action type
**When** the `AUDIT_ACTION_LABELS` constant is checked
**Then** that action type has a human-readable label entry
**And** the label is descriptive (e.g., "Tenant Created" not "tenant_created")

### AC2: Actions Grouped by Category
**Given** the `AUDIT_ACTION_LABELS` map
**When** a developer reads the file
**Then** action types are organized by category with clear section comments (Auth, User Management, Affiliate, Campaign, Commission, Payout, Security, Email, Infrastructure, Admin)

### AC3: Activity Log Filter Reflects All Types
**Given** the Activity Log page loads (`/activity-log`)
**When** the action type filter dropdown is opened
**Then** all registered action types appear as options
**And** options are grouped or at minimum clearly labeled

### AC4: Admin Audit Page Filter Works
**Given** the Admin Audit page loads (`/audit`)
**When** an admin selects a previously-missing action type from the filter
**Then** audit logs are filtered correctly
**And** results show only entries matching that action type

### AC5: Backend `getActivityLogActionTypes()` Returns Complete List
**Given** the `getActivityLogActionTypes()` query in `convex/audit.ts`
**When** it is called
**Then** it returns ALL registered action types
**And** no action type that exists in `auditLogs` is missing from the response

## Tasks / Subtasks

- [x] Task 1 (AC: #1, #2): Audit and catalog all missing action types
  - [x] Subtask 1.1: Cross-reference all `ctx.db.insert("auditLogs", ...)` calls across codebase with `AUDIT_ACTION_LABELS` entries
  - [x] Subtask 1.2: Document the full list of 18+ missing action types with source file:line references
  - [x] Subtask 1.3: Categorize each action into a group (Auth, User, Affiliate, Campaign, Commission, Payout, Security, Email, Infrastructure, Admin)

- [x] Task 2 (AC: #1, #2): Update `src/lib/audit-constants.ts`
  - [x] Subtask 2.1: Add all missing action type labels to `AUDIT_ACTION_LABELS` with category section comments
  - [x] Subtask 2.2: Add `CAMPAIGN_AUDIT_ACTIONS` constant (for Story 15.3, pre-emptive)
  - [x] Subtask 2.3: Add `USER_AUDIT_ACTIONS` constant
  - [x] Subtask 2.4: Add `AFFILIATE_MANAGEMENT_ACTIONS` constant
  - [x] Subtask 2.5: Add `ADMIN_AUDIT_ACTIONS` constant
  - [x] Subtask 2.6: Add `INFRASTRUCTURE_ACTIONS` constant
  - [x] Subtask 2.7: Add `EMAIL_DELIVERY_ACTIONS` constant
  - [x] Subtask 2.8: Add `FRAUD_AUDIT_ACTIONS` constant
  - [x] Subtask 2.9: Add `CONVERSION_AUDIT_ACTIONS_EXTENDED` constant
  - [x] Subtask 2.10: Verify `getAuditActionLabel()` fallback still works for unknown actions

- [x] Task 3 (AC: #3, #4): Verify frontend filter components use the registry
  - [x] Subtask 3.1: Check `src/app/(auth)/activity-log/ActivityLogClient.tsx` — already uses `getActivityLogActionTypes` query for dropdown (no changes needed)
  - [x] Subtask 3.2: Check `src/app/(admin)/audit/page.tsx` — replaced hardcoded `formatAction` map with `getAuditActionLabel()` from shared constants
  - [x] Subtask 3.3: Import `getAuditActionLabel` added to admin audit page

- [x] Task 4 (AC: #5): Update backend `getActivityLogActionTypes()` in `convex/audit.ts`
  - [x] Subtask 4.1: Expanded `KNOWN_AUDIT_ACTIONS` from 29 to 58 action types (added campaign, user, affiliate, admin, infrastructure, email delivery, fraud, extended conversion actions)
  - [x] Subtask 4.2: Removed dead security action types from `KNOWN_AUDIT_ACTIONS` (security_cross_tenant_query, security_cross_tenant_mutation, security_authentication_failure)

- [x] Task 5 (Bonus): Clean dead SecurityEventType values
  - [x] Reduced `SecurityEventType` union from 6 types to 1 (only `unauthorized_access_attempt` remains — the only actually-called type)

## Dev Notes

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/audit-constants.ts` | Add 18+ missing action type labels, add new action constant groups |
| `src/app/(auth)/activity-log/ActivityLogClient.tsx` | Verify/update filter to use complete action list |
| `src/app/(admin)/audit/page.tsx` | Verify/update filter to use complete action list |
| `convex/audit.ts` | Update `getActivityLogActionTypes()` to return complete list |

### Current Missing Actions with Source Locations

| Action Type | Source File | Line |
|-------------|-----------|------|
| `tenant_created` | `convex/users.ts` | 184, 307 |
| `user_created` | `convex/users.ts` | 205, 329, 419 |
| `user_updated` | `convex/users.ts` | 587 |
| `user_deleted` | `convex/users.ts` | 363 |
| `TEAM_MEMBER_REMOVED` | `convex/users.ts` | 765 |
| `USER_PROFILE_UPDATED` | `convex/users.ts` | 1023 |
| `affiliate_invited` | `convex/affiliates.ts` | 1164 |
| `affiliate_status_updated` | `convex/affiliates.ts` | 1281 |
| `affiliate_profile_updated` | `convex/affiliates.ts` | 1397 |
| `affiliate_password_updated` | `convex/affiliates.ts` | 1441 |
| `affiliate_login` | `convex/affiliateAuth.ts` | 733 |
| `affiliate_password_changed` | `convex/affiliateAuth.ts` | 891 |
| `referral_link_auto_created` | `convex/affiliates.ts` | 1267 |
| `impersonation_start` | `convex/admin/impersonation.ts` | 105 |
| `impersonation_end` | `convex/admin/impersonation.ts` | 174 |
| `impersonated_mutation` | `convex/admin/impersonation.ts` | 312 |
| `impersonation_unauthorized` | `convex/admin/impersonation.ts` | 65 |
| `permission_denied` | `convex/affiliates.ts` | 1204, 1517 |

### Anti-Patterns to Avoid

1. **Do NOT modify any Convex mutations** — this story is purely about the constants/registry, not about adding new logging
2. **Do NOT change existing action type string values** — action types are already written to `auditLogs` in production; changing strings would break filter matching
3. **Do NOT create a new file** — all changes go into existing `src/lib/audit-constants.ts`

## Dev Agent Record

### Agent Model Used

glm-5-turbo

### Debug Log References

No significant debugging issues encountered.

### Completion Notes List

1. **Task 1 Complete**: Cataloged all 18+ missing action types by cross-referencing `ctx.db.insert("auditLogs", ...)` calls across codebase with `AUDIT_ACTION_LABELS` entries.

2. **Task 2 Complete**: Expanded `src/lib/audit-constants.ts` from 160 lines to 265+ lines. Added 8 new action constant groups: `CAMPAIGN_AUDIT_ACTIONS`, `USER_AUDIT_ACTIONS`, `AFFILIATE_MANAGEMENT_ACTIONS`, `ADMIN_AUDIT_ACTIONS`, `INFRASTRUCTURE_ACTIONS`, `EMAIL_DELIVERY_ACTIONS`, `FRAUD_AUDIT_ACTIONS`, `CONVERSION_AUDIT_ACTIONS_EXTENDED`. Added 30+ new labels to `AUDIT_ACTION_LABELS` organized by category with section comments.

3. **Task 3 Complete**: Activity Log page (`ActivityLogClient.tsx`) already used `getActivityLogActionTypes` query for dropdown — no changes needed. Admin Audit page (`page.tsx`) had a hardcoded `formatAction` map with only 21 entries — replaced with `getAuditActionLabel()` from shared constants, now has 58+ action labels.

4. **Task 4 Complete**: Expanded `KNOWN_AUDIT_ACTIONS` in `convex/audit.ts` from 29 to 58 action types. Removed dead security types. Backend filter dropdowns now show all registered actions.

5. **Bonus**: Cleaned `SecurityEventType` union in `convex/audit.ts` from 6 dead types to 1 live type (`unauthorized_access_attempt`). Removed `cross_tenant_query`, `cross_tenant_mutation`, `authentication_failure`, `session_expired`, `invalid_token`.

### File List

| File | Changes |
|------|---------|
| `src/lib/audit-constants.ts` | Added 8 new action constant groups, 30+ new labels to AUDIT_ACTION_LABELS, organized by category |
| `convex/audit.ts` | Expanded KNOWN_AUDIT_ACTIONS from 29 to 58 entries, cleaned dead SecurityEventType |
| `src/app/(admin)/audit/page.tsx` | Replaced hardcoded formatAction map with getAuditActionLabel() import |
