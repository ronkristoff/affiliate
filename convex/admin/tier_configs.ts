// Story 11.6: Tier Configuration Management
// Backend mutations, queries, and internal functions for platform admin tier configuration

import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./_helpers";

// =============================================================================
// Constants
// =============================================================================

/** Maximum allowed value for any tier config field */
const MAX_TIER_VALUE = 100000;

/**
 * Validate that the tier name is well-formed.
 * Tier names must be lowercase alphanumeric with hyphens, 2-30 chars.
 */
export function validateTierName(tierName: string): string | undefined {
  if (!tierName || tierName.trim().length === 0) {
    return "Tier name is required";
  }
  if (tierName.length > 30) {
    return "Tier name must be 30 characters or less";
  }
  if (!/^[a-z][a-z0-9-]*$/.test(tierName)) {
    return 'Tier name must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens';
  }
  return undefined;
}

// =============================================================================
// Validators
// =============================================================================

/** Validator for feature gates object */
const featuresValidator = v.object({
  customDomain: v.boolean(),
  advancedAnalytics: v.boolean(),
  prioritySupport: v.boolean(),
});

/** Validator for tier config update arguments */
const tierConfigUpdateArgs = v.object({
  tier: v.string(),
  price: v.number(),
  maxAffiliates: v.number(),
  maxCampaigns: v.number(),
  maxTeamMembers: v.number(),
  maxPayoutsPerMonth: v.number(),
  maxApiCalls: v.number(),
  features: featuresValidator,
  forceApply: v.boolean(),
});

/** Validator for impact assessment arguments */
const impactAssessmentArgs = v.object({
  tier: v.string(),
  proposedValues: v.object({
    price: v.optional(v.number()),
    maxAffiliates: v.optional(v.number()),
    maxCampaigns: v.optional(v.number()),
    maxTeamMembers: v.optional(v.number()),
    maxPayoutsPerMonth: v.optional(v.number()),
    maxApiCalls: v.optional(v.number()),
  }),
});

// =============================================================================
// Pure Business Logic (exported for testing)
// =============================================================================

/**
 * Validate tier configuration values.
 * Returns an array of error messages, or empty if valid.
 *
 * Rules:
 * - Price must be >= 0
 * - Limit values must be > 0 or exactly -1 (unlimited)
 * - Values must not exceed MAX_TIER_VALUE
 */
export function validateTierConfigValues(values: {
  price: number;
  maxAffiliates: number;
  maxCampaigns: number;
  maxTeamMembers: number;
  maxPayoutsPerMonth: number;
  maxApiCalls: number;
}): string[] {
  const errors: string[] = [];

  // Price validation
  if (values.price < 0) {
    errors.push("Price must be >= 0");
  }
  if (values.price > MAX_TIER_VALUE) {
    errors.push(`Price cannot exceed ${MAX_TIER_VALUE.toLocaleString()}`);
  }

  // Limit validation helper
  const limitFields = [
    { key: "maxAffiliates", value: values.maxAffiliates, label: "Max Affiliates" },
    { key: "maxCampaigns", value: values.maxCampaigns, label: "Max Campaigns" },
    { key: "maxTeamMembers", value: values.maxTeamMembers, label: "Max Team Members" },
    { key: "maxPayoutsPerMonth", value: values.maxPayoutsPerMonth, label: "Max Payouts Per Month" },
    { key: "maxApiCalls", value: values.maxApiCalls, label: "Max API Calls" },
  ];

  for (const field of limitFields) {
    if (field.value !== -1 && field.value <= 0) {
      errors.push(`${field.label} must be > 0 or -1 (unlimited)`);
    }
    if (field.value > MAX_TIER_VALUE) {
      errors.push(`${field.label} cannot exceed ${MAX_TIER_VALUE.toLocaleString()}`);
    }
  }

  return errors;
}

/**
 * Calculate which limits have decreased between current and proposed values.
 * Returns an array of objects describing each decreased limit.
 */
export function calculateDecreasedLimits(
  current: {
    maxAffiliates: number;
    maxCampaigns: number;
    maxTeamMembers: number;
    maxPayoutsPerMonth: number;
    maxApiCalls: number;
  },
  proposed: {
    maxAffiliates: number;
    maxCampaigns: number;
    maxTeamMembers: number;
    maxPayoutsPerMonth: number;
    maxApiCalls: number;
  }
): Array<{
  field: string;
  label: string;
  oldValue: number;
  newValue: number;
}> {
  const decreased: Array<{
    field: string;
    label: string;
    oldValue: number;
    newValue: number;
  }> = [];

  const fields: Array<{
    field: keyof typeof current;
    label: string;
  }> = [
    { field: "maxAffiliates", label: "Max Affiliates" },
    { field: "maxCampaigns", label: "Max Campaigns" },
    { field: "maxTeamMembers", label: "Max Team Members" },
    { field: "maxPayoutsPerMonth", label: "Max Payouts Per Month" },
    { field: "maxApiCalls", label: "Max API Calls" },
  ];

  for (const f of fields) {
    const oldVal = current[f.field];
    const newVal = proposed[f.field];

    // A limit has decreased if:
    // - Old was unlimited (-1) and new is not
    // - Both were finite and new < old
    // - Old was finite and >= 0, new is lower positive number
    if (oldVal === -1 && newVal !== -1) {
      // Going from unlimited to limited is a decrease
      decreased.push({ field: f.field, label: f.label, oldValue: oldVal, newValue: newVal });
    } else if (oldVal !== -1 && newVal !== -1 && newVal < oldVal) {
      decreased.push({ field: f.field, label: f.label, oldValue: oldVal, newValue: newVal });
    }
  }

  return decreased;
}

/**
 * Format a limit value for display.
 * -1 becomes "Unlimited", otherwise returns the number.
 */
export function formatLimitValue(value: number): string | number {
  return value === -1 ? "unlimited" : value;
}

/**
 * Determine impact severity based on affected tenant count.
 */
export function determineImpactSeverity(
  affectedCount: number
): "none" | "warning" | "critical" {
  if (affectedCount === 0) return "none";
  if (affectedCount <= 5) return "warning";
  return "critical";
}

// =============================================================================
// Task 1: Tier Config Update Mutation (AC: #3, #4, #5, #6)
// =============================================================================

/**
 * Update a tier configuration.
 * Admin-only mutation that modifies tier pricing, limits, and feature gates.
 * Requires impact confirmation (forceApply=true) when limits decrease.
 * (AC: #3 - Validation, #4 - Impact Assessment, #5 - Save & Audit, #6 - Notifications)
 */
export const updateTierConfig = mutation({
  args: tierConfigUpdateArgs,
  returns: v.object({
    success: v.boolean(),
    impactReport: v.optional(
      v.object({
        affectedTenants: v.number(),
        severity: v.union(v.literal("none"), v.literal("warning"), v.literal("critical")),
      })
    ),
  }),
  handler: async (ctx, args) => {
    // Subtask 1.2: Require admin role
    const admin = await requireAdmin(ctx);

    // Subtask 1.3: Validate tier name
    const tierError = validateTierName(args.tier);
    if (tierError) {
      throw new Error(tierError);
    }

    // Subtask 1.3: Validate input values
    const validationErrors = validateTierConfigValues({
      price: args.price,
      maxAffiliates: args.maxAffiliates,
      maxCampaigns: args.maxCampaigns,
      maxTeamMembers: args.maxTeamMembers,
      maxPayoutsPerMonth: args.maxPayoutsPerMonth,
      maxApiCalls: args.maxApiCalls,
    });
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join("; "));
    }

    // Subtask 1.4: Fetch existing tier config
    const existingConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.tier))
      .unique();

    if (!existingConfig) {
      throw new Error(`Tier configuration not found for "${args.tier}"`);
    }

    // Subtask 1.5: Calculate impact — detect decreased limits
    const decreasedLimits = calculateDecreasedLimits(
      {
        maxAffiliates: existingConfig.maxAffiliates,
        maxCampaigns: existingConfig.maxCampaigns,
        maxTeamMembers: existingConfig.maxTeamMembers,
        maxPayoutsPerMonth: existingConfig.maxPayoutsPerMonth,
        maxApiCalls: existingConfig.maxApiCalls,
      },
      {
        maxAffiliates: args.maxAffiliates,
        maxCampaigns: args.maxCampaigns,
        maxTeamMembers: args.maxTeamMembers,
        maxPayoutsPerMonth: args.maxPayoutsPerMonth,
        maxApiCalls: args.maxApiCalls,
      }
    );

    // If there are decreased limits, count affected tenants
    let affectedTenantIds: string[] = [];
    if (decreasedLimits.length > 0) {
      // Get all tenants on this tier
      const tenantsOnTier = await ctx.db
        .query("tenants")
        .filter((q) => q.eq(q.field("plan"), args.tier))
        .collect();

      // For each decreased limit, check which tenants exceed the new limit
      const affectedSet = new Set<string>();
      for (const limit of decreasedLimits) {
        if (limit.newValue === -1) continue; // No impact if going to unlimited

        for (const tenant of tenantsOnTier) {
          const currentUsage = await getTenantResourceCount(ctx, tenant._id, limit.field);
          if (currentUsage > limit.newValue) {
            affectedSet.add(tenant._id);
          }
        }
      }
      affectedTenantIds = Array.from(affectedSet);
    }

    const impactSeverity = determineImpactSeverity(affectedTenantIds.length);

    // Subtask 1.6: If impact exists and not forceApply, reject
    if (affectedTenantIds.length > 0 && !args.forceApply) {
      return {
        success: false,
        impactReport: {
          affectedTenants: affectedTenantIds.length,
          severity: impactSeverity,
        },
      };
    }

    // Compute before values for audit log
    const beforeValues = {
      price: existingConfig.price,
      maxAffiliates: existingConfig.maxAffiliates,
      maxCampaigns: existingConfig.maxCampaigns,
      maxTeamMembers: existingConfig.maxTeamMembers,
      maxPayoutsPerMonth: existingConfig.maxPayoutsPerMonth,
      maxApiCalls: existingConfig.maxApiCalls,
      features: existingConfig.features,
    };

    // Subtask 1.7: Patch tierConfigs record
    await ctx.db.patch(existingConfig._id, {
      price: args.price,
      maxAffiliates: args.maxAffiliates,
      maxCampaigns: args.maxCampaigns,
      maxTeamMembers: args.maxTeamMembers,
      maxPayoutsPerMonth: args.maxPayoutsPerMonth,
      maxApiCalls: args.maxApiCalls,
      features: args.features,
    });

    // Subtask 1.8: Create audit log entry
    const afterValues = {
      price: args.price,
      maxAffiliates: args.maxAffiliates,
      maxCampaigns: args.maxCampaigns,
      maxTeamMembers: args.maxTeamMembers,
      maxPayoutsPerMonth: args.maxPayoutsPerMonth,
      maxApiCalls: args.maxApiCalls,
      features: args.features,
    };

    await ctx.db.insert("auditLogs", {
      // Platform-level change — tenantId is optional, use undefined
      tenantId: undefined,
      action: "tier_config_updated",
      entityType: "tierConfigs",
      entityId: existingConfig._id,
      actorId: admin.authId,
      actorType: "admin",
      metadata: {
        adminId: admin._id,
        adminEmail: admin.email,
        tier: args.tier,
        before: beforeValues,
        after: afterValues,
        affectedTenants: affectedTenantIds.length,
        decreasedLimits: decreasedLimits.map((l) => ({
          field: l.field,
          label: l.label,
          oldValue: l.oldValue,
          newValue: l.newValue,
        })),
      },
    });

    // Subtask 1.9: Create notification records for affected tenants (if limits decreased)
    if (affectedTenantIds.length > 0) {
      await createTierChangeNotifications(ctx, {
        tierName: args.tier,
        decreasedLimits: decreasedLimits.map((l) => ({
          field: l.field,
          label: l.label,
          oldValue: l.oldValue,
          newValue: l.newValue,
        })),
        affectedTenantIds,
      });
    }

    return {
      success: true,
      impactReport: affectedTenantIds.length > 0
        ? {
            affectedTenants: affectedTenantIds.length,
            severity: impactSeverity,
          }
        : undefined,
    };
  },
});

// =============================================================================
// Task 2: Create & Delete Tier Config Mutations
// =============================================================================

/**
 * Create a new tier configuration.
 * Admin-only mutation that creates a new tier with pricing, limits, and feature gates.
 */
export const createTierConfig = mutation({
  args: {
    tier: v.string(),
    price: v.number(),
    maxAffiliates: v.number(),
    maxCampaigns: v.number(),
    maxTeamMembers: v.number(),
    maxPayoutsPerMonth: v.number(),
    maxApiCalls: v.number(),
    features: featuresValidator,
  },
  returns: v.object({
    success: v.boolean(),
    tierConfigId: v.id("tierConfigs"),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    // Validate tier name format
    const tierError = validateTierName(args.tier);
    if (tierError) {
      throw new Error(tierError);
    }

    // Check for duplicate tier name
    const existing = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.tier))
      .unique();

    if (existing) {
      throw new Error(`A tier with the name "${args.tier}" already exists`);
    }

    // Validate input values
    const validationErrors = validateTierConfigValues({
      price: args.price,
      maxAffiliates: args.maxAffiliates,
      maxCampaigns: args.maxCampaigns,
      maxTeamMembers: args.maxTeamMembers,
      maxPayoutsPerMonth: args.maxPayoutsPerMonth,
      maxApiCalls: args.maxApiCalls,
    });
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join("; "));
    }

    // Insert new tier config
    const existingCount = (await ctx.db.query("tierConfigs").collect()).length;
    const tierConfigId = await ctx.db.insert("tierConfigs", {
      tier: args.tier,
      price: args.price,
      maxAffiliates: args.maxAffiliates,
      maxCampaigns: args.maxCampaigns,
      maxTeamMembers: args.maxTeamMembers,
      maxPayoutsPerMonth: args.maxPayoutsPerMonth,
      maxApiCalls: args.maxApiCalls,
      features: args.features,
      isDefault: false,
      displayOrder: existingCount + 1,
      isActive: true,
    });

    // Create audit log
    await ctx.db.insert("auditLogs", {
      tenantId: undefined,
      action: "tier_config_created",
      entityType: "tierConfigs",
      entityId: tierConfigId,
      actorId: admin.authId,
      actorType: "admin",
      metadata: {
        adminId: admin._id,
        adminEmail: admin.email,
        tier: args.tier,
        config: {
          price: args.price,
          maxAffiliates: args.maxAffiliates,
          maxCampaigns: args.maxCampaigns,
          maxTeamMembers: args.maxTeamMembers,
          maxPayoutsPerMonth: args.maxPayoutsPerMonth,
          maxApiCalls: args.maxApiCalls,
          features: args.features,
        },
      },
    });

    return { success: true, tierConfigId };
  },
});

/**
 * Delete a tier configuration.
 * Admin-only mutation that removes a tier. Cannot delete tiers with active tenants.
 */
export const deleteTierConfig = mutation({
  args: {
    tierConfigId: v.id("tierConfigs"),
  },
  returns: v.object({
    success: v.boolean(),
    affectedTenants: v.number(),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const config = await ctx.db.get(args.tierConfigId);
    if (!config) {
      throw new Error("Tier configuration not found");
    }

    // Check if any tenants are on this tier
    const tenantsOnTier = await ctx.db
      .query("tenants")
      .filter((q) => q.eq(q.field("plan"), config.tier))
      .collect();

    if (tenantsOnTier.length > 0) {
      return { success: false, affectedTenants: tenantsOnTier.length };
    }

    // Delete the tier config
    await ctx.db.delete(args.tierConfigId);

    // Create audit log
    await ctx.db.insert("auditLogs", {
      tenantId: undefined,
      action: "tier_config_deleted",
      entityType: "tierConfigs",
      entityId: args.tierConfigId,
      actorId: admin.authId,
      actorType: "admin",
      metadata: {
        adminId: admin._id,
        adminEmail: admin.email,
        tier: config.tier,
        deletedConfig: {
          price: config.price,
          maxAffiliates: config.maxAffiliates,
          maxCampaigns: config.maxCampaigns,
          maxTeamMembers: config.maxTeamMembers,
          maxPayoutsPerMonth: config.maxPayoutsPerMonth,
          maxApiCalls: config.maxApiCalls,
          features: config.features,
        },
      },
    });

    return { success: true, affectedTenants: 0 };
  },
});

// =============================================================================
// Task 3: Admin Tier Config Query (AC: #1)
// =============================================================================

/**
 * Get all tier configurations for admin display.
 * Returns sorted configs with tenant counts per tier.
 * (AC: #1 - Tier Configuration List View)
 */
export const getAdminTierConfigs = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("tierConfigs"),
      tier: v.string(),
      price: v.number(),
      maxAffiliates: v.number(),
      maxCampaigns: v.number(),
      maxTeamMembers: v.number(),
      maxPayoutsPerMonth: v.number(),
      maxApiCalls: v.number(),
      features: featuresValidator,
      tenantCount: v.number(),
    })
  ),
  handler: async (ctx) => {
    // Subtask 2.2: Admin-only
    await requireAdmin(ctx);

    // Subtask 2.3: Fetch all tier configs
    const allConfigs = await ctx.db.query("tierConfigs").collect();

    // Subtask 2.4: Count tenants per tier
    const allTenants = await ctx.db.query("tenants").collect();
    const tenantCountsByTier: Record<string, number> = {};
    for (const tenant of allTenants) {
      const plan = tenant.plan || "starter";
      tenantCountsByTier[plan] = (tenantCountsByTier[plan] || 0) + 1;
    }

    // Sort by creation time (earliest first) for consistent display
    const sorted = allConfigs.sort(
      (a, b) => a._creationTime - b._creationTime
    );

    return sorted.map((config) => ({
      _id: config._id,
      tier: config.tier,
      price: config.price,
      maxAffiliates: config.maxAffiliates,
      maxCampaigns: config.maxCampaigns,
      maxTeamMembers: config.maxTeamMembers,
      maxPayoutsPerMonth: config.maxPayoutsPerMonth,
      maxApiCalls: config.maxApiCalls,
      features: config.features,
      tenantCount: tenantCountsByTier[config.tier] || 0,
    }));
  },
});

// =============================================================================
// Task 3: Impact Assessment Query (AC: #4)
// =============================================================================

/**
 * Assess the impact of proposed tier config changes.
 * Returns a structured impact report showing affected tenants.
 * (AC: #4 - Impact Assessment on Limit Decreases)
 */
export const assessTierChangeImpact = query({
  args: impactAssessmentArgs,
  returns: v.object({
    affectedTenants: v.number(),
    breakdownByLimit: v.record(
      v.string(),
      v.object({
        oldValue: v.number(),
        newValue: v.number(),
        affectedCount: v.number(),
      })
    ),
    severity: v.union(v.literal("none"), v.literal("warning"), v.literal("critical")),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Subtask 3.2: Fetch current tier config
    const currentConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", args.tier))
      .unique();

    if (!currentConfig) {
      throw new Error(`Tier configuration not found for "${args.tier}"`);
    }

    // Subtask 3.3: Compare proposed limits against current limits
    const proposed = {
      maxAffiliates: args.proposedValues.maxAffiliates ?? currentConfig.maxAffiliates,
      maxCampaigns: args.proposedValues.maxCampaigns ?? currentConfig.maxCampaigns,
      maxTeamMembers: args.proposedValues.maxTeamMembers ?? currentConfig.maxTeamMembers,
      maxPayoutsPerMonth: args.proposedValues.maxPayoutsPerMonth ?? currentConfig.maxPayoutsPerMonth,
      maxApiCalls: args.proposedValues.maxApiCalls ?? currentConfig.maxApiCalls,
    };

    const current = {
      maxAffiliates: currentConfig.maxAffiliates,
      maxCampaigns: currentConfig.maxCampaigns,
      maxTeamMembers: currentConfig.maxTeamMembers,
      maxPayoutsPerMonth: currentConfig.maxPayoutsPerMonth,
      maxApiCalls: currentConfig.maxApiCalls,
    };

    // Subtask 3.4: For each decreased limit, count affected tenants
    const decreasedLimits = calculateDecreasedLimits(current, proposed);

    const breakdownByLimit: Record<
      string,
      { oldValue: number; newValue: number; affectedCount: number }
    > = {};
    const affectedSet = new Set<string>();

    // Get all tenants on this tier
    const tenantsOnTier = await ctx.db
      .query("tenants")
      .filter((q) => q.eq(q.field("plan"), args.tier))
      .collect();

    for (const limit of decreasedLimits) {
      if (limit.newValue === -1) continue; // Going to unlimited — no impact

      let affectedCount = 0;
      for (const tenant of tenantsOnTier) {
        const currentUsage = await getTenantResourceCount(ctx, tenant._id, limit.field);
        if (currentUsage > limit.newValue) {
          affectedCount++;
          affectedSet.add(tenant._id);
        }
      }

      breakdownByLimit[limit.field] = {
        oldValue: limit.oldValue,
        newValue: limit.newValue,
        affectedCount,
      };
    }

    // Subtask 3.5: Return structured impact report
    const totalAffected = affectedSet.size;
    const severity = determineImpactSeverity(totalAffected);

    return {
      affectedTenants: totalAffected,
      breakdownByLimit,
      severity,
    };
  },
});

// =============================================================================
// Task 4: Notification Records for Affected Tenants (AC: #6)
// =============================================================================

/**
 * Create email-ready notification records for tenants affected by tier limit decreases.
 * Plain async function called directly from updateTierConfig (same transaction).
 * Records are stored in the `emails` table with "pending" status for the existing
 * email infrastructure to pick up and process asynchronously.
 * (AC: #6 - Tenant Notification on Limit Decrease)
 */
async function createTierChangeNotifications(
  ctx: any,
  args: {
    tierName: string;
    decreasedLimits: Array<{
      field: string;
      label: string;
      oldValue: number;
      newValue: number;
    }>;
    affectedTenantIds: string[];
  }
): Promise<number> {
  let notificationCount = 0;

  for (const tenantId of args.affectedTenantIds) {
    // Subtask 4.3: Build notification content
    const changesDescription = args.decreasedLimits
      .map(
        (limit) =>
          `${limit.label}: ${limit.oldValue === -1 ? "Unlimited" : limit.oldValue} → ${limit.newValue === -1 ? "Unlimited" : limit.newValue}`
      )
      .join(", ");

    const advice =
      args.tierName === "scale"
        ? "Please contact support to discuss your options."
        : "Consider upgrading your plan or reducing your usage to stay within the new limits.";

    // Look up tenant owner email from users table
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) continue;

    // Find the owner (first user with 'owner' role on this tenant)
    const ownerUsers = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
      .filter((q: any) => q.eq(q.field("role"), "owner"))
      .take(1);

    const ownerEmail = ownerUsers.length > 0 ? ownerUsers[0].email : "";
    if (!ownerEmail) continue;

    // Subtask 4.2: Create email-ready entry in emails table
    await ctx.db.insert("emails", {
      tenantId,
      type: "tier_limit_decrease",
      recipientEmail: ownerEmail,
      subject: `Important: ${capitalize(args.tierName)} plan limits have been updated`,
      status: "pending",
    });

    notificationCount++;
  }

  return notificationCount;
}

// =============================================================================
// Shared Helpers (internal)
// =============================================================================

/**
 * Get current resource count for a tenant on a specific limit field.
 * Maps tier config field names to database resource counts.
 */
async function getTenantResourceCount(
  ctx: any,
  tenantId: string,
  field: string
): Promise<number> {
  switch (field) {
    case "maxAffiliates": {
      const affiliates = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
        .collect();
      return affiliates.length;
    }
    case "maxCampaigns": {
      const campaigns = await ctx.db
        .query("campaigns")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
        .collect();
      return campaigns.length;
    }
    case "maxTeamMembers": {
      const users = await ctx.db
        .query("users")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
        .collect();
      return users.length;
    }
    case "maxPayoutsPerMonth": {
      // Count payouts for the current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const payouts = await ctx.db
        .query("payouts")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
        .collect();
      // Filter to current month (since we can't use a compound index)
      return payouts.filter((p: any) => p._creationTime >= startOfMonth).length;
    }
    case "maxApiCalls": {
      // API calls tracking requires a separate usage tracking mechanism
      // Return 0 as placeholder
      return 0;
    }
    default:
      return 0;
  }
}

/**
 * Capitalize first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
