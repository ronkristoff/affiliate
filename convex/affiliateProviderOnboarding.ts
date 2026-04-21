import { query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getAffiliateByEmailInternal = internalQuery({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      status: v.string(),
      payoutProviderAccountId: v.optional(v.string()),
      payoutProviderType: v.optional(v.string()),
      payoutProviderStatus: v.optional(v.string()),
      payoutProviderEnabled: v.optional(v.boolean()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!affiliate) return null;
    return {
      _id: affiliate._id,
      tenantId: affiliate.tenantId,
      email: affiliate.email,
      name: affiliate.name,
      status: affiliate.status,
      payoutProviderAccountId: affiliate.payoutProviderAccountId,
      payoutProviderType: affiliate.payoutProviderType,
      payoutProviderStatus: affiliate.payoutProviderStatus,
      payoutProviderEnabled: affiliate.payoutProviderEnabled,
    };
  },
});

export const getAffiliateByIdInternal = internalQuery({
  args: { affiliateId: v.id("affiliates") },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      status: v.string(),
      payoutProviderAccountId: v.optional(v.string()),
      payoutProviderType: v.optional(v.string()),
      payoutProviderStatus: v.optional(v.string()),
      payoutProviderEnabled: v.optional(v.boolean()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) return null;
    return {
      _id: affiliate._id,
      tenantId: affiliate.tenantId,
      email: affiliate.email,
      name: affiliate.name,
      status: affiliate.status,
      payoutProviderAccountId: affiliate.payoutProviderAccountId,
      payoutProviderType: affiliate.payoutProviderType,
      payoutProviderStatus: affiliate.payoutProviderStatus,
      payoutProviderEnabled: affiliate.payoutProviderEnabled,
    };
  },
});

const CONSECUTIVE_FAILURE_THRESHOLD = 3;

export const getWebhookSignatureFailureCount = internalQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const recent = await ctx.db
      .query("errorLogs")
      .withIndex("by_source", (q) => q.eq("source", "providerWebhook:signature"))
      .order("desc")
      .take(CONSECUTIVE_FAILURE_THRESHOLD);

    let count = 0;
    for (const entry of recent) {
      if (entry.metadata?.type === "signature_failure" && !entry.resolved) {
        count++;
      } else {
        break;
      }
    }
    return count;
  },
});

export const recordWebhookSignatureFailure = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.db.insert("errorLogs", {
      severity: "warning",
      source: "providerWebhook:signature",
      message: "Stripe Connect webhook signature verification failed",
      metadata: { type: "signature_failure", timestamp: Date.now() },
    });
    return null;
  },
});

export const resetWebhookSignatureFailures = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const recent = await ctx.db
      .query("errorLogs")
      .withIndex("by_source", (q) => q.eq("source", "providerWebhook:signature"))
      .order("desc")
      .take(CONSECUTIVE_FAILURE_THRESHOLD);

    for (const entry of recent) {
      if (entry.metadata?.type === "signature_failure") {
        await ctx.db.patch(entry._id, { resolved: true, resolvedAt: Date.now() });
      } else {
        break;
      }
    }
    return null;
  },
});

export const getAffiliateByProviderAccountId = internalQuery({
  args: { payoutProviderAccountId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      tenantId: v.id("tenants"),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_payout_provider_account_id", (q) =>
        q.eq("payoutProviderAccountId", args.payoutProviderAccountId),
      )
      .first();
    if (!affiliate) return null;
    return {
      _id: affiliate._id,
      tenantId: affiliate.tenantId,
    };
  },
});

export const getTenantStripeConfigInternal = internalQuery({
  args: { tenantId: v.id("tenants") },
  returns: v.union(
    v.object({
      _id: v.id("tenants"),
      stripeAccountId: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return null;
    return {
      _id: tenant._id,
      stripeAccountId: tenant.stripeAccountId,
    };
  },
});

export const setAffiliateProviderAccount = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    payoutProviderAccountId: v.string(),
    payoutProviderType: v.string(),
    payoutProviderStatus: v.string(),
    payoutProviderEnabled: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: Record<string, any> = {
      payoutProviderAccountId: args.payoutProviderAccountId,
      payoutProviderType: args.payoutProviderType,
      payoutProviderStatus: args.payoutProviderStatus,
    };
    if (args.payoutProviderEnabled !== undefined) {
      patch.payoutProviderEnabled = args.payoutProviderEnabled;
    }
    await ctx.db.patch(args.affiliateId, patch);
    return null;
  },
});

export const setAffiliateProviderStatus = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    payoutProviderStatus: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.affiliateId, {
      payoutProviderStatus: args.payoutProviderStatus,
    });
    return null;
  },
});

export const setAffiliateProviderStatusDetails = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    payoutProviderStatus: v.string(),
    payoutProviderEnabled: v.boolean(),
    payoutProviderStatusDetails: v.optional(
      v.object({
        currentlyDue: v.optional(v.array(v.string())),
        eventuallyDue: v.optional(v.array(v.string())),
        pastDue: v.optional(v.array(v.string())),
        rejectionReason: v.optional(v.string()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: Record<string, any> = {
      payoutProviderStatus: args.payoutProviderStatus,
      payoutProviderEnabled: args.payoutProviderEnabled,
      payoutProviderStatusDetails: args.payoutProviderStatusDetails,
    };
    await ctx.db.patch(args.affiliateId, patch);
    return null;
  },
});

export const clearProviderAccount = internalMutation({
  args: { affiliateId: v.id("affiliates") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.affiliateId, {
      payoutProviderAccountId: undefined,
      payoutProviderType: undefined,
      payoutProviderStatus: undefined,
      payoutProviderEnabled: undefined,
      payoutProviderStatusDetails: undefined,
    });
    return null;
  },
});
