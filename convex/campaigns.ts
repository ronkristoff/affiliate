import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthenticatedUser } from "./tenantContext";
import { internal } from "./_generated/api";

/**
 * Campaign Management Functions
 * 
 * Provides CRUD operations for affiliate campaigns with multi-tenant data isolation.
 */

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
  returns: v.union(
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
      autoApproveCommissions: v.optional(v.boolean()),
      approvalThreshold: v.optional(v.number()),
      status: v.string(),
    }),
    v.null()
  ),
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

    return {
      ...campaign,
      commissionRate: campaign.commissionValue,
      recurringCommissions: campaign.recurringCommission,
    };
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
    if (args.commissionRate !== undefined) updates.commissionRate = args.commissionRate;
    if (args.cookieDuration !== undefined) updates.cookieDuration = args.cookieDuration;
    if (args.recurringCommissions !== undefined) updates.recurringCommissions = args.recurringCommissions;
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

    return stats;
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
