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
import { requireAdmin } from "./_helpers";
import { DEFAULT_TIER_CONFIGS } from "../tierConfig";

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
    deletionScheduledDate: v.optional(v.number()),
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
      deletionScheduledDate: tenant.deletionScheduledDate,
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
    splitCursor: v.optional(v.union(v.string(), v.null())),
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
    }

    totalMRR = activeMRR + pastDueMRR;

    // Trial conversion rate: tenants with plan !== "starter" AND subscriptionStatus === "active"
    // divided by tenants with billingHistory event "trial_conversion"
    const uniqueTrialConvertedTenantIds = new Set<string>();

    // Query billingHistory to find trial_conversion events — capped at 500
    const allBillingHistory = await ctx.db
      .query("billingHistory")
      .order("desc")
      .take(500);

    for (const event of allBillingHistory) {
      if (event.event === "trial_conversion") {
        uniqueTrialConvertedTenantIds.add(event.tenantId);
      }
    }

    const trialConvertedCount = uniqueTrialConvertedTenantIds.size;
    // Use the same derived status logic for consistency
    const payingFromTrial = allTenants.filter((t) => {
      if (t.plan === "starter") return false;
      if (t.subscriptionStatus === "active") return true;
      // If subscriptionStatus is undefined but plan is paid, treat as active
      if (!t.subscriptionStatus) return true;
      return false;
    }).length;
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

    return { success: true, newTrialEndsAt };
  },
});

/**
 * Admin cancels a tenant's subscription.
 * Schedules deletion relative to billing cycle end (matches owner's cancel pattern).
 */
export const adminCancelSubscription = mutation({
  args: {
    tenantId: v.id("tenants"),
    reason: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    deletionScheduledDate: v.number(),
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
    // Deletion scheduled relative to billing cycle end, not from now
    const billingEnd = tenant.billingEndDate ?? now;
    const deletionScheduledDate = billingEnd + 30 * 86400000;

    await ctx.db.patch(args.tenantId, {
      subscriptionStatus: "cancelled",
      cancellationDate: now,
      deletionScheduledDate,
    });

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
        deletionScheduledDate,
      },
      metadata: { reason: args.reason },
    });

    return { success: true, deletionScheduledDate };
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

    // Build patch — clear deletionScheduledDate to cancel any pending deletion
    const patchFields: Record<string, any> = {
      subscriptionStatus: "active",
      cancellationDate: undefined,
      deletionScheduledDate: undefined,
    };

    // Set billing dates for all plans (starter gets 30-day cycle, paid plans get new cycle)
    patchFields.billingStartDate = now;
    patchFields.billingEndDate = now + 30 * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.tenantId, patchFields);

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

    return { success: true };
  },
});
