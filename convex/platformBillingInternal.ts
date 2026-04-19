/**
 * Internal queries and mutations for platform billing — runs in V8 context.
 * Actions cannot define queries/mutations, so these live in a separate file.
 */

import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getTenantById = internalQuery({
  args: { tenantId: v.id("tenants") },
  returns: v.union(
    v.object({
      _id: v.id("tenants"),
      _creationTime: v.number(),
      plan: v.string(),
      platformPaymentProvider: v.optional(v.union(v.literal("stripe"), v.literal("saligpay"))),
      stripeSubscriptionId: v.optional(v.string()),
      billingStartDate: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.tenantId);
  },
});

export const getUserBasic = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      tenantId: v.optional(v.id("tenants")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const markTenantCancelled = internalMutation({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return null;

    await ctx.db.patch(args.tenantId, {
      subscriptionStatus: "cancelled",
      cancellationDate: Date.now(),
      cancelledReason: "owner_cancelled" as const,
    });

    await ctx.db.insert("billingHistory", {
      tenantId: args.tenantId,
      event: "cancel",
      previousPlan: tenant.plan,
      newPlan: "cancelled",
      mockTransaction: false,
      timestamp: Date.now(),
      actorId: undefined,
    });

    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "SUBSCRIPTION_CANCELLATION",
      entityType: "tenant",
      entityId: args.tenantId,
      actorType: "system",
      previousValue: { subscriptionStatus: "active" },
      newValue: {
        subscriptionStatus: "cancelled",
        cancelledReason: "owner_cancelled",
        provider: "stripe",
      },
    });
  },
});

export const getTenantByStripeSubscriptionId = internalQuery({
  args: { stripeSubscriptionId: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("tenants"),
      plan: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_stripeSubscriptionId", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();
    if (!tenant) return null;
    return { _id: tenant._id, plan: tenant.plan };
  },
});

export const syncStripeSubscriptionToTenant = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    status: v.string(),
    priceId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    userId: v.optional(v.string()),
    plan: v.optional(v.string()),
    tenantId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.userId || !args.tenantId) {
      return null;
    }

    const tenant = await ctx.db.get(args.tenantId as any);
    if (!tenant) {
      return null;
    }

    const patchData: Record<string, unknown> = {
      stripeSubscriptionId: args.stripeSubscriptionId,
      platformPaymentProvider: "stripe" as const,
    };

    if (args.currentPeriodEnd) {
      patchData.billingEndDate = args.currentPeriodEnd;
    }

    const subscriptionStatusMap: Record<string, string> = {
      active: "active",
      trialing: "active",
      past_due: "past_due",
      canceled: "cancelled",
      unpaid: "past_due",
      incomplete: "past_due",
      incomplete_expired: "cancelled",
    };

    if (args.status in subscriptionStatusMap) {
      patchData.subscriptionStatus = subscriptionStatusMap[args.status];
    }

    if (args.cancelAtPeriodEnd && (args.status === "active" || args.status === "trialing")) {
      patchData.subscriptionStatus = "cancelled";
      patchData.cancellationDate = Date.now();
      patchData.cancelledReason = "owner_cancelled" as const;
    }

    if (args.status === "canceled" || args.status === "incomplete_expired") {
      patchData.cancellationDate = Date.now();
      patchData.cancelledReason = "owner_cancelled" as const;
    }

    if (args.plan && args.plan !== (tenant as any).plan) {
      patchData.plan = args.plan;
    }

    const isActiveSubscription = args.status === "active" || args.status === "trialing";
    if (isActiveSubscription && (tenant as any).trialEndsAt) {
      patchData.trialEndsAt = undefined;
      if (!(tenant as any).billingStartDate) {
        patchData.billingStartDate = Date.now();
      }
    }

    await ctx.db.patch(args.tenantId as any, patchData);

    await ctx.db.insert("billingHistory", {
      tenantId: args.tenantId as any,
      event: "stripe_webhook",
      plan: patchData.plan ?? (tenant as any).plan,
      timestamp: Date.now(),
      actorId: undefined,
    });

    return null;
  },
});
