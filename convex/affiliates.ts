import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getTenantId, requireTenantId, validateTenantOwnership, getAuthenticatedUser } from "./tenantContext";
import { hasPermission } from "./permissions";
import type { Role } from "./permissions";

/**
 * Generate a unique referral code for an affiliate.
 * Format: 8-character alphanumeric code.
 */
async function generateUniqueReferralCode(ctx: any): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing characters
  let code = "";
  
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Ensure uniqueness within tenant (will be checked at creation)
  return code;
}

/**
 * Check if a referral code is unique within a tenant.
 */
async function isCodeUnique(ctx: any, tenantId: Id<"tenants">, code: string): Promise<boolean> {
  const existing = await ctx.db
    .query("affiliates")
    .withIndex("by_tenant_and_code", (q: any) => 
      q.eq("tenantId", tenantId).eq("uniqueCode", code)
    )
    .first();
  
  return !existing;
}

/**
 * Get affiliate by ID.
 * Returns null if the affiliate doesn't exist or belongs to another tenant.
 * @security Requires authentication. Results filtered by tenant.
 */
export const getAffiliate = query({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      payoutMethod: v.optional(v.object({
        type: v.string(),
        details: v.string(),
      })),
      fraudSignals: v.optional(v.array(v.object({
        type: v.string(),
        severity: v.string(),
        timestamp: v.number(),
        details: v.optional(v.string()),
      }))),
      commissionOverride: v.optional(v.object({
        campaignId: v.id("campaigns"),
        rate: v.number(),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx);
    if (!tenantId) {
      return null;
    }
    
    const affiliate = await ctx.db.get(args.affiliateId);
    
    // Validate tenant ownership - return null if affiliate belongs to another tenant
    if (!affiliate || affiliate.tenantId !== tenantId) {
      return null;
    }
    
    return affiliate;
  },
});

/**
 * Get affiliate by email within a tenant.
 * Used for authentication lookup.
 */
export const getAffiliateByEmail = query({
  args: {
    tenantId: v.id("tenants"),
    email: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      payoutMethod: v.optional(v.object({
        type: v.string(),
        details: v.string(),
      })),
      fraudSignals: v.optional(v.array(v.object({
        type: v.string(),
        severity: v.string(),
        timestamp: v.number(),
        details: v.optional(v.string()),
      }))),
      commissionOverride: v.optional(v.object({
        campaignId: v.id("campaigns"),
        rate: v.number(),
      })),
      passwordHash: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", args.tenantId).eq("email", args.email)
      )
      .first();
  },
});

/**
 * Get affiliate by referral code.
 * Used for tracking clicks and conversions.
 */
export const getAffiliateByCode = query({
  args: {
    tenantId: v.id("tenants"),
    code: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_code", (q) =>
        q.eq("tenantId", args.tenantId).eq("uniqueCode", args.code)
      )
      .first();
  },
});

/**
 * Get all affiliates for the current tenant.
 * Used for owner dashboard to view affiliate list.
 * @security Requires authentication. Results automatically filtered by tenant.
 */
export const getAffiliatesByTenant = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("affiliates"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      payoutMethod: v.optional(v.object({
        type: v.string(),
        details: v.string(),
      })),
    })
  ),
  handler: async (ctx) => {
    const tenantId = await requireTenantId(ctx);
    
    return await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();
  },
});

/**
 * Register a new affiliate.
 * This is the primary registration function for the affiliate portal.
 * Creates an affiliate record with "pending" status (requires approval).
 * @security Requires authentication. Affiliate is created in the authenticated user's tenant.
 */
export const registerAffiliate = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
  },
  returns: v.object({
    affiliateId: v.id("affiliates"),
    uniqueCode: v.string(),
    status: v.string(),
  }),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    
    // Check if affiliate already exists for this tenant
    const existingAffiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", tenantId).eq("email", args.email)
      )
      .first();

    if (existingAffiliate) {
      throw new Error("An affiliate with this email already exists in this tenant");
    }

    // Generate unique referral code
    let uniqueCode = await generateUniqueReferralCode(ctx);
    let attempts = 0;
    while (!(await isCodeUnique(ctx, tenantId, uniqueCode)) && attempts < 10) {
      uniqueCode = await generateUniqueReferralCode(ctx);
      attempts++;
    }

    if (attempts >= 10) {
      throw new Error("Failed to generate unique referral code");
    }

    // Create affiliate with pending status (requires approval)
    const affiliateId = await ctx.db.insert("affiliates", {
      tenantId,
      email: args.email,
      name: args.name,
      uniqueCode,
      status: "pending",
      passwordHash: args.passwordHash,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_registered",
      entityType: "affiliate",
      entityId: affiliateId,
      actorType: "system",
      newValue: { email: args.email, name: args.name, uniqueCode, status: "pending" },
    });

    return {
      affiliateId,
      uniqueCode,
      status: "pending",
    };
  },
});

/**
 * Approve or reject an affiliate application.
 * Used by SaaS Owner/Manager to approve affiliate registrations.
 * @security Requires authentication. Validates that the affiliate belongs to the current tenant.
 * @security Requires 'affiliates:manage' permission.
 */
export const updateAffiliateStatus = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }
    
    const tenantId = authUser.tenantId;
    
    // Check permission - require affiliates:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && !hasPermission(role, "manage:*")) {
      // Log unauthorized access attempt
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=updateAffiliateStatus`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to manage affiliates");
    }
    
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }
    
    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    const validStatuses = ["pending", "active", "suspended", "rejected"];
    if (!validStatuses.includes(args.status)) {
      throw new Error(`Invalid status: ${args.status}. Must be one of: ${validStatuses.join(", ")}`);
    }

    const previousStatus = affiliate.status;
    await ctx.db.patch(args.affiliateId, { status: args.status });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_status_updated",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { status: previousStatus },
      newValue: { status: args.status },
    });

    return null;
  },
});

/**
 * Authenticate affiliate by email and password.
 * Used for affiliate portal login.
 * Returns null if authentication fails.
 */
export const authenticateAffiliate = query({
  args: {
    tenantId: v.id("tenants"),
    email: v.string(),
    passwordHash: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", args.tenantId).eq("email", args.email)
      )
      .first();

    if (!affiliate) {
      return null;
    }

    // Check if affiliate has password set
    if (!affiliate.passwordHash) {
      return null;
    }

    // Compare password hashes (client should send hashed password)
    if (affiliate.passwordHash !== args.passwordHash) {
      return null;
    }

    // Only allow active affiliates to authenticate
    if (affiliate.status !== "active") {
      return null;
    }

    return {
      _id: affiliate._id,
      tenantId: affiliate.tenantId,
      email: affiliate.email,
      name: affiliate.name,
      uniqueCode: affiliate.uniqueCode,
      status: affiliate.status,
    };
  },
});

/**
 * Update affiliate profile.
 * Affiliates can update their name and payout method.
 * @security Requires authentication. Validates tenant ownership.
 */
export const updateAffiliateProfile = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    name: v.optional(v.string()),
    payoutMethod: v.optional(v.object({
      type: v.string(),
      details: v.string(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }
    
    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    const updates: Record<string, any> = {};
    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.payoutMethod !== undefined) {
      updates.payoutMethod = args.payoutMethod;
    }

    await ctx.db.patch(args.affiliateId, updates);

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_profile_updated",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorType: "affiliate",
      previousValue: { name: affiliate.name, payoutMethod: affiliate.payoutMethod },
      newValue: updates,
    });

    return null;
  },
});

/**
 * Update affiliate password.
 * @security Requires authentication. Validates tenant ownership.
 */
export const updateAffiliatePassword = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    currentPasswordHash: v.string(),
    newPasswordHash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }
    
    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    if (!affiliate.passwordHash || affiliate.passwordHash !== args.currentPasswordHash) {
      throw new Error("Current password is incorrect");
    }

    await ctx.db.patch(args.affiliateId, { passwordHash: args.newPasswordHash });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_password_updated",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorType: "affiliate",
    });

    return null;
  },
});

/**
 * Set affiliate password (for new affiliates approved by owner).
 * Used when owner approves an affiliate and they set their password.
 * @security Requires authentication. Validates tenant ownership.
 */
export const setAffiliatePassword = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    newPasswordHash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }
    
    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    if (affiliate.passwordHash) {
      throw new Error("Password already set. Use updateAffiliatePassword instead.");
    }

    await ctx.db.patch(args.affiliateId, { passwordHash: args.newPasswordHash });

    return null;
  },
});

/**
 * Suspend or reactivate an affiliate.
 * Used by SaaS Owner/Manager to manage affiliate status.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission.
 */
export const setAffiliateStatus = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("rejected")
    ),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }
    
    const tenantId = authUser.tenantId;
    
    // Check permission - require affiliates:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && !hasPermission(role, "manage:*")) {
      // Log unauthorized access attempt
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=setAffiliateStatus`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to manage affiliates");
    }
    
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }
    
    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    const previousStatus = affiliate.status;
    await ctx.db.patch(args.affiliateId, { status: args.status });

    // Add fraud signal if suspended with reason
    if (args.status === "suspended" && args.reason) {
      const fraudSignals = affiliate.fraudSignals || [];
      fraudSignals.push({
        type: "manual_suspension",
        severity: "high",
        timestamp: Date.now(),
        details: args.reason,
      });
      await ctx.db.patch(args.affiliateId, { fraudSignals });
    }

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: `affiliate_${args.status}`,
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { status: previousStatus },
      newValue: { status: args.status, reason: args.reason },
    });

    return null;
  },
});

/**
 * Get affiliate statistics.
 * Returns click count, conversion count, and commission total for an affiliate.
 * @security Requires authentication. Validates tenant ownership.
 */
export const getAffiliateStats = query({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.object({
    totalClicks: v.number(),
    totalConversions: v.number(),
    totalCommissions: v.number(),
    pendingCommissions: v.number(),
    confirmedCommissions: v.number(),
  }),
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx);
    if (!tenantId) {
      throw new Error("Authentication required");
    }
    
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }
    
    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Get clicks count
    const clicks = await ctx.db
      .query("clicks")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .collect();
    const totalClicks = clicks.length;

    // Get conversions count
    const conversions = await ctx.db
      .query("conversions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .collect();
    const totalConversions = conversions.length;

    // Get commissions
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .collect();

    const totalCommissions = commissions.reduce((sum, c) => sum + c.amount, 0);
    const pendingCommissions = commissions
      .filter(c => c.status === "pending")
      .reduce((sum, c) => sum + c.amount, 0);
    const confirmedCommissions = commissions
      .filter(c => c.status === "confirmed")
      .reduce((sum, c) => sum + c.amount, 0);

    return {
      totalClicks,
      totalConversions,
      totalCommissions,
      pendingCommissions,
      confirmedCommissions,
    };
  },
});