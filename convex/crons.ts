import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Refresh platformStats cache from aggregates every 5 minutes
crons.interval(
  "refresh-platform-stats",
  { minutes: 5 },
  internal.admin.platformStats.refreshPlatformStats,
  {}
);

// Clean up old login attempts every hour
crons.interval(
  "cleanup-old-login-attempts",
  { hours: 1 },
  internal.rateLimit.cleanupOldAttempts,
  {}
);

// Clean up expired rate limit docs every hour (API Resilience Layer — Task 16)
// Uses by_expiresAt index with .take(500) batch cap
crons.interval(
  "cleanup-expired-rate-limits",
  { hours: 1 },
  internal.rateLimits.cleanupExpiredLimits,
  { batchSize: 500 }
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

// Story 15.7: Audit log retention — runs daily at 3 AM UTC
// Purges audit log entries older than 12 months in batches of 500 per tenant
crons.interval(
  "audit-log-retention",
  { hours: 24 },
  internal.audit.runAuditLogRetention,
  {}
);

export default crons;
