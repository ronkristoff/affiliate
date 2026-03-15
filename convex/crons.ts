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

export default crons;
