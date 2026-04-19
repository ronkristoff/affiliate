/**
 * Platform Settings Module
 *
 * Singleton pattern (keyed by "platform") for platform-wide configuration
 * that Platform Admins can change without a code deploy.
 *
 * Settings include:
 * - defaultTrialDays: Number of days for new tenant free trials (default: 14)
 * - enabledPlatformProviders: Which payment providers are available for platform subscriptions
 * - stripePriceIds: Mapping of plan names to Stripe Price IDs
 */

import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./admin/_helpers";

// =============================================================================
// Constants
// =============================================================================

const FALLBACK_TRIAL_DAYS = 14;

const PLATFORM_KEY = "platform";

const MIN_TRIAL_DAYS = 1;
const MAX_TRIAL_DAYS = 365;

export type PlatformProvider = "stripe" | "saligpay";

// =============================================================================
// Shared helpers (call directly from any function handler)
// =============================================================================

export async function readDefaultTrialDays(ctx: QueryCtx): Promise<number> {
  const db = ctx.db as any;
  const settings = await db
    .query("platformSettings")
    .withIndex("by_key", (q: any) => q.eq("key", PLATFORM_KEY))
    .first();

  return (settings?.defaultTrialDays as number) ?? FALLBACK_TRIAL_DAYS;
}

export async function readPlatformSettings(ctx: QueryCtx): Promise<{
  defaultTrialDays: number;
  enabledPlatformProviders: PlatformProvider[];
  stripePriceIds: Record<string, string>;
}> {
  const db = ctx.db as any;
  const settings = await db
    .query("platformSettings")
    .withIndex("by_key", (q: any) => q.eq("key", PLATFORM_KEY))
    .first();

  return {
    defaultTrialDays: (settings?.defaultTrialDays as number) ?? FALLBACK_TRIAL_DAYS,
    enabledPlatformProviders: (settings?.enabledPlatformProviders as PlatformProvider[]) ?? [],
    stripePriceIds: (settings?.stripePriceIds as Record<string, string>) ?? {},
  };
}

// =============================================================================
// Internal queries (for external callers that need ctx.runQuery)
// =============================================================================

export const getDefaultTrialDays = internalQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    return readDefaultTrialDays(ctx);
  },
});

export const getPlatformSettingsInternal = internalQuery({
  args: {},
  returns: v.object({
    defaultTrialDays: v.number(),
    enabledPlatformProviders: v.array(v.union(v.literal("stripe"), v.literal("saligpay"))),
    stripePriceIds: v.record(v.string(), v.string()),
  }),
  handler: async (ctx) => {
    return readPlatformSettings(ctx);
  },
});

// =============================================================================
// Public queries (no auth required)
// =============================================================================

export const getPublicDefaultTrialDays = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    return readDefaultTrialDays(ctx);
  },
});

export const getPublicPlatformProviders = query({
  args: {},
  returns: v.array(v.union(v.literal("stripe"), v.literal("saligpay"))),
  handler: async (ctx) => {
    const settings = await readPlatformSettings(ctx);
    return settings.enabledPlatformProviders;
  },
});

// =============================================================================
// Admin queries (platform admin only)
// =============================================================================

export const getPlatformSettings = query({
  args: {},
  returns: v.object({
    key: v.string(),
    defaultTrialDays: v.number(),
    enabledPlatformProviders: v.array(v.union(v.literal("stripe"), v.literal("saligpay"))),
    stripePriceIds: v.record(v.string(), v.string()),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const settings = await readPlatformSettings(ctx);

    return {
      key: PLATFORM_KEY,
      ...settings,
    };
  },
});

// =============================================================================
// Admin mutations (platform admin only)
// =============================================================================

export const updatePlatformSettings = mutation({
  args: {
    defaultTrialDays: v.number(),
    enabledPlatformProviders: v.optional(v.array(v.union(v.literal("stripe"), v.literal("saligpay")))),
    stripePriceIds: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

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

    const existing = await db
      .query("platformSettings")
      .withIndex("by_key", (q: any) => q.eq("key", PLATFORM_KEY))
      .first();

    if (existing) {
      const previousValue: Record<string, unknown> = {
        defaultTrialDays: existing.defaultTrialDays,
        enabledPlatformProviders: existing.enabledPlatformProviders,
        stripePriceIds: existing.stripePriceIds,
      };

      const patchData: Record<string, unknown> = {
        defaultTrialDays: args.defaultTrialDays,
      };
      if (args.enabledPlatformProviders !== undefined) {
        patchData.enabledPlatformProviders = args.enabledPlatformProviders;
      }
      if (args.stripePriceIds !== undefined) {
        patchData.stripePriceIds = args.stripePriceIds;
      }

      await db.patch(existing._id, patchData);

      await ctx.db.insert("auditLogs", {
        action: "PLATFORM_SETTINGS_UPDATED",
        entityType: "platformSettings",
        entityId: PLATFORM_KEY,
        actorId: admin._id,
        actorType: "admin",
        previousValue,
        newValue: patchData,
      });
    } else {
      const newValue: Record<string, unknown> = {
        defaultTrialDays: args.defaultTrialDays,
      };
      if (args.enabledPlatformProviders !== undefined) {
        newValue.enabledPlatformProviders = args.enabledPlatformProviders;
      }
      if (args.stripePriceIds !== undefined) {
        newValue.stripePriceIds = args.stripePriceIds;
      }

      await db.insert("platformSettings", {
        key: PLATFORM_KEY,
        ...newValue,
      });

      await ctx.db.insert("auditLogs", {
        action: "PLATFORM_SETTINGS_CREATED",
        entityType: "platformSettings",
        entityId: PLATFORM_KEY,
        actorId: admin._id,
        actorType: "admin",
        newValue,
      });
    }

    return { success: true };
  },
});

// =============================================================================
// Seed (internal)
// =============================================================================

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
      return null;
    }

    await db.insert("platformSettings", {
      key: PLATFORM_KEY,
      defaultTrialDays: FALLBACK_TRIAL_DAYS,
      enabledPlatformProviders: [],
    });

    return null;
  },
});
