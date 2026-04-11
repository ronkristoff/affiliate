/**
 * Subscription Management Module
 * 
 * Provides subscription upgrade, downgrade, and status management.
 * Supports mock payment processing for testing.
 * 
 * @see Story 3.1: Mock Subscription Checkout
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAuthenticatedUser } from "./tenantContext";
import { sendUpgradeConfirmation, sendDowngradeConfirmation, sendCancellationConfirmation, sendPaymentSuccessEmail } from "./email";
import { internal } from "./_generated/api";

/**
 * Billing cycle duration in days
 */
const BILLING_CYCLE_DAYS = 30;

/**
 * Plan type for subscriptions
 */
export type PlanType = "starter" | "growth" | "scale";

/**
 * Get current subscription status for the authenticated user's tenant.
 * Returns subscription details including plan, trial status, and billing dates.
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

    // Determine subscription status
    let subscriptionStatus: "trial" | "active" | "cancelled" | "past_due" | undefined;
    if (isTrial) {
      subscriptionStatus = "trial";
    } else if (tenant.subscriptionStatus === "active" || tenant.subscriptionStatus === "cancelled" || tenant.subscriptionStatus === "past_due") {
      subscriptionStatus = tenant.subscriptionStatus;
    } else if (tenant.plan !== "starter") {
      subscriptionStatus = "active";
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
    };
  },
});

/**
 * Get billing history for the authenticated user's tenant.
 * Returns paginated results for the billing history table.
 */
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

/**
 * Get usage statistics for the authenticated user's tenant.
 * Returns current counts of affiliates, campaigns, and team members.
 * AC3: Plan Limits and Usage
 */
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

    // Run all queries in parallel for better performance
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
 * Upgrade subscription to a paid plan (Growth or Scale).
 * Supports mock payment for testing purposes.
 * 
 * @param plan - The plan to upgrade to (growth or scale)
 * @param mockPayment - Whether to use mock payment processing
 */
export const upgradeSubscription = mutation({
  args: {
    plan: v.union(v.literal("growth"), v.literal("scale")),
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

    // Store previous plan for audit
    const previousPlan = tenant.plan;

    // Validate plan is valid
    if (args.plan !== "growth" && args.plan !== "scale") {
      throw new Error("Invalid plan selected");
    }

    // Prevent upgrading to the same plan
    if (tenant.plan === args.plan) {
      throw new Error(`You are already on the ${args.plan} plan`);
    }

    // Get tier config for pricing
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.plan))
      .unique();

    if (!tierConfig) {
      throw new Error("Tier configuration not found");
    }

    // Calculate billing dates
    const billingStartDate = Date.now();
    const billingEndDate = billingStartDate + (BILLING_CYCLE_DAYS * 24 * 60 * 60 * 1000);

    // Generate mock transaction ID
    const transactionId = args.mockPayment 
      ? `mock_sub_${Date.now()}`
      : `sub_${Date.now()}`;

    // Update tenant subscription
    await ctx.db.patch(authUser.tenantId, {
      plan: args.plan,
      trialEndsAt: undefined, // Remove trial
      billingStartDate,
      billingEndDate,
      subscriptionStatus: "active",
      subscriptionId: transactionId,
    });

    // Log to billing history
    await ctx.db.insert("billingHistory", {
      tenantId: authUser.tenantId,
      event: "upgrade",
      previousPlan,
      newPlan: args.plan,
      amount: tierConfig.price,
      transactionId,
      mockTransaction: args.mockPayment,
      timestamp: Date.now(),
      actorId: authUser.userId,
    });

    // Log to audit
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
 * Data is deleted 30 days after the billing cycle ends.
 */
export const cancelSubscription = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    accessEndDate: v.number(),
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

    const currentPlan = (tenant.plan || "starter") as "starter" | "growth" | "scale";
    const currentStatus = tenant.subscriptionStatus || "active";

    // Validate subscription is active (not already cancelled)
    if (currentStatus !== "active") {
      throw new Error(`Cannot cancel subscription with status: ${currentStatus}`);
    }

    // Get access end date (current billing cycle end)
    const accessEndDate = tenant.billingEndDate || Date.now();

    // Update tenant subscription - keep plan but mark as cancelled
    // billingEndDate remains unchanged - access until cycle ends
    await ctx.db.patch(authUser.tenantId, {
      subscriptionStatus: "cancelled",
      cancellationDate: Date.now(),
      cancelledReason: "owner_cancelled" as const,
      // Plan remains unchanged - access continues until billingEndDate
    });

    // Log to billing history
    await ctx.db.insert("billingHistory", {
      tenantId: authUser.tenantId,
      event: "cancel",
      previousPlan: currentPlan,
      newPlan: "cancelled",
      mockTransaction: false,
      timestamp: Date.now(),
      actorId: authUser.userId,
    });

    // Log to audit trail
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
      },
    });

    // Send confirmation email
    const user = await ctx.db.get(authUser.userId);
    if (user?.email) {
      await sendCancellationConfirmation(ctx, {
        to: user.email,
        previousPlan: currentPlan,
        accessEndDate,
        tenantId: authUser.tenantId,
      });
    }

    // Send in-app notification
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

    return {
      success: true,
      accessEndDate,
    };
  },
});

/**
 * Convert trial subscription to a paid plan (Growth or Scale).
 * Called when a trial user upgrades to a paid plan.
 * 
 * @param plan - The plan to convert to (growth or scale)
 * @param mockPayment - Whether to use mock payment processing
 */
export const convertTrialToPaid = mutation({
  args: {
    plan: v.union(v.literal("growth"), v.literal("scale")),
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

    // Verify tenant is on trial (check both subscriptionStatus and trialEndsAt)
    const now = Date.now();
    const isTrialActive = tenant.trialEndsAt ? tenant.trialEndsAt > now : false;
    const isTrialStatus = tenant.subscriptionStatus === "trial";
    
    if (!isTrialActive && !isTrialStatus) {
      throw new Error("Tenant is not on an active trial");
    }

    // Validate plan
    if (args.plan !== "growth" && args.plan !== "scale") {
      throw new Error("Invalid plan selected. Only 'growth' or 'scale' plans are valid for trial conversion.");
    }

    // Prevent converting to the same plan
    if (tenant.plan === args.plan) {
      throw new Error(`You are already on the ${args.plan} plan`);
    }

    // Store previous plan for audit
    const previousPlan = tenant.plan || "starter";

    // Get tier config for pricing
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.plan))
      .unique();

    if (!tierConfig) {
      throw new Error("Tier configuration not found");
    }

    // Calculate billing dates
    const billingStartDate = Date.now();
    const billingEndDate = billingStartDate + (BILLING_CYCLE_DAYS * 24 * 60 * 60 * 1000);

    // Generate mock transaction ID
    const transactionId = args.mockPayment
      ? `mock_trial_${Date.now()}`
      : `trial_${Date.now()}`;

    // Update tenant subscription from trial to active
    await ctx.db.patch(authUser.tenantId, {
      plan: args.plan,
      trialEndsAt: undefined, // Clear trial end date
      billingStartDate,
      billingEndDate,
      subscriptionStatus: "active",
      subscriptionId: transactionId,
    });

    // Log to billing history as trial_conversion
    await ctx.db.insert("billingHistory", {
      tenantId: authUser.tenantId,
      event: "trial_conversion",
      previousPlan,
      newPlan: args.plan,
      amount: tierConfig.price,
      transactionId,
      mockTransaction: args.mockPayment,
      timestamp: Date.now(),
      actorId: authUser.userId,
    });

    // Log to audit trail with conversion metadata
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

    // Send payment success confirmation email
    const ownerUser = await ctx.db.get(authUser.userId);
    if (ownerUser?.email) {
      await sendPaymentSuccessEmail(ctx, {
        to: ownerUser.email,
        tenantName: tenant.name,
        plan: args.plan,
        amount: tierConfig.price,
        billingStartDate,
        billingEndDate,
        transactionId,
        tenantId: authUser.tenantId,
      });
    }

    return { success: true, transactionId };
  },
});

/**
 * Calculate prorated upgrade amount and new billing dates.
 *
 * @param oldPrice - Current plan price
 * @param newPrice - Target plan price
 * @param billingStartDate - Current billing cycle start timestamp
 * @param billingEndDate - Current billing cycle end timestamp
 * @returns Object with prorated amount and new billing dates
 */
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

  // Calculate prorated difference: (newPrice - oldPrice) * (daysRemaining / 30)
  const monthlyDifference = newPrice - oldPrice;
  const dailyDifference = monthlyDifference / 30;
  const proratedAmount = Math.ceil(dailyDifference * remainingDays);

  // New billing cycle starts now
  const newBillingStart = now;
  const newBillingEnd = now + (30 * 24 * 60 * 60 * 1000);

  return { proratedAmount, newBillingStart, newBillingEnd };
}

/**
 * Upgrade subscription tier with prorated billing.
 * Supports upgrading from Starter→Growth, Starter→Scale, or Growth→Scale.
 *
 * @param targetPlan - The plan to upgrade to (growth or scale)
 * @param mockPayment - Whether to use mock payment processing
 */
export const upgradeTier = mutation({
  args: {
    targetPlan: v.union(v.literal("growth"), v.literal("scale")),
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

    const currentPlan = (tenant.plan || "starter") as "starter" | "growth" | "scale";

    // Validate upgrade path
    const upgradePaths: Record<string, string[]> = {
      starter: ["growth", "scale"],
      growth: ["scale"],
      scale: [],
    };

    if (!upgradePaths[currentPlan]?.includes(args.targetPlan)) {
      throw new Error(`Cannot upgrade from ${currentPlan} to ${args.targetPlan}`);
    }

    // Prevent upgrading to same plan
    if (currentPlan === args.targetPlan) {
      throw new Error(`You are already on the ${args.targetPlan} plan`);
    }

    // Prevent upgrades on cancelled subscriptions
    if (tenant.subscriptionStatus === "cancelled") {
      throw new Error("Cannot upgrade a cancelled subscription. Please reactivate first.");
    }

    // Get tier configs for pricing
    const currentTierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", currentPlan))
      .unique();

    const targetTierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.targetPlan))
      .unique();

    if (!targetTierConfig) {
      throw new Error("Target tier configuration not found");
    }

    // Calculate prorated amount
    const oldPrice = currentTierConfig?.price || 0;
    const newPrice = targetTierConfig.price;
    const billingStart = tenant.billingStartDate || Date.now();
    const billingEnd = tenant.billingEndDate || (Date.now() + 30 * 24 * 60 * 60 * 1000);

    const { proratedAmount, newBillingStart, newBillingEnd } = calculateProratedUpgrade(
      oldPrice,
      newPrice,
      billingStart,
      billingEnd
    );

    // Generate transaction ID
    const transactionId = args.mockPayment
      ? `mock_upgrade_${Date.now()}`
      : `upgrade_${Date.now()}`;

    // Update tenant subscription
    await ctx.db.patch(authUser.tenantId, {
      plan: args.targetPlan,
      billingStartDate: newBillingStart,
      billingEndDate: newBillingEnd,
      subscriptionStatus: "active",
      subscriptionId: transactionId,
    });

    // Log to billing history with prorated amount
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

    // Log to audit trail
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

    // Send confirmation email
    // Get the user's email for the notification
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

      // Send payment success confirmation email
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
 * Supports downgrading from Scale→Growth, Scale→Starter, or Growth→Starter.
 * Downgrades take effect immediately but billing changes at next cycle (no proration).
 *
 * @param targetPlan - The plan to downgrade to (growth or starter)
 */
export const downgradeTier = mutation({
  args: {
    targetPlan: v.union(v.literal("growth"), v.literal("starter")),
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

    const currentPlan = (tenant.plan || "starter") as "starter" | "growth" | "scale";

    // Validate downgrade path
    const downgradePaths: Record<string, string[]> = {
      scale: ["growth", "starter"],
      growth: ["starter"],
      starter: [],
    };

    if (!downgradePaths[currentPlan]?.includes(args.targetPlan)) {
      throw new Error(`Cannot downgrade from ${currentPlan} to ${args.targetPlan}`);
    }

    // Prevent downgrading to same plan
    if (currentPlan === args.targetPlan) {
      throw new Error(`You are already on the ${args.targetPlan} plan`);
    }

    // Prevent downgrades on cancelled subscriptions
    if (tenant.subscriptionStatus === "cancelled") {
      throw new Error("Cannot downgrade a cancelled subscription");
    }

    // Get tier configs for pricing
    const targetTierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.targetPlan))
      .unique();

    if (!targetTierConfig) {
      throw new Error("Target tier configuration not found");
    }

    // Downgrade takes effect immediately but billing changes at next cycle
    const effectiveDate = tenant.billingEndDate || Date.now();

    // Generate transaction ID
    const transactionId = `downgrade_${Date.now()}`;

    // Update tenant subscription
    await ctx.db.patch(authUser.tenantId, {
      plan: args.targetPlan,
      // billingStartDate and billingEndDate remain unchanged
      // New rate takes effect at next billing cycle
      subscriptionStatus: "active",
      subscriptionId: transactionId,
    });

    // Log to billing history (no prorated amount for downgrades)
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

    // Log to audit trail
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

    // Send confirmation email
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
