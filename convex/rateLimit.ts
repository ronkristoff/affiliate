import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Rate limiting configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPTS_WINDOW_MS = 30 * 60 * 1000; // 30 minutes window

/**
 * Check if an email is currently rate limited (locked out)
 */
export const checkRateLimit = query({
  args: {
    email: v.string(),
  },
  returns: v.union(
    v.object({
      isLocked: v.boolean(),
      lockedUntil: v.optional(v.number()),
      remainingAttempts: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const now = Date.now();
    const windowStart = now - ATTEMPTS_WINDOW_MS;

    // Get all recent attempts for this email
    const attempts = await ctx.db
      .query("loginAttempts")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .filter((q) => q.gte(q.field("failedAt"), windowStart))
      .collect();

    if (attempts.length === 0) {
      return {
        isLocked: false,
        remainingAttempts: MAX_FAILED_ATTEMPTS,
      };
    }

    // Check if there's an active lock
    const activeLock = attempts.find(
      (attempt) => attempt.lockedUntil && attempt.lockedUntil > now
    );

    if (activeLock) {
      return {
        isLocked: true,
        lockedUntil: activeLock.lockedUntil ?? undefined,
        remainingAttempts: 0,
      };
    }

    // Calculate remaining attempts
    const failedCount = attempts.length;
    const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - failedCount);

    return {
      isLocked: false,
      remainingAttempts: remaining,
    };
  },
});

/**
 * Record a failed login attempt and log to audit
 */
export const recordFailedAttempt = mutation({
  args: {
    email: v.string(),
    ipAddress: v.optional(v.string()),
  },
  returns: v.object({
    isLocked: v.boolean(),
    lockedUntil: v.optional(v.number()),
    remainingAttempts: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const windowStart = now - ATTEMPTS_WINDOW_MS;
    const email = args.email.toLowerCase();

    // Get all recent attempts for this email
    const attempts = await ctx.db
      .query("loginAttempts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .filter((q) => q.gte(q.field("failedAt"), windowStart))
      .collect();

    // Count attempts in current window
    const failedCount = attempts.length;

    // If already locked, just return lock status
    const activeLock = attempts.find(
      (attempt) => attempt.lockedUntil && attempt.lockedUntil > now
    );

    if (activeLock) {
      return {
        isLocked: true,
        lockedUntil: activeLock.lockedUntil ?? undefined,
        remainingAttempts: 0,
      };
    }

    // Record this failed attempt
    const newAttempt = {
      email,
      ipAddress: args.ipAddress,
      failedAt: now,
      lockedUntil:
        failedCount + 1 >= MAX_FAILED_ATTEMPTS
          ? now + LOCKOUT_DURATION_MS
          : undefined,
    };

    await ctx.db.insert("loginAttempts", newAttempt);

    // Log to audit for security tracking
    await ctx.db.insert("auditLogs", {
      action: "LOGIN_ATTEMPT_FAILED",
      entityType: "user",
      entityId: email,
      actorType: "system",
      metadata: {
        ipAddress: args.ipAddress,
        securityEvent: true,
        additionalInfo: `Failed login attempt ${failedCount + 1} of ${MAX_FAILED_ATTEMPTS}`,
      },
    });

    // Check if we should lock now
    if (failedCount + 1 >= MAX_FAILED_ATTEMPTS) {
      // Log account lockout
      await ctx.db.insert("auditLogs", {
        action: "ACCOUNT_LOCKED",
        entityType: "user",
        entityId: email,
        actorType: "system",
        metadata: {
          ipAddress: args.ipAddress,
          securityEvent: true,
          additionalInfo: `Account locked due to ${MAX_FAILED_ATTEMPTS} failed login attempts`,
        },
      });

      return {
        isLocked: true,
        lockedUntil: now + LOCKOUT_DURATION_MS,
        remainingAttempts: 0,
      };
    }

    return {
      isLocked: false,
      lockedUntil: undefined,
      remainingAttempts: MAX_FAILED_ATTEMPTS - (failedCount + 1),
    };
  },
});

/**
 * Clear failed login attempts after successful login
 */
export const clearFailedAttempts = mutation({
  args: {
    email: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase();

    // Get all attempts for this email
    const attempts = await ctx.db
      .query("loginAttempts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();

    // Delete all attempts
    for (const attempt of attempts) {
      await ctx.db.delete(attempt._id);
    }

    // Log successful login
    await ctx.db.insert("auditLogs", {
      action: "LOGIN_SUCCESS",
      entityType: "user",
      entityId: email,
      actorType: "user",
      metadata: {
        securityEvent: true,
        additionalInfo: "Successful login after failed attempt reset",
      },
    });

    return null;
  },
});

/**
 * Internal mutation to clean up old login attempts (for cron job)
 */
export const cleanupOldAttempts = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - ATTEMPTS_WINDOW_MS;
    const oldAttempts = await ctx.db
      .query("loginAttempts")
      .filter((q) => q.lt(q.field("failedAt"), cutoff))
      .collect();

    for (const attempt of oldAttempts) {
      await ctx.db.delete(attempt._id);
    }

    return oldAttempts.length;
  },
});
