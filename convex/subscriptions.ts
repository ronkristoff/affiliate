/**
 * Subscription Management Module
 *
 * Provides subscription upgrade, downgrade, and status management.
 * Plans are fully dynamic — validated against tierConfigs table.
 * Platform billing is handled via platformBilling.ts (Stripe/SaligPay).
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAuthenticatedUser } from "./tenantContext";
import { sendUpgradeConfirmation, sendDowngradeConfirmation, sendCancellationConfirmation, sendPaymentSuccessEmail } from "./email";
import { internal } from "./_generated/api";

const BILLING_CYCLE_DAYS = 30;

/**
 * Get current subscription status for the authenticated user's tenant.
 */
export const getCurrentSubscription = query({
  args: {},
  returns: v.union(
    v.object({
      plan: v.string(),
      isTrial: v.boolean(),
      trialEndsAt: v.optional(v.number()),
      trialDaysRemaining: v.optional(v.number()),
      subscriptionStatus: v.optional(v.union(
        v.literal("trial"),
        v.literal("active"),
        v.literal("cancelled"),
        v.literal("past_due")
      )),
      billingStartDate: v.optional(v.number()),
      billingEndDate: v.optional(v.number()),
      subscriptionId: v.optional(v.string()),
      cancellationDate: v.optional(v.number()),
      cancelledReason: v.optional(v.union(
        v.literal("grace_expired"),
        v.literal("trial_expired"),
        v.literal("admin_cancelled"),
        v.literal("owner_cancelled"),
      )),
      deletionScheduledDate: v.optional(v.number()),
      platformPaymentProvider: v.optional(v.union(
        v.literal("stripe"),
        v.literal("saligpay"),
      )),
    }),
    v.null()
  ),
  handler: async (ctx, _args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      return null;
    }

    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      return null;
    }

    const now = Date.now();
    const isTrial = tenant.trialEndsAt ? tenant.trialEndsAt > now : false;
    const trialDaysRemaining = tenant.trialEndsAt && isTrial
      ? Math.ceil((tenant.trialEndsAt - now) / (24 * 60 * 60 * 1000))
      : undefined;

    let subscriptionStatus: "trial" | "active" | "cancelled" | "past_due" | undefined;
    if (isTrial) {
      subscriptionStatus = "trial";
    } else if (tenant.subscriptionStatus === "active" || tenant.subscriptionStatus === "cancelled" || tenant.subscriptionStatus === "past_due") {
      subscriptionStatus = tenant.subscriptionStatus;
    } else {
      const defaultPlanName = await (async () => {
        const dt = await ctx.db.query("tierConfigs").withIndex("by_default", (q: any) => q.eq("isDefault", true)).first();
        return (dt && dt.isActive) ? dt.tier : "starter";
      })();
      if (tenant.plan && tenant.plan !== defaultPlanName) {
        subscriptionStatus = "active";
      }
    }

    return {
      plan: tenant.plan,
      isTrial,
      trialEndsAt: tenant.trialEndsAt,
      trialDaysRemaining,
      subscriptionStatus,
      billingStartDate: tenant.billingStartDate,
      billingEndDate: tenant.billingEndDate,
      subscriptionId: tenant.subscriptionId,
      cancellationDate: tenant.cancellationDate,
      cancelledReason: tenant.cancelledReason as "grace_expired" | "trial_expired" | "admin_cancelled" | "owner_cancelled" | undefined,
      deletionScheduledDate: undefined,
      platformPaymentProvider: tenant.platformPaymentProvider ?? undefined,
    };
  },
});

export const getBillingHistory = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("billingHistory"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      event: v.string(),
      plan: v.optional(v.string()),
      previousPlan: v.optional(v.string()),
      newPlan: v.optional(v.string()),
      amount: v.optional(v.number()),
      proratedAmount: v.optional(v.number()),
      transactionId: v.optional(v.string()),
      mockTransaction: v.optional(v.boolean()),
      timestamp: v.number(),
      actorId: v.optional(v.id("users")),
    })),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
    pageStatus: v.optional(v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      return { page: [], continueCursor: undefined, isDone: true };
    }

    return await ctx.db
      .query("billingHistory")
      .withIndex("by_tenant_and_time", (q) => q.eq("tenantId", authUser.tenantId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const getUsageStats = query({
  args: {},
  returns: v.object({
    affiliates: v.number(),
    campaigns: v.number(),
    teamMembers: v.number(),
  }),
  handler: async (ctx, _args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      return { affiliates: 0, campaigns: 0, teamMembers: 0 };
    }

    const [affiliates, campaigns, users] = await Promise.all([
      ctx.db
        .query("affiliates")
        .withIndex("by_tenant", (q) => q.eq("tenantId", authUser.tenantId))
        .collect(),
      ctx.db
        .query("campaigns")
        .withIndex("by_tenant", (q) => q.eq("tenantId", authUser.tenantId))
        .collect(),
      ctx.db
        .query("users")
        .withIndex("by_tenant", (q) => q.eq("tenantId", authUser.tenantId))
        .collect(),
    ]);

    return {
      affiliates: affiliates.length,
      campaigns: campaigns.length,
      teamMembers: users.length,
    };
  },
});

/**
 * Upgrade subscription to a paid plan.
 * Validates that the plan exists in tierConfigs.
 */
export const upgradeSubscription = mutation({
  args: {
    plan: v.string(),
    mockPayment: v.boolean(),
  },
  returns: v.object({
    success: v.boolean(),
    transactionId: v.string(),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const previousPlan = tenant.plan;

    const targetTierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.plan))
      .unique();

    if (!targetTierConfig) {
      throw new Error(`Plan "${args.plan}" not found`);
    }

    if (!targetTierConfig.isActive) {
      throw new Error(`Plan "${args.plan}" is not available`);
    }

    if (tenant.plan === args.plan) {
      throw new Error(`You are already on the ${args.plan} plan`);
    }

    const billingStartDate = Date.now();
    const billingEndDate = billingStartDate + (BILLING_CYCLE_DAYS * 24 * 60 * 60 * 1000);

    const transactionId = args.mockPayment
      ? `mock_sub_${Date.now()}`
      : `sub_${Date.now()}`;

    await ctx.db.patch(authUser.tenantId, {
      plan: args.plan,
      trialEndsAt: undefined,
      billingStartDate,
      billingEndDate,
      subscriptionStatus: "active",
      subscriptionId: transactionId,
    });

    await ctx.db.insert("billingHistory", {
      tenantId: authUser.tenantId,
      event: "upgrade",
      previousPlan,
      newPlan: args.plan,
      amount: targetTierConfig.price,
      transactionId,
      mockTransaction: args.mockPayment,
      timestamp: Date.now(),
      actorId: authUser.userId,
    });

    await ctx.db.insert("auditLogs", {
      tenantId: authUser.tenantId,
      action: "SUBSCRIPTION_UPGRADE",
      entityType: "tenant",
      entityId: authUser.tenantId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { plan: previousPlan },
      newValue: {
        plan: args.plan,
        billingStartDate,
        billingEndDate,
        transactionId,
        mockTransaction: args.mockPayment,
      },
    });

    try {
      await ctx.runMutation(internal.notifications.createNotification, {
        tenantId: authUser.tenantId,
        userId: authUser.userId,
        type: "billing.upgraded",
        title: "Plan Upgraded",
        message: `Your plan has been upgraded to ${args.plan.charAt(0).toUpperCase() + args.plan.slice(1)}.`,
        severity: "info",
        actionUrl: "/settings/billing",
        actionLabel: "View Billing",
      });
    } catch {}

    return { success: true, transactionId };
  },
});

/**
 * Cancel subscription - ends billing but allows access until billing cycle ends.
 * For Stripe-backed subscriptions, use cancelPlatformSubscriptionAndSyncTenant action instead.
 */
export const cancelSubscription = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    accessEndDate: v.number(),
    stripeCancelled: v.boolean(),
  }),
  handler: async (ctx, _args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    if (tenant.platformPaymentProvider === "stripe" && tenant.stripeSubscriptionId) {
      throw new Error(
        "Use cancelPlatformSubscriptionAndSyncTenant action for Stripe subscriptions."
      );
    }

    const currentPlan = tenant.plan || await (async () => {
      const dt = await ctx.db.query("tierConfigs").withIndex("by_default", (q: any) => q.eq("isDefault", true)).first();
      return dt?.tier ?? "starter";
    })();
    const currentStatus = tenant.subscriptionStatus || "active";

    if (currentStatus !== "active") {
      throw new Error(`Cannot cancel subscription with status: ${currentStatus}`);
    }

    const accessEndDate = tenant.billingEndDate || Date.now();

    let stripeCancelled = false;

    await ctx.db.patch(authUser.tenantId, {
      subscriptionStatus: "cancelled",
      cancellationDate: Date.now(),
      cancelledReason: "owner_cancelled" as const,
    });

    await ctx.db.insert("billingHistory", {
      tenantId: authUser.tenantId,
      event: "cancel",
      previousPlan: currentPlan,
      newPlan: "cancelled",
      mockTransaction: false,
      timestamp: Date.now(),
      actorId: authUser.userId,
    });

    await ctx.db.insert("auditLogs", {
      tenantId: authUser.tenantId,
      action: "SUBSCRIPTION_CANCELLATION",
      entityType: "tenant",
      entityId: authUser.tenantId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: {
        plan: currentPlan,
        subscriptionStatus: "active",
      },
      newValue: {
        subscriptionStatus: "cancelled",
        cancelledReason: "owner_cancelled",
        accessEndDate,
        stripeCancelled,
      },
    });

    const user = await ctx.db.get(authUser.userId);
    if (user?.email) {
      await sendCancellationConfirmation(ctx, {
        to: user.email,
        previousPlan: currentPlan,
        accessEndDate,
        tenantId: authUser.tenantId,
      });
    }

    try {
      await ctx.runMutation(internal.notifications.createNotification, {
        tenantId: authUser.tenantId,
        userId: authUser.userId,
        type: "billing.cancelled",
        title: "Subscription Cancelled",
        message: "Your subscription has been cancelled. Your account is now read-only.",
        severity: "warning",
        actionUrl: "/settings/billing",
        actionLabel: "View Billing Settings",
      });
    } catch {}

    return {
      success: true,
      accessEndDate,
      stripeCancelled,
    };
  },
});

/**
 * Convert trial subscription to a paid plan.
 * Validates that the plan exists in tierConfigs.
 */
export const convertTrialToPaid = mutation({
  args: {
    plan: v.string(),
    mockPayment: v.boolean(),
  },
  returns: v.object({
    success: v.boolean(),
    transactionId: v.string(),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const now = Date.now();
    const isTrialActive = tenant.trialEndsAt ? tenant.trialEndsAt > now : false;
    const isTrialStatus = tenant.subscriptionStatus === "trial";

    if (!isTrialActive && !isTrialStatus) {
      throw new Error("Tenant is not on an active trial");
    }

    const targetTierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.plan))
      .unique();

    if (!targetTierConfig) {
      throw new Error(`Plan "${args.plan}" not found`);
    }

    if (!targetTierConfig.isActive) {
      throw new Error(`Plan "${args.plan}" is not available`);
    }

    if (tenant.plan === args.plan) {
      throw new Error(`You are already on the ${args.plan} plan`);
    }

    const previousPlan = tenant.plan || await (async () => {
      const dt = await ctx.db.query("tierConfigs").withIndex("by_default", (q: any) => q.eq("isDefault", true)).first();
      return dt?.tier ?? "starter";
    })();

    const billingStartDate = Date.now();
    const billingEndDate = billingStartDate + (BILLING_CYCLE_DAYS * 24 * 60 * 60 * 1000);

    const transactionId = args.mockPayment
      ? `mock_trial_${Date.now()}`
      : `trial_${Date.now()}`;

    await ctx.db.patch(authUser.tenantId, {
      plan: args.plan,
      trialEndsAt: undefined,
      billingStartDate,
      billingEndDate,
      subscriptionStatus: "active",
      subscriptionId: transactionId,
    });

    await ctx.db.insert("billingHistory", {
      tenantId: authUser.tenantId,
      event: "trial_conversion",
      previousPlan,
      newPlan: args.plan,
      amount: targetTierConfig.price,
      transactionId,
      mockTransaction: args.mockPayment,
      timestamp: Date.now(),
      actorId: authUser.userId,
    });

    await ctx.db.insert("auditLogs", {
      tenantId: authUser.tenantId,
      action: "TRIAL_CONVERSION",
      entityType: "tenant",
      entityId: authUser.tenantId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: {
        plan: previousPlan,
        subscriptionStatus: "trial",
      },
      newValue: {
        plan: args.plan,
        subscriptionStatus: "active",
        billingStartDate,
        billingEndDate,
        transactionId,
        mockTransaction: args.mockPayment,
      },
    });

    try {
      await ctx.runMutation(internal.notifications.createNotification, {
        tenantId: authUser.tenantId,
        userId: authUser.userId,
        type: "billing.recovered",
        title: "Trial Converted to Paid",
        message: `Your trial has been successfully converted to the ${args.plan} plan. Welcome!`,
        severity: "success",
        actionUrl: "/settings/billing",
        actionLabel: "View Billing",
      });
    } catch {}

    const ownerUser = await ctx.db.get(authUser.userId);
    if (ownerUser?.email) {
      await sendPaymentSuccessEmail(ctx, {
        to: ownerUser.email,
        tenantName: tenant.name,
        plan: args.plan,
        amount: targetTierConfig.price,
        billingStartDate,
        billingEndDate,
        transactionId,
        tenantId: authUser.tenantId,
      });
    }

    return { success: true, transactionId };
  },
});

function calculateProratedUpgrade(
  oldPrice: number,
  newPrice: number,
  billingStartDate: number,
  billingEndDate: number
): { proratedAmount: number; newBillingStart: number; newBillingEnd: number } {
  const now = Date.now();
  const totalCycleMs = billingEndDate - billingStartDate;
  const remainingMs = billingEndDate - now;
  const remainingDays = Math.max(0, remainingMs / (1000 * 60 * 60 * 24));

  const monthlyDifference = newPrice - oldPrice;
  const dailyDifference = monthlyDifference / 30;
  const proratedAmount = Math.ceil(dailyDifference * remainingDays);

  const newBillingStart = now;
  const newBillingEnd = now + (30 * 24 * 60 * 60 * 1000);

  return { proratedAmount, newBillingStart, newBillingEnd };
}

/**
 * Upgrade subscription tier with prorated billing.
 * Validates that target plan exists in tierConfigs and is more expensive than current.
 */
export const upgradeTier = mutation({
  args: {
    targetPlan: v.string(),
    mockPayment: v.boolean(),
  },
  returns: v.object({
    success: v.boolean(),
    transactionId: v.string(),
    proratedAmount: v.number(),
    newBillingEndDate: v.number(),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const currentPlan = tenant.plan || await (async () => {
      const dt = await ctx.db.query("tierConfigs").withIndex("by_default", (q: any) => q.eq("isDefault", true)).first();
      return dt?.tier ?? "starter";
    })();

    const currentTierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", currentPlan))
      .unique();

    const targetTierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.targetPlan))
      .unique();

    if (!targetTierConfig) {
      throw new Error(`Plan "${args.targetPlan}" not found`);
    }

    if (!targetTierConfig.isActive) {
      throw new Error(`Plan "${args.targetPlan}" is not available`);
    }

    if (currentPlan === args.targetPlan) {
      throw new Error(`You are already on the ${args.targetPlan} plan`);
    }

    if (tenant.subscriptionStatus === "cancelled") {
      throw new Error("Cannot upgrade a cancelled subscription. Please reactivate first.");
    }

    const oldPrice = currentTierConfig?.price || 0;
    const newPrice = targetTierConfig.price;

    if (newPrice <= oldPrice) {
      throw new Error("Cannot upgrade to a plan that costs the same or less. Use the downgrade flow instead.");
    }

    const billingStart = tenant.billingStartDate || Date.now();
    const billingEnd = tenant.billingEndDate || (Date.now() + 30 * 24 * 60 * 60 * 1000);

    const { proratedAmount, newBillingStart, newBillingEnd } = calculateProratedUpgrade(
      oldPrice,
      newPrice,
      billingStart,
      billingEnd
    );

    const transactionId = args.mockPayment
      ? `mock_upgrade_${Date.now()}`
      : `upgrade_${Date.now()}`;

    await ctx.db.patch(authUser.tenantId, {
      plan: args.targetPlan,
      billingStartDate: newBillingStart,
      billingEndDate: newBillingEnd,
      subscriptionStatus: "active",
      subscriptionId: transactionId,
    });

    await ctx.db.insert("billingHistory", {
      tenantId: authUser.tenantId,
      event: "upgrade",
      previousPlan: currentPlan,
      newPlan: args.targetPlan,
      amount: newPrice,
      proratedAmount,
      transactionId,
      mockTransaction: args.mockPayment,
      timestamp: Date.now(),
      actorId: authUser.userId,
    });

    await ctx.db.insert("auditLogs", {
      tenantId: authUser.tenantId,
      action: "SUBSCRIPTION_UPGRADE",
      entityType: "tenant",
      entityId: authUser.tenantId,
      actorType: "user",
      actorId: authUser.userId,
      previousValue: {
        plan: currentPlan,
        billingStartDate: billingStart,
        billingEndDate: billingEnd,
      },
      newValue: {
        plan: args.targetPlan,
        billingStartDate: newBillingStart,
        billingEndDate: newBillingEnd,
        proratedAmount,
        transactionId,
      },
    });

    const user = await ctx.db.get(authUser.userId);
    if (user?.email) {
      await sendUpgradeConfirmation(ctx, {
        to: user.email,
        previousPlan: currentPlan,
        newPlan: args.targetPlan,
        proratedAmount,
        effectiveDate: newBillingStart,
        newBillingAmount: newPrice,
        tenantId: authUser.tenantId,
      });

      await sendPaymentSuccessEmail(ctx, {
        to: user.email,
        tenantName: tenant.name,
        plan: args.targetPlan,
        amount: proratedAmount,
        billingStartDate: newBillingStart,
        billingEndDate: newBillingEnd,
        transactionId,
        tenantId: authUser.tenantId,
      });
    }

    try {
      await ctx.runMutation(internal.notifications.createNotification, {
        tenantId: authUser.tenantId,
        userId: authUser.userId,
        type: "billing.upgraded",
        title: "Plan Upgraded",
        message: `Your plan has been upgraded from ${currentPlan} to ${args.targetPlan}.`,
        severity: "info",
        actionUrl: "/settings/billing",
        actionLabel: "View Billing",
      });
    } catch {}

    return {
      success: true,
      transactionId,
      proratedAmount,
      newBillingEndDate: newBillingEnd,
    };
  },
});

/**
 * Downgrade subscription tier.
 * Validates that target plan exists in tierConfigs and is less expensive than current.
 * Downgrades take effect immediately but billing changes at next cycle (no proration).
 */
export const downgradeTier = mutation({
  args: {
    targetPlan: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    transactionId: v.string(),
    effectiveDate: v.number(),
    newPlan: v.string(),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const currentPlan = tenant.plan || await (async () => {
      const dt = await ctx.db.query("tierConfigs").withIndex("by_default", (q: any) => q.eq("isDefault", true)).first();
      return dt?.tier ?? "starter";
    })();

    const currentTierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", currentPlan))
      .unique();

    const targetTierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.targetPlan))
      .unique();

    if (!targetTierConfig) {
      throw new Error(`Plan "${args.targetPlan}" not found`);
    }

    if (!targetTierConfig.isActive) {
      throw new Error(`Plan "${args.targetPlan}" is not available`);
    }

    if (currentPlan === args.targetPlan) {
      throw new Error(`You are already on the ${args.targetPlan} plan`);
    }

    if (tenant.subscriptionStatus === "cancelled") {
      throw new Error("Cannot downgrade a cancelled subscription");
    }

    const currentPrice = currentTierConfig?.price || 0;
    const targetPrice = targetTierConfig.price;

    if (targetPrice >= currentPrice) {
      throw new Error("Cannot downgrade to a plan that costs the same or more. Use the upgrade flow instead.");
    }

    const effectiveDate = tenant.billingEndDate || Date.now();
    const transactionId = `downgrade_${Date.now()}`;

    await ctx.db.patch(authUser.tenantId, {
      plan: args.targetPlan,
      subscriptionStatus: "active",
      subscriptionId: transactionId,
    });

    await ctx.db.insert("billingHistory", {
      tenantId: authUser.tenantId,
      event: "downgrade",
      previousPlan: currentPlan,
      newPlan: args.targetPlan,
      amount: targetTierConfig.price,
      transactionId,
      mockTransaction: false,
      timestamp: Date.now(),
      actorId: authUser.userId,
    });

    await ctx.db.insert("auditLogs", {
      tenantId: authUser.tenantId,
      action: "SUBSCRIPTION_DOWNGRADE",
      entityType: "tenant",
      entityId: authUser.tenantId,
      actorType: "user",
      actorId: authUser.userId,
      previousValue: {
        plan: currentPlan,
        billingEndDate: tenant.billingEndDate,
      },
      newValue: {
        plan: args.targetPlan,
        effectiveDate,
        newBillingAmount: targetTierConfig.price,
      },
    });

    const user = await ctx.db.get(authUser.userId);
    if (user?.email) {
      await sendDowngradeConfirmation(ctx, {
        to: user.email,
        previousPlan: currentPlan,
        newPlan: args.targetPlan,
        effectiveDate,
        newBillingAmount: targetTierConfig.price,
        tenantId: authUser.tenantId,
      });
    }

    try {
      await ctx.runMutation(internal.notifications.createNotification, {
        tenantId: authUser.tenantId,
        userId: authUser.userId,
        type: "billing.downgraded",
        title: "Plan Downgraded",
        message: `Your plan has been downgraded from ${currentPlan} to ${args.targetPlan}. Changes take effect at next billing cycle.`,
        severity: "info",
        actionUrl: "/settings/billing",
        actionLabel: "View Billing",
      });
    } catch {}

    return {
      success: true,
      transactionId,
      effectiveDate,
      newPlan: args.targetPlan,
    };
  },
});
