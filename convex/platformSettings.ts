/**
 * Platform Settings Module
 *
 * Singleton pattern (keyed by "platform") for platform-wide configuration
 * that Platform Admins can change without a code deploy.
 *
 * Settings include:
 * - defaultTrialDays: Number of days for new tenant free trials (default: 14)
 *
 * NOTE: This file uses `as any` casts on ctx.db operations for the
 * platformSettings table to avoid a bootstrapping chicken-and-egg problem:
 * the Convex generated types (_generated/api.d.ts) don't include the new
 * table until after the schema is pushed, but convex dev runs tsc before
 * pushing. Once the backend processes the schema and regenerates types,
 * these casts become unnecessary but remain harmless.
 */

import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./admin/_helpers";

// =============================================================================
// Constants
// =============================================================================

/** Fallback default trial days when no platformSettings row exists yet. */
const FALLBACK_TRIAL_DAYS = 14;

/** Platform settings singleton key. */
const PLATFORM_KEY = "platform";

/** Minimum and maximum allowed trial days. */
const MIN_TRIAL_DAYS = 1;
const MAX_TRIAL_DAYS = 365;

// =============================================================================
// Shared helper (call directly from any function handler)
// =============================================================================

/**
 * Read the configured default trial days from the platformSettings table.
 * Returns FALLBACK_TRIAL_DAYS (14) if the settings document doesn't exist yet.
 *
 * This is the SINGLE SOURCE OF TRUTH for trial duration.
 * All tenant creation flows must call this instead of hardcoding a number.
 *
 * Import and call directly in any query/mutation handler:
 *   const days = await readDefaultTrialDays(ctx);
 */
export async function readDefaultTrialDays(ctx: QueryCtx): Promise<number> {
  // Cast to any to avoid stale generated types before schema push
  const db = ctx.db as any;
  const settings = await db
    .query("platformSettings")
    .withIndex("by_key", (q: any) => q.eq("key", PLATFORM_KEY))
    .first();

  return (settings?.defaultTrialDays as number) ?? FALLBACK_TRIAL_DAYS;
}

// =============================================================================
// Internal query (for external callers that need ctx.runQuery)
// =============================================================================

/**
 * Internal query wrapper around readDefaultTrialDays.
 * Use readDefaultTrialDays() directly when possible — this exists
 * only for callers that must use ctx.runQuery().
 */
export const getDefaultTrialDays = internalQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    return readDefaultTrialDays(ctx);
  },
});

/**
 * Public query — returns the default trial days for new tenants.
 * No authentication required. Used by marketing/sign-up/sign-in pages.
 */
export const getPublicDefaultTrialDays = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    return readDefaultTrialDays(ctx);
  },
});

// =============================================================================
// Admin queries (platform admin only)
// =============================================================================

/**
 * Get current platform settings. Admin-only.
 */
export const getPlatformSettings = query({
  args: {},
  returns: v.object({
    key: v.string(),
    defaultTrialDays: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const db = ctx.db as any;
    const settings = await db
      .query("platformSettings")
      .withIndex("by_key", (q: any) => q.eq("key", PLATFORM_KEY))
      .first();

    return {
      key: PLATFORM_KEY,
      defaultTrialDays: (settings?.defaultTrialDays as number) ?? FALLBACK_TRIAL_DAYS,
    };
  },
});

// =============================================================================
// Admin mutations (platform admin only)
// =============================================================================

/**
 * Update platform settings. Admin-only.
 * Creates the singleton document if it doesn't exist yet.
 */
export const updatePlatformSettings = mutation({
  args: {
    defaultTrialDays: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    // Validate trial days range
    if (
      !Number.isInteger(args.defaultTrialDays) ||
      args.defaultTrialDays < MIN_TRIAL_DAYS ||
      args.defaultTrialDays > MAX_TRIAL_DAYS
    ) {
      throw new Error(
        `Default trial days must be an integer between ${MIN_TRIAL_DAYS} and ${MAX_TRIAL_DAYS}`
      );
    }

    const db = ctx.db as any;

    // Upsert the singleton settings document
    const existing = await db
      .query("platformSettings")
      .withIndex("by_key", (q: any) => q.eq("key", PLATFORM_KEY))
      .first();

    if (existing) {
      const previousValue = existing.defaultTrialDays;
      await db.patch(existing._id, {
        defaultTrialDays: args.defaultTrialDays,
      });

      // Audit log
      await ctx.db.insert("auditLogs", {
        action: "PLATFORM_SETTINGS_UPDATED",
        entityType: "platformSettings",
        entityId: PLATFORM_KEY,
        actorId: admin._id,
        actorType: "admin",
        previousValue: { defaultTrialDays: previousValue },
        newValue: { defaultTrialDays: args.defaultTrialDays },
      });
    } else {
      await db.insert("platformSettings", {
        key: PLATFORM_KEY,
        defaultTrialDays: args.defaultTrialDays,
      });

      // Audit log
      await ctx.db.insert("auditLogs", {
        action: "PLATFORM_SETTINGS_CREATED",
        entityType: "platformSettings",
        entityId: PLATFORM_KEY,
        actorId: admin._id,
        actorType: "admin",
        newValue: { defaultTrialDays: args.defaultTrialDays },
      });
    }

    return { success: true };
  },
});

// =============================================================================
// Seed (internal)
// =============================================================================

/**
 * Seed the default platform settings singleton.
 * Idempotent — skips if a "platform" row already exists.
 * Call from seedAllTestData or one-time setup.
 */
export const seedPlatformSettings = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const db = ctx.db as any;
    const existing = await db
      .query("platformSettings")
      .withIndex("by_key", (q: any) => q.eq("key", PLATFORM_KEY))
      .first();

    if (existing) {
      return null; // Already seeded
    }

    await db.insert("platformSettings", {
      key: PLATFORM_KEY,
      defaultTrialDays: FALLBACK_TRIAL_DAYS,
    });

    return null;
  },
});
