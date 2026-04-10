---
title: "Billing Lifecycle Enforcement, Admin Visibility & Platform Notification System"
slug: "billing-lifecycle-enforcement-notifications"
created: "2026-04-10"
status: "completed"
stepsCompleted: [1, 2, 3, 4, 5, 6]
tech_stack: ["Next.js 16.1", "Convex 1.32", "TypeScript 5.9", "Tailwind CSS v4.1", "React 19.2", "React Email (@react-email/components)", "Radix UI", "Lucide Icons", "Sonner (toast)"]
files_to_modify: ["convex/schema.ts", "convex/crons.ts", "convex/tenantContext.ts", "convex/subscriptions.ts", "convex/admin/subscriptions.ts", "convex/admin/tenants.ts", "convex/campaigns.ts", "convex/tenants.ts", "convex/affiliates.ts", "convex/commissionEngine.ts", "convex/payouts.ts", "convex/teamInvitations.ts", "convex/email.tsx", "convex/emails/(new billing emails)", "convex/billingLifecycle.ts", "convex/notifications.ts", "src/app/(admin)/tenants/_components/TenantTable.tsx", "src/app/(admin)/tenants/_components/FilterPills.tsx", "src/app/(admin)/tenants/_components/StatsRow.tsx", "src/app/(admin)/tenants/_components/SubscriptionStatusBadge.tsx", "src/app/(admin)/tenants/[tenantId]/_components/SubscriptionSummaryCard.tsx", "src/app/(admin)/tenants/[tenantId]/_components/AdminSubscriptionActions.tsx", "src/app/(admin)/tenants/page.tsx", "src/components/notifications/NotificationBell.tsx", "src/components/notifications/NotificationPanel.tsx", "src/components/notifications/NotificationItem.tsx", "src/components/notifications/NotificationProvider.tsx", "src/components/notifications/useNotifications.ts", "src/components/notifications/useNotificationCount.ts", "src/app/(auth)/notifications/page.tsx", "src/app/layout.tsx", "src/app/(admin)/layout.tsx", "src/app/(auth)/layout.tsx"]
code_patterns: ["Convex new function syntax (query/mutation/action with args+returns validators)", "Cron jobs via cronJobs() + crons.interval() targeting internal functions", "Internal functions via internalMutation/internalQuery/internalAction", "Email via sendEmailFromMutation (mutation ctx) with React Email templates", "Audit logging via auditLogs table insert with action/entityType/actorId pattern", "Billing history via billingHistory table insert with event/timestamp/actorId pattern", "Admin auth via requireAdmin(ctx) helper", "Write access gating via requireWriteAccess(ctx) in tenantMutation wrapper", "Denormalized counters in tenantStats with update hooks on status changes", "No unbounded .collect() — use .take(N) or .paginate()", "Tenant status uses two fields: tenant.status (active/trial/suspended) vs tenant.subscriptionStatus (trial/active/cancelled/past_due)", "Admin filter pills map to tenant.status via by_status index", "Platform stats count by tenant.status, not subscriptionStatus", "Realtime via Convex useQuery — notification bell uses live query for unread count", "Radix UI Popover/DropdownMenu for notification panel", "Sonner for toast notifications"]
test_patterns: ["Vitest configured (placeholder tests only, no production tests)", "Test files use .test.ts suffix", "Convex CLI requires --typecheck=disable due to pre-existing TS errors"]
---

# Tech-Spec: Billing Lifecycle Enforcement, Admin Visibility & Platform Notification System

**Created:** 2026-04-10

## Overview

### Problem Statement

The platform admin has no visibility into tenants whose billing cycles have expired or trials have ended. There is no time-driven state machine to enforce subscription status transitions when temporal conditions are met. Tenants remain `"active"` indefinitely even when `billingEndDate` has passed (last payment was months ago). No cron exists to auto-transition statuses, send notifications, or enforce cancellation after grace periods.

### Solution

Implement a daily billing lifecycle cron that automatically transitions tenant `subscriptionStatus` based on billing dates — marking overdue tenants as `"past_due"` and expired trials as `"cancelled"`. All cancelled/past-due tenants get **read-only portal access** with **all campaigns paused** — no auto-deletion. Data is preserved indefinitely unless an admin manually deletes. Surface billing-urgent tenants prominently in the admin tenant list with computed flags and filter pills. Provide platform admin with full edit/override capability. Send email + in-app notifications on every status transition.

### State Flow (FINAL)

```
active ──(billingEndDate passes)──→ past_due ──(7d grace expires)──→ cancelled
trial ──(trialEndsAt passes)──→ cancelled (same day, no grace period)
```

**Recovery paths:**
- `past_due` → `active`: Payment received (webhook) or admin extends billing
- `cancelled` → `active`: Admin reactivates or owner converts trial to paid

**All cancelled/read-only tenants:**
- Portal read-only (all write mutations blocked via `checkWriteAccess`)
- All campaigns paused (no new conversions/commissions)
- Data preserved indefinitely
- Auto-deletion is completely removed — deletion is admin-only manual action

### Scope

**In Scope — Part A: Platform Notification System (NEW)**

A full-featured in-app notification system applied across the entire platform:

1. **`notifications` table** in schema with fields: `tenantId`, `userId` (required — always per-user), `type` (category.type key, e.g. `"billing.past_due"`), `title`, `message`, `severity` (info/warning/success/critical), `actionUrl` (optional deep link), `actionLabel` (optional CTA text), `isRead`, `readAt`, `expiresAt` (90 days from creation), `metadata` (optional structured data), `aggregatedCount` (number, default 1 — for aggregated notifications), `aggregationDate` (optional — groups same-type notifications by day)
2. **Notification service layer** (`convex/notifications.ts`) — internal mutation `createNotification` that inserts notification record + optionally sends email in a single call. Synchronous delivery (same transaction as business logic). In-app write is primary (must succeed), email is best-effort (try/catch, never throws). Centralizes all notification creation so every feature uses the same path.
3. **Notification queries**: `getNotifications` (paginated, filterable by type/read status), `getUnreadNotificationCount` (O(1) via denormalized `notificationUnreadCount` on `users` table), `markNotificationRead` (atomic: patches notification + decrements unread count in same transaction), `markAllNotificationsRead`, `deleteNotification`, `clearExpiredNotifications` (cron)
4. **Notification UI components**:
    - `NotificationBell` — bell icon with unread count badge (badge only shows `critical + warning` count — NOT total). 4-level severity colors: info=gray, success=green, warning=amber, critical=red with pulse animation. Placed top-right of owner sidebar and admin sidebar.
    - `NotificationPanel` — Radix `Popover` dropdown showing 10 most recent notifications. **Severity-sorted**: critical/warning always at top regardless of time, info/success below sorted by time. Severity-based left border + icon colors. "Mark all as read" button (awaits mutation completion, shows loading state). "View all" link to full page.
    - `NotificationItem` — individual notification with severity icon, title, message, relative timestamp, action button (if actionUrl — click navigates + marks read), read/unread styling (unread = bold + subtle bg)
    - `NotificationProvider` — React context for realtime unread count subscription via Convex `useQuery`
    - `useNotifications` hook — convenience hook for components to access notification state
    - `useNotificationCount` hook — returns `{ total: number, critical: number, warning: number }`. Bell badge uses `critical + warning`.
5. **Full `/notifications` page** (`src/app/(auth)/notifications/page.tsx`) — complete notifications history with:
    - Filter tabs: All / Unread / by type (billing, affiliate, commission, payout, team, campaign)
    - Paginated infinite scroll list
    - Mark individual as read, mark all as read
    - Click notification → navigate to `actionUrl` (if present) and mark as read
    - Empty state for each filter
    - Responsive layout (mobile-friendly for affiliates)
6. **Notification aggregation rules** (prevent fatigue):
    - **Commission earned**: Aggregate by day per user — "You earned 12 commissions today (₱4,500 total)" instead of 12 individual notifications
    - **Affiliate signup**: Aggregate by day per tenant — "5 new affiliates signed up today" instead of 5
    - **Admin alerts**: Never aggregate — every single one is important
    - **Billing events**: Never aggregate — every status change is critical
    - **Payout events**: Never aggregate — each payout is distinct
    - **Team events**: Never aggregate — each team change is distinct
    - Implementation: check for existing same-type + same-day notification before creating; if exists, increment `aggregatedCount` and update message/title instead of inserting new row
7. **Notification retention**: Notifications auto-expire after 90 days (`expiresAt` = creation + 90 days). Cleanup cron runs **daily** (not weekly), deleting expired notifications in batches of 1000 per run via `.take(1000)` to avoid Convex function timeouts. All queries filter `expiresAt > now`.
8. **Apply notifications across ALL platform events** (28 event types across 7 categories):
    - **Affiliate**: new affiliate signup (aggregated), affiliate approved/rejected/suspended/reactivated
    - **Commission**: commission earned (aggregated), commission approved/declined/reversed
    - **Payout**: payout processed, payout failed
    - **Team**: team member invited, accepted, removed
    - **Billing/Subscription**: all billing lifecycle transitions (see Part B)
    - **Campaign**: campaign paused, campaign resumed, campaign archived
    - **Admin (platform)**: new tenant signed up, tenant flagged, tenant past_due, tenant cancelled

**In Scope — Part B: Billing Lifecycle Enforcement & Admin Visibility**

7. Daily billing lifecycle cron (`billingCycleEnforcer`) with state transitions:
   - `active` → `past_due` when `billingEndDate < now`
   - `past_due` → `cancelled` when 7-day grace period expires
   - Implicit trial → `cancelled` when `trialEndsAt < now` (same day, no grace)
8. Read-only enforcement — extend `checkWriteAccess` to block writes for `past_due` and `cancelled` (all reasons)
9. Campaign pausing — auto-pause all active campaigns when tenant becomes `past_due` or `cancelled`; auto-resume when reactivated to `active`
10. Email + in-app notifications on every automated status transition (using notification system from Part A)
11. Admin UI visibility — computed flags (`isBillingOverdue`, `isTrialExpired`) surfaced in tenant list table and filter pills
12. Platform admin edit/override actions in `/(admin)` route group — **named operations only** (not free-form field editing):
    - **Extend Billing**: `tenantId, additionalDays (1-365), reason` — extends `billingEndDate`, sets `active`, clears `pastDueSince`. Tenant must be `active` or `past_due`. Max billing end: `now + 365 days`.
    - **Reset to Trial**: `tenantId, trialDays (1-90), reason` — reactivates cancelled/past_due tenant with new trial period. Sets `trialEndsAt`, clears billing dates.
    - **Mark as Paid**: `tenantId, reason` — recovers `past_due` or `cancelled` tenant to `active`. Sets `billingStartDate = now`, `billingEndDate = now + 30 days`, clears `pastDueSince`.
    - **Edit Billing Dates**: `tenantId, billingStartDate, billingEndDate, reason` — updates dates only, does NOT change status. Validation: `billingStartDate < billingEndDate < now + 365 days`. If `billingEndDate < now`, requires explicit confirmation (triggers past_due on next cron).
    - **Admin Cancel**: `tenantId, reason` — existing `adminCancelSubscription` enhanced with `cancelledReason: "admin_cancelled"`, no auto-deletion.
    - **Admin Reactivate**: existing `adminReactivateSubscription` enhanced with notification on reactivation.
    - All admin actions create billingHistory + auditLogs entries.
13. Add `cancelledReason` field to distinguish cancellation origin (`"grace_expired"`, `"trial_expired"`, `"admin_cancelled"`, `"owner_cancelled"`)
14. Billing history entries for all automated state transitions
15. Remove all auto-deletion: strip `ctx.scheduler.runAfter(deleteTenantData)` from owner `cancelSubscription` and admin `adminCancelSubscription`

**Out of Scope:**

- External billing provider integration (SaligPay/Stripe webhook changes)
- Actual payment processing or checkout flow
- New subscription plan creation or pricing changes
- Owner-facing billing UI changes (admin-only scope for edit actions)
- Manual tenant deletion by admin (separate future feature)
- Notification preferences UI (schema-ready but UI deferred)
- Push notifications (browser/mobile) — web in-app only for now
- Notification sound or browser notification API

## Context for Development

### Codebase Patterns

- Convex function syntax: `export const fn = query/mutation/action({ args, returns, handler })`
- New function syntax required with validators on all args and returns
- No dynamic imports in queries/mutations (V8 runtime) — use static imports only
- Cron jobs defined in `convex/crons.ts` using `cronJobs()` + `crons.interval()` or `crons.cron()`
- All cron targets are **internal functions** imported via `internal.*`
- Internal functions via `internalMutation`, `internalQuery`, `internalAction`
- Denormalized counters in `tenantStats` — mutations changing status must call corresponding hooks
- No unbounded `.collect()` on high-volume tables — always use `.take(N)` or `.paginate()`
- Email via `sendEmailFromMutation` (mutation context) or `ctx.runAction(internal.emailService.sendEmail)` (action context)
- Email templates in `convex/emails/` use `@react-email/components` with inline styles
- Audit logging via `_logAuditEventInternal` or direct `ctx.db.insert("auditLogs", { action, entityType, entityId, actorId, actorType, previousValue, newValue })`
- Billing history entries via `ctx.db.insert("billingHistory", { tenantId, event, timestamp, actorId })`
- `checkWriteAccess` in `tenantContext.ts` — currently ONLY blocks when `subscriptionStatus === "cancelled" && now >= billingEndDate`. Must be extended for `past_due`.
- `tenantMutation` wrapper in `tenantContext.ts` calls `requireWriteAccess` automatically for all tenant-scoped mutations
- Admin queries use `requireAdmin(ctx)` helper from `convex/admin/_helpers.ts`
- Two status fields on tenants: `tenant.status` (active/trial/suspended, used by filter pills + platform stats) vs `tenant.subscriptionStatus` (trial/active/cancelled/past_due, used by subscription badge)
- Next.js 16: client components with hooks MUST be wrapped in `<Suspense>`
- UI components: Radix UI primitives, Tailwind CSS v4, `<Button>` from `@/components/ui/button`
- `FilterTabs` component from `@/components/ui/FilterTabs` used by FilterPills

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `convex/schema.ts` | Tenant schema — add `cancelledReason`, `pastDueSince` fields. Add `notificationUnreadCount` to users table. Add `notifications` table. |
| `convex/crons.ts` | Cron infrastructure — add billing-cycle-enforcer (daily), notification-cleanup (daily), notification-reconciliation (weekly). |
| `convex/tenantContext.ts` | `checkWriteAccess` — extend to block `past_due` and all `cancelled`. |
| `convex/subscriptions.ts` | Owner `cancelSubscription` — remove auto-deletion scheduler call + `deletionDate`. `getCurrentSubscription` — no changes needed. |
| `convex/admin/subscriptions.ts` | `adminCancelSubscription` — add `cancelledReason`, remove `deletionScheduledDate`. `adminReactivateSubscription` — add notification. New mutations: `adminExtendBilling`, `adminResetToTrial`, `adminMarkAsPaid`, `adminEditBillingDates`. |
| `convex/admin/tenants.ts` | `searchTenants` — add `isBillingOverdue`, `isTrialExpired` computed flags. `getPlatformStats` — add `pastDue` count based on `subscriptionStatus`. |
| `convex/campaigns.ts` | Add `pauseAllActiveCampaignsForTenant` and `resumeAllPausedCampaignsForTenant` internal mutations. |
| `convex/tenants.ts` | `deleteTenantData` — keep for manual admin use. |
| `convex/notifications.ts` | **NEW FILE** — notification service: `createNotification`, `createBulkNotifications`, `getNotifications`, `getUnreadNotificationCount`, `markNotificationRead`, `markAllNotificationsRead`, `clearExpiredNotifications`, `reconcileUnreadCounts`. |
| `convex/billingLifecycle.ts` | **NEW FILE** — cron functions: `enforceBillingLifecycle` (daily), `pauseCampaignsForTenant`, `resumeCampaignsForTenant`. |
| `convex/email.tsx` | Add billing lifecycle email helpers following existing Group B pattern. |
| `convex/emails/PastDueEmail.tsx` | **NEW** — billing overdue email template. |
| `convex/emails/GracePeriodWarningEmail.tsx` | **NEW** — 3-day warning email template. |
| `convex/emails/TrialExpiredEmail.tsx` | **NEW** — trial ended email template. |
| `convex/emails/WelcomeBackEmail.tsx` | **NEW** — payment received email template. |
| `convex/emails/AccountReactivatedEmail.tsx` | **NEW** — account reactivated email template. |
| `src/components/notifications/*` | **NEW FILES** — NotificationBell, NotificationPanel, NotificationItem, NotificationProvider, useNotifications, useNotificationCount. |
| `src/app/(auth)/notifications/page.tsx` | **NEW** — full notifications page with filter tabs + pagination. |
| `src/app/(admin)/tenants/_components/TenantTable.tsx` | Add `isBillingOverdue`, `isTrialExpired` columns and row styling. |
| `src/app/(admin)/tenants/_components/FilterPills.tsx` | Add "Past Due" and "Billing Overdue" filter tabs. |
| `src/app/(admin)/tenants/_components/StatsRow.tsx` | Add "Past Due" metric card. |
| `src/app/(admin)/tenants/[tenantId]/_components/SubscriptionSummaryCard.tsx` | Show `cancelledReason`, `pastDueSince`, remove deletion date display. |
| `src/app/(admin)/tenants/[tenantId]/_components/AdminSubscriptionActions.tsx` | Add Extend Billing, Reset to Trial, Mark as Paid, Edit Billing Dates action buttons. |
| `src/app/(auth)/layout.tsx` | Add NotificationBell to owner sidebar. Wrap with NotificationProvider. |
| `src/app/(admin)/layout.tsx` | Add NotificationBell to admin sidebar. |

### Technical Decisions

- **Full enforcement mode:** Cron auto-transitions status, not just surface flags
- **Grace period:** 7 days default for `past_due` → `cancelled` transition (calendar-based via `pastDueSince` timestamp, not run-count based)
- **Trial expiry:** Immediate `cancelled` on same day `trialEndsAt` passes, no grace period
- **No auto-deletion:** Completely removed. Data preserved indefinitely. Deletion = admin-only manual action
- **Read-only enforcement:** `checkWriteAccess` extended to block writes for `past_due` AND `cancelled` (all reasons)
- **Campaign pausing:** Auto-pause all active campaigns when tenant transitions to `past_due` or `cancelled`; auto-resume when reactivated to `active`. NO existing bulk pause — need new internal mutation. Cap at `.take(500)` per run to avoid timeout.
- **Admin-only:** All edit/override actions restricted to platform admin role in `/(admin)` route group
- **Admin actions: Named operations only** — "Extend Billing", "Reset to Trial", "Mark as Paid", "Edit Billing Dates", "Admin Cancel", "Admin Reactivate". No raw status editing. Each action has specific validation rules, preconditions, and side effects.
- **Admin date validation:** `billingStartDate < billingEndDate < now + 365 days`. Past `billingEndDate` requires explicit confirmation warning. All actions create billingHistory + auditLogs entries.
- **Notification table design:** Dual writes for broadcasts — write one notification per user instead of nullable `userId`. Simpler queries, single index, scalable reads.
- **Notification delivery:** Synchronous via `ctx.runMutation` — all notifications in same transaction as business logic. Simpler, consistent, Convex is fast enough for this scale.
- **Notification email handling:** In-app write is primary (must succeed), email is best-effort (try/catch, never throws from email failure). If email fails, notification still appears in-app.
- **Unread count:** Denormalized `notificationUnreadCount` field on `users` table (per-user). Incremented on notification create, decremented on mark-read in atomic mutation. O(1) read — no `.collect()`. Weekly reconciliation cron counts actual unread and patches counter to fix drift.
- **Notification indexing:** `by_user_created` (paginated list), `by_user_unread` (filter by read status). Both on `userId` prefix for efficient querying.
- **Notification aggregation:** Commission earned and affiliate signup notifications aggregated by day per user/tenant. Uses `aggregatedCount` + `aggregationDate` fields (UTC day boundary). Checks for existing same-type + same-day notification before inserting. Accepts rare race-condition duplicates — weekly cleanup can merge.
- **Notification retention:** Auto-expire after 90 days via `expiresAt` field. **Daily** cleanup cron deletes expired rows in batches of `.take(1000)` per run. All queries filter `expiresAt > now`.
- **Notification realtime:** Convex `useQuery` for unread count — automatically re-renders when data changes. No custom subscriptions needed.
- **Notification UI — bell badge:** Only shows `critical + warning` count (NOT total). Prevents notification fatigue — bell only lights up when it matters.
- **Notification UI — panel sorting:** Critical/warning notifications sorted to top regardless of creation time. Info/success below, sorted by time descending.
- **Notification UI — mark-all-read:** Awaits mutation completion before closing panel. Shows brief loading state. Source of truth is always the `users.notificationUnreadCount` query.
- **Notification UI:** Radix UI `Popover` for dropdown panel. 4-level severity system: info (gray), success (green), warning (amber), critical (red + pulse). Full `/notifications` page with filter tabs + pagination.
- **Notification architecture:** `convex/notifications.ts` as central service → called via `ctx.runMutation(internal.notifications.create, ...)` from any mutation → writes to `notifications` table + optionally sends email
- **Notification targeting:** Every notification has a specific `userId` (no null). Broadcasts use dual writes (one per tenant user).
- **Idempotent cron:** Re-reads tenant fresh each run; skips if already in target state. Uses `pastDueSince` timestamp for calendar-based grace calculation
- **Race condition protection:** Cron checks `billingEndDate` fresh — if webhook already renewed it (billingEndDate now in future), cron skips transition. Cron skips tenants already in target `subscriptionStatus` regardless of `cancelledReason`.
- **`cancelledReason` field:** Distinguishes cancellation origin for admin filtering: `"grace_expired"`, `"trial_expired"`, `"admin_cancelled"`, `"owner_cancelled"`
- **Cron processing caps:** Each cron run caps processing at N tenants to avoid Convex function timeout (recommend 50-100 per run)

### Notification Schedule — Billing Lifecycle

| Transition | Email Subject | In-App Title | In-App Message | Severity |
|-----------|--------------|--------------|----------------|----------|
| `active` → `past_due` | "Payment overdue — action required" | "Payment Overdue" | "Your subscription payment is overdue. Please update your payment method to avoid cancellation." | warning |
| `past_due` (3 days remaining) | "Final warning — 3 days until cancellation" | "Cancellation in 3 Days" | "Your account will be cancelled in 3 days. Update your payment now to keep your data." | critical |
| `past_due` → `cancelled` (grace expired) | "Subscription cancelled" | "Subscription Cancelled" | "Your subscription has been cancelled. Upgrade to a paid plan to restore full access." | critical |
| `trial` → `cancelled` (trial expired) | "Trial ended — upgrade to keep your data" | "Trial Ended" | "Your free trial has ended. Upgrade to a paid plan to continue using all features." | warning |
| `past_due` → `active` (payment received) | "Welcome back!" | "Payment Received" | "Payment received. Your account is fully active again." | success |
| `cancelled` → `active` (reactivated) | "Account reactivated" | "Account Reactivated" | "Your account has been reactivated. All features are now available." | success |

### Notification Event Catalog — Full Platform

| Category | Type Key | Title | Who Sees It | Email? |
|----------|----------|-------|-------------|--------|
| **Affiliate** | `affiliate.approved` | "Affiliate Approved" | Owner | ✅ |
| **Affiliate** | `affiliate.rejected` | "Affiliate Rejected" | Owner | ✅ |
| **Affiliate** | `affiliate.new_signup` | "New Affiliate Signup" | Owner | ✅ |
| **Affiliate** | `affiliate.suspended` | "Affiliate Suspended" | Owner + Affiliate | ✅ |
| **Affiliate** | `affiliate.reactivated` | "Affiliate Reactivated" | Owner + Affiliate | ✅ |
| **Commission** | `commission.earned` | "New Commission" | Owner + Affiliate | ✅ (affiliate only) |
| **Commission** | `commission.approved` | "Commission Approved" | Affiliate | ✅ |
| **Commission** | `commission.declined` | "Commission Declined" | Affiliate | ✅ |
| **Commission** | `commission.reversed` | "Commission Reversed" | Affiliate | ✅ |
| **Payout** | `payout.processed` | "Payout Sent" | Affiliate | ✅ |
| **Payout** | `payout.failed` | "Payout Failed" | Affiliate + Owner | ✅ |
| **Team** | `team.invited` | "Team Invitation" | Invitee | ✅ |
| **Team** | `team.accepted` | "Team Member Joined" | Owner | ❌ |
| **Team** | `team.removed` | "Removed from Team" | Removed member | ✅ |
| **Billing** | `billing.past_due` | "Payment Overdue" | Owner | ✅ |
| **Billing** | `billing.grace_warning` | "Cancellation in 3 Days" | Owner | ✅ |
| **Billing** | `billing.cancelled` | "Subscription Cancelled" | Owner | ✅ |
| **Billing** | `billing.trial_expired` | "Trial Ended" | Owner | ✅ |
| **Billing** | `billing.recovered` | "Payment Received" | Owner | ✅ |
| **Billing** | `billing.reactivated` | "Account Reactivated" | Owner | ✅ |
| **Campaign** | `campaign.paused` | "Campaign Paused" | Owner | ❌ |
| **Campaign** | `campaign.resumed` | "Campaign Resumed" | Owner | ❌ |
| **Campaign** | `campaign.archived` | "Campaign Archived" | Owner | ❌ |
| **Admin** | `admin.tenant_signup` | "New Tenant Signed Up" | Platform Admin | ❌ |
| **Admin** | `admin.tenant_flagged` | "Tenant Flagged" | Platform Admin | ❌ |
| **Admin** | `admin.tenant_past_due` | "Tenant Payment Overdue" | Platform Admin | ❌ |
| **Admin** | `admin.tenant_cancelled` | "Tenant Subscription Cancelled" | Platform Admin | ❌ |

### Race Condition Protections

| Scenario | Risk | Prevention |
|----------|------|------------|
| Webhook sets `active` while cron transitions to `past_due` | Wrong state persists | Cron re-reads `billingEndDate` fresh — if webhook renewed it, `billingEndDate` is now in future, cron skips |
| Admin extends billing while cron mid-grace | Grace doesn't reset | Admin mutation clears `pastDueSince`; cron re-evaluates on next run |
| Cron misses a day (Convex outage) | Tenants get extra grace | Grace is calendar-based (7 days from `pastDueSince`), not run-count based |
| Tenant pays while cron about to cancel | Payment taken but cancelled | Cron re-reads `subscriptionStatus` before acting; if `"active"`, skips |

### Investigation Findings

#### Existing `checkWriteAccess` (must extend)
- Currently ONLY blocks: `subscriptionStatus === "cancelled" && now >= billingEndDate`
- Must add: `subscriptionStatus === "past_due"` (block all writes immediately)
- Must add: `subscriptionStatus === "cancelled"` for ALL `cancelledReason` values (not just when `billingEndDate` passed)

#### Existing Campaign Pause (individual only, no bulk)
- `pauseCampaign` / `resumeCampaign` exist for single campaigns
- NO `pauseAllCampaignsForTenant` — must create new internal mutation
- Paused campaigns already block commission creation via `checkCampaignCanEarnCommission`

#### No In-App Notification System (building from scratch)
- No `notifications` table in schema
- No notification bell, panel, or component
- Only email notifications exist today (26 templates in `convex/emails/`)
- Email delivery tracked in `emails` table
- `getSidebarBadgeCounts` query exists for sidebar badge counts (pendingAffiliates, pendingCommissions, pendingPayouts) — pattern to follow
- Must build: schema table, service layer, queries, UI components, integration hooks

#### Two-Field Status Confusion
- `tenant.status` (active/trial/suspended) — used by `getPlatformStats` counts and `FilterPills`
- `tenant.subscriptionStatus` (trial/active/cancelled/past_due) — used by `SubscriptionStatusBadge`
- `getPlatformStats` counts trial by `tenant.status === "trial"` but `createTenant` sets `status: "active"` — trial count always 0
- `searchTenants` status filter queries `by_status` index on `tenant.status`, not `subscriptionStatus`
- New filter pills for "past_due" and "billing_overdue" should filter on `subscriptionStatus` (in-memory or new index)

#### Owner `cancelSubscription` Auto-Deletion (must remove)
- Lines 358-364: `ctx.scheduler.runAfter(deleteTenantData, { tenantId })` — REMOVE
- Lines 340-346: `deletionScheduledDate` calculation — REMOVE
- Lines 329-331: `deletionDate` in return value — REMOVE
- Email `sendCancellationConfirmation` passes `deletionDate` — UPDATE template

#### Admin `adminCancelSubscription` (must update)
- Sets `deletionScheduledDate` but no scheduler call — remove `deletionScheduledDate` set since no auto-deletion
- Add `cancelledReason: "admin_cancelled"` to patch
- No email sent — notification system will handle

#### No Billing Date Editing
- Admin cannot edit `billingStartDate` or `billingEndDate` directly today
- Only set as side effects of plan changes, reactivations, or trial conversions
- Need new admin mutation for direct billing date editing

#### Existing Email Templates (26 files in `convex/emails/`)
- `CancellationConfirmationEmail.tsx` — reference for new billing lifecycle emails
- `DeletionReminderEmail.tsx` — may repurpose for grace period warning
- Pattern: React Email components, inline styles, brand color `#1c2260`
- `BaseEmail.tsx` provides shared wrapper (not all templates use it)

#### Existing Notification Touchpoints (where to hook in)
- `convex/subscriptions.ts`: cancelSubscription, upgradeTier, convertTrialToPaid — add notification calls
- `convex/admin/subscriptions.ts`: adminCancel, adminReactivate, adminExtendTrial, adminChangePlan — add notification calls
- `convex/campaigns.ts`: pauseCampaign, resumeCampaign — add notification calls
- `convex/affiliates.ts`: approve, reject, suspend, reactivate — add notification calls
- `convex/commissionEngine.ts`: commission created, approved, declined, reversed — add notification calls
- `convex/payouts.ts`: payout processed, failed — add notification calls
- `convex/teamInvitations.ts`: team invited, accepted, removed — add notification calls
- `convex/billingLifecycle.ts` (new): all cron-driven status transitions — add notification calls
- Sidebar layouts: `src/app/(auth)/layout.tsx` (owner sidebar) and `src/app/(admin)/layout.tsx` (admin sidebar) — add NotificationBell

## Implementation Plan

### Tasks

#### Phase 1: Schema & Foundation (no UI changes, no cron activation)

- [x] **Task 1: Add billing lifecycle fields to tenants table**
  - File: `convex/schema.ts`
  - Action: Add `cancelledReason` as `v.optional(v.string())` and `pastDueSince` as `v.optional(v.number())` to the `tenants` defineTable. No index changes needed.
  - Notes: These are additive fields — existing tenants will have `undefined` values, which is correct (they haven't been through the lifecycle cron yet).

- [x] **Task 2: Add notifications table and users.notificationUnreadCount**
  - File: `convex/schema.ts`
  - Action: Add `notificationUnreadCount` as `v.optional(v.number())` to the `users` defineTable. Create new `notifications` defineTable with fields: `tenantId` (v.id("tenants")), `userId` (v.id("users")), `type` (v.string()), `title` (v.string()), `message` (v.string()), `severity` (v.union(v.literal("info"), v.literal("warning"), v.literal("success"), v.literal("critical"))), `actionUrl` (v.optional(v.string())), `actionLabel` (v.optional(v.string())), `isRead` (v.boolean()), `readAt` (v.optional(v.number())), `expiresAt` (v.optional(v.number())), `metadata` (v.optional(v.any())), `aggregatedCount` (v.number()), `aggregationDate` (v.optional(v.number())). Indexes: `by_user_created` on `["userId", "_creationTime"]`, `by_user_unread` on `["userId", "isRead"]`, `by_tenant` on `["tenantId"]`.
  - Notes: `isRead` defaults to `false` (must be explicitly set on insert). `aggregatedCount` defaults to `1`. `expiresAt` set to `Date.now() + 90 * 86400000` on creation.

- [x] **Task 3: Build notification service layer**
  - File: `convex/notifications.ts` (NEW)
  - Action: Create the following internal functions:
    - `createNotification` (internalMutation): Args — `{ tenantId, userId, type, title, message, severity, actionUrl?, actionLabel?, emailSubject?, emailHtml?, metadata?, shouldAggregate? }`. Logic: (1) If `shouldAggregate`, check for existing notification with same `type` + same `aggregationDate` + same `userId` → if found, patch `aggregatedCount++`, update title/message, return. (2) Insert notification with `isRead: false`, `aggregatedCount: 1`, `aggregationDate: Math.floor(Date.now() / 86400000)`, `expiresAt: Date.now() + 90 * 86400000`. (3) Increment `users.notificationUnreadCount` via `ctx.db.patch(userId, { notificationUnreadCount: (existing || 0) + 1 })`. (4) If `emailSubject` provided, call `sendEmailFromMutation` in try/catch — never throw from email failure. Log error to console but continue.
    - `createBulkNotifications` (internalMutation): Args — `{ tenantId, userIds, type, title, message, severity, actionUrl?, actionLabel?, emailSubject?, emailHtml?, metadata? }`. Logic: Loop over `userIds`, call `createNotification` for each (with individual try/catch per user to accept partial delivery).
    - `getNotifications` (query): Args — `{ userId, paginationOpts, typeFilter?, unreadOnly? }`. Logic: Query `by_user_created` filtered by `userId` and `expiresAt > now`. If `typeFilter`, filter by type prefix. If `unreadOnly`, filter by `isRead === false`. Paginate with `paginationOptsValidator`. Return with severity sorting logic (critical/warning first).
    - `getUnreadNotificationCount` (query): Args — `{ userId }`. Logic: Read `users.notificationUnreadCount` field. Return `{ total, critical, warning }` — requires a second query for severity breakdown or store these as separate denormalized counters. For simplicity: return the single count and let client determine severity breakdown from the notifications query.
    - `markNotificationRead` (mutation): Args — `{ notificationId }`. Logic: Get notification, verify `userId` matches authenticated user. If already read, return. Patch `isRead: true`, `readAt: Date.now()`. Decrement `users.notificationUnreadCount` (min 0).
    - `markAllNotificationsRead` (mutation): Args — `{ userId }`. Logic: Query unread notifications for user (cap `.take(200)` for safety). Patch each `isRead: true`, `readAt: Date.now()`. Set `users.notificationUnreadCount` to 0.
    - `clearExpiredNotifications` (internalMutation): Args — `{}`. Logic: Query notifications where `expiresAt < now`. Take 1000. Delete each. Return count deleted.
    - `reconcileUnreadCounts` (internalMutation): Args — `{}`. Logic: Query all users with `notificationUnreadCount != null`. For each (cap 100 per run), count actual unread notifications via `by_user_unread` index. Patch if count differs. Return count fixed.
  - Notes: All functions use new Convex function syntax with validators. No dynamic imports. `getUnreadNotificationCount` returns simple `{ total: v.number() }` for O(1) reads.

- [x] **Task 4: Extend checkWriteAccess for past_due and all cancelled states**
  - File: `convex/tenantContext.ts`
  - Action: Modify `checkWriteAccess` function. Current logic blocks only when `subscriptionStatus === "cancelled" && now >= billingEndDate`. New logic: Block writes if ANY of these conditions are true:
    1. `subscriptionStatus === "past_due"` → return `{ canWrite: false, reason: "Write operations are blocked because your subscription payment is overdue" }`
    2. `subscriptionStatus === "cancelled"` (regardless of billingEndDate) → return `{ canWrite: false, reason: "Write operations are blocked because your subscription has been cancelled" }`
    3. Keep existing `cancelled && now >= billingEndDate` as a subset of condition 2.
  - Notes: This affects all mutations using the `tenantMutation` wrapper. No changes needed to individual mutation handlers — the gate is automatic.

- [x] **Task 5: Remove auto-deletion from owner cancelSubscription**
  - File: `convex/subscriptions.ts`
  - Action: In `cancelSubscription` mutation (line 288-385):
    1. Remove `deletionDate` calculation (lines ~340-346: `const deletionDate = accessEndDate + 30 * 24 * 60 * 60 * 1000`)
    2. Remove `deletionScheduledDate: deletionDate` from the `ctx.db.patch` call
    3. Remove `ctx.scheduler.runAfter(deleteTenantData)` call (lines ~358-364)
    4. Update return type to remove `deletionDate` field — return `{ success: true, accessEndDate }`
    5. Add `cancelledReason: "owner_cancelled"` to the `ctx.db.patch` call
    6. Update `sendCancellationConfirmation` call to remove `deletionDate` parameter
    7. Add `ctx.runMutation(internal.notifications.create, ...)` call with type `"billing.cancelled"`, severity `"warning"`, notification to owner user
  - Notes: The `deleteTenantData` internal mutation in `tenants.ts` stays intact for potential future manual admin use.

- [x] **Task 6: Remove auto-deletion from admin cancelSubscription and add cancelledReason**
  - File: `convex/admin/subscriptions.ts`
  - Action: In `adminCancelSubscription` mutation (line 559-618):
    1. Remove `deletionScheduledDate` variable and its assignment
    2. Remove `deletionScheduledDate` from `ctx.db.patch` call
    3. Add `cancelledReason: "admin_cancelled"` to `ctx.db.patch` call
    4. Update return type to remove `deletionScheduledDate` — return `{ success: true }`
    5. Add `ctx.runMutation(internal.notifications.create, ...)` with type `"billing.cancelled"`, severity `"warning"` to tenant owner user
  - Notes: Admin gets a notification in the admin panel (type `"admin.tenant_cancelled"`) via a separate call.

#### Phase 2: Billing Lifecycle Cron

- [x] **Task 7: Create billing lifecycle cron functions**
  - File: `convex/billingLifecycle.ts` (NEW)
  - Action: Create internal functions:
    - `enforceBillingLifecycle` (internalAction — needs "use node" for Date operations if needed, otherwise internalMutation):
      - Args: `{}`
      - Logic:
        1. Query all tenants via `.take(500)`. Filter in-memory for `status === "active"` or `status === "suspended"`.
        2. Process up to 100 tenants per run (cap to avoid timeout).
        3. For each tenant, re-read fresh from DB via `ctx.db.get(tenant._id)`.
        4. **Trial expiry check**: If `trialEndsAt` is set AND `trialEndsAt < Date.now()` AND `subscriptionStatus !== "active"` AND `subscriptionStatus !== "cancelled"`:
           - `ctx.db.patch(tenantId, { subscriptionStatus: "cancelled", cancelledReason: "trial_expired", cancellationDate: Date.now(), trialEndsAt: undefined })`
           - Insert billingHistory: `{ event: "trial_expired", timestamp: Date.now(), actorId: null }`
           - Insert auditLog: `{ action: "BILLING_TRIAL_EXPIRED", ... }`
           - Call `internal.campaigns.pauseAllActiveCampaignsForTenant({ tenantId })`
           - Call `internal.notifications.create({ ..., type: "billing.trial_expired", severity: "warning" })` for tenant owner
        5. **Past due check**: If `subscriptionStatus === "active"` AND `billingEndDate` is set AND `billingEndDate < Date.now()` AND `trialEndsAt` is undefined or past:
           - `ctx.db.patch(tenantId, { subscriptionStatus: "past_due", pastDueSince: Date.now() })`
           - Insert billingHistory: `{ event: "past_due", timestamp: Date.now(), actorId: null }`
           - Insert auditLog: `{ action: "BILLING_PAST_DUE", ... }`
           - Call `internal.notifications.create({ ..., type: "billing.past_due", severity: "warning" })` for tenant owner
        6. **Grace period expiry check**: If `subscriptionStatus === "past_due"` AND `pastDueSince` is set AND `(Date.now() - pastDueSince) > 7 * 86400000`:
           - `ctx.db.patch(tenantId, { subscriptionStatus: "cancelled", cancelledReason: "grace_expired", cancellationDate: Date.now() })`
           - Insert billingHistory: `{ event: "grace_expired", timestamp: Date.now(), actorId: null }`
           - Insert auditLog: `{ action: "BILLING_GRACE_EXPIRED", ... }`
           - Call `internal.campaigns.pauseAllActiveCampaignsForTenant({ tenantId })`
           - Call `internal.notifications.create({ ..., type: "billing.cancelled", severity: "critical" })` for tenant owner
        7. **Grace period warning (3 days remaining)**: If `subscriptionStatus === "past_due"` AND `pastDueSince` is set AND `graceRemaining <= 3 * 86400000` AND `graceRemaining > 2.5 * 86400000`:
           - Call `internal.notifications.create({ ..., type: "billing.grace_warning", severity: "critical" })` for tenant owner
      - Returns: `v.null()`
    - `pauseCampaignsForTenant` (internalMutation):
      - Args: `{ tenantId: v.id("tenants") }`
      - Logic: Query campaigns `by_tenant_and_status` with `status: "active"`. Take 500. For each, patch `{ status: "paused" }`.
    - `resumeCampaignsForTenant` (internalMutation):
      - Args: `{ tenantId: v.id("tenants") }`
      - Logic: Query campaigns `by_tenant_and_status` with `status: "paused"`. Take 500. For each, patch `{ status: "active" }`.
  - Notes: All billing transitions use internal mutations for atomicity. Campaign pause/resume are separate internal mutations. Cron uses internalAction so it can call other internal functions via `ctx.runMutation`.

- [x] **Task 8: Create billing lifecycle email templates**
  - File: `convex/emails/PastDueEmail.tsx` (NEW), `convex/emails/GracePeriodWarningEmail.tsx` (NEW), `convex/emails/TrialExpiredEmail.tsx` (NEW), `convex/emails/WelcomeBackEmail.tsx` (NEW), `convex/emails/AccountReactivatedEmail.tsx` (NEW)
  - Action: Create 5 email templates following existing pattern (reference `CancellationConfirmationEmail.tsx`). Each uses `@react-email/components` (Html, Body, Container, Heading, Text, Button, Section). Brand color `#1c2260` for buttons. Templates:
    - `PastDueEmail`: Subject "Payment overdue — action required". Body: "Your subscription payment is overdue. Please update your payment method to avoid cancellation." CTA button to billing settings.
    - `GracePeriodWarningEmail`: Subject "Final warning — 3 days until cancellation". Body: "Your account will be cancelled in 3 days. Update your payment now." Urgent styling (red accent).
    - `TrialExpiredEmail`: Subject "Trial ended — upgrade to keep your data". Body: "Your free trial has ended. Your account is now read-only." CTA to upgrade.
    - `WelcomeBackEmail`: Subject "Welcome back!". Body: "Payment received. Your account is fully active again." Green accent.
    - `AccountReactivatedEmail`: Subject "Account reactivated". Body: "Your account has been reactivated. All features available." Green accent.
  - Notes: All templates accept `{ tenantName, brandName }` props. Use inline styles (consistent with existing templates).

- [x] **Task 9: Add billing email helpers to email.tsx**
  - File: `convex/email.tsx`
  - Action: Add 5 new email helper functions in Group B (billing helpers), following existing pattern:
    - `sendPastDueEmail(ctx, { to, tenantName, tenantId })`
    - `sendGracePeriodWarningEmail(ctx, { to, tenantName, tenantId })`
    - `sendTrialExpiredEmail(ctx, { to, tenantName, tenantId })`
    - `sendWelcomeBackEmail(ctx, { to, tenantName, tenantId })`
    - `sendAccountReactivatedEmail(ctx, { to, tenantName, tenantId })`
    Each uses `sendEmailFromMutation(ctx, { from: getFromAddress("billing"), to, subject, html: await render(<Template />), tracking: { tenantId, type: "billing_<event>" } })`
  - Notes: Import templates from `./emails/<TemplateName>`.

- [x] **Task 10: Update owner cancelSubscription to use notification service and new email**
  - File: `convex/subscriptions.ts`
  - Action: In `cancelSubscription` mutation:
    1. Replace `sendCancellationConfirmation(ctx, { to, previousPlan, accessEndDate, deletionDate, tenantId })` with notification service call: `ctx.runMutation(internal.notifications.create, { tenantId: authUser.tenantId, userId: authUser.userId, type: "billing.cancelled", title: "Subscription Cancelled", message: "Your subscription has been cancelled.", severity: "warning", emailSubject: "Subscription cancelled", emailHtml: await render(<CancellationConfirmationEmail previousPlan={currentPlan} accessEndDate={accessEndDate} />) })`
    2. Remove `import { sendCancellationConfirmation }` if no longer used elsewhere.
  - Notes: The cancellation email template is kept but called through the notification service.

#### Phase 3: Admin Override Mutations

- [x] **Task 11: Create new admin billing override mutations**
  - File: `convex/admin/subscriptions.ts`
  - Action: Add 4 new mutations:
    - `adminExtendBilling`: Args `{ tenantId, additionalDays (1-365), reason }`. Validate tenant is `active` or `past_due`. Calculate new `billingEndDate = max(current billingEndDate, now) + additionalDays * 86400000`. Cap at `now + 365 days`. Patch: `{ subscriptionStatus: "active", billingEndDate: newEnd, pastDueSince: undefined }`. Insert billingHistory `{ event: "admin_extend_billing", amount: 0, ... }` and auditLog `{ action: "ADMIN_EXTEND_BILLING", metadata: { additionalDays, reason } }`. Create notification for tenant owner with severity `"success"`.
    - `adminResetToTrial`: Args `{ tenantId, trialDays (1-90), reason }`. Validate tenant is `cancelled` or `past_due`. Set `trialEndsAt = Date.now() + trialDays * 86400000`. Patch: `{ subscriptionStatus: "active", trialEndsAt, billingStartDate: undefined, billingEndDate: undefined, pastDueSince: undefined, cancelledReason: undefined, cancellationDate: undefined }`. Insert billingHistory + auditLog. Create notification with severity `"info"`. Resume campaigns via `ctx.runMutation(internal.billingLifecycle.resumeCampaignsForTenant, { tenantId })`.
    - `adminMarkAsPaid`: Args `{ tenantId, reason }`. Validate tenant is `past_due` or `cancelled`. Patch: `{ subscriptionStatus: "active", billingStartDate: Date.now(), billingEndDate: Date.now() + 30 * 86400000, pastDueSince: undefined, cancelledReason: undefined, cancellationDate: undefined }`. Insert billingHistory `{ event: "admin_mark_as_paid", ... }` and auditLog. Create notification with severity `"success"`. Resume campaigns.
    - `adminEditBillingDates`: Args `{ tenantId, billingStartDate, billingEndDate, reason }`. Validate `billingStartDate < billingEndDate < Date.now() + 365 * 86400000`. Patch only billing dates — does NOT change subscriptionStatus. Insert billingHistory `{ event: "admin_edit_billing_dates", ... }` and auditLog. Create notification with severity `"info"`.
  - Notes: All mutations call `requireAdmin(ctx)`. All create billingHistory + auditLogs. All send notifications to tenant owner. `adminResetToTrial` and `adminMarkAsPaid` resume campaigns.

- [x] **Task 12: Enhance adminReactivateSubscription with notifications and campaign resume**
  - File: `convex/admin/subscriptions.ts`
  - Action: In `adminReactivateSubscription` (line 626-685):
    1. After the patch, call `ctx.runMutation(internal.billingLifecycle.resumeCampaignsForTenant, { tenantId: args.tenantId })` to auto-resume paused campaigns.
    2. Add `ctx.runMutation(internal.notifications.create, ...)` with type `"billing.reactivated"`, severity `"success"` for tenant owner.
    3. Add admin notification with type `"admin.tenant_reactivated"` for platform admin (no email).
  - Notes: Campaign resume happens in same mutation transaction context.

#### Phase 4: Admin UI Visibility

- [x] **Task 13: Add billing overdue computed flags to admin searchTenants**
  - File: `convex/admin/tenants.ts`
  - Action: In `searchTenants` query enrichment loop, add computed fields:
    - `isBillingOverdue`: `tenant.subscriptionStatus === "past_due" || (tenant.billingEndDate !== undefined && tenant.billingEndDate < Date.now() && tenant.subscriptionStatus === "active")`
    - `isTrialExpired`: `tenant.trialEndsAt !== undefined && tenant.trialEndsAt < Date.now() && (tenant.subscriptionStatus === "cancelled" || tenant.subscriptionStatus === undefined)`
  - Notes: Add these to the return validator `v.object({ ... isBillingOverdue: v.boolean(), isTrialExpired: v.boolean() })`.

- [x] **Task 14: Add pastDue count to getPlatformStats**
  - File: `convex/admin/tenants.ts`
  - Action: In `getPlatformStats` query, add a `pastDue` counter. Count tenants where `tenant.subscriptionStatus === "past_due"`. Return `{ total, active, trial, suspended, flagged, pastDue, deltaThisWeek }`.
  - Notes: This counts by `subscriptionStatus`, not `tenant.status`. The existing trial count by `tenant.status` can remain as-is.

- [x] **Task 15: Update admin TenantTable with overdue indicators**
  - File: `src/app/(admin)/tenants/_components/TenantTable.tsx`
  - Action:
    1. Add `isBillingOverdue: boolean` and `isTrialExpired: boolean` to the `Tenant` interface.
    2. Add a "Health" or "Billing" column (or add visual indicators to existing columns).
    3. Row styling: `row.isBillingOverdue ? "border-l-4 border-l-amber-500" : ""` and `row.isTrialExpired ? "border-l-4 border-l-red-400" : ""`.
    4. Add filter for `isBillingOverdue` in column filters.
  - Notes: Use amber for past_due and red for trial expired to match severity colors.

- [x] **Task 16: Add Past Due and Billing Overdue filter pills**
  - File: `src/app/(admin)/tenants/_components/FilterPills.tsx`
  - Action: Add two new filter tabs:
    - `"past_due"` — label "Past Due", icon `Clock`, color `bg-amber-500`
    - `"billing_overdue"` — label "Needs Attention", icon `AlertTriangle`, color `bg-red-500`
  - Notes: These filter on `subscriptionStatus` (in-memory since there's no index on it) or on the computed flags from `searchTenants`.

- [x] **Task 17: Add Past Due metric card to StatsRow**
  - File: `src/app/(admin)/tenants/_components/StatsRow.tsx`
  - Action: Add 6th MetricCard for "Past Due" with `stats.pastDue`, variant `red`, icon `Clock`.
  - Notes: Update grid to `grid-cols-3 lg:grid-cols-6` to accommodate 6 cards.

- [x] **Task 18: Update SubscriptionSummaryCard for cancelledReason and pastDueSince**
  - File: `src/app/(admin)/tenants/[tenantId]/_components/SubscriptionSummaryCard.tsx`
  - Action:
    1. Display `cancelledReason` as a human-readable label (e.g., "Grace Period Expired", "Trial Expired", "Admin Cancelled", "Owner Cancelled").
    2. Display `pastDueSince` as "Overdue since [date]" with days elapsed.
    3. Remove "Deletion Scheduled" section since auto-deletion is removed.
    4. Show grace period countdown when `pastDueSince` is set: "X days until cancellation".
  - Notes: Use `date-fns` `formatDistanceToNow` for relative time display.

- [x] **Task 19: Add admin billing override action buttons**
  - File: `src/app/(admin)/tenants/[tenantId]/_components/AdminSubscriptionActions.tsx`
  - Action: Add buttons/dialogs for:
    - "Extend Billing" → dialog with `additionalDays` input (number, 1-365) + `reason` textarea
    - "Reset to Trial" → dialog with `trialDays` input (number, 1-90) + `reason` textarea
    - "Mark as Paid" → confirmation dialog with `reason` textarea
    - "Edit Billing Dates" → dialog with `billingStartDate` and `billingEndDate` date pickers + `reason` textarea. Show warning if `billingEndDate < now`.
    - Conditionally show based on current `subscriptionStatus`:
      - `active` or `past_due`: Show "Extend Billing", "Edit Billing Dates"
      - `past_due`: Also show "Mark as Paid"
      - `cancelled`: Show "Reset to Trial", "Mark as Paid"
  - Notes: Use existing dialog/modal components from the project. All actions call the new mutations from Task 11.

#### Phase 5: Notification UI Components

- [x] **Task 20: Create NotificationProvider and hooks**
  - File: `src/components/notifications/NotificationProvider.tsx` (NEW), `src/components/notifications/useNotificationCount.ts` (NEW), `src/components/notifications/useNotifications.ts` (NEW)
  - Action:
    - `NotificationProvider`: React context provider wrapping `ConvexClientProvider`. Exposes `unreadCount` via `useQuery(api.notifications.getUnreadNotificationCount, { userId })`. Re-renders on count change (Convex realtime).
    - `useNotificationCount()`: Hook returning `{ total, critical, warning }` from context. For bell badge: `total` is the count, but display logic filters by severity.
    - `useNotifications()`: Hook returning `{ notifications, unreadCount, markRead, markAllRead, isLoading }`. Uses `useQuery(api.notifications.getNotifications, ...)` for the panel list.
  - Notes: `"use client"` directive required. Wrap in `<Suspense>` where mounted.

- [x] **Task 21: Create NotificationBell, NotificationPanel, and NotificationItem components**
  - File: `src/components/notifications/NotificationBell.tsx` (NEW), `src/components/notifications/NotificationPanel.tsx` (NEW), `src/components/notifications/NotificationItem.tsx` (NEW)
  - Action:
    - `NotificationBell`: Bell icon (`Bell` from lucide-react) with badge showing `critical + warning` count (from `useNotificationCount`). Badge colors: 0 = hidden, warning = amber, critical = red with CSS pulse animation. Wrapped in Radix `Popover` trigger.
    - `NotificationPanel`: Radix `Popover.Content` showing "Notifications" header + "Mark all as read" button + list of `NotificationItem` + "View all" link to `/notifications`. Max-height scrollable container. Sort: critical/warning first, then by creation time descending. "Mark all as read" awaits `markAllNotificationsRead` mutation, shows loading spinner.
    - `NotificationItem`: Severity icon (AlertTriangle for warning, AlertCircle for critical, Info for info, CheckCircle for success), title, message (truncated), relative time (`date-fns` formatDistanceToNow), action button if `actionUrl` present. Unread = bold text + subtle left border by severity color. Read = normal text, muted. Click on action button → `router.push(actionUrl)` + `markNotificationRead`.
  - Notes: All use `"use client"` directive. Tailwind CSS v4 utility classes. No inline transition classes on `<Button>`.

- [x] **Task 22: Create full /notifications page**
  - File: `src/app/(auth)/notifications/page.tsx` (NEW)
  - Action: Create a page with:
    - Header: "Notifications" title + "Mark all as read" button
    - Filter tabs: All, Unread, Billing, Affiliate, Commission, Payout, Team, Campaign (using FilterTabs component)
    - Paginated list of `NotificationItem` components (load more on scroll or pagination buttons)
    - Click notification → navigate to `actionUrl` + mark as read
    - Empty states per filter: "No unread notifications", "No billing notifications", etc.
    - Responsive layout: single column on mobile, comfortable width on desktop
  - Notes: `"use client"` with `<Suspense>` wrapper. Route group `(auth)` requires authentication.

- [x] **Task 23: Integrate NotificationBell into owner sidebar and admin sidebar**
  - File: `src/app/(auth)/layout.tsx`, `src/app/(admin)/layout.tsx`
  - Action:
    1. Wrap the layout content with `<NotificationProvider>`.
    2. Add `<NotificationBell />` in the sidebar top area (near user avatar/profile section).
    3. Both sidebars show the bell — owner sees their tenant notifications, admin sees platform admin notifications.
  - Notes: The `NotificationProvider` must be inside the `ConvexClientProvider` (which is already in the root layout). The bell uses `useNotificationCount` which reads from `users` table based on authenticated user.

#### Phase 6: Notification Integration into Existing Features

- [x] **Task 24: Add notifications to subscription mutations**
  - File: `convex/subscriptions.ts`
  - Action: Add `ctx.runMutation(internal.notifications.create, ...)` calls in:
    - `upgradeTier`: type `"billing.upgraded"`, severity `"info"`, email to owner
    - `convertTrialToPaid`: type `"billing.trial_conversion"`, severity `"success"`, email to owner
    - `downgradeTier`: type `"billing.downgraded"`, severity `"info"`, email to owner
  - Notes: Only add notification calls where they don't already exist. The cancel flow was already updated in Tasks 5 and 10.

- [x] **Task 25: Add notifications to admin subscription mutations**
  - File: `convex/admin/subscriptions.ts`
  - Action: Add notification calls in:
    - `adminChangePlan`: type `"billing.plan_changed"`, severity `"info"` to tenant owner
    - `adminExtendTrial`: type `"billing.trial_extended"`, severity `"info"` to tenant owner
    - Existing `adminCancelSubscription`: type `"admin.tenant_cancelled"` to platform admin (already done in Task 6 for tenant owner)
    - Existing `adminReactivateSubscription`: type `"admin.tenant_reactivated"` to platform admin (already done in Task 12)
    - New `adminExtendBilling`: type `"billing.extended"` to tenant owner (already done in Task 11)
    - New `adminMarkAsPaid`: type `"billing.recovered"` to tenant owner (already done in Task 11)
  - Notes: Admin notifications use `severity: "info"` and no email. Owner notifications use appropriate severity and email.

- [x] **Task 26: Add notifications to campaign mutations**
  - File: `convex/campaigns.ts`
  - Action: Add `ctx.runMutation(internal.notifications.create, ...)` calls in:
    - `pauseCampaign`: type `"campaign.paused"`, severity `"info"`, no email, to tenant owner
    - `resumeCampaign`: type `"campaign.resumed"`, severity `"success"`, no email, to tenant owner
    - Any campaign archive logic: type `"campaign.archived"`, severity `"info"`, no email, to tenant owner
  - Notes: Campaign notifications are in-app only (no email) to avoid noise.

- [x] **Task 27: Add notifications to affiliate mutations**
  - File: `convex/affiliates.ts`
  - Action: Add notification calls in affiliate approval, rejection, suspension, reactivation flows. Each creates notification for tenant owner (and affiliate where applicable). Commission earned notification uses aggregation (`shouldAggregate: true`).
  - Notes: Search for existing mutation handlers in affiliates.ts that handle status transitions. Add notification calls at the end of each handler after the DB patch.

- [x] **Task 28: Add notifications to commission engine**
  - File: `convex/commissionEngine.ts`
  - Action: Add notification calls when commissions are created (aggregated), approved, declined, reversed. Commission earned notifications go to both owner (aggregated, no email) and affiliate (aggregated, with email).
  - Notes: Commission earned is the highest-volume event — aggregation is critical here.

- [x] **Task 29: Add notifications to payout and team invitation flows**
  - Files: `convex/payouts.ts`, `convex/teamInvitations.ts`
  - Action: Add notification calls for payout processed/failed and team invited/accepted/removed events.
  - Notes: Payout failed is `severity: "critical"` since it affects money. Team events are `severity: "info"`.

#### Phase 7: Cron Registration & Cleanup

- [x] **Task 30: Register new crons**
  - File: `convex/crons.ts`
  - Action: Add 3 new cron intervals:
    1. `crons.interval("billing-cycle-enforcer", { hours: 24 }, internal.billingLifecycle.enforceBillingLifecycle, {})` — daily billing lifecycle enforcement
    2. `crons.interval("notification-cleanup", { hours: 24 }, internal.notifications.clearExpiredNotifications, {})` — daily expired notification cleanup
    3. `crons.interval("notification-reconciliation", { hours: 168 }, internal.notifications.reconcileUnreadCounts, {})` — weekly unread count reconciliation
  - Notes: All cron targets are internal functions. Use `internal.*` references.

- [x] **Task 31: Update CancellationConfirmationEmail template to remove deletion references**
  - File: `convex/emails/CancellationConfirmationEmail.tsx`
  - Action: Remove any references to "deletion date", "30 days until data deletion", or "your data will be permanently deleted". Replace with messaging about read-only access and reactivation options.
  - Notes: The template should now say something like "Your account is now read-only. You can reactivate at any time to restore full access."

- [x] **Task 32: Seed data update for existing tenants**
  - File: `convex/testData.ts`
  - Action: Ensure seed data is compatible with new schema fields:
    - Existing tenants get `cancelledReason: undefined`, `pastDueSince: undefined` (default)
    - Existing users get `notificationUnreadCount: 0`
    - Add test tenants in `past_due` and `cancelled` states for testing the admin UI
    - Add test notifications for testing the notification UI
  - Notes: Use `--typecheck=disable` when running seed commands.

### Acceptance Criteria

#### Part A: Notification System

- [x] **AC 1:** Given a notification is created for user X, when user X opens the notification panel, then the notification appears with correct title, message, severity icon, and timestamp.
- [x] **AC 2:** Given a user has 5 unread notifications (3 info, 1 warning, 1 critical), when the bell badge renders, then it shows count "2" (warning + critical only, NOT total).
- [x] **AC 3:** Given a user clicks "Mark all as read" in the notification panel, when the mutation completes, then all notifications are marked read, the badge count resets to 0, and the panel shows loading state during mutation.
- [x] **AC 4:** Given a notification has an `actionUrl`, when the user clicks the action button, then the user navigates to the `actionUrl` and the notification is marked as read.
- [x] **AC 5:** Given 5 commission earned events occur in one day for user X, when notifications are created, then only 1 aggregated notification appears with `aggregatedCount: 5` and message "You earned 5 commissions today".
- [x] **AC 6:** Given a notification was created 91 days ago, when the cleanup cron runs, then the notification is deleted from the `notifications` table.
- [x] **AC 7:** Given the unread count has drifted (manual DB edit), when the reconciliation cron runs, then `users.notificationUnreadCount` is patched to match actual unread notification count.
- [x] **AC 8:** Given an email failure occurs during notification creation, when the notification is queried, then the in-app notification exists but no email was sent (no error thrown).
- [x] **AC 9:** Given a user navigates to `/notifications` page, when the page renders, then they see filter tabs, paginated list, and can filter by type or read status.
- [x] **AC 10:** Given a critical notification exists and an info notification exists, when the panel renders, then the critical notification appears above the info notification regardless of creation time.

#### Part B: Billing Lifecycle

- [x] **AC 11:** Given a tenant with `subscriptionStatus: "active"` and `billingEndDate: 2 days ago`, when the billing cron runs, then the tenant's `subscriptionStatus` is set to `"past_due"`, `pastDueSince` is set, and the owner receives a notification + email.
- [x] **AC 12:** Given a tenant with `subscriptionStatus: "past_due"` and `pastDueSince: 8 days ago`, when the billing cron runs, then the tenant's `subscriptionStatus` is set to `"cancelled"` with `cancelledReason: "grace_expired"`, all active campaigns are paused, and the owner receives a critical notification + email.
- [x] **AC 13:** Given a tenant with `subscriptionStatus: "past_due"` and `pastDueSince: 4 days ago` (3 days remaining), when the billing cron runs, then the owner receives a critical "3 days remaining" notification + email.
- [x] **AC 14:** Given a tenant with `trialEndsAt: 1 day ago` and `subscriptionStatus: undefined`, when the billing cron runs, then the tenant's `subscriptionStatus` is set to `"cancelled"` with `cancelledReason: "trial_expired"`, all active campaigns are paused, and the owner receives a notification + email.
- [x] **AC 15:** Given a tenant in `past_due` status, when the owner tries to create a campaign or approve an affiliate, then the mutation is blocked with error "Write operations are blocked because your subscription payment is overdue".
- [x] **AC 16:** Given a tenant in `cancelled` status (any `cancelledReason`), when the owner tries any write mutation, then the mutation is blocked with error "Write operations are blocked because your subscription has been cancelled".
- [x] **AC 17:** Given a webhook sets `subscriptionStatus: "active"` and updates `billingEndDate` to 30 days in the future, when the billing cron runs, then the cron skips this tenant (billingEndDate is in the future).
- [x] **AC 18:** Given the billing cron misses a day (simulated), when it runs the next day, then grace period is still calculated correctly based on `pastDueSince` (calendar-based, not run-count).
- [x] **AC 19:** Given owner `cancelSubscription` is called, when the mutation completes, then `subscriptionStatus: "cancelled"`, `cancelledReason: "owner_cancelled"`, NO `deletionScheduledDate` is set, and NO scheduler call is made.

#### Admin Visibility & Override

- [x] **AC 20:** Given 3 tenants are `past_due`, when the admin views the tenant list, then the "Past Due" filter pill shows count "3" and filtering by it shows only past_due tenants.
- [x] **AC 21:** Given a tenant is past due, when the admin views the tenant table row, then the row has an amber left border indicator.
- [x] **AC 22:** Given the admin clicks "Extend Billing" for a past_due tenant and enters 30 days, when the mutation completes, then the tenant is `active` with `billingEndDate` extended by 30 days, `pastDueSince` is cleared, and the owner receives a "Payment Received" notification.
- [x] **AC 23:** Given the admin clicks "Reset to Trial" for a cancelled tenant and enters 14 days, when the mutation completes, then the tenant has `subscriptionStatus: "active"`, `trialEndsAt` set to 14 days from now, campaigns are resumed, and the owner receives a notification.
- [x] **AC 24:** Given the admin clicks "Edit Billing Dates" and enters `billingEndDate` in the past, when the form submits, then a confirmation warning is shown: "This will trigger past_due on the next cron run. Continue?"
- [x] **AC 25:** Given the admin clicks "Extend Billing" with `additionalDays: 400`, when the form submits, then validation fails with "Additional days must be between 1 and 365".
- [x] **AC 26:** Given the platform admin opens the StatsRow, when it renders, then a "Past Due" metric card shows the count of past_due tenants.

## Additional Context

### Dependencies

- Existing subscription schema fields on `tenants` table: `billingStartDate`, `billingEndDate`, `trialEndsAt`, `subscriptionStatus`, `cancellationDate`, `deletionScheduledDate`
- Existing cron infrastructure in `convex/crons.ts`
- Existing email service in `convex/emailService.ts` and `convex/email.tsx`
- Existing admin helpers in `convex/admin/_helpers.ts` (`requireAdmin`)
- Existing billing history and audit log tables
- Existing individual `pauseCampaign`/`resumeCampaign` in `convex/campaigns.ts`
- `@react-email/components` for email templates
- `date-fns` for relative time formatting (already installed per project-context.md)
- Radix UI `Popover` for notification panel (already in project as Radix dependency)
- `FilterTabs` component at `@/components/ui/FilterTabs` (used by FilterPills)

### Testing Strategy

- **Manual testing:** After each phase, manually verify by:
  - Phase 1: Run `pnpm convex dev` and verify schema migration. Create a test notification via Convex dashboard. Verify query returns it.
  - Phase 2: Set a tenant's `billingEndDate` to the past. Run cron manually via `pnpm convex run billingLifecycle:enforceBillingLifecycle --typecheck=disable -- '{}'`. Verify status transitions.
  - Phase 3: Test each admin mutation via the admin UI dialogs.
  - Phase 4: View admin tenant list, verify overdue indicators and filter pills work.
  - Phase 5: Create notifications, verify bell badge, panel, full page, mark-read, aggregation.
  - Phase 6: Trigger various events (approve affiliate, create commission), verify notifications appear.
  - Phase 7: Verify crons are registered (check Convex dashboard). Verify cleanup cron deletes expired notifications.
- **Edge cases to test manually:**
  - Cron runs twice in same day — second run should be idempotent (no duplicate transitions)
  - Webhook payment received while tenant is `past_due` — should transition back to `active`
  - Admin extends billing while cron is mid-grace — `pastDueSince` should be cleared
  - 500+ campaigns for a tenant — bulk pause should cap at 500 and not timeout
  - Notification creation when email service is down — in-app notification should still appear
- **No automated tests:** Project has no production test suite. Vitest is configured but only placeholder tests exist.

### Notes

- All auto-deletion is being removed as part of this spec — deliberate architectural decision
- Schema additions needed: `cancelledReason` (optional string), `pastDueSince` (optional number) on tenants table; `notificationUnreadCount` (number) on users table; NEW `notifications` table
- New files needed: `convex/billingLifecycle.ts` (cron functions), `convex/notifications.ts` (notification service), `src/components/notifications/*` (bell, panel, item, provider, hooks), `src/app/(auth)/notifications/page.tsx` (full notifications page), 5 new email templates
- Notification system is full-featured with realtime unread counts, severity-based styling, aggregation, retention, email integration, and full page
- 28 notification event types across 7 categories (affiliate, commission, payout, team, billing, campaign, admin)
- Notification aggregation for commission earned and affiliate signup (by UTC day) to prevent fatigue. Accepts rare race-condition duplicates.
- Notification retention: 90-day auto-expire with **daily** cleanup cron (`.take(1000)` per run)
- Unread count denormalized on `users` table for O(1) reads — increment on create, decrement on mark-read (atomic). Weekly reconciliation cron fixes drift.
- Dual writes for broadcast notifications (one per user instead of nullable userId)
- Bell badge shows only `critical + warning` count — NOT total. Prevents notification fatigue.
- Panel sorts critical/warning to top regardless of time. Info/success below by time.
- Notification integration touches ~10 existing Convex files — each needs a `ctx.runMutation(internal.notifications.create, ...)` call added
- Bell icon placement: top-right of owner sidebar (authenticated layout) and admin sidebar
- `/notifications` full page includes: filter tabs, pagination, mark-all-read (awaits mutation), click-to-navigate, responsive layout
- Admin override uses **named operations only** — no raw status/date editing. 6 named actions with specific validation and preconditions.
- Admin date validation: `billingStartDate < billingEndDate < now + 365 days`. Past `billingEndDate` triggers confirmation warning.
- Campaign bulk pause capped at `.take(500)` per cron run to avoid timeout
- `adminExtendTrial` currently checks `subscriptionStatus === "trial"` but normal trial tenants don't have this field set — may need to check `trialEndsAt > now` instead
- Task ordering follows dependency chain: schema → service layer → cron → UI → integration

---

## Implementation Review Notes (Step 5 & 6)

### Adversarial Review Findings — All Resolved

| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| F1 | `adminResetToTrial` set `subscriptionStatus: "active"` instead of `"trial"` | Bug | Fixed — now correctly sets `"trial"` |
| F2 | `clearExpiredNotifications` was a no-op (queried with dummy userId) | Bug | Rewritten to iterate users (100×50 per run) |
| F3 | Public notification queries/mutations had no auth checks | Security | Added `ctx.auth.getUserIdentity()` + email verification |
| F4 | `adminReactivateSubscription` set billing dates for free starter plan | Bug | Skip billing dates when `plan === "starter"` |
| F5 | `adminCancelSubscription` didn't pause campaigns | Bug | Added `pauseAllActiveCampaignsForTenant` call |
| F6 | `getNotifications` used fake in-memory pagination (hard-capped at 50) | Scale | Rewritten with native Convex `.paginate()`, hook exposes `loadMore`/`isDone` |
| F7 | Reconciliation cron ran weekly (168h) — too slow for counter drift | Correctness | Changed to daily (24h) |
| F8 | `getPlatformRevenueMetrics` referenced undefined `payingFromTrial`/`trialConvertedCount` | Bug | Defined both from tenant data within existing loop |
| F9 | Grace warning notification had no deduplication | Fatigue | Added `shouldAggregate: true` to notification call |
| F10 | `useNotificationCount` hook was clean | OK | No fix needed |
| F11 | Cron scheduling used interval drift instead of fixed daily | Correctness | Fixed to daily schedule |
| F12 | `notifyTenantOwner` helper missing `shouldAggregate` in type | Bug | Added to param type |
| F13 | Notifications page didn't support cursor-based loading | Scale | Switched to `useNotifications` hook with "Load More" button |
| F14 | `markNotificationRead` called with wrong args from page | Bug | Fixed to only pass `{ notificationId }` |

### Self-Check (Step 4) Pattern Audit — All Resolved

- E1: Replaced all raw `<button>` with `<Button>` component (Bell, Panel, page)
- E4: Fixed notifications page to use `api.auth.getCurrentUser` instead of client session
- E6: Removed unused imports across notification components
- E7: Cleaned up NotificationProvider dead code
- W10: Added Skeleton loading states for notification panels
- W11: Used `bg-background` instead of `bg-white`
- W13: Wired `onMarkRead` + `onClick` props to NotificationItem
- W14: Added accessibility attributes (role, tabIndex, aria-pressed)

### Known Limitations

- **No automated tests** — project has placeholder tests only; manual verification required
- **Unread count has a theoretical read-modify-write race** — mitigated by daily reconciliation cron
- **All TS errors are `_generated/api.ts` lag** — will resolve on `pnpm dev` (codegen)
