/**
 * Rate Limiter — Convex queries and mutations for API rate limiting.
 *
 * Two-tier design (avoids write amplification on high-volume endpoints):
 * - `getRateLimitStatus` — internalQuery (read-only, no write)
 * - `checkAndIncrementRateLimit` — internalMutation (atomic check + increment)
 * - `incrementRateLimit` — internalMutation (increment-only, for post-processing)
 * - `cleanupExpiredLimits` — internalMutation (paginated cleanup via by_expiresAt index)
 */

import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const MIN_WINDOW_MS = 1000; // Minimum window duration to prevent misconfiguration

/**
 * Get current rate limit status for a key (read-only, no write).
 * Returns default "under limit" values for missing docs.
 *
 * For high-volume endpoints: call this first, proceed if remaining > 0,
 * then call incrementRateLimit separately after processing.
 */
export const getRateLimitStatus = internalQuery({
  args: {
    key: v.string(),
    limit: v.number(),
  },
  returns: v.object({
    count: v.number(),
    windowStart: v.number(),
    remaining: v.number(),
    resetsAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (!doc) {
      // No doc = under limit by default
      const now = Date.now();
      return {
        count: 0,
        windowStart: now,
        remaining: args.limit,
        resetsAt: now + 60_000, // Default window assumption
      };
    }

    const now = Date.now();

    // Check if window has expired
    if (now >= doc.windowStart + doc.windowDurationMs) {
      return {
        count: 0,
        windowStart: now,
        remaining: args.limit,
        resetsAt: now + doc.windowDurationMs,
      };
    }

    return {
      count: doc.count,
      windowStart: doc.windowStart,
      remaining: Math.max(0, args.limit - doc.count),
      resetsAt: doc.windowStart + doc.windowDurationMs,
    };
  },
});

/**
 * Atomically check rate limit and increment if under limit.
 * For low-volume endpoints (broadcast, export, DNS) — single call is simpler.
 *
 * Returns { allowed, remainingCount, resetsAt }.
 * Writes auditLog on rejection.
 */
export const checkAndIncrementRateLimit = internalMutation({
  args: {
    key: v.string(),
    limit: v.number(),
    windowDurationMs: v.number(),
  },
  returns: v.object({
    allowed: v.boolean(),
    remainingCount: v.number(),
    resetsAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Guard against misconfigured windows
    if (args.windowDurationMs < MIN_WINDOW_MS) {
      throw new Error(`Rate limit window must be at least ${MIN_WINDOW_MS}ms`);
    }

    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (!existing) {
      // First request — create doc with count=1
      await ctx.db.insert("rateLimits", {
        key: args.key,
        count: 1,
        windowStart: now,
        windowDurationMs: args.windowDurationMs,
        expiresAt: now + args.windowDurationMs,
      });

      return {
        allowed: true,
        remainingCount: args.limit - 1,
        resetsAt: now + args.windowDurationMs,
      };
    }

    // Check if window has expired
    if (now >= existing.windowStart + existing.windowDurationMs) {
      // Reset window
      const newExpiresAt = now + args.windowDurationMs;
      await ctx.db.patch(existing._id, {
        count: 1,
        windowStart: now,
        windowDurationMs: args.windowDurationMs,
        expiresAt: newExpiresAt,
      });

      return {
        allowed: true,
        remainingCount: args.limit - 1,
        resetsAt: newExpiresAt,
      };
    }

    // Check if at/over limit
    if (existing.count >= args.limit) {
      // Write audit log for rate limit rejection
      await ctx.db.insert("auditLogs", {
        tenantId: undefined as any, // Rate limits may span tenants or be global
        action: "RATE_LIMIT_EXCEEDED",
        entityType: "rateLimit",
        entityId: existing._id,
        actorType: "system",
        newValue: {
          key: args.key,
          limit: args.limit,
          currentCount: existing.count,
          resetsAt: existing.windowStart + existing.windowDurationMs,
        },
      });

      return {
        allowed: false,
        remainingCount: 0,
        resetsAt: existing.windowStart + existing.windowDurationMs,
      };
    }

    // Increment count
    const newCount = existing.count + 1;
    await ctx.db.patch(existing._id, {
      count: newCount,
    });

    return {
      allowed: true,
      remainingCount: args.limit - newCount,
      resetsAt: existing.windowStart + existing.windowDurationMs,
    };
  },
});

/**
 * Increment rate limit counter (no limit check).
 * For high-volume endpoints: call after getRateLimitStatus query confirms under limit.
 *
 * N7: Upsert pattern — try patch first, insert if doc missing.
 * N6: Safety net — optional limit param for accidental misuse.
 * N9: Minimum window guard — reject windowDurationMs < 1000.
 */
export const incrementRateLimit = internalMutation({
  args: {
    key: v.string(),
    windowDurationMs: v.number(),
    limit: v.optional(v.number()), // Safety net: throw if exceeded
  },
  returns: v.number(), // Returns new count
  handler: async (ctx, args) => {
    const now = Date.now();

    // Guard against misconfigured windows
    if (args.windowDurationMs < MIN_WINDOW_MS) {
      throw new Error(`Rate limit window must be at least ${MIN_WINDOW_MS}ms`);
    }

    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      // Check if window has expired — reset if so
      if (now >= existing.windowStart + existing.windowDurationMs) {
        const newCount = 1;
        await ctx.db.patch(existing._id, {
          count: newCount,
          windowStart: now,
          windowDurationMs: args.windowDurationMs,
          expiresAt: now + args.windowDurationMs,
        });
        return newCount;
      }

      // Increment existing
      const newCount = existing.count + 1;

      // Safety net check
      if (args.limit !== undefined && newCount > args.limit) {
        throw new Error(
          `Rate limit exceeded for key "${args.key}": ${newCount}/${args.limit}`
        );
      }

      await ctx.db.patch(existing._id, { count: newCount });
      return newCount;
    }

    // N7: Doc doesn't exist — create (upsert pattern)
    // This handles the race where query saw no doc but another request created it
    const newCount = 1;
    await ctx.db.insert("rateLimits", {
      key: args.key,
      count: newCount,
      windowStart: now,
      windowDurationMs: args.windowDurationMs,
      expiresAt: now + args.windowDurationMs,
    });
    return newCount;
  },
});

/**
 * Cleanup expired rate limit docs using paginated by_expiresAt index.
 * Called by cron job every hour.
 *
 * Returns null. Processes in batches of batchSize.
 * Args validator matches cron args: { cursor?, batchSize? }
 */
export const cleanupExpiredLimits = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 500;
    const now = Date.now();

    // Use by_expiresAt index — take expired docs up to batchSize
    const expired = await ctx.db
      .query("rateLimits")
      .withIndex("by_expiresAt")
      .order("asc") // Oldest first — ensures we process docs that have been expired longest
      .take(batchSize);

    let deletedCount = 0;
    for (const doc of expired) {
      if (doc.expiresAt < now) {
        await ctx.db.delete(doc._id);
        deletedCount++;
      }
    }

    // If we deleted exactly batchSize docs, there are likely more to process.
    // The next cron run (hourly) will pick them up.
    if (deletedCount > 0) {
      console.log(`[RateLimit Cleanup] Deleted ${deletedCount} expired docs`);
    }

    return null;
  },
});
