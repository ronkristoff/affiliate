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

export default crons;
