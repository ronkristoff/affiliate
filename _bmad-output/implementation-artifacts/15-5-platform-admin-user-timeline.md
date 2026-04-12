# Story 15.5: Platform Admin User Timeline Page

Status: ready-for-dev

## Story

As a Platform Admin,
I want a "User Timeline" page where I can search any user by email and see their complete activity history across all subsystems in one chronological view,
so that I can investigate any user issue (login failure, missing OTP, payout discrepancy) in under 2 minutes.

## Business Context

**This is the keystone feature of the Platform Admin Logging initiative.** It transforms the raw audit log data (Stories 15.1-15.4) into an actionable support investigation tool.

Today, when a tenant reports a user issue, the admin must:
1. Search for the user in the tenant management page
2. Check the per-tenant audit log tab
3. Manually cross-reference `loginAttempts` table (separate, no admin UI)
4. Manually cross-reference `emails` table (separate, no admin UI)
5. Try to reconstruct the user's journey across multiple pages

**The User Timeline consolidates all of this into a single page:** type an email, see everything.

### User Personas

- **Platform Admin ("msi")** — Needs to quickly debug tenant-reported issues. Values efficiency and completeness. Wants to search by email, see timeline, filter by category, and export if needed.

### Dependencies

- **Story 15.2** (auth events) — required so auth events appear in timeline
- **Story 15.4** (new indexes) — required for efficient `by_actor_time` queries

### Related Stories

- Story 15.1: Fix Audit Action Type Registry (action labels for timeline display)
- Story 15.2: Bridge Better Auth Events (auth events in timeline)
- Story 15.4: Audit Log Query Infrastructure (indexes for performance)
- Story 15.6: Login Attempts & Email Chain Integration (inline login/email data)

## Acceptance Criteria

### AC1: Cross-Tenant User Search by Email
**Given** a Platform Admin navigates to the User Timeline page
**When** they type an email address in the search box (min 3 characters)
**Then** matching users across ALL tenants are shown in a dropdown
**And** each result shows: user name, email, tenant name, role, affiliate code (if applicable), status
**And** search is debounced (300ms) to avoid excessive queries

### AC2: User Selection Loads Timeline
**Given** search results are displayed
**When** the admin clicks a user result
**Then** the full activity timeline for that user loads
**And** the search box updates to show the selected user's info (name, email, tenant)
**And** the URL updates to include the userId for deep-linking

### AC3: Timeline Displays All Audit Events Chronologically
**Given** a user is selected
**When** the timeline loads
**Then** ALL audit log entries for that user (across all entity types and actions) are displayed
**And** entries are ordered newest-first (reverse chronological)
**And** cursor-based pagination loads more entries on scroll ("Load more" button)

### AC4: Events Color-Coded by Severity
**Given** the timeline is displayed
**When** events render
**Then** each event has a color indicator based on category:
- 🔴 Red — failures, locks, bounces, rejections (`AUTH_SIGNIN_FAILURE`, `AUTH_ACCOUNT_LOCKED`, `email_bounced`, `COMMISSION_DECLINED`)
- 🟢 Green — successes, deliveries, approvals (`AUTH_SIGNIN_SUCCESS`, `COMMISSION_APPROVED`, `payout_marked_paid`)
- 🟡 Amber — warnings, attempts, pending (`AUTH_SIGNIN_FAILURE` attempts, `AUTH_OTP_SENT`, commission pending)
- 🔵 Blue — informational, system events (`AUTH_EMAIL_VERIFICATION_SENT`, `CAMPAIGN_CREATED`, `tenant_created`)
- 🟣 Purple — admin/security events (`impersonation_start`, `security_unauthorized_access_attempt`)

### AC5: Events Grouped by Date
**Given** the timeline has multiple events across different days
**When** rendered
**Then** events are visually grouped under date headers ("Today, Apr 12", "Yesterday, Apr 11", "Apr 10, 2026")
**And** date groups are collapsible

### AC6: Event Expand/Collapse
**Given** the timeline displays events
**When** an admin clicks an event
**Then** the event expands to show full metadata:
- For auth events: IP address, method, attempt count
- For commission events: amount, campaign, affiliate
- For payout events: batch ID, amount, payment reference
- For email events: provider, template, delivery status
- Previous/new values for update events
**And** clicking again collapses the detail

### AC7: Category Filter Tabs
**Given** the timeline is displayed
**When** category filter tabs are shown
**Then** the following tabs are available: All, 🔐 Auth, 📧 Email, 💰 Money (commissions + payouts), 👥 Affiliates, 🔒 Security
**And** each tab shows a count badge of events in that category
**And** selecting a tab filters the timeline to only events in that category
**And** "All" shows everything

### AC8: Date Range Filter
**Given** the timeline is displayed
**When** the date range filter is shown
**Then** quick-select options are: Last 24h, 7 days, 30 days, 90 days, All time
**And** selecting a range filters the timeline accordingly
**And** the filter state is URL-persisted (page refresh preserves filters)

### AC9: Navigation Integration
**Given** the Platform Admin sidebar
**When** the admin navigates to the admin section
**Then** a "User Timeline" nav item is visible
**And** clicking it navigates to `/user-timeline`

### AC10: Deep-Link Support
**Given** a URL like `/user-timeline?email=jamie@email.com`
**When** the page loads
**Then** the search is pre-populated with the email
**And** if exactly one user matches, the timeline auto-loads

### AC11: Loading and Empty States
**Given** the timeline is loading
**When** data is being fetched
**Then** a skeleton loading state is displayed
**And** when no events exist for a user, an empty state message is shown: "No activity recorded for this user"

### AC12: Backend Query — Cross-Tenant User Search
**Given** the Platform Admin User Timeline page
**When** the admin searches for an email
**Then** the `searchUsersAcrossTenants` admin query is called
**And** it searches the `users` table `by_email` index across all tenants
**And** returns matching users with enriched data (tenant name, role, affiliate info)

### AC13: Backend Query — User Timeline
**Given** a user is selected
**When** the timeline loads
**Then** the `getUserTimeline` admin query is called
**And** it queries `auditLogs` using the `by_actor_time` index
**And** supports pagination via cursor and optional category/date filters

## Tasks / Subtasks

- [ ] Task 1 (AC: #12): Create cross-tenant user search query
  - [ ] Subtask 1.1: Add `searchUsersAcrossTenants` admin query in `convex/admin/audit.ts`
  - [ ] Subtask 1.2: Args: `{ email: v.string() }`
  - [ ] Subtask 1.3: Use `users` table `by_email` index, scan across tenants (take limit: 20)
  - [ ] Subtask 1.4: Enrich results with tenant name from `tenants` table
  - [ ] Subtask 1.5: Include affiliate info (code, status) if user has an affiliate record

- [ ] Task 2 (AC: #13): Create user timeline query
  - [ ] Subtask 2.1: Add `getUserTimeline` admin query in `convex/admin/audit.ts`
  - [ ] Subtask 2.2: Args: `{ actorId: v.string(), paginationOpts, category?: v.string(), startDate?: v.number(), endDate?: v.number() }`
  - [ ] Subtask 2.3: Use `by_actor_time` index for efficient chronological queries
  - [ ] Subtask 2.4: Apply category filter by mapping category string to action types (e.g., "auth" → all `AUTH_*` actions)
  - [ ] Subtask 2.5: Apply date range filter using `.gt()` / `.lt()` on `_creationTime`
  - [ ] Subtask 2.6: Return paginated results

- [ ] Task 3 (AC: #1, #2, #9, #10, #11): Create User Timeline page skeleton
  - [ ] Subtask 3.1: Create `src/app/(admin)/user-timeline/page.tsx` — Server Component wrapper with Suspense
  - [ ] Subtask 3.2: Create `src/app/(admin)/user-timeline/UserTimelineClient.tsx` — main client component with search + timeline
  - [ ] Subtask 3.3: Add "User Timeline" nav item to `src/app/(admin)/_components/AdminSidebar.tsx`
  - [ ] Subtask 3.4: Implement URL state management with `nuqs` for search params (email, userId, category, dateRange)
  - [ ] Subtask 3.5: Implement debounced search (300ms) with dropdown results
  - [ ] Subtask 3.6: Implement skeleton loading state
  - [ ] Subtask 3.7: Implement empty state

- [ ] Task 4 (AC: #3, #5, #6): Build timeline display components
  - [ ] Subtask 4.1: Create `TimelineEvent.tsx` component — individual event row with icon, timestamp, label, expand/collapse
  - [ ] Subtask 4.2: Create `TimelineDateGroup.tsx` component — date header with collapsible events
  - [ ] Subtask 4.3: Implement expand/collapse for event metadata display
  - [ ] Subtask 4.4: Implement cursor-based pagination ("Load more" button)
  - [ ] Subtask 4.5: Format timestamps using `date-fns` (relative for today/yesterday, absolute for older)

- [ ] Task 5 (AC: #4, #7, #8): Implement filters
  - [ ] Subtask 5.1: Create category filter tabs (All, Auth, Email, Money, Affiliates, Security)
  - [ ] Subtask 5.2: Create date range quick-select buttons (Last 24h, 7d, 30d, 90d, All)
  - [ ] Subtask 5.3: Map categories to action types:
    - Auth: `AUTH_*`, `LOGIN_*`, `ACCOUNT_LOCKED`
    - Email: `email_*`, `EMAIL_*`
    - Money: `COMMISSION_*`, `commission_*`, `payout_*`, `batch_*`
    - Affiliates: `affiliate_*`, `AFFILIATE_*`
    - Security: `security_*`, `impersonation_*`, `FRAUD_*`, `permission_denied`
  - [ ] Subtask 5.4: Add count badges to category tabs
  - [ ] Subtask 5.5: Persist filter state in URL

## Dev Notes

### File Structure

```
NEW FILES:
├── src/app/(admin)/user-timeline/page.tsx              # Server Component wrapper
├── src/app/(admin)/user-timeline/UserTimelineClient.tsx  # Main client component
├── src/app/(admin)/user-timeline/TimelineEvent.tsx        # Event row component
├── src/app/(admin)/user-timeline/TimelineDateGroup.tsx    # Date group component
├── src/app/(admin)/user-timeline/UserSearchResults.tsx    # Search dropdown component

MODIFIED FILES:
├── convex/admin/audit.ts                                 # Add searchUsersAcrossTenants, getUserTimeline queries
├── src/app/(admin)/_components/AdminSidebar.tsx           # Add nav item
├── src/lib/audit-constants.ts                            # Add category groupings, action-to-category mapping
```

### Category-to-Action Mapping

```typescript
export const AUDIT_ACTION_CATEGORIES: Record<string, string[]> = {
  auth: [
    "AUTH_SIGNUP_COMPLETED", "AUTH_SIGNIN_SUCCESS", "AUTH_SIGNIN_FAILURE",
    "AUTH_ACCOUNT_LOCKED", "AUTH_PASSWORD_RESET_REQUESTED", "AUTH_PASSWORD_RESET_COMPLETED",
    "AUTH_PASSWORD_CHANGED", "AUTH_PASSWORD_REUSE_BLOCKED", "AUTH_EMAIL_VERIFICATION_SENT",
    "AUTH_OTP_SENT", "AUTH_MAGIC_LINK_SENT", "AUTH_2FA_ENABLED", "AUTH_2FA_OTP_SENT",
    "AUTH_2FA_OTP_VERIFIED", "AUTH_ACCOUNT_DELETED", "AUTH_SESSION_REVOKED",
    "LOGIN_ATTEMPT_FAILED", "ACCOUNT_LOCKED", "LOGIN_SUCCESS",
  ],
  email: [
    "email_bounced", "email_complained", "email_send_failed",
    "email_scheduling_failed", "fraud_alert_email_failed",
    "EMAIL_TEMPLATE_SAVED", "EMAIL_TEMPLATE_DELETED",
  ],
  money: [
    "COMMISSION_CREATED", "COMMISSION_APPROVED", "COMMISSION_DECLINED",
    "COMMISSION_REVERSED", "COMMISSION_STATUS_CHANGE",
    "payout_batch_generated", "payout_marked_paid", "batch_marked_paid",
    "payout_processing", "payout_failed", "payout_paid_saligpay",
  ],
  affiliates: [
    "affiliate_approved", "affiliate_rejected", "affiliate_suspended",
    "affiliate_reactivated", "affiliate_registered", "affiliate_bulk_approved",
    "affiliate_bulk_rejected", "affiliate_invited", "affiliate_status_updated",
    "affiliate_profile_updated", "affiliate_password_updated",
    "AFFILIATE_PASSWORD_SET", "referral_link_auto_created",
  ],
  security: [
    "security_unauthorized_access_attempt", "impersonation_start",
    "impersonation_end", "impersonated_mutation", "impersonation_unauthorized",
    "FRAUD_SIGNAL_ADDED", "self_referral_detected", "fraud_signal_dismissed",
    "permission_denied", "CIRCUIT_BREAKER_STATE_CHANGE",
  ],
};
```

### Severity Color Mapping

```typescript
export const AUDIT_SEVERITY_COLORS: Record<string, "red" | "green" | "amber" | "blue" | "purple"> = {
  // Red — failures, locks, rejections
  AUTH_SIGNIN_FAILURE: "red", AUTH_ACCOUNT_LOCKED: "red",
  email_bounced: "red", COMMISSION_DECLINED: "red",
  payout_failed: "red", security_unauthorized_access_attempt: "red",
  AUTH_PASSWORD_REUSE_BLOCKED: "red",
  // Green — successes, deliveries, approvals
  AUTH_SIGNIN_SUCCESS: "green", AUTH_PASSWORD_RESET_COMPLETED: "green",
  COMMISSION_APPROVED: "green", payout_marked_paid: "green",
  batch_marked_paid: "green", AUTH_2FA_ENABLED: "green",
  // Amber — warnings, pending
  AUTH_OTP_SENT: "amber", AUTH_EMAIL_VERIFICATION_SENT: "amber",
  AUTH_MAGIC_LINK_SENT: "amber", AUTH_PASSWORD_RESET_REQUESTED: "amber",
  // Blue — informational, system
  CAMPAIGN_CREATED: "blue", tenant_created: "blue", user_created: "blue",
  CAMPAIGN_UPDATED: "blue", CAMPAIGN_ARCHIVED: "blue",
  // Purple — admin/security
  impersonation_start: "purple", impersonation_end: "purple",
  FRAUD_SIGNAL_ADDED: "purple",
};
```

### UI Design Reference

Follow Sally's design from the party mode discussion — "medical chart" style with search-first entry, system-grouped filters, color-coded severity, and inline detail expansion. Use the existing admin sidebar dark theme.

### Performance Considerations

- Use `by_actor_time` index (from Story 15.4) for chronological user queries
- Default page size: 20 events, load more in batches of 20
- Category filter is a client-side action type inclusion check (no new index needed — the `by_actor_time` query fetches and client filters)
- Date range filter uses `_creationTime` range on the `by_actor_time` index

### Anti-Patterns to Avoid

1. **Do NOT create a separate page for each entity type** — one unified timeline
2. **Do NOT fetch ALL audit logs and filter client-side** — use indexed queries with pagination
3. **Do NOT store category in the database** — category is derived from action type on the client
4. **Do NOT use `.collect()` on high-volume tables** — always paginate or `.take(N)`
5. **Do NOT make the search synchronous** — debounce and show loading state
6. **Do NOT skip the Suspense boundary** — wrap client component per Next.js 16 requirements

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

| File | Changes |
|------|---------|
