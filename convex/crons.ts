import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up old login attempts every hour
crons.interval(
  "cleanup-old-login-attempts",
  { hours: 1 },
  internal.rateLimit.cleanupOldAttempts,
  {}
);

// Check for tenants needing deletion reminders - runs daily at 9 AM UTC
crons.interval(
  "check-deletion-reminders",
  { hours: 24 },
  internal.tenants.checkAndSendDeletionReminders,
  {}
);

// Story 11.5: Expire tier overrides - runs hourly
// NOTE: This cron references a function that doesn't exist yet
// crons.interval(
//   "expire-tier-overrides",
//   { hours: 1 },
//   internal.admin.tierOverrides.expireTierOverrides,
//   {}
// );

// Weekly backfill of tenantStats counters — catches any drift from edge cases
crons.weekly(
  "weekly-stats-backfill",
  {
    dayOfWeek: "sunday",
    hourUTC: 2,
    minuteUTC: 0,
  },
  internal.tenantStats.backfillAllTenants,
  {}
);

// Clean up expired query builder export files — runs daily at 3 AM UTC
crons.interval(
  "cleanup-expired-query-exports",
  { hours: 24 },
  internal.queryBuilder.cleanupExpiredExports,
  {}
);

// Expire stale referral leads — runs daily at 4 AM UTC
// Archives leads older than 90 days with no linked conversion (caps at 100 per run)
crons.interval(
  "expire-stale-referral-leads",
  { hours: 24 },
  internal.referralLeads.expireStaleLeads,
  {}
);

// Billing lifecycle enforcement — runs daily
// Auto-transitions subscription statuses based on billing dates
crons.interval(
  "billing-cycle-enforcer",
  { hours: 24 },
  internal.billingLifecycle.enforceBillingLifecycle,
  {}
);

// Notification cleanup — runs daily
// Deletes expired notifications (older than 90 days) in batches of 1000
crons.interval(
  "notification-cleanup",
  { hours: 24 },
  internal.notifications.clearExpiredNotifications,
  {}
);

// Notification unread count reconciliation — runs daily
// Fixes drift in denormalized unread counters on users table
crons.interval(
  "notification-reconciliation",
  { hours: 24 },
  internal.notifications.reconcileUnreadCounts,
  {}
);

// Hourly platformStats recalculation from all tenantStats
// V1: cron-only (no incremental hooks). Recalculates aggregate KPIs.
crons.interval(
  "recalculate-platform-stats",
  { hours: 1 },
  internal.admin.platformStats.recalculatePlatformStats,
  {}
);

// New tenant backfill — runs every 4 hours
// Discovers tenants missing tenantStats and batch-creates them
crons.interval(
  "backfill-new-tenant-stats",
  { hours: 4 },
  internal.tenantStats._discoverAndBackfillImpl,
  {}
);

export default crons;
