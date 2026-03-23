import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Internal query to find affiliates that have fraud signals without signalId.
 * Used by the migration action. Returns up to 50 affiliates per batch.
 */
export const getAffiliatesWithLegacySignals = internalQuery({
  args: { tenantId: v.optional(v.id("tenants")) },
  returns: v.array(
    v.object({
      _id: v.id("affiliates"),
      fraudSignals: v.optional(v.array(v.any())),
    })
  ),
  handler: async (ctx, args) => {
    let affiliates: Array<{ _id: Id<"affiliates">; fraudSignals?: any[] }>;

    if (args.tenantId) {
      // Query specific tenant
      const tid = args.tenantId;
      affiliates = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tid))
        .take(50);
    } else {
      // Query all affiliates — take first 50 from table scan
      affiliates = await ctx.db.query("affiliates").take(50);
    }

    // Filter to only those with fraud signals lacking signalId
    return affiliates.filter((affiliate) => {
      const signals = affiliate.fraudSignals;
      if (!signals || signals.length === 0) return false;
      return signals.some((s: any) => !s.signalId);
    });
  },
});

/**
 * Internal mutation to patch an affiliate's fraud signals array.
 * Used by the migration action.
 */
export const patchAffiliateFraudSignals = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    fraudSignals: v.array(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.affiliateId, { fraudSignals: args.fraudSignals });
    return null;
  },
});
