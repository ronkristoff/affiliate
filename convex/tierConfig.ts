import { query, mutation, internalMutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { getAuthenticatedUser } from "./tenantContext";

/**
 * Tier Configuration Service
 * 
 * Provides centralized tier limit management for the platform.
 * All tier enforcement uses this service for consistency.
 */

/** Constant representing unlimited resource allowance */
export const UNLIMITED = -1;

// Default tier configurations (used for seeding and fallback)
export const DEFAULT_TIER_CONFIGS = {
  starter: {
    tier: "starter",
    price: 0,
    maxAffiliates: 100,
    maxCampaigns: 3,
    maxTeamMembers: 5,
    maxPayoutsPerMonth: 10,
    maxApiCalls: 1000,
    features: {
      customDomain: false,
      advancedAnalytics: false,
      prioritySupport: false,
    },
  },
  growth: {
    tier: "growth",
    price: 99,
    maxAffiliates: 5000,
    maxCampaigns: 10,
    maxTeamMembers: 20,
    maxPayoutsPerMonth: 100,
    maxApiCalls: 10000,
    features: {
      customDomain: true,
      advancedAnalytics: true,
      prioritySupport: false,
    },
  },
  scale: {
    tier: "scale",
    price: 299,
    maxAffiliates: UNLIMITED,
    maxCampaigns: UNLIMITED,
    maxTeamMembers: UNLIMITED,
    maxPayoutsPerMonth: UNLIMITED,
    maxApiCalls: UNLIMITED,
    features: {
      customDomain: true,
      advancedAnalytics: true,
      prioritySupport: true,
    },
  },
} as const;

export type TierName = keyof typeof DEFAULT_TIER_CONFIGS;

// Limit status type for checkLimit responses
export const LIMIT_STATUS = {
  OK: "ok",
  WARNING: "warning",    // 80% threshold
  CRITICAL: "critical",  // 95% threshold
  BLOCKED: "blocked",    // 100% threshold
} as const;

export type LimitStatus = typeof LIMIT_STATUS[keyof typeof LIMIT_STATUS];

// Resource types that can be checked
export const RESOURCE_TYPES = {
  AFFILIATES: "affiliates",
  CAMPAIGNS: "campaigns",
  TEAM_MEMBERS: "teamMembers",
  PAYOUTS: "payouts",
  API_CALLS: "apiCalls",
} as const;

export type ResourceType = typeof RESOURCE_TYPES[keyof typeof RESOURCE_TYPES];

// Map resource types to tier config fields
const RESOURCE_TO_LIMIT_FIELD: Record<ResourceType, keyof typeof DEFAULT_TIER_CONFIGS.starter> = {
  affiliates: "maxAffiliates",
  campaigns: "maxCampaigns",
  teamMembers: "maxTeamMembers",
  payouts: "maxPayoutsPerMonth",
  apiCalls: "maxApiCalls",
};

// Validator for tier config response
const tierConfigResponseValidator = v.object({
  tier: v.string(),
  price: v.number(),
  maxAffiliates: v.number(),
  maxCampaigns: v.number(),
  maxTeamMembers: v.number(),
  maxPayoutsPerMonth: v.number(),
  maxApiCalls: v.number(),
  features: v.object({
    customDomain: v.boolean(),
    advancedAnalytics: v.boolean(),
    prioritySupport: v.boolean(),
  }),
});

// Validator for limit check result
const limitCheckResultValidator = v.object({
  status: v.union(
    v.literal("ok"),
    v.literal("warning"),
    v.literal("critical"),
    v.literal("blocked")
  ),
  percentage: v.number(),
  current: v.number(),
  limit: v.number(),
  resourceType: v.string(),
  upgradePrompt: v.boolean(),
});

// Validator for resource type
const resourceTypeValidator = v.union(
  v.literal("affiliates"),
  v.literal("campaigns"),
  v.literal("teamMembers"),
  v.literal("payouts"),
  v.literal("apiCalls")
);

/**
 * Helper function to build a tier config response object.
 * Ensures consistent structure across all functions.
 */
function buildTierConfigResponse(config: {
  tier: string;
  price: number;
  maxAffiliates: number;
  maxCampaigns: number;
  maxTeamMembers: number;
  maxPayoutsPerMonth: number;
  maxApiCalls: number;
  features: {
    customDomain: boolean;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
  };
}) {
  return {
    tier: config.tier,
    price: config.price,
    maxAffiliates: config.maxAffiliates,
    maxCampaigns: config.maxCampaigns,
    maxTeamMembers: config.maxTeamMembers,
    maxPayoutsPerMonth: config.maxPayoutsPerMonth,
    maxApiCalls: config.maxApiCalls,
    features: config.features,
  };
}

/**
 * Get tier configuration for a tenant.
 * Returns the complete tier configuration including limits and features.
 * AC1, AC2, AC3: Returns correct limits for Starter, Growth, and Scale plans.
 */
export const getTierConfig = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: tierConfigResponseValidator,
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Get tier from tenant, default to starter
    const tierName = (tenant.plan || "starter") as TierName;
    
    // Look up tier configuration from database
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", tierName))
      .unique();

    // Return database config or fall back to defaults
    if (tierConfig) {
      return buildTierConfigResponse(tierConfig);
    }

    // Fallback to default configuration if not in database
    const defaultConfig = DEFAULT_TIER_CONFIGS[tierName] || DEFAULT_TIER_CONFIGS.starter;
    return buildTierConfigResponse(defaultConfig);
  },
});

/**
 * Get tier configuration for the current authenticated user's tenant.
 */
export const getMyTierConfig = query({
  args: {},
  returns: v.union(tierConfigResponseValidator, v.null()),
  handler: async (ctx, _args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const tenant = await ctx.db.get(user.tenantId);
    if (!tenant) {
      return null;
    }

    const tierName = (tenant.plan || "starter") as TierName;
    
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", tierName))
      .unique();

    if (tierConfig) {
      return buildTierConfigResponse(tierConfig);
    }

    const defaultConfig = DEFAULT_TIER_CONFIGS[tierName] || DEFAULT_TIER_CONFIGS.starter;
    return buildTierConfigResponse(defaultConfig);
  },
});

/**
 * Helper to get current resource count for a tenant.
 * @param ctx - Query context from Convex
 * @param tenantId - The tenant to check resources for
 * @param resourceType - The type of resource to count
 * @returns The current count of the resource type
 * @throws Error if resourceType is "apiCalls" (not yet implemented)
 */
async function getResourceCount(
  ctx: QueryCtx,
  tenantId: Id<"tenants">,
  resourceType: ResourceType
): Promise<number> {
  switch (resourceType) {
    case "affiliates":
      const affiliates = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect();
      return affiliates.length;
    case "campaigns":
      const campaigns = await ctx.db
        .query("campaigns")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect();
      return campaigns.length;
    case "teamMembers":
      const users = await ctx.db
        .query("users")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect();
      return users.length;
    case "payouts":
      // Payouts are counted per month - for simplicity, count all pending/approved payouts
      const payouts = await ctx.db
        .query("payouts")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect();
      return payouts.length;
    case "apiCalls":
      // API calls tracking requires a separate usage tracking mechanism
      // This is a placeholder that should be implemented with a usageTracking table
      throw new Error(
        "API call tracking is not yet implemented. Please use a different resource type or implement usage tracking."
      );
    default:
      return 0;
  }
}

/**
 * Calculate limit status based on percentage.
 * @param current - Current resource count
 * @param limit - Maximum allowed (UNLIMITED for no limit)
 * @returns Status object with percentage and upgrade prompt flag
 */
function calculateLimitStatus(current: number, limit: number): {
  status: LimitStatus;
  percentage: number;
  upgradePrompt: boolean;
} {
  // Unlimited
  if (limit === UNLIMITED) {
    return { status: LIMIT_STATUS.OK, percentage: 0, upgradePrompt: false };
  }

  const percentage = limit > 0 ? Math.round((current / limit) * 100) : 0;

  if (percentage >= 100) {
    return { status: LIMIT_STATUS.BLOCKED, percentage, upgradePrompt: true };
  } else if (percentage >= 95) {
    return { status: LIMIT_STATUS.CRITICAL, percentage, upgradePrompt: true };
  } else if (percentage >= 80) {
    return { status: LIMIT_STATUS.WARNING, percentage, upgradePrompt: false };
  } else {
    return { status: LIMIT_STATUS.OK, percentage, upgradePrompt: false };
  }
}

/**
 * Check limit status for a resource type.
 * AC4: Soft limit warning at 80%
 * AC5: Hard limit warning at 95%
 * AC6: Hard limit blocking at 100%
 */
export const checkLimit = query({
  args: {
    tenantId: v.id("tenants"),
    resourceType: resourceTypeValidator,
  },
  returns: limitCheckResultValidator,
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Get tier configuration
    const tierName = (tenant.plan || "starter") as TierName;
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", tierName))
      .unique();

    const config = tierConfig || DEFAULT_TIER_CONFIGS[tierName] || DEFAULT_TIER_CONFIGS.starter;
    
    // Get the limit for this resource type
    const limitField = RESOURCE_TO_LIMIT_FIELD[args.resourceType];
    const limit = config[limitField] as number;

    // Get current count based on resource type
    const current = await getResourceCount(ctx, args.tenantId, args.resourceType);

    // Calculate status
    const { status, percentage, upgradePrompt } = calculateLimitStatus(current, limit);

    return {
      status,
      percentage,
      current,
      limit,
      resourceType: args.resourceType,
      upgradePrompt,
    };
  },
});

/**
 * Check if a resource creation would exceed tier limits.
 * Returns true if the action is allowed, false if blocked.
 * AC6: Blocks creation at 100% limit.
 */
export const canCreateResource = query({
  args: {
    tenantId: v.id("tenants"),
    resourceType: resourceTypeValidator,
  },
  returns: v.object({
    allowed: v.boolean(),
    reason: v.optional(v.string()),
    current: v.number(),
    limit: v.number(),
  }),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      return { allowed: false, reason: "Tenant not found", current: 0, limit: 0 };
    }

    const tierName = (tenant.plan || "starter") as TierName;
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", tierName))
      .unique();

    const config = tierConfig || DEFAULT_TIER_CONFIGS[tierName] || DEFAULT_TIER_CONFIGS.starter;
    const limitField = RESOURCE_TO_LIMIT_FIELD[args.resourceType];
    const limit = config[limitField] as number;

    // Unlimited
    if (limit === UNLIMITED) {
      return { allowed: true, current: 0, limit };
    }

    // Get current count
    const current = await getResourceCount(ctx, args.tenantId, args.resourceType);

    // Check if at or over limit
    if (current >= limit) {
      return {
        allowed: false,
        reason: `You have reached the maximum number of ${args.resourceType} (${limit}) for your plan. Please upgrade to create more.`,
        current,
        limit,
      };
    }

    return { allowed: true, current, limit };
  },
});

/**
 * Mutation to check and enforce limit before resource creation.
 * Use this in mutations that create resources to enforce tier limits.
 * Throws an error if limit is exceeded.
 */
export const enforceLimit = mutation({
  args: {
    tenantId: v.id("tenants"),
    resourceType: resourceTypeValidator,
  },
  returns: v.object({
    allowed: v.boolean(),
    current: v.number(),
    limit: v.number(),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Verify tenant access
    if (authUser.tenantId !== args.tenantId) {
      throw new Error("Access denied: Cannot access this tenant's resources");
    }

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const tierName = (tenant.plan || "starter") as TierName;
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", tierName))
      .unique();

    const config = tierConfig || DEFAULT_TIER_CONFIGS[tierName] || DEFAULT_TIER_CONFIGS.starter;
    const limitField = RESOURCE_TO_LIMIT_FIELD[args.resourceType];
    const limit = config[limitField] as number;

    // Unlimited
    if (limit === UNLIMITED) {
      return { allowed: true, current: 0, limit: UNLIMITED };
    }

    // Get current count
    const current = await getResourceCount(ctx, args.tenantId, args.resourceType);

    // Check if at or over limit
    if (current >= limit) {
      // Log the blocked attempt
      await ctx.db.insert("auditLogs", {
        tenantId: args.tenantId,
        action: "limit_exceeded",
        entityType: "tier",
        entityId: args.tenantId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          additionalInfo: `Resource type: ${args.resourceType}, Current: ${current}, Limit: ${limit}`,
        },
      });

      throw new Error(
        `You have reached the maximum number of ${args.resourceType} (${limit}) for your plan. Please upgrade to create more.`
      );
    }

    return { allowed: true, current, limit };
  },
});

/**
 * Get all limit statuses for a tenant.
 * Useful for dashboard display.
 */
export const getAllLimits = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.object({
    affiliates: v.object({
      status: v.union(v.literal("ok"), v.literal("warning"), v.literal("critical"), v.literal("blocked")),
      percentage: v.number(),
      current: v.number(),
      limit: v.number(),
    }),
    campaigns: v.object({
      status: v.union(v.literal("ok"), v.literal("warning"), v.literal("critical"), v.literal("blocked")),
      percentage: v.number(),
      current: v.number(),
      limit: v.number(),
    }),
    teamMembers: v.object({
      status: v.union(v.literal("ok"), v.literal("warning"), v.literal("critical"), v.literal("blocked")),
      percentage: v.number(),
      current: v.number(),
      limit: v.number(),
    }),
    payouts: v.object({
      status: v.union(v.literal("ok"), v.literal("warning"), v.literal("critical"), v.literal("blocked")),
      percentage: v.number(),
      current: v.number(),
      limit: v.number(),
    }),
    tierName: v.string(),
  }),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const tierName = (tenant.plan || "starter") as TierName;
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", tierName))
      .unique();

    const config = tierConfig || DEFAULT_TIER_CONFIGS[tierName] || DEFAULT_TIER_CONFIGS.starter;

    // Get counts for each resource type
    const [affiliatesCount, campaignsCount, teamMembersCount, payoutsCount] = await Promise.all([
      getResourceCount(ctx, args.tenantId, "affiliates"),
      getResourceCount(ctx, args.tenantId, "campaigns"),
      getResourceCount(ctx, args.tenantId, "teamMembers"),
      getResourceCount(ctx, args.tenantId, "payouts"),
    ]);

    // Calculate status for each resource
    const affiliatesStatus = calculateLimitStatus(affiliatesCount, config.maxAffiliates);
    const campaignsStatus = calculateLimitStatus(campaignsCount, config.maxCampaigns);
    const teamMembersStatus = calculateLimitStatus(teamMembersCount, config.maxTeamMembers);
    const payoutsStatus = calculateLimitStatus(payoutsCount, config.maxPayoutsPerMonth);

    return {
      affiliates: {
        status: affiliatesStatus.status,
        percentage: affiliatesStatus.percentage,
        current: affiliatesCount,
        limit: config.maxAffiliates,
      },
      campaigns: {
        status: campaignsStatus.status,
        percentage: campaignsStatus.percentage,
        current: campaignsCount,
        limit: config.maxCampaigns,
      },
      teamMembers: {
        status: teamMembersStatus.status,
        percentage: teamMembersStatus.percentage,
        current: teamMembersCount,
        limit: config.maxTeamMembers,
      },
      payouts: {
        status: payoutsStatus.status,
        percentage: payoutsStatus.percentage,
        current: payoutsCount,
        limit: config.maxPayoutsPerMonth,
      },
      tierName: config.tier,
    };
  },
});

/**
 * Internal mutation to seed default tier configurations.
 * Should be called during initial setup or when new tiers are added.
 */
export const seedTierConfigs = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx, _args) => {
    for (const config of Object.values(DEFAULT_TIER_CONFIGS)) {
      const existing = await ctx.db
        .query("tierConfigs")
        .withIndex("by_tier", (q) => q.eq("tier", config.tier))
        .unique();

      if (!existing) {
        await ctx.db.insert("tierConfigs", {
          tier: config.tier,
          price: config.price,
          maxAffiliates: config.maxAffiliates,
          maxCampaigns: config.maxCampaigns,
          maxTeamMembers: config.maxTeamMembers,
          maxPayoutsPerMonth: config.maxPayoutsPerMonth,
          maxApiCalls: config.maxApiCalls,
          features: config.features,
        });
      }
    }
    return null;
  },
});

/**
 * Get all available tier configurations (for Pricing Display, etc).
 */
export const getAllTierConfigs = query({
  args: {},
  returns: v.array(tierConfigResponseValidator),
  handler: async (ctx, _args) => {
    const configs = await ctx.db.query("tierConfigs").collect();

    if (configs.length === 0) {
      // Return defaults if no configs in database
      return Object.values(DEFAULT_TIER_CONFIGS).map((config) => ({
        tier: config.tier,
        price: config.price,
        maxAffiliates: config.maxAffiliates,
        maxCampaigns: config.maxCampaigns,
        maxTeamMembers: config.maxTeamMembers,
        maxPayoutsPerMonth: config.maxPayoutsPerMonth,
        maxApiCalls: config.maxApiCalls,
        features: config.features,
      }));
    }

    return configs.map((c) => ({
      tier: c.tier,
      price: c.price,
      maxAffiliates: c.maxAffiliates,
      maxCampaigns: c.maxCampaigns,
      maxTeamMembers: c.maxTeamMembers,
      maxPayoutsPerMonth: c.maxPayoutsPerMonth,
      maxApiCalls: c.maxApiCalls,
      features: c.features,
    }));
  },
});
