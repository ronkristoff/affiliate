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

export default crons;
