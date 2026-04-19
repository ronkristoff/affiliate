import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { getAuthenticatedUser } from "./tenantContext";

async function resolveDefaultPlanName(ctx: QueryCtx): Promise<string> {
  const defaultTier = await ctx.db
    .query("tierConfigs")
    .withIndex("by_default", (q) => q.eq("isDefault", true))
    .first();
  if (defaultTier && defaultTier.isActive) return defaultTier.tier;
  const fallback = Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.isDefault && c.isActive);
  return fallback?.tier ?? "starter";
}

/**
 * Tier Configuration Service
 *
 * Provides centralized tier limit management for the platform.
 * Plans are fully dynamic — defined in the tierConfigs database table.
 * DEFAULT_TIER_CONFIGS is used only for seeding.
 */

export const UNLIMITED = -1;

export const DEFAULT_TIER_CONFIGS = {
  starter: {
    tier: "starter",
    price: 0,
    maxAffiliates: 1000,
    maxCampaigns: 3,
    maxTeamMembers: 5,
    maxPayoutsPerMonth: 10,
    maxApiCalls: 1000,
    features: {
      customDomain: false,
      advancedAnalytics: false,
      prioritySupport: false,
    },
    isDefault: true,
    displayOrder: 1,
    isActive: true,
  },
  growth: {
    tier: "growth",
    price: 2499,
    maxAffiliates: 5000,
    maxCampaigns: 10,
    maxTeamMembers: 20,
    maxPayoutsPerMonth: 100,
    maxApiCalls: 10000,
    features: {
      customDomain: false,
      advancedAnalytics: true,
      prioritySupport: false,
    },
    isDefault: false,
    displayOrder: 2,
    isActive: true,
  },
  scale: {
    tier: "scale",
    price: 4999,
    maxAffiliates: UNLIMITED,
    maxCampaigns: UNLIMITED,
    maxTeamMembers: UNLIMITED,
    maxPayoutsPerMonth: UNLIMITED,
    maxApiCalls: UNLIMITED,
    features: {
      customDomain: false,
      advancedAnalytics: true,
      prioritySupport: true,
    },
    isDefault: false,
    displayOrder: 3,
    isActive: true,
  },
} as const;

export const LIMIT_STATUS = {
  OK: "ok",
  WARNING: "warning",
  CRITICAL: "critical",
  BLOCKED: "blocked",
} as const;

export type LimitStatus = typeof LIMIT_STATUS[keyof typeof LIMIT_STATUS];

export const RESOURCE_TYPES = {
  AFFILIATES: "affiliates",
  CAMPAIGNS: "campaigns",
  TEAM_MEMBERS: "teamMembers",
  PAYOUTS: "payouts",
  API_CALLS: "apiCalls",
} as const;

export type ResourceType = typeof RESOURCE_TYPES[keyof typeof RESOURCE_TYPES];

type TierLimitField = "maxAffiliates" | "maxCampaigns" | "maxTeamMembers" | "maxPayoutsPerMonth" | "maxApiCalls";

const RESOURCE_TO_LIMIT_FIELD: Record<ResourceType, TierLimitField> = {
  affiliates: "maxAffiliates",
  campaigns: "maxCampaigns",
  teamMembers: "maxTeamMembers",
  payouts: "maxPayoutsPerMonth",
  apiCalls: "maxApiCalls",
};

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
  isDefault: v.boolean(),
  displayOrder: v.number(),
  isActive: v.boolean(),
});

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

const resourceTypeValidator = v.union(
  v.literal("affiliates"),
  v.literal("campaigns"),
  v.literal("teamMembers"),
  v.literal("payouts"),
  v.literal("apiCalls")
);

function buildTierConfigResponse(config: Doc<"tierConfigs">) {
  return {
    tier: config.tier,
    price: config.price,
    maxAffiliates: config.maxAffiliates,
    maxCampaigns: config.maxCampaigns,
    maxTeamMembers: config.maxTeamMembers,
    maxPayoutsPerMonth: config.maxPayoutsPerMonth,
    maxApiCalls: config.maxApiCalls,
    features: config.features,
    isDefault: config.isDefault,
    displayOrder: config.displayOrder,
    isActive: config.isActive,
  };
}

/**
 * Get the name of the default (free) plan from the database.
 * Falls back to the first DEFAULT_TIER_CONFIG with isDefault=true.
 */
export const getDefaultPlanName = query({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const defaultTier = await ctx.db
      .query("tierConfigs")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .first();

    if (defaultTier && defaultTier.isActive) {
      return defaultTier.tier;
    }

    const fallback = Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.isDefault && c.isActive);
    return fallback?.tier ?? "starter";
  },
});

/**
 * Internal query to get default plan name (for use in mutations).
 */
export const getDefaultPlanNameInternal = internalQuery({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const defaultTier = await ctx.db
      .query("tierConfigs")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .first();

    if (defaultTier && defaultTier.isActive) {
      return defaultTier.tier;
    }

    const fallback = Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.isDefault && c.isActive);
    return fallback?.tier ?? "starter";
  },
});

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

    const tierName = tenant.plan || await resolveDefaultPlanName(ctx);

    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", tierName))
      .unique();

    if (tierConfig) {
      return buildTierConfigResponse(tierConfig);
    }

    const defaultConfig = Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.tier === tierName)
      || Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.isDefault)!;
    return buildTierConfigResponse(defaultConfig as any);
  },
});

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

    const tierName = tenant.plan || await resolveDefaultPlanName(ctx);

    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", tierName))
      .unique();

    if (tierConfig) {
      return buildTierConfigResponse(tierConfig);
    }

    const defaultConfig = Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.tier === tierName)
      || Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.isDefault)!;
    return buildTierConfigResponse(defaultConfig as any);
  },
});

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
      const payouts = await ctx.db
        .query("payouts")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect();
      return payouts.length;
    case "apiCalls":
      const apiCallsStats = await ctx.db
        .query("tenantStats")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .first();
      return apiCallsStats?.apiCallsThisMonth ?? 0;
    default:
      return 0;
  }
}

function calculateLimitStatus(current: number, limit: number): {
  status: LimitStatus;
  percentage: number;
  upgradePrompt: boolean;
} {
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

    const tierName = tenant.plan || await resolveDefaultPlanName(ctx);
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", tierName))
      .unique();

    const config = tierConfig
      || (Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.tier === tierName) as any)
      || (Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.isDefault) as any);

    const limitField = RESOURCE_TO_LIMIT_FIELD[args.resourceType];
    const limit = config[limitField] as number;

    const current = await getResourceCount(ctx, args.tenantId, args.resourceType);
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

    const tierName = tenant.plan || await resolveDefaultPlanName(ctx);
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", tierName))
      .unique();

    const config = tierConfig
      || (Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.tier === tierName) as any)
      || (Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.isDefault) as any);

    const limitField = RESOURCE_TO_LIMIT_FIELD[args.resourceType];
    const limit = config[limitField] as number;

    if (limit === UNLIMITED) {
      return { allowed: true, current: 0, limit };
    }

    const current = await getResourceCount(ctx, args.tenantId, args.resourceType);

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

    if (authUser.tenantId !== args.tenantId) {
      throw new Error("Access denied: Cannot access this tenant's resources");
    }

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const tierName = tenant.plan || await resolveDefaultPlanName(ctx);
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", tierName))
      .unique();

    const config = tierConfig
      || (Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.tier === tierName) as any)
      || (Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.isDefault) as any);

    const limitField = RESOURCE_TO_LIMIT_FIELD[args.resourceType];
    const limit = config[limitField] as number;

    if (limit === UNLIMITED) {
      return { allowed: true, current: 0, limit: UNLIMITED };
    }

    const current = await getResourceCount(ctx, args.tenantId, args.resourceType);

    if (current >= limit) {
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
    apiCalls: v.object({
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

    const tierName = tenant.plan || await resolveDefaultPlanName(ctx);
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", tierName))
      .unique();

    const config = tierConfig
      || (Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.tier === tierName) as any)
      || (Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.isDefault) as any);

    const [affiliatesCount, campaignsCount, teamMembersCount, payoutsCount, apiCallsCount] = await Promise.all([
      getResourceCount(ctx, args.tenantId, "affiliates"),
      getResourceCount(ctx, args.tenantId, "campaigns"),
      getResourceCount(ctx, args.tenantId, "teamMembers"),
      getResourceCount(ctx, args.tenantId, "payouts"),
      getResourceCount(ctx, args.tenantId, "apiCalls"),
    ]);

    const affiliatesStatus = calculateLimitStatus(affiliatesCount, config.maxAffiliates);
    const campaignsStatus = calculateLimitStatus(campaignsCount, config.maxCampaigns);
    const teamMembersStatus = calculateLimitStatus(teamMembersCount, config.maxTeamMembers);
    const payoutsStatus = calculateLimitStatus(payoutsCount, config.maxPayoutsPerMonth);
    const apiCallsStatus = calculateLimitStatus(apiCallsCount, config.maxApiCalls);

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
      apiCalls: {
        status: apiCallsStatus.status,
        percentage: apiCallsStatus.percentage,
        current: apiCallsCount,
        limit: config.maxApiCalls,
      },
      tierName: config.tier,
    };
  },
});

export const seedTierConfigs = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx, _args) => {
    for (const config of Object.values(DEFAULT_TIER_CONFIGS)) {
      const existing = await ctx.db
        .query("tierConfigs")
        .withIndex("by_tier", (q) => q.eq("tier", config.tier))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          price: config.price,
          maxAffiliates: config.maxAffiliates,
          maxCampaigns: config.maxCampaigns,
          maxTeamMembers: config.maxTeamMembers,
          maxPayoutsPerMonth: config.maxPayoutsPerMonth,
          maxApiCalls: config.maxApiCalls,
          features: config.features,
          displayOrder: config.displayOrder,
          isActive: config.isActive,
        });
      } else {
        await ctx.db.insert("tierConfigs", {
          tier: config.tier,
          price: config.price,
          maxAffiliates: config.maxAffiliates,
          maxCampaigns: config.maxCampaigns,
          maxTeamMembers: config.maxTeamMembers,
          maxPayoutsPerMonth: config.maxPayoutsPerMonth,
          maxApiCalls: config.maxApiCalls,
          features: config.features,
          isDefault: config.isDefault,
          displayOrder: config.displayOrder,
          isActive: config.isActive,
        });
      }
    }
    return null;
  },
});

/**
 * Get all active tier configurations ordered by displayOrder.
 * Used for pricing pages and upgrade flows.
 */
export const getAllTierConfigs = query({
  args: {},
  returns: v.array(tierConfigResponseValidator),
  handler: async (ctx, _args) => {
    const configs = await ctx.db
      .query("tierConfigs")
      .withIndex("by_display_order")
      .order("asc")
      .collect();

    const activeConfigs = configs.filter((c) => c.isActive);

    if (activeConfigs.length === 0) {
      return Object.values(DEFAULT_TIER_CONFIGS)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((config) => buildTierConfigResponse(config as any));
    }

    return activeConfigs.map((c) => buildTierConfigResponse(c));
  },
});

/**
 * Get all non-default (paid) tier configurations.
 * Used for upgrade/checkout flows.
 */
export const getPaidTierConfigs = query({
  args: {},
  returns: v.array(tierConfigResponseValidator),
  handler: async (ctx, _args) => {
    const configs = await ctx.db
      .query("tierConfigs")
      .withIndex("by_display_order")
      .order("asc")
      .collect();

    const paidConfigs = configs.filter((c) => c.isActive && !c.isDefault);

    if (paidConfigs.length === 0) {
      return Object.values(DEFAULT_TIER_CONFIGS)
        .filter((c) => !c.isDefault)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((config) => buildTierConfigResponse(config as any));
    }

    return paidConfigs.map((c) => buildTierConfigResponse(c));
  },
});

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
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      return {
        allowed: false,
        reason: "Tenant not found",
        current: 0,
        limit: 0,
        percentage: 0,
        status: "blocked" as const,
      };
    }

    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const current = campaigns.length;

    const tierName = tenant.plan || await resolveDefaultPlanName(ctx);
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", tierName))
      .unique();

    const config = tierConfig
      || (Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.tier === tierName) as any)
      || (Object.values(DEFAULT_TIER_CONFIGS).find((c) => c.isDefault) as any);

    const limit = config?.maxCampaigns ?? 3;

    if (limit === UNLIMITED) {
      return {
        allowed: true,
        current,
        limit: UNLIMITED,
        percentage: 0,
        status: "ok" as const,
      };
    }

    const percentage = limit > 0 ? Math.round((current / limit) * 100) : 0;

    let status: "ok" | "warning" | "critical" | "blocked" = "ok";
    if (percentage >= 100) {
      status = "blocked";
    } else if (percentage >= 95) {
      status = "critical";
    } else if (percentage >= 80) {
      status = "warning";
    }

    if (current >= limit) {
      return {
        allowed: false,
        reason: `You have reached the maximum number of campaigns (${limit}) for your plan. Please upgrade to create more.`,
        current,
        limit,
        percentage,
        status,
      };
    }

    return {
      allowed: true,
      current,
      limit,
      percentage,
      status,
    };
  },
});
