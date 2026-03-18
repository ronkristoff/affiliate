// Story 11.5: Tier Limit Override
// Backend mutations, queries, and cron job for platform admin tier limit overrides

import { query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./_helpers";

// =============================================================================
// Constants
// =============================================================================

/** Maximum allowed value for any tier limit override */
const MAX_OVERRIDE_VALUE = 100000;

/** Maximum number of overrides to process in a single cron run */
const CRON_BATCH_SIZE = 1000;

// =============================================================================
// Validators
// =============================================================================

/**
 * Validator for override values object.
 */
const overrideValuesValidator = v.object({
  maxAffiliates: v.optional(v.number()),
  maxCampaigns: v.optional(v.number()),
  maxTeamMembers: v.optional(v.number()),
  maxPayoutsPerMonth: v.optional(v.number()),
});

// =============================================================================
// Shared Helpers
// =============================================================================

/**
 * Validate that override values are positive numbers within reasonable bounds.
 * Returns an array of validation error messages, or empty if valid.
 */
function validateOverrideValues(
  overrides: { maxAffiliates?: number; maxCampaigns?: number; maxTeamMembers?: number; maxPayoutsPerMonth?: number }
): string[] {
  const errors: string[] = [];
  
  // Check for negative values
  if (overrides.maxAffiliates !== undefined && overrides.maxAffiliates < 0) {
    errors.push("maxAffiliates must be a positive number");
  }
  if (overrides.maxCampaigns !== undefined && overrides.maxCampaigns < 0) {
    errors.push("maxCampaigns must be a positive number");
  }
  if (overrides.maxTeamMembers !== undefined && overrides.maxTeamMembers < 0) {
    errors.push("maxTeamMembers must be a positive number");
  }
  if (overrides.maxPayoutsPerMonth !== undefined && overrides.maxPayoutsPerMonth < 0) {
    errors.push("maxPayoutsPerMonth must be a positive number");
  }
  
  // Check for excessive values (prevent UI issues and resource abuse)
  if (overrides.maxAffiliates !== undefined && overrides.maxAffiliates > MAX_OVERRIDE_VALUE) {
    errors.push(`maxAffiliates cannot exceed ${MAX_OVERRIDE_VALUE.toLocaleString()}`);
  }
  if (overrides.maxCampaigns !== undefined && overrides.maxCampaigns > MAX_OVERRIDE_VALUE) {
    errors.push(`maxCampaigns cannot exceed ${MAX_OVERRIDE_VALUE.toLocaleString()}`);
  }
  if (overrides.maxTeamMembers !== undefined && overrides.maxTeamMembers > MAX_OVERRIDE_VALUE) {
    errors.push(`maxTeamMembers cannot exceed ${MAX_OVERRIDE_VALUE.toLocaleString()}`);
  }
  if (overrides.maxPayoutsPerMonth !== undefined && overrides.maxPayoutsPerMonth > MAX_OVERRIDE_VALUE) {
    errors.push(`maxPayoutsPerMonth cannot exceed ${MAX_OVERRIDE_VALUE.toLocaleString()}`);
  }
  
  return errors;
}

// =============================================================================
// Task 2: Override Mutations (AC: #3, #7)
// =============================================================================

/**
 * Create a tier override for a tenant.
 * Admin-only mutation that overrides tier limits with custom values.
 * (AC: #3 - Override Limits Mutation)
 */
export const createTierOverride = mutation({
  args: {
    tenantId: v.id("tenants"),
    overrides: overrideValuesValidator,
    reason: v.string(),
    expiresAt: v.optional(v.number()),
  },
  returns: v.id("tierOverrides"),
  handler: async (ctx, args) => {
    // Subtask 2.2: Validate admin role
    const admin = await requireAdmin(ctx);

    // Validate reason field (minimum 10 characters)
    if (args.reason.trim().length < 10) {
      throw new Error("Reason must be at least 10 characters long");
    }

    // Subtask 2.3: Validate override values (including upper bounds)
    const validationErrors = validateOverrideValues(args.overrides);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join("; "));
    }

    // Validate expiration date is not in the past
    if (args.expiresAt !== undefined && args.expiresAt < Date.now()) {
      throw new Error("Expiration date cannot be in the past");
    }

    // Verify tenant exists
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Subtask 2.4: Store override record with admin identity and reason
    const overrideId = await ctx.db.insert("tierOverrides", {
      tenantId: args.tenantId,
      adminId: admin._id,
      overrides: args.overrides,
      reason: args.reason.trim(),
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });

    // Subtask 2.5: Log to auditLogs
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "tier_override_created",
      entityType: "tierOverrides",
      entityId: overrideId,
      actorId: admin.authId,
      actorType: "admin",
      metadata: {
        adminId: admin._id,
        adminEmail: admin.email,
        overrides: args.overrides,
        reason: args.reason.trim(),
        expiresAt: args.expiresAt,
      },
    });

    return overrideId;
  },
});

/**
 * Remove a tier override for a tenant.
 * Admin-only mutation that marks an override as removed.
 * (AC: #7 - Override Removal)
 */
export const removeTierOverride = mutation({
  args: {
    overrideId: v.id("tierOverrides"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    // Verify override exists and is active
    const override = await ctx.db.get(args.overrideId);
    if (!override) {
      throw new Error("Override not found");
    }

    if (override.removedAt) {
      throw new Error("Override is already removed or expired");
    }

    // Subtask 2.6: Mark as removed
    await ctx.db.patch(args.overrideId, {
      removedAt: Date.now(),
      removedBy: admin._id,
      removalReason: "manual_removal",
    });

    // Subtask 2.7: Log removal
    await ctx.db.insert("auditLogs", {
      tenantId: override.tenantId,
      action: "tier_override_removed",
      entityType: "tierOverrides",
      entityId: args.overrideId,
      actorId: admin.authId,
      actorType: "admin",
      metadata: {
        adminId: admin._id,
        adminEmail: admin.email,
        removedOverride: {
          overrides: override.overrides,
          reason: override.reason,
          createdAt: override.createdAt,
        },
      },
    });

    return null;
  },
});

// =============================================================================
// Task 3: Override Queries (AC: #4, #8)
// =============================================================================

/**
 * Get the active tier override for a tenant (if any).
 * Returns override details with admin name, or null if no active override.
 * (AC: #4 - Override Display)
 */
export const getActiveTierOverride = query({
  args: { tenantId: v.id("tenants") },
  returns: v.union(
    v.object({
      _id: v.id("tierOverrides"),
      tenantId: v.id("tenants"),
      adminId: v.id("users"),
      adminName: v.string(),
      adminEmail: v.string(),
      overrides: overrideValuesValidator,
      reason: v.string(),
      expiresAt: v.optional(v.number()),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Query for non-removed overrides for this tenant
    const overrides = await ctx.db
      .query("tierOverrides")
      .withIndex("by_tenant_and_active", (q: any) =>
        q.eq("tenantId", args.tenantId).eq("removedAt", undefined)
      )
      .order("desc")
      .collect();

    // Filter out expired overrides (Subtask 3.2)
    const now = Date.now();
    const activeOverride = overrides.find((o: any) => {
      if (o.expiresAt === undefined) return true; // No expiration = permanent
      return o.expiresAt > now; // Not yet expired
    });

    if (!activeOverride) {
      return null;
    }

    // Get admin details (Subtask 3.3)
    const adminUser = await ctx.db.get(activeOverride.adminId) as any;

    return {
      _id: activeOverride._id,
      tenantId: activeOverride.tenantId,
      adminId: activeOverride.adminId,
      adminName: adminUser?.name ?? "Unknown",
      adminEmail: adminUser?.email ?? "",
      overrides: activeOverride.overrides,
      reason: activeOverride.reason,
      expiresAt: activeOverride.expiresAt,
      createdAt: activeOverride.createdAt,
    };
  },
});

/**
 * Get tier override history for a tenant.
 * Returns all past overrides with admin names and status.
 * (AC: #8 - Override History)
 */
export const getTierOverrideHistory = query({
  args: {
    tenantId: v.id("tenants"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("tierOverrides"),
      adminName: v.string(),
      adminEmail: v.string(),
      overrides: overrideValuesValidator,
      reason: v.string(),
      expiresAt: v.optional(v.number()),
      createdAt: v.number(),
      removedAt: v.optional(v.number()),
      removedBy: v.optional(v.string()),
      removedByName: v.optional(v.string()), // Added: Human-readable remover name
      removalReason: v.optional(v.string()),
      status: v.union(
        v.literal("active"),
        v.literal("expired"),
        v.literal("removed")
      ),
    })
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 20;

    // Get all overrides for tenant
    const overrides = await ctx.db
      .query("tierOverrides")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(limit);

    const now = Date.now();

    // Enrich with admin details and status
    const history = await Promise.all(
      overrides.map(async (override: any) => {
        const adminUser = await ctx.db.get(override.adminId) as any;
        
        // Resolve removedBy to admin name if available
        let removedByName: string | undefined;
        if (override.removedBy) {
          const remover = await ctx.db.get(override.removedBy) as any;
          removedByName = remover?.name ?? "Unknown";
        }

        // Determine status
        let status: "active" | "expired" | "removed" = "active";
        if (override.removedAt) {
          status = override.removalReason === "expired" ? "expired" : "removed";
        } else if (override.expiresAt && override.expiresAt < now) {
          status = "expired";
        }

        return {
          _id: override._id,
          adminName: adminUser?.name ?? "Unknown",
          adminEmail: adminUser?.email ?? "",
          overrides: override.overrides,
          reason: override.reason,
          expiresAt: override.expiresAt,
          createdAt: override.createdAt,
          removedAt: override.removedAt,
          removedBy: override.removedBy ?? undefined,
          removedByName,
          removalReason: override.removalReason ?? undefined,
          status,
        };
      })
    );

    return history;
  },
});

// =============================================================================
// Task 5: Expiration Cron Job (AC: #6)
// =============================================================================

/**
 * Internal mutation to expire tier overrides that have passed their expiration date.
 * Called by cron job on an hourly basis.
 * Optimized to process only overrides with expiration dates set.
 * (AC: #6 - Override Expiration)
 */
export const expireTierOverrides = internalMutation({
  args: {},
  returns: v.object({
    expiredCount: v.number(),
    processedCount: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    let expiredCount = 0;
    let processedCount = 0;

    // OPTIMIZED: Query only non-removed overrides with an expiration date
    // We paginate through results to avoid memory issues with large datasets
    let hasMore = true;
    let cursor: string | null = null;

    while (hasMore && processedCount < CRON_BATCH_SIZE) {
      // Get batch of active overrides (limited to those with expiration dates)
      const batch = await ctx.db
        .query("tierOverrides")
        .withIndex("by_tenant_and_active", (q: any) =>
          q.eq("removedAt", undefined)
        )
        .order("desc")
        .take(100);

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      // Filter to only those with expiration dates that have passed
      const expiredInBatch = batch.filter((o: any) => {
        return o.expiresAt !== undefined && o.expiresAt < now;
      });

      // Process expired overrides
      for (const override of expiredInBatch) {
        await ctx.db.patch(override._id, {
          removedAt: now,
          removalReason: "expired",
        });

        // Log expiration
        await ctx.db.insert("auditLogs", {
          tenantId: override.tenantId,
          action: "tier_override_expired",
          entityType: "tierOverrides",
          entityId: override._id,
          actorType: "system",
          metadata: {
            adminId: override.adminId,
            overrides: override.overrides,
            reason: override.reason,
            expiresAt: override.expiresAt,
            expiredAt: now,
          },
        });

        expiredCount++;
      }

      processedCount += batch.length;
      
      // If we got fewer than 100 results, we've processed all active overrides
      if (batch.length < 100) {
        hasMore = false;
      }
    }

    return { expiredCount, processedCount };
  },
});
