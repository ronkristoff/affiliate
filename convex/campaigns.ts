import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Id, Doc } from "./_generated/dataModel";
import { getAuthenticatedUser } from "./tenantContext";
import { internal } from "./_generated/api";

/**
 * Campaign Management Functions
 * 
 * Provides CRUD operations for affiliate campaigns with multi-tenant data isolation.
 */

// ── ADR-4: Shared campaign return shape + mapper ──────────────────────────
// All overview/listing queries return the same aliased shape.
// Using explicit field mapping (NOT ...spread) to prevent ghost fields (F1 fix).

export const campaignReturnShape = v.object({
  _id: v.id("campaigns"),
  _creationTime: v.number(),
  tenantId: v.id("tenants"),
  name: v.string(),
  description: v.optional(v.string()),
  commissionType: v.string(),
  commissionRate: v.number(),               // alias for commissionValue
  cookieDuration: v.optional(v.number()),
  recurringCommissions: v.optional(v.boolean()),  // alias for recurringCommission (optional for safety)
  recurringRate: v.optional(v.number()),
  recurringRateType: v.optional(v.string()),
  autoApproveCommissions: v.optional(v.boolean()),
  approvalThreshold: v.optional(v.number()),
  status: v.string(),
});

/**
 * Map a raw campaign DB doc to the shared return shape.
 * Uses explicit field mapping — NOT spread — to prevent ghost fields.
 */
function mapCampaignToReturnShape(c: Doc<"campaigns">) {
  return {
    _id: c._id,
    _creationTime: c._creationTime,
    tenantId: c.tenantId,
    name: c.name,
    description: c.description,
    commissionType: c.commissionType,
    commissionRate: c.commissionValue,           // explicit alias
    cookieDuration: c.cookieDuration,
    recurringCommissions: c.recurringCommission,  // explicit alias
    recurringRate: c.recurringRate,
    recurringRateType: c.recurringRateType,
    autoApproveCommissions: c.autoApproveCommissions,
    approvalThreshold: c.approvalThreshold,
    status: c.status,
  };
}

/**
 * Create a new campaign for the tenant.
 * Enforces tier limits before creating.
 */
export const createCampaign = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    commissionType: v.union(v.literal("percentage"), v.literal("flatFee")),
    commissionRate: v.number(),
    cookieDuration: v.optional(v.number()),
    recurringCommissions: v.optional(v.boolean()),
    recurringRate: v.optional(v.number()),
    recurringRateType: v.optional(v.union(
      v.literal("same"),
      v.literal("reduced"),
      v.literal("custom")
    )),
    autoApproveCommissions: v.optional(v.boolean()),
    approvalThreshold: v.optional(v.number()),
  },
  returns: v.id("campaigns"),
  handler: async (ctx, args) => {
    // Get authenticated user
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = user.tenantId;

    // Validate input
    if (args.name.length < 2 || args.name.length > 100) {
      throw new Error("Campaign name must be between 2 and 100 characters");
    }

    if (args.commissionType === "percentage") {
      if (args.commissionRate < 1 || args.commissionRate > 100) {
        throw new Error("Percentage commission rate must be between 1 and 100");
      }
    } else if (args.commissionType === "flatFee") {
      if (args.commissionRate < 0) {
        throw new Error("Flat fee commission rate must be 0 or greater");
      }
    }

    // Validate cookie duration
    const cookieDuration = args.cookieDuration ?? 30;
    if (cookieDuration < 1 || cookieDuration > 365) {
      throw new Error("Cookie duration must be between 1 and 365 days");
    }

    // Validate recurring configuration
    if (args.recurringCommissions) {
      const rateType = args.recurringRateType ?? "same";
      
      // For "custom" or "reduced" rate types, a recurring rate MUST be provided
      if ((rateType === "custom" || rateType === "reduced") && !args.recurringRate) {
        throw new Error(`Recurring rate is required when using "${rateType}" rate type`);
      }
      
      // Validate recurring rate range if provided
      if (args.recurringRate !== undefined) {
        if (args.recurringRate < 1 || args.recurringRate > 100) {
          throw new Error("Recurring commission rate must be between 1 and 100");
        }
      }
    }

    // Check tier limits before creating using the internal function
    const limitCheck = await ctx.runQuery(internal.campaigns.checkCampaignLimitInternal, { tenantId });
    
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.reason || `You have reached the maximum number of campaigns (${limitCheck.limit}) for your plan. Please upgrade to create more.`);
    }

    // Create the campaign
    const campaignId = await ctx.db.insert("campaigns", {
      tenantId,
      name: args.name,
      description: args.description,
      commissionType: args.commissionType,
      commissionValue: args.commissionRate,
      cookieDuration: cookieDuration,
      recurringCommission: args.recurringCommissions ?? false,
      recurringRate: args.recurringRate,
      autoApproveCommissions: args.autoApproveCommissions ?? true,
      approvalThreshold: args.approvalThreshold,
      status: "active",
    });

    return campaignId;
  },
});

/**
 * Internal function to check campaign limit (used by createCampaign)
 * Uses tierConfig service for consistent limit enforcement
 */
export const checkCampaignLimitInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.optional(v.string()),
    current: v.number(),
    limit: v.number(),
    percentage: v.number(),
    status: v.union(v.literal("ok"), v.literal("warning"), v.literal("critical"), v.literal("blocked")),
  }),
  handler: async (ctx, args): Promise<{
    allowed: boolean;
    reason?: string;
    current: number;
    limit: number;
    percentage: number;
    status: "ok" | "warning" | "critical" | "blocked";
  }> => {
    // Use the centralized tierConfig service
    const result: {
      allowed: boolean;
      reason?: string;
      current: number;
      limit: number;
      percentage: number;
      status: "ok" | "warning" | "critical" | "blocked";
    } = await ctx.runQuery(internal.tierConfig.checkCampaignLimitInternal, {
      tenantId: args.tenantId,
    });
    return result;
  },
});

/**
 * List all campaigns for the current tenant.
 * By default, excludes archived campaigns. Use includeArchived=true to include them.
 * Ordered by creation date (newest first).
 */
export const listCampaigns = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("campaigns"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      name: v.string(),
      description: v.optional(v.string()),
      commissionType: v.string(),
      commissionValue: v.number(),
      commissionRate: v.number(), // Alias for frontend compatibility
      cookieDuration: v.optional(v.number()),
      recurringCommission: v.boolean(),
      recurringCommissions: v.boolean(), // Alias for frontend compatibility
      recurringRate: v.optional(v.number()),
      recurringRateType: v.optional(v.string()),
      autoApproveCommissions: v.optional(v.boolean()),
      approvalThreshold: v.optional(v.number()),
      status: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = user.tenantId;
    const includeArchived = args.includeArchived ?? false;

    // OPTIMIZED: Use compound index for better performance
    // If not including archived, we can efficiently query only active and paused
    if (!includeArchived) {
      const activeCampaigns = await ctx.db
        .query("campaigns")
        .withIndex("by_tenant_and_status", (q) => 
          q.eq("tenantId", tenantId).eq("status", "active")
        )
        .order("desc")
        .collect();
      
      const pausedCampaigns = await ctx.db
        .query("campaigns")
        .withIndex("by_tenant_and_status", (q) => 
          q.eq("tenantId", tenantId).eq("status", "paused")
        )
        .order("desc")
        .collect();
      
      // Combine and sort by creation time (descending)
      return [...activeCampaigns, ...pausedCampaigns].sort(
        (a, b) => b._creationTime - a._creationTime
      ).map(c => ({
        ...c,
        commissionRate: c.commissionValue,
        recurringCommissions: c.recurringCommission,
      }));
    }

    // If including archived, fetch all campaigns for the tenant
    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .order("desc")
      .collect();

    return campaigns.map(c => ({
      ...c,
      commissionRate: c.commissionValue,
      recurringCommissions: c.recurringCommission,
    }));
  },
});

/**
 * Get a single campaign by ID.
 * Returns null if not found or doesn't belong to tenant.
 */
export const getCampaign = query({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.union(campaignReturnShape, v.null()),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const campaign = await ctx.db.get(args.campaignId);

    if (!campaign) {
      return null;
    }

    // Verify tenant ownership
    if (campaign.tenantId !== user.tenantId) {
      throw new Error("Campaign not found or access denied");
    }

    // Use shared mapper — NOT spread — to prevent ghost fields (F1 fix)
    return mapCampaignToReturnShape(campaign);
  },
});

/**
 * Update an existing campaign.
 */
export const updateCampaign = mutation({
  args: {
    campaignId: v.id("campaigns"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    commissionType: v.optional(v.union(v.literal("percentage"), v.literal("flatFee"))),
    commissionRate: v.optional(v.number()),
    cookieDuration: v.optional(v.number()),
    recurringCommissions: v.optional(v.boolean()),
    recurringRate: v.optional(v.number()),
    recurringRateType: v.optional(v.union(
      v.literal("same"),
      v.literal("reduced"),
      v.literal("custom")
    )),
    autoApproveCommissions: v.optional(v.boolean()),
    approvalThreshold: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  returns: v.id("campaigns"),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const campaign = await ctx.db.get(args.campaignId);

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Verify tenant ownership
    if (campaign.tenantId !== user.tenantId) {
      throw new Error("Campaign not found or access denied");
    }

    // CRITICAL: Block editing of archived campaigns
    if (campaign.status === "archived") {
      throw new Error("Archived campaigns cannot be edited");
    }

    // Validate input if provided
    if (args.name !== undefined && (args.name.length < 2 || args.name.length > 100)) {
      throw new Error("Campaign name must be between 2 and 100 characters");
    }

    if (args.commissionRate !== undefined) {
      const commissionType = args.commissionType ?? campaign.commissionType;
      if (commissionType === "percentage") {
        if (args.commissionRate < 1 || args.commissionRate > 100) {
          throw new Error("Percentage commission rate must be between 1 and 100");
        }
      } else if (commissionType === "flatFee") {
        if (args.commissionRate < 0) {
          throw new Error("Flat fee commission rate must be 0 or greater");
        }
      }
    }

    if (args.cookieDuration !== undefined && (args.cookieDuration < 1 || args.cookieDuration > 365)) {
      throw new Error("Cookie duration must be between 1 and 365 days");
    }

    // Validate recurring configuration
    const isRecurringEnabled = args.recurringCommissions ?? campaign.recurringCommission;
    const recurringRate = args.recurringRate ?? campaign.recurringRate;
    
    if (isRecurringEnabled && !recurringRate) {
      throw new Error(`Recurring rate is required when recurring commissions are enabled`);
    }
    
    if (args.recurringRate !== undefined && (args.recurringRate < 1 || args.recurringRate > 100)) {
      throw new Error("Recurring commission rate must be between 1 and 100");
    }

    // Build update object
    const updates: Record<string, any> = {};
    
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.commissionType !== undefined) updates.commissionType = args.commissionType;
    if (args.commissionRate !== undefined) updates.commissionValue = args.commissionRate;
    if (args.cookieDuration !== undefined) updates.cookieDuration = args.cookieDuration;
    if (args.recurringCommissions !== undefined) updates.recurringCommission = args.recurringCommissions;
    if (args.recurringRate !== undefined) updates.recurringRate = args.recurringRate;
    if (args.recurringRateType !== undefined) updates.recurringRateType = args.recurringRateType;
    if (args.autoApproveCommissions !== undefined) updates.autoApproveCommissions = args.autoApproveCommissions;
    if (args.approvalThreshold !== undefined) updates.approvalThreshold = args.approvalThreshold;
    if (args.status !== undefined) {
      // Validate status
      if (!["active", "paused", "archived"].includes(args.status)) {
        throw new Error("Invalid status. Must be active, paused, or archived");
      }
      
      // Validate status transitions
      const validTransitions: Record<string, string[]> = {
        active: ["paused", "archived"],
        paused: ["active", "archived"],
        archived: [], // Archived campaigns cannot transition to other statuses via update
      };
      
      const currentStatus = campaign.status;
      if (args.status !== currentStatus && !validTransitions[currentStatus]?.includes(args.status)) {
        throw new Error(`Cannot transition from ${currentStatus} to ${args.status}. Use the appropriate action instead.`);
      }
      
      updates.status = args.status;
    }

    await ctx.db.patch(args.campaignId, updates);

    return args.campaignId;
  },
});

/**
 * Archive a campaign (soft delete).
 */
export const archiveCampaign = mutation({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.id("campaigns"),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const campaign = await ctx.db.get(args.campaignId);

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Verify tenant ownership
    if (campaign.tenantId !== user.tenantId) {
      throw new Error("Campaign not found or access denied");
    }

    await ctx.db.patch(args.campaignId, {
      status: "archived",
    });

    return args.campaignId;
  },
});

/**
 * Pause a campaign.
 */
export const pauseCampaign = mutation({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.id("campaigns"),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const campaign = await ctx.db.get(args.campaignId);

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Verify tenant ownership
    if (campaign.tenantId !== user.tenantId) {
      throw new Error("Campaign not found or access denied");
    }

    if (campaign.status !== "active") {
      throw new Error("Only active campaigns can be paused");
    }

    await ctx.db.patch(args.campaignId, {
      status: "paused",
    });

    return args.campaignId;
  },
});

/**
 * Resume a paused campaign.
 */
export const resumeCampaign = mutation({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.id("campaigns"),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const campaign = await ctx.db.get(args.campaignId);

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Verify tenant ownership
    if (campaign.tenantId !== user.tenantId) {
      throw new Error("Campaign not found or access denied");
    }

    if (campaign.status !== "paused") {
      throw new Error("Only paused campaigns can be resumed");
    }

    await ctx.db.patch(args.campaignId, {
      status: "active",
    });

    return args.campaignId;
  },
});

/**
 * Get campaign statistics for a tenant.
 * Returns counts by status.
 */
export const getCampaignStats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    active: v.number(),
    paused: v.number(),
    archived: v.number(),
    zeroAffiliateCampaignIds: v.array(v.id("campaigns")),
  }),
  handler: async (ctx, _args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = user.tenantId;

    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    const stats = {
      total: campaigns.length,
      active: campaigns.filter((c) => c.status === "active").length,
      paused: campaigns.filter((c) => c.status === "paused").length,
      archived: campaigns.filter((c) => c.status === "archived").length,
    };

    // Detect active campaigns with zero affiliates
    const activeCampaigns = campaigns.filter((c) => c.status === "active");
    const zeroAffiliateCampaignIds: Id<"campaigns">[] = [];

    if (activeCampaigns.length > 0) {
      // Fetch all referral links for this tenant
      const allReferralLinks = await ctx.db
        .query("referralLinks")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect();

      // Build set of campaign IDs that have at least one referral link
      const campaignsWithAffiliates = new Set<string>();
      for (const link of allReferralLinks) {
        if (link.campaignId) {
          campaignsWithAffiliates.add(link.campaignId as string);
        }
      }

      // Active campaigns not in the set have zero affiliates
      for (const campaign of activeCampaigns) {
        if (!campaignsWithAffiliates.has(campaign._id as string)) {
          zeroAffiliateCampaignIds.push(campaign._id);
        }
      }
    }

    return {
      ...stats,
      zeroAffiliateCampaignIds,
    };
  },
});

/**
 * Check current campaign limit for UI display (public query)
 * Uses tierConfig service for consistent limit enforcement
 */
export const checkCampaignLimit = query({
  args: {},
  returns: v.object({
    allowed: v.boolean(),
    reason: v.optional(v.string()),
    current: v.number(),
    limit: v.number(),
    percentage: v.number(),
    status: v.union(v.literal("ok"), v.literal("warning"), v.literal("critical"), v.literal("blocked")),
  }),
  handler: async (ctx, _args): Promise<{
    allowed: boolean;
    reason?: string;
    current: number;
    limit: number;
    percentage: number;
    status: "ok" | "warning" | "critical" | "blocked";
  }> => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Use the centralized tierConfig service
    const result: {
      allowed: boolean;
      reason?: string;
      current: number;
      limit: number;
      percentage: number;
      status: "ok" | "warning" | "critical" | "blocked";
    } = await ctx.runQuery(internal.tierConfig.checkCampaignLimitInternal, {
      tenantId: user.tenantId,
    });

    return result;
  },
});

/**
 * Internal query to check if a campaign can earn commissions.
 * Used by commission engine (Epic 7) to determine if commissions should be created.
 * Returns null if campaign doesn't exist.
 */
export const canCampaignEarnCommissions = internalQuery({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.object({
    canEarn: v.boolean(),
    reason: v.optional(v.string()),
    status: v.string(),
  }),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    
    if (!campaign) {
      return { canEarn: false, reason: "Campaign not found", status: "not_found" };
    }

    // Check campaign status
    if (campaign.status === "paused") {
      return { 
        canEarn: false, 
        reason: "Campaign is paused - no new commissions will be created", 
        status: "paused" 
      };
    }

    if (campaign.status === "archived") {
      return { 
        canEarn: false, 
        reason: "Campaign is archived - no commissions can be created", 
        status: "archived" 
      };
    }

    return { canEarn: true, status: "active" };
  },
});

/**
 * Get per-campaign stats for campaign cards.
 * Returns affiliates count, conversions count, and paid out amount per campaign.
 * Efficient for typical SaaS-scale data (fetches by tenant index, groups in memory).
 */
export const getCampaignCardStats = query({
  args: {},
  returns: v.union(
    v.record(
      v.string(),
      v.object({
        affiliates: v.number(),
        conversions: v.number(),
        paidOut: v.number(),
      })
    ),
    v.null()
  ),
  handler: async (ctx, _args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      // Return null instead of throwing — the Convex client may not have
      // the session identity yet during page navigation/refresh. The query
      // will automatically re-execute once the session is established.
      return null;
    }

    const tenantId = user.tenantId;

    // Fetch all conversions for tenant
    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .take(500);

    // Fetch all commissions for tenant
    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .take(300);

    // Fetch all referral links for affiliate counting
    const allReferralLinks = await ctx.db
      .query("referralLinks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .take(1000);

    // Aggregate conversions per campaign
    const conversionsByCampaign = new Map<string, number>();
    for (const conv of allConversions) {
      if (conv.campaignId) {
        const key = conv.campaignId as string;
        conversionsByCampaign.set(key, (conversionsByCampaign.get(key) ?? 0) + 1);
      }
    }

    // Aggregate paid commissions per campaign (status "approved" or "paid")
    const paidOutByCampaign = new Map<string, number>();
    for (const comm of allCommissions) {
      if (comm.status === "approved" || comm.status === "paid") {
        const key = comm.campaignId as string;
        paidOutByCampaign.set(key, (paidOutByCampaign.get(key) ?? 0) + comm.amount);
      }
    }

    // Count unique affiliates per campaign via referral links
    const affiliatesByCampaign = new Map<string, Set<string>>();
    for (const link of allReferralLinks) {
      if (link.campaignId) {
        const key = link.campaignId as string;
        if (!affiliatesByCampaign.has(key)) {
          affiliatesByCampaign.set(key, new Set());
        }
        affiliatesByCampaign.get(key)!.add(link.affiliateId as string);
      }
    }

    // Build result
    const result: Record<string, { affiliates: number; conversions: number; paidOut: number }> = {};

    // Get all campaign IDs that appear in any of the data
    const allCampaignIds = new Set<string>([
      ...conversionsByCampaign.keys(),
      ...paidOutByCampaign.keys(),
      ...affiliatesByCampaign.keys(),
    ]);

    for (const campaignId of allCampaignIds) {
      result[campaignId] = {
        affiliates: affiliatesByCampaign.get(campaignId)?.size ?? 0,
        conversions: conversionsByCampaign.get(campaignId) ?? 0,
        paidOut: paidOutByCampaign.get(campaignId) ?? 0,
      };
    }

    return result;
  },
});

/**
 * Internal query to get campaign by ID.
 * Used by commission engine to check recurringCommission settings.
 */
export const getCampaignByIdInternal = internalQuery({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.union(
    v.object({
      _id: v.id("campaigns"),
      recurringCommission: v.boolean(),
      recurringRate: v.optional(v.number()),
      recurringRateType: v.optional(v.string()),
      commissionType: v.string(),
      commissionValue: v.number(),
      status: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    
    if (!campaign) {
      return null;
    }

    return {
      _id: campaign._id,
      recurringCommission: campaign.recurringCommission,
      recurringRate: campaign.recurringRate,
      recurringRateType: campaign.recurringRateType,
      commissionType: campaign.commissionType,
      commissionValue: campaign.commissionValue,
      status: campaign.status,
    };
  },
});

/**
 * Get affiliates performance data for a specific campaign.
 * Returns per-affiliate stats: clicks, conversions, revenue, pending/confirmed commissions.
 * Tenant resolved internally via getAuthenticatedUser(ctx) — no tenantId arg.
 * Scale guard: max 200 affiliates per campaign.
 * Stats are filtered to THIS campaign only (not global per affiliate).
 */
export const getAffiliatesByCampaign = query({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.array(
    v.object({
      affiliateId: v.id("affiliates"),
      name: v.string(),
      email: v.string(),
      joinedAt: v.number(),
      clicks: v.number(),
      conversions: v.number(),
      totalRevenue: v.number(),
      pendingCommission: v.number(),
      confirmedCommission: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = user.tenantId;

    // Verify campaign belongs to this tenant
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign || campaign.tenantId !== tenantId) {
      throw new Error("Campaign not found or access denied");
    }

    // Get referral links for this campaign (scale guard: max 200)
    const referralLinks = await ctx.db
      .query("referralLinks")
      .withIndex("by_tenant_and_campaign", (q) =>
        q.eq("tenantId", tenantId).eq("campaignId", args.campaignId)
      )
      .take(200);

    // Collect unique affiliate IDs from referral links
    const affiliateIds = new Set<string>();
    for (const link of referralLinks) {
      affiliateIds.add(link.affiliateId as string);
    }

    if (affiliateIds.size === 0) {
      return [];
    }

    // ── Batch fetch all stats in parallel (fixes N+3 query problem) ──
    const [allClicks, allConversions, campaignCommissions, affiliateDocs] =
      await Promise.all([
        // Clicks — fetch by tenant, filter to this campaign in memory
        ctx.db
          .query("clicks")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
          .take(500),
        // Conversions — fetch by tenant, filter to this campaign in memory
        ctx.db
          .query("conversions")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
          .take(500),
        // Commissions — filter directly by campaign using index
        ctx.db
          .query("commissions")
          .withIndex("by_campaign", (q) =>
            q.eq("campaignId", args.campaignId)
          )
          .take(300),
        // Fetch all affiliate docs in one batch
        Promise.all(
          Array.from(affiliateIds).map((id) =>
            ctx.db.get(id as Id<"affiliates">)
          )
        ),
      ]);

    // Filter clicks and conversions to THIS campaign only
    const clicksByAffiliate = new Map<string, number>();
    for (const click of allClicks) {
      if (click.campaignId === args.campaignId) {
        const key = click.affiliateId as string;
        clicksByAffiliate.set(key, (clicksByAffiliate.get(key) ?? 0) + 1);
      }
    }

    const conversionsByAffiliate = new Map<string, number>();
    const revenueByAffiliate = new Map<string, number>();
    for (const conv of allConversions) {
      if (conv.campaignId === args.campaignId) {
        const key = conv.affiliateId as string;
        conversionsByAffiliate.set(
          key,
          (conversionsByAffiliate.get(key) ?? 0) + 1
        );
        revenueByAffiliate.set(
          key,
          (revenueByAffiliate.get(key) ?? 0) + conv.amount
        );
      }
    }

    // Aggregate commissions per affiliate (already filtered by campaign index)
    const pendingByAffiliate = new Map<string, number>();
    const confirmedByAffiliate = new Map<string, number>();
    for (const comm of campaignCommissions) {
      const key = comm.affiliateId as string;
      if (comm.status === "pending") {
        pendingByAffiliate.set(
          key,
          (pendingByAffiliate.get(key) ?? 0) + comm.amount
        );
      } else if (comm.status === "approved" || comm.status === "paid") {
        confirmedByAffiliate.set(
          key,
          (confirmedByAffiliate.get(key) ?? 0) + comm.amount
        );
      }
    }

    // Build result from batch-fetched data
    const result: Array<{
      affiliateId: Id<"affiliates">;
      name: string;
      email: string;
      joinedAt: number;
      clicks: number;
      conversions: number;
      totalRevenue: number;
      pendingCommission: number;
      confirmedCommission: number;
    }> = [];

    for (const affiliate of affiliateDocs) {
      if (!affiliate) continue;
      const key = affiliate._id as string;

      result.push({
        affiliateId: affiliate._id,
        name: affiliate.name,
        email: affiliate.email,
        joinedAt: affiliate._creationTime,
        clicks: clicksByAffiliate.get(key) ?? 0,
        conversions: conversionsByAffiliate.get(key) ?? 0,
        totalRevenue: revenueByAffiliate.get(key) ?? 0,
        pendingCommission: pendingByAffiliate.get(key) ?? 0,
        confirmedCommission: confirmedByAffiliate.get(key) ?? 0,
      });
    }

    // Sort by total revenue descending
    result.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return result;
  },
});

/**
 * Get campaigns by IDs — batch query for the overview page.
 * Returns basic campaign info (id + name) for a set of campaign IDs.
 * Used by ZeroAffiliateList to avoid calling useQuery in a loop.
 */
export const getCampaignsByIds = query({
  args: {
    campaignIds: v.array(v.id("campaigns")),
  },
  returns: v.array(
    v.object({
      _id: v.id("campaigns"),
      name: v.string(),
      status: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const results: Array<{ _id: Id<"campaigns">; name: string; status: string }> = [];
    for (const id of args.campaignIds) {
      const doc = await ctx.db.get(id);
      if (doc && doc.tenantId === user.tenantId) {
        results.push({
          _id: doc._id,
          name: doc.name,
          status: doc.status,
        });
      }
    }
    return results;
  },
});

// ── Paginated listing query for /campaigns/all ────────────────────────────

/**
 * List campaigns with cursor-based pagination and multi-dimension filters.
 * Hydration strategy: frontend requests numItems=30, we post-filter, display up to 20.
 * Returns hasMoreFiltered=true if post-filtering removed items AND more pages exist.
 */
export const listCampaignsPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    statusFilter: v.optional(v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    )),
    commissionTypeFilter: v.optional(v.union(
      v.literal("percentage"),
      v.literal("flatFee")
    )),
    recurringFilter: v.optional(v.boolean()),
    createdAfter: v.optional(v.number()),
    createdBefore: v.optional(v.number()),
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.object({
    page: v.array(campaignReturnShape),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    hasMoreFiltered: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = user.tenantId;
    const includeArchived = args.includeArchived ?? false;

    // Choose index based on status filter
    let queryBuilder;
    if (args.statusFilter) {
      queryBuilder = ctx.db
        .query("campaigns")
        .withIndex("by_tenant_and_status", (q) =>
          q.eq("tenantId", tenantId).eq("status", args.statusFilter!)
        );
    } else {
      queryBuilder = ctx.db
        .query("campaigns")
        // by_tenant index auto-includes _creationTime — .order("desc") sorts newest first
        .withIndex("by_tenant", (q) =>
          q.eq("tenantId", tenantId)
        );
    }

    // Paginate with order desc (newest first)
    const paginated = await queryBuilder
      .order("desc")
      .paginate(args.paginationOpts);

    // Post-filter: archived (when no status filter set and not including archived)
    let filtered = paginated.page;
    if (!args.statusFilter && !includeArchived) {
      filtered = filtered.filter((c) => c.status !== "archived");
    }

    // Post-filter: commission type
    if (args.commissionTypeFilter) {
      filtered = filtered.filter(
        (c) => c.commissionType === args.commissionTypeFilter
      );
    }

    // Post-filter: recurring
    if (args.recurringFilter !== undefined) {
      filtered = filtered.filter(
        (c) => c.recurringCommission === args.recurringFilter
      );
    }

    // Post-filter: date range (using _creationTime epoch ms)
    if (args.createdAfter !== undefined) {
      filtered = filtered.filter((c) => c._creationTime >= args.createdAfter!);
    }
    if (args.createdBefore !== undefined) {
      filtered = filtered.filter((c) => c._creationTime <= args.createdBefore!);
    }

    // Hydration indicator: if post-filtering removed items AND more pages exist
    const hasMoreFiltered = filtered.length < paginated.page.length && !paginated.isDone;

    return {
      page: filtered.map(mapCampaignToReturnShape),
      isDone: paginated.isDone,
      continueCursor: paginated.continueCursor,
      hasMoreFiltered,
    };
  },
});

// ── Page-based listing query for /campaigns/all ───────────────────────────

/**
 * List campaigns with page-based pagination and multi-dimension filters.
 * Returns total count so frontend can show proper pagination controls.
 * Server-side filtering for all filter dimensions.
 */
export const listCampaignsPageBased = query({
  args: {
    page: v.number(),
    pageSize: v.number(),
    statusFilter: v.optional(v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    )),
    commissionTypeFilter: v.optional(v.union(
      v.literal("percentage"),
      v.literal("flatFee")
    )),
    recurringFilter: v.optional(v.boolean()),
    createdAfter: v.optional(v.number()),
    createdBefore: v.optional(v.number()),
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.object({
    page: v.array(campaignReturnShape),
    total: v.number(),
    pageNum: v.number(),
    pageSize: v.number(),
    totalPages: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = user.tenantId;
    const includeArchived = args.includeArchived ?? false;

    // Choose index based on status filter
    let queryBuilder;
    if (args.statusFilter) {
      queryBuilder = ctx.db
        .query("campaigns")
        .withIndex("by_tenant_and_status", (q) =>
          q.eq("tenantId", tenantId).eq("status", args.statusFilter!)
        );
    } else {
      queryBuilder = ctx.db
        .query("campaigns")
        .withIndex("by_tenant", (q) =>
          q.eq("tenantId", tenantId)
        );
    }

    // Fetch all filtered campaigns (we need all to know total count)
    // Then sort and slice for pagination
    const allCampaigns = await queryBuilder
      .order("desc")
      .collect();

    // Apply filters
    let filtered = allCampaigns;
    
    // Post-filter: archived (when no status filter set and not including archived)
    if (!args.statusFilter && !includeArchived) {
      filtered = filtered.filter((c) => c.status !== "archived");
    }

    // Post-filter: commission type
    if (args.commissionTypeFilter) {
      filtered = filtered.filter(
        (c) => c.commissionType === args.commissionTypeFilter
      );
    }

    // Post-filter: recurring
    if (args.recurringFilter !== undefined) {
      filtered = filtered.filter(
        (c) => c.recurringCommission === args.recurringFilter
      );
    }

    // Post-filter: date range
    if (args.createdAfter !== undefined) {
      filtered = filtered.filter((c) => c._creationTime >= args.createdAfter!);
    }
    if (args.createdBefore !== undefined) {
      filtered = filtered.filter((c) => c._creationTime <= args.createdBefore!);
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / args.pageSize) || 1;
    
    // Clamp page to valid range
    const pageNum = Math.max(1, Math.min(args.page, totalPages));
    
    // Calculate start and end indices
    const startIndex = (pageNum - 1) * args.pageSize;
    const endIndex = startIndex + args.pageSize;
    
    // Slice the filtered results
    const pageResults = filtered.slice(startIndex, endIndex);

    return {
      page: pageResults.map(mapCampaignToReturnShape),
      total,
      pageNum,
      pageSize: args.pageSize,
      totalPages,
    };
  },
});

// ── Overview queries ──────────────────────────────────────────────────────

/**
 * Get top 5 active campaigns sorted by conversion count.
 * ADR-3: Returns stats alongside campaigns so the frontend does NOT need
 * a separate getCampaignCardStats query. One internal round-trip only.
 * Fetches up to 50 active campaigns to find actual top converters (F32 fix).
 */
export const getTopCampaigns = query({
  args: {},
  returns: v.object({
    campaigns: v.array(campaignReturnShape),
  }),
  handler: async (ctx, _args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = user.tenantId;

    // Fetch up to 50 active campaigns, newest first
    let campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant_and_status", (q) =>
        q.eq("tenantId", tenantId).eq("status", "active")
      )
      .order("desc")
      .take(50);

    // Fall back to paused campaigns if no active ones exist
    if (campaigns.length === 0) {
      campaigns = await ctx.db
        .query("campaigns")
        .withIndex("by_tenant_and_status", (q) =>
          q.eq("tenantId", tenantId).eq("status", "paused")
        )
        .order("desc")
        .take(50);
    }

    if (campaigns.length === 0) {
      return { campaigns: [] };
    }

    // Return top 5 campaigns sorted by creation date (newest first)
    const top5 = campaigns.slice(0, 5);

    return {
      campaigns: top5.map(mapCampaignToReturnShape),
    };
  },
});

/**
 * Internal query to get campaign card stats by tenant ID.
 * Used by getTopCampaigns internally (ADR-3).
 */
export const getCampaignCardStatsInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.record(
    v.string(),
    v.object({
      affiliates: v.number(),
      conversions: v.number(),
      paidOut: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const tenantId = args.tenantId;

    // Fetch all conversions for tenant
    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    // Fetch all commissions for tenant
    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    // Fetch all referral links for affiliate counting
    const allReferralLinks = await ctx.db
      .query("referralLinks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    // Aggregate conversions per campaign
    const conversionsByCampaign = new Map<string, number>();
    for (const conv of allConversions) {
      if (conv.campaignId) {
        const key = conv.campaignId as string;
        conversionsByCampaign.set(key, (conversionsByCampaign.get(key) ?? 0) + 1);
      }
    }

    // Aggregate paid commissions per campaign
    const paidOutByCampaign = new Map<string, number>();
    for (const comm of allCommissions) {
      if (comm.status === "approved" || comm.status === "paid") {
        const key = comm.campaignId as string;
        paidOutByCampaign.set(key, (paidOutByCampaign.get(key) ?? 0) + comm.amount);
      }
    }

    // Count unique affiliates per campaign via referral links
    const affiliatesByCampaign = new Map<string, Set<string>>();
    for (const link of allReferralLinks) {
      if (link.campaignId) {
        const key = link.campaignId as string;
        if (!affiliatesByCampaign.has(key)) {
          affiliatesByCampaign.set(key, new Set());
        }
        affiliatesByCampaign.get(key)!.add(link.affiliateId as string);
      }
    }

    // Build result
    const result: Record<string, { affiliates: number; conversions: number; paidOut: number }> = {};
    const allCampaignIds = new Set<string>([
      ...conversionsByCampaign.keys(),
      ...paidOutByCampaign.keys(),
      ...affiliatesByCampaign.keys(),
    ]);

    for (const campaignId of allCampaignIds) {
      result[campaignId] = {
        affiliates: affiliatesByCampaign.get(campaignId)?.size ?? 0,
        conversions: conversionsByCampaign.get(campaignId) ?? 0,
        paidOut: paidOutByCampaign.get(campaignId) ?? 0,
      };
    }

    return result;
  },
});

/**
 * Get campaigns needing attention for the overview page.
 * Returns paused campaigns (up to 5) and total count.
 * Zero-affiliate detection handled entirely on frontend via getCampaignStats (F31/F47).
 */
export const getAttentionCampaigns = query({
  args: {},
  returns: v.object({
    pausedCampaigns: v.array(campaignReturnShape),
    pausedTotal: v.number(),
  }),
  handler: async (ctx, _args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = user.tenantId;

    // Fetch paused campaigns — up to 5 for display
    const pausedCampaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant_and_status", (q) =>
        q.eq("tenantId", tenantId).eq("status", "paused")
      )
      .order("desc")
      .take(5);

    // Count total paused campaigns
    const allPaused = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant_and_status", (q) =>
        q.eq("tenantId", tenantId).eq("status", "paused")
      )
      .collect();

    return {
      pausedCampaigns: pausedCampaigns.map(mapCampaignToReturnShape),
      pausedTotal: allPaused.length,
    };
  },
});
