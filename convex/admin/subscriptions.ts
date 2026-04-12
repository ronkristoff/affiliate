/**
 * Admin Subscription Management Module
 *
 * Provides admin-only queries and mutations for managing tenant subscriptions.
 * Uses requireAdmin for authentication and writes to billingHistory + auditLogs
 * for full audit trail on all actions.
 *
 * @see tech-spec-admin-subscription-management.md
 */

import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireAdmin } from "./_helpers";
import { DEFAULT_TIER_CONFIGS } from "../tierConfig";
import {
  sendWelcomeBackEmail,
  sendAccountReactivatedEmail,
} from "../email";

// =============================================================================
// Queries
// =============================================================================

/**
 * Get subscription details for a specific tenant.
 * Returns full subscription fields plus computed fields.
 */
export const getTenantSubscription = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    _id: v.id("tenants"),
    plan: v.string(),
    subscriptionStatus: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    billingStartDate: v.optional(v.number()),
    billingEndDate: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    cancellationDate: v.optional(v.number()),
    cancelledReason: v.optional(v.union(
      v.literal("grace_expired"),
      v.literal("trial_expired"),
      v.literal("admin_cancelled"),
      v.literal("owner_cancelled"),
    )),
    pastDueSince: v.optional(v.number()),
    isTrial: v.boolean(),
    trialDaysRemaining: v.optional(v.number()),
    billingCycleDaysRemaining: v.optional(v.number()),
    daysSinceCancellation: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const now = Date.now();
    const isTrial = tenant.trialEndsAt ? tenant.trialEndsAt > now : false;
    const trialDaysRemaining = isTrial
      ? Math.ceil((tenant.trialEndsAt! - now) / (24 * 60 * 60 * 1000))
      : undefined;

    let billingCycleDaysRemaining: number | undefined;
    if (tenant.billingEndDate && tenant.billingEndDate > now) {
      billingCycleDaysRemaining = Math.ceil(
        (tenant.billingEndDate - now) / (24 * 60 * 60 * 1000)
      );
    }

    let daysSinceCancellation: number | undefined;
    if (tenant.cancellationDate) {
      daysSinceCancellation = Math.ceil(
        (now - tenant.cancellationDate) / (24 * 60 * 60 * 1000)
      );
    }

    return {
      _id: tenant._id,
      plan: tenant.plan,
      subscriptionStatus: tenant.subscriptionStatus,
      subscriptionId: tenant.subscriptionId,
      billingStartDate: tenant.billingStartDate,
      billingEndDate: tenant.billingEndDate,
      trialEndsAt: tenant.trialEndsAt,
      cancellationDate: tenant.cancellationDate,
      cancelledReason: tenant.cancelledReason as "grace_expired" | "trial_expired" | "admin_cancelled" | "owner_cancelled" | undefined,
      pastDueSince: tenant.pastDueSince,
      isTrial,
      trialDaysRemaining,
      billingCycleDaysRemaining,
      daysSinceCancellation,
    };
  },
});

/**
 * Get paginated billing history for a specific tenant.
 * Uses the by_tenant_and_time index for reverse-chronological order.
 */
export const getTenantBillingHistory = query({
  args: {
    tenantId: v.id("tenants"),
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
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null()
      )
    ),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    return await ctx.db
      .query("billingHistory")
      .withIndex("by_tenant_and_time", (q) =>
        q.eq("tenantId", args.tenantId)
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * Get aggregate revenue metrics across all tenants.
 * Computed from tenants table + tierConfigs pricing.
 *
 * Performance: Loads all tierConfigs once at start (only 3 rows — safe),
 * builds a Map<tierName, price> for O(1) lookups, then iterates tenants.
 * Falls back to DEFAULT_TIER_CONFIGS for any tier not found in DB.
 */
export const getPlatformRevenueMetrics = query({
  args: {},
  returns: v.object({
    totalMRR: v.number(),
    activeMRR: v.number(),
    pastDueMRR: v.number(),
    trialCount: v.number(),
    activeCount: v.number(),
    pastDueCount: v.number(),
    cancelledCount: v.number(),
    churnedMRR: v.number(),
    trialConversionRate: v.number(),
    starterCount: v.number(),
    growthCount: v.number(),
    scaleCount: v.number(),
    growthMRR: v.number(),
    scaleMRR: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // Build tier price map — one-time read of tierConfigs table (only 3 rows)
    const dbConfigs = await ctx.db.query("tierConfigs").collect();
    const tierPriceMap = new Map<string, number>();

    for (const config of dbConfigs) {
      tierPriceMap.set(config.tier, config.price);
    }

    // Fallback for any tier not in DB
    for (const [tier, config] of Object.entries(DEFAULT_TIER_CONFIGS)) {
      if (!tierPriceMap.has(tier)) {
        tierPriceMap.set(tier, config.price);
      }
    }

    // Get all tenants (capped at 500)
    const allTenants = await ctx.db.query("tenants").take(500);

    let totalMRR = 0;
    let activeMRR = 0;
    let pastDueMRR = 0;
    let churnedMRR = 0;
    let trialCount = 0;
    let activeCount = 0;
    let pastDueCount = 0;
    let cancelledCount = 0;
    let starterCount = 0;
    let growthCount = 0;
    let scaleCount = 0;
    let growthMRR = 0;
    let scaleMRR = 0;
    let trialConvertedCount = 0;
    let payingFromTrial = 0;

    const now = Date.now();

    for (const tenant of allTenants) {
      const price = tierPriceMap.get(tenant.plan) ?? 0;

      // Derive effective subscription status — mirrors the logic in
      // subscriptions.ts (getSubscriptionStatus) so that tenants whose
      // subscriptionStatus is still undefined in the DB are still counted.
      let status: "trial" | "active" | "past_due" | "cancelled" | undefined;
      const isTrial = tenant.trialEndsAt ? tenant.trialEndsAt > now : false;
      if (isTrial) {
        status = "trial";
      } else if (
        tenant.subscriptionStatus === "active" ||
        tenant.subscriptionStatus === "cancelled" ||
        tenant.subscriptionStatus === "past_due"
      ) {
        status = tenant.subscriptionStatus as "active" | "cancelled" | "past_due";
      } else if (tenant.plan !== "starter") {
        status = "active";
      }

      if (status === "trial") {
        trialCount++;
      } else if (status === "active") {
        activeCount++;
        activeMRR += price;
      } else if (status === "past_due") {
        pastDueCount++;
        pastDueMRR += price;
      } else if (status === "cancelled") {
        cancelledCount++;
        churnedMRR += price;
      }

      // Plan distribution
      if (tenant.plan === "starter") starterCount++;
      else if (tenant.plan === "growth") {
        growthCount++;
        if (status === "active" || status === "past_due") growthMRR += price;
      } else if (tenant.plan === "scale") {
        scaleCount++;
        if (status === "active" || status === "past_due") scaleMRR += price;
      }

      // Track trial conversion: tenant was on trial (has past trial end) and is now paying
      const wasOnTrial = tenant.trialEndsAt !== undefined && tenant.trialEndsAt <= now;
      const isNowPaying = (status === "active" || status === "past_due") && tenant.plan !== "starter";
      if (wasOnTrial) {
        trialConvertedCount++;
        if (isNowPaying) {
          payingFromTrial++;
        }
      }
    }

    totalMRR = activeMRR + pastDueMRR;

    // Trial conversion rate: percentage of expired-trial tenants that converted to paid
    const trialConversionRate = trialConvertedCount > 0
      ? Math.round((payingFromTrial / trialConvertedCount) * 100)
      : 0;

    return {
      totalMRR,
      activeMRR,
      pastDueMRR,
      trialCount,
      activeCount,
      pastDueCount,
      cancelledCount,
      churnedMRR,
      trialConversionRate,
      starterCount,
      growthCount,
      scaleCount,
      growthMRR,
      scaleMRR,
    };
  },
});

/**
 * Get recent subscription activity across all tenants.
 * Returns the 10 most recent billingHistory events with tenant/actor names.
 */
export const getRecentSubscriptionActivity = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("billingHistory"),
    timestamp: v.number(),
    event: v.string(),
    tenantId: v.id("tenants"),
    tenantName: v.string(),
    plan: v.optional(v.string()),
    newPlan: v.optional(v.string()),
    previousPlan: v.optional(v.string()),
    amount: v.optional(v.number()),
    actorId: v.optional(v.id("users")),
    actorName: v.optional(v.string()),
  })),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // Get 10 most recent billingHistory events (default index = _creationTime desc)
    const recentEvents = await ctx.db
      .query("billingHistory")
      .order("desc")
      .take(10);

    // Batch lookups for tenant and actor names to avoid N+1
    const tenantIds = [...new Set(recentEvents.map((e) => e.tenantId.toString()))];
    const actorIds = [
      ...new Set(
        recentEvents
          .filter((e) => e.actorId)
          .map((e) => e.actorId!.toString())
      ),
    ];

    const [tenantDocs, actorDocs] = await Promise.all([
      Promise.all(tenantIds.map((id) => ctx.db.get(id as Id<"tenants">))),
      Promise.all(actorIds.map((id) => ctx.db.get(id as Id<"users">))),
    ]);

    const tenantMap = new Map(
      tenantDocs.filter(Boolean).map((doc) => [doc!._id.toString(), doc!])
    );
    const actorMap = new Map(
      actorDocs.filter(Boolean).map((doc) => [doc!._id.toString(), doc!])
    );

    const results = [];
    for (const event of recentEvents) {
      const tenant = tenantMap.get(event.tenantId.toString());
      const tenantName = tenant?.name ?? "Unknown Tenant";

      let actorName: string | undefined;
      if (event.actorId) {
        const actor = actorMap.get(event.actorId.toString());
        actorName = actor?.name ?? actor?.email;
      }

      results.push({
        _id: event._id,
        timestamp: event.timestamp,
        event: event.event,
        tenantId: event.tenantId,
        tenantName,
        plan: event.plan,
        newPlan: event.newPlan,
        previousPlan: event.previousPlan,
        amount: event.amount,
        actorId: event.actorId,
        actorName,
      });
    }

    return results;
  },
});

// =============================================================================
// Mutations
// =============================================================================

/**
 * Admin changes a tenant's plan.
 * Writes to billingHistory + auditLogs for full audit trail.
 * Sets a mock subscriptionId to prevent owner's trial-to-paid flow from running
 * on an already-active tenant.
 */
export const adminChangePlan = mutation({
  args: {
    tenantId: v.id("tenants"),
    targetPlan: v.union(
      v.literal("starter"),
      v.literal("growth"),
      v.literal("scale")
    ),
    reason: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    previousPlan: v.string(),
    newPlan: v.string(),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    if (args.targetPlan === tenant.plan) {
      throw new Error("Target plan is the same as current plan");
    }

    const previousPlan = tenant.plan;
    const now = Date.now();
    const billingEndDate = now + 30 * 24 * 60 * 60 * 1000;

    // Determine new subscriptionStatus
    let newSubscriptionStatus = tenant.subscriptionStatus;
    if (tenant.subscriptionStatus === "trial" && args.targetPlan !== "starter") {
      newSubscriptionStatus = "active";
    }

    // Get target plan price
    const targetTierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q: any) => q.eq("tier", args.targetPlan))
      .first();
    const amount = targetTierConfig?.price
      ?? DEFAULT_TIER_CONFIGS[args.targetPlan as keyof typeof DEFAULT_TIER_CONFIGS]?.price
      ?? 0;

    // Generate mock transaction ID
    const subscriptionId = `admin_plan_change_${Date.now()}`;

    // Build patch fields
    const patchFields: Record<string, any> = {
      plan: args.targetPlan,
      subscriptionStatus: newSubscriptionStatus,
      subscriptionId,
    };

    // Set billing dates only for paid plans
    if (args.targetPlan !== "starter") {
      patchFields.billingStartDate = now;
      patchFields.billingEndDate = billingEndDate;
    }

    // If upgrading from trial, clear trialEndsAt
    if (tenant.subscriptionStatus === "trial" && args.targetPlan !== "starter") {
      patchFields.trialEndsAt = undefined;
    }

    await ctx.db.patch(args.tenantId, patchFields);

    // Write billingHistory
    await ctx.db.insert("billingHistory", {
      tenantId: args.tenantId,
      event: "admin_plan_change",
      previousPlan,
      newPlan: args.targetPlan,
      amount,
      transactionId: subscriptionId,
      mockTransaction: true,
      timestamp: now,
      actorId: admin._id,
    });

    // Write auditLogs — actorId is admin._id (Id<"users">), not admin.authId
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "ADMIN_PLAN_CHANGE",
      entityType: "tenant",
      entityId: args.tenantId,
      actorId: admin._id,
      actorType: "admin",
      previousValue: { plan: previousPlan, subscriptionStatus: tenant.subscriptionStatus },
      newValue: { plan: args.targetPlan, subscriptionStatus: newSubscriptionStatus },
      metadata: {
        reason: args.reason,
        subscriptionId,
        amount,
      },
    });

    await notifyTenantOwner(ctx, args.tenantId, {
      type: "billing.plan_changed",
      title: "Plan Changed",
      message: `Your plan has been changed to ${args.targetPlan}.`,
      severity: "info",
    });

    return { success: true, previousPlan, newPlan: args.targetPlan };
  },
});

/**
 * Admin extends a tenant's trial period.
 * Validates tenant is on trial and days is 1-90.
 */
export const adminExtendTrial = mutation({
  args: {
    tenantId: v.id("tenants"),
    additionalDays: v.number(),
    reason: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    newTrialEndsAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    if (tenant.subscriptionStatus !== "trial") {
      throw new Error("Tenant is not on trial");
    }

    if (!Number.isInteger(args.additionalDays) || args.additionalDays < 1 || args.additionalDays > 90) {
      throw new Error("Additional days must be an integer between 1 and 90");
    }

    // Fallback to Date.now() when trialEndsAt is null to avoid epoch corruption
    const baseTime = tenant.trialEndsAt ?? Date.now();
    const newTrialEndsAt = baseTime + args.additionalDays * 86400000;

    await ctx.db.patch(args.tenantId, {
      trialEndsAt: newTrialEndsAt,
    });

    // Write billingHistory
    await ctx.db.insert("billingHistory", {
      tenantId: args.tenantId,
      event: "admin_trial_extension",
      amount: 0,
      timestamp: Date.now(),
      actorId: admin._id,
    });

    // Write auditLogs
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "ADMIN_TRIAL_EXTENSION",
      entityType: "tenant",
      entityId: args.tenantId,
      actorId: admin._id,
      actorType: "admin",
      previousValue: { trialEndsAt: tenant.trialEndsAt },
      newValue: { trialEndsAt: newTrialEndsAt },
      metadata: {
        additionalDays: args.additionalDays,
        reason: args.reason,
      },
    });

    await notifyTenantOwner(ctx, args.tenantId, {
      type: "billing.trial_extended",
      title: "Trial Extended",
      message: `Your trial has been extended by ${args.additionalDays} days.`,
      severity: "info",
    });

    return { success: true, newTrialEndsAt };
  },
});

/**
 * Admin cancels a tenant's subscription.
 * Sets cancelledReason to "admin_cancelled". No auto-deletion.
 */
export const adminCancelSubscription = mutation({
  args: {
    tenantId: v.id("tenants"),
    reason: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    if (tenant.subscriptionStatus !== "active" && tenant.subscriptionStatus !== "trial") {
      throw new Error("Can only cancel active or trial subscriptions");
    }

    const now = Date.now();

    await ctx.db.patch(args.tenantId, {
      subscriptionStatus: "cancelled",
      cancellationDate: now,
      cancelledReason: "admin_cancelled" as const,
    });

    // Pause all active campaigns (consistent with billing cron behaviour)
    try {
      await ctx.runMutation(internal.billingLifecycle.pauseAllActiveCampaignsForTenant, {
        tenantId: args.tenantId,
      });
    } catch {
      // Non-fatal — campaign pause failure shouldn't block admin action
    }

    // Write billingHistory
    await ctx.db.insert("billingHistory", {
      tenantId: args.tenantId,
      event: "admin_cancel",
      previousPlan: tenant.plan,
      timestamp: now,
      actorId: admin._id,
    });

    // Write auditLogs
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "ADMIN_SUBSCRIPTION_CANCEL",
      entityType: "tenant",
      entityId: args.tenantId,
      actorId: admin._id,
      actorType: "admin",
      previousValue: { subscriptionStatus: tenant.subscriptionStatus },
      newValue: {
        subscriptionStatus: "cancelled",
        cancelledReason: "admin_cancelled",
      },
      metadata: { reason: args.reason },
    });

    // Send notification to tenant owner
    const ownerUsers = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("role") as any, "owner"))
      .take(5);

    for (const owner of ownerUsers) {
      try {
        await ctx.runMutation(internal.notifications.createNotification, {
          tenantId: args.tenantId,
          userId: owner._id,
          type: "billing.cancelled",
          title: "Subscription Cancelled",
          message: "Your subscription has been cancelled by the platform admin.",
          severity: "warning",
          actionUrl: "/settings/billing",
          actionLabel: "View Billing",
        });
      } catch {
        // Non-fatal — notification failure shouldn't block admin action
      }
    }

    // Send admin notification for platform admin
    try {
      await ctx.runMutation(internal.notifications.createNotification, {
        tenantId: args.tenantId,
        userId: admin._id,
        type: "admin.tenant_cancelled",
        title: "Tenant Subscription Cancelled",
        message: `${tenant.name} subscription has been cancelled.`,
        severity: "info",
        metadata: { reason: args.reason },
      });
    } catch {
      // Non-fatal
    }

    return { success: true };
  },
});

/**
 * Admin reactivates a cancelled subscription.
 * Clears cancellation/deletion dates and restores active status.
 * NOTE: Relies on the deletion guard in deleteTenantData (convex/tenants.ts)
 * which aborts deletion when deletionScheduledDate is undefined.
 */
export const adminReactivateSubscription = mutation({
  args: {
    tenantId: v.id("tenants"),
    reason: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    if (tenant.subscriptionStatus !== "cancelled") {
      throw new Error("Can only reactivate cancelled subscriptions");
    }

    const now = Date.now();

    // Clear cancellation fields
    const patchFields: Record<string, any> = {
      subscriptionStatus: "active",
      cancellationDate: undefined,
      pastDueSince: undefined,
      cancelledReason: undefined,
    };

    // Set billing dates only for paid plans (starter is free — no billing cycle)
    if (tenant.plan !== "starter") {
      patchFields.billingStartDate = now;
      patchFields.billingEndDate = now + 30 * 24 * 60 * 60 * 1000;
    }

    await ctx.db.patch(args.tenantId, patchFields);

    // Resume paused campaigns
    try {
      await ctx.runMutation(internal.billingLifecycle.resumeAllPausedCampaignsForTenant, {
        tenantId: args.tenantId,
      });
    } catch {
      // Non-fatal — campaign resume failure shouldn't block reactivation
    }

    // Write billingHistory
    await ctx.db.insert("billingHistory", {
      tenantId: args.tenantId,
      event: "admin_reactivate",
      plan: tenant.plan,
      timestamp: now,
      actorId: admin._id,
    });

    // Write auditLogs
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "ADMIN_SUBSCRIPTION_REACTIVATE",
      entityType: "tenant",
      entityId: args.tenantId,
      actorId: admin._id,
      actorType: "admin",
      previousValue: { subscriptionStatus: "cancelled" },
      newValue: { subscriptionStatus: "active" },
      metadata: { reason: args.reason },
    });

    // Notify tenant owner
    await notifyTenantOwner(ctx, args.tenantId, {
      type: "billing.reactivated",
      title: "Account Reactivated",
      message: "Your account has been reactivated. All features are now available.",
      severity: "success",
    });

    // Send account reactivated email
    await sendReactivationEmailToOwner(ctx, args.tenantId, tenant.name, "reactivated");

    // Notify platform admin
    try {
      await ctx.runMutation(internal.notifications.createNotification, {
        tenantId: args.tenantId,
        userId: admin._id,
        type: "admin.tenant_reactivated",
        title: "Tenant Reactivated",
        message: `${tenant.name} has been reactivated.`,
        severity: "info",
        metadata: { reason: args.reason },
      });
    } catch {
      // Non-fatal
    }

    return { success: true };
  },
});

// =============================================================================
// New Admin Billing Override Mutations
// =============================================================================

/**
 * Admin extends billing for a tenant.
 * Only available for active or past_due tenants.
 */
export const adminExtendBilling = mutation({
  args: {
    tenantId: v.id("tenants"),
    additionalDays: v.number(),
    reason: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    newBillingEndDate: v.number(),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    if (
      tenant.subscriptionStatus !== "active" &&
      tenant.subscriptionStatus !== "past_due"
    ) {
      throw new Error("Can only extend billing for active or past_due subscriptions");
    }

    if (!Number.isInteger(args.additionalDays) || args.additionalDays < 1 || args.additionalDays > 365) {
      throw new Error("Additional days must be between 1 and 365");
    }

    const now = Date.now();
    const maxEnd = now + 365 * 86400000;
    const newEnd = Math.min(
      Math.max(tenant.billingEndDate ?? now, now) + args.additionalDays * 86400000,
      maxEnd
    );

    await ctx.db.patch(args.tenantId, {
      subscriptionStatus: "active",
      billingEndDate: newEnd,
      pastDueSince: undefined,
    });

    // Write billingHistory
    await ctx.db.insert("billingHistory", {
      tenantId: args.tenantId,
      event: "admin_extend_billing",
      amount: 0,
      timestamp: now,
      actorId: admin._id,
    });

    // Write auditLogs
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "ADMIN_EXTEND_BILLING",
      entityType: "tenant",
      entityId: args.tenantId,
      actorId: admin._id,
      actorType: "admin",
      previousValue: {
        subscriptionStatus: tenant.subscriptionStatus,
        billingEndDate: tenant.billingEndDate,
      },
      newValue: {
        subscriptionStatus: "active",
        billingEndDate: newEnd,
      },
      metadata: { additionalDays: args.additionalDays, reason: args.reason },
    });

    // Notify tenant owner
    await notifyTenantOwner(ctx, args.tenantId, {
      type: "billing.extended",
      title: "Billing Extended",
      message: `Your billing has been extended by ${args.additionalDays} days.`,
      severity: "success",
    });

    // Send welcome back email if recovering from past_due
    if (tenant.subscriptionStatus === "past_due") {
      await sendReactivationEmailToOwner(ctx, args.tenantId, tenant.name, "welcome_back");
    }

    return { success: true, newBillingEndDate: newEnd };
  },
});

/**
 * Admin resets a tenant to trial.
 * Only available for cancelled or past_due tenants.
 */
export const adminResetToTrial = mutation({
  args: {
    tenantId: v.id("tenants"),
    trialDays: v.number(),
    reason: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    newTrialEndsAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    if (
      tenant.subscriptionStatus !== "cancelled" &&
      tenant.subscriptionStatus !== "past_due"
    ) {
      throw new Error("Can only reset to trial for cancelled or past_due subscriptions");
    }

    if (!Number.isInteger(args.trialDays) || args.trialDays < 1 || args.trialDays > 90) {
      throw new Error("Trial days must be between 1 and 90");
    }

    const now = Date.now();
    const newTrialEndsAt = now + args.trialDays * 86400000;

    await ctx.db.patch(args.tenantId, {
      subscriptionStatus: "trial",
      trialEndsAt: newTrialEndsAt,
      billingStartDate: undefined,
      billingEndDate: undefined,
      pastDueSince: undefined,
      cancelledReason: undefined,
      cancellationDate: undefined,
    });

    // Resume paused campaigns
    try {
      await ctx.runMutation(internal.billingLifecycle.resumeAllPausedCampaignsForTenant, {
        tenantId: args.tenantId,
      });
    } catch {
      // Non-fatal
    }

    // Write billingHistory
    await ctx.db.insert("billingHistory", {
      tenantId: args.tenantId,
      event: "admin_reset_to_trial",
      amount: 0,
      timestamp: now,
      actorId: admin._id,
    });

    // Write auditLogs
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "ADMIN_RESET_TO_TRIAL",
      entityType: "tenant",
      entityId: args.tenantId,
      actorId: admin._id,
      actorType: "admin",
      previousValue: { subscriptionStatus: tenant.subscriptionStatus },
      newValue: { subscriptionStatus: "active", trialEndsAt: newTrialEndsAt },
      metadata: { trialDays: args.trialDays, reason: args.reason },
    });

    // Notify tenant owner
    await notifyTenantOwner(ctx, args.tenantId, {
      type: "billing.reactivated",
      title: "Trial Activated",
      message: `Your account has been reset to a ${args.trialDays}-day trial.`,
      severity: "info",
    });

    // Send account reactivated email
    await sendReactivationEmailToOwner(ctx, args.tenantId, tenant.name, "reactivated");

    return { success: true, newTrialEndsAt };
  },
});

/**
 * Admin marks a tenant as paid (recovers from past_due or cancelled).
 */
export const adminMarkAsPaid = mutation({
  args: {
    tenantId: v.id("tenants"),
    reason: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    if (
      tenant.subscriptionStatus !== "past_due" &&
      tenant.subscriptionStatus !== "cancelled"
    ) {
      throw new Error("Can only mark as paid for past_due or cancelled subscriptions");
    }

    const now = Date.now();

    await ctx.db.patch(args.tenantId, {
      subscriptionStatus: "active",
      billingStartDate: now,
      billingEndDate: now + 30 * 86400000,
      pastDueSince: undefined,
      cancelledReason: undefined,
      cancellationDate: undefined,
    });

    // Resume paused campaigns
    try {
      await ctx.runMutation(internal.billingLifecycle.resumeAllPausedCampaignsForTenant, {
        tenantId: args.tenantId,
      });
    } catch {
      // Non-fatal
    }

    // Write billingHistory
    await ctx.db.insert("billingHistory", {
      tenantId: args.tenantId,
      event: "admin_mark_as_paid",
      timestamp: now,
      actorId: admin._id,
    });

    // Write auditLogs
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "ADMIN_MARK_AS_PAID",
      entityType: "tenant",
      entityId: args.tenantId,
      actorId: admin._id,
      actorType: "admin",
      previousValue: { subscriptionStatus: tenant.subscriptionStatus },
      newValue: { subscriptionStatus: "active" },
      metadata: { reason: args.reason },
    });

    // Notify tenant owner
    await notifyTenantOwner(ctx, args.tenantId, {
      type: "billing.recovered",
      title: "Payment Received",
      message: "Payment received. Your account is fully active again.",
      severity: "success",
    });

    // Send welcome back email
    await sendReactivationEmailToOwner(ctx, args.tenantId, tenant.name, "welcome_back");

    return { success: true };
  },
});

/**
 * Admin edits billing dates for a tenant.
 * Does NOT change subscriptionStatus — only updates dates.
 */
export const adminEditBillingDates = mutation({
  args: {
    tenantId: v.id("tenants"),
    billingStartDate: v.number(),
    billingEndDate: v.number(),
    reason: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    billingEndDateInPast: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const now = Date.now();
    const maxEnd = now + 365 * 86400000;

    // Validate dates
    if (args.billingStartDate >= args.billingEndDate) {
      throw new Error("Billing start date must be before billing end date");
    }

    if (args.billingEndDate > maxEnd) {
      throw new Error("Billing end date must be within 365 days from now");
    }

    await ctx.db.patch(args.tenantId, {
      billingStartDate: args.billingStartDate,
      billingEndDate: args.billingEndDate,
    });

    // Write billingHistory
    await ctx.db.insert("billingHistory", {
      tenantId: args.tenantId,
      event: "admin_edit_billing_dates",
      timestamp: now,
      actorId: admin._id,
    });

    // Write auditLogs
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "ADMIN_EDIT_BILLING_DATES",
      entityType: "tenant",
      entityId: args.tenantId,
      actorId: admin._id,
      actorType: "admin",
      previousValue: {
        billingStartDate: tenant.billingStartDate,
        billingEndDate: tenant.billingEndDate,
      },
      newValue: {
        billingStartDate: args.billingStartDate,
        billingEndDate: args.billingEndDate,
      },
      metadata: { reason: args.reason },
    });

    const billingEndDateInPast = args.billingEndDate < now;

    // Notify tenant owner
    await notifyTenantOwner(ctx, args.tenantId, {
      type: "billing.extended",
      title: "Billing Dates Updated",
      message: "Your billing dates have been updated by the platform admin.",
      severity: "info",
    });

    return { success: true, billingEndDateInPast };
  },
});

// =============================================================================
// Helper: Notify Tenant Owner
// =============================================================================

/**
 * Find the owner user for a tenant and send them a notification.
 * Non-fatal — if no owner found or notification fails, continues silently.
 */
async function notifyTenantOwner(
  ctx: any,
  tenantId: Id<"tenants">,
  notification: {
    type: string;
    title: string;
    message: string;
    severity: "info" | "warning" | "success" | "critical";
  }
): Promise<void> {
  try {
    const ownerUsers = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .filter((q: any) => q.eq(q.field("role") as any, "owner"))
      .take(5);

    for (const owner of ownerUsers) {
      await ctx.runMutation(internal.notifications.createNotification, {
        tenantId,
        userId: owner._id,
        ...notification,
      });
    }
  } catch (error) {
    console.error(
      `[admin.subscriptions] Failed to notify owner for tenant="${tenantId}":`,
      error instanceof Error ? error.message : String(error)
    );
  }
}

// =============================================================================
// Helper: Send reactivation email to tenant owner
// =============================================================================

type ReactivationEmailType = "reactivated" | "welcome_back";

/**
 * Send the appropriate reactivation email to the tenant owner.
 * Non-fatal — email send failure should not block the admin action.
 */
async function sendReactivationEmailToOwner(
  ctx: any,
  tenantId: Id<"tenants">,
  tenantName: string,
  emailType: ReactivationEmailType,
): Promise<void> {
  try {
    const ownerUsers = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .filter((q: any) => q.eq(q.field("role") as any, "owner"))
      .take(5);

    const brandName = tenantName || "Salig Affiliate";

    for (const owner of ownerUsers) {
      if (!owner.email) continue;

      if (emailType === "reactivated") {
        await sendAccountReactivatedEmail(ctx, {
          to: owner.email,
          tenantName,
          brandName,
          tenantId,
        });
      } else {
        await sendWelcomeBackEmail(ctx, {
          to: owner.email,
          tenantName,
          brandName,
          tenantId,
        });
      }
    }
  } catch (error) {
    console.error(
      `[admin.subscriptions] Failed to send ${emailType} email for tenant="${tenantId}":`,
      error instanceof Error ? error.message : String(error)
    );
  }
}
