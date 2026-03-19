import { query, mutation, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getTenantId, requireTenantId, validateTenantOwnership, getAuthenticatedUser } from "./tenantContext";
import { hasPermission } from "./permissions";
import type { Role } from "./permissions";
import { api, internal } from "./_generated/api";

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
      vanitySlug: v.optional(v.string()),
      note: v.optional(v.string()),
      promotionChannel: v.optional(v.string()),
      payoutMethod: v.optional(v.object({
        type: v.string(),
        details: v.string(),
      })),
      // Fraud signals with review tracking (Story 5.7)
      fraudSignals: v.optional(v.array(v.object({
        type: v.string(),
        severity: v.string(),
        timestamp: v.number(),
        details: v.optional(v.string()),
        reviewedAt: v.optional(v.number()),
        reviewedBy: v.optional(v.string()),
        reviewNote: v.optional(v.string()),
      }))),
      commissionOverrides: v.optional(v.array(v.object({
        campaignId: v.id("campaigns"),
        rate: v.number(),
        status: v.optional(v.union(
          v.literal("active"),
          v.literal("paused"),
        )),
      }))),
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

    // Only return safe fields, exclude sensitive data like passwordHash
    return {
      _id: affiliate._id,
      _creationTime: affiliate._creationTime,
      tenantId: affiliate.tenantId,
      email: affiliate.email,
      name: affiliate.name,
      uniqueCode: affiliate.uniqueCode,
      status: affiliate.status,
      vanitySlug: affiliate.vanitySlug,
      promotionChannel: affiliate.promotionChannel,
      note: affiliate.note,
      payoutMethod: affiliate.payoutMethod,
      fraudSignals: affiliate.fraudSignals,
      commissionOverrides: affiliate.commissionOverrides,
    };
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
      vanitySlug: v.optional(v.string()),
      promotionChannel: v.optional(v.string()),
      payoutMethod: v.optional(v.object({
        type: v.string(),
        details: v.string(),
      })),
      // Fraud signals with review tracking (Story 5.7)
      fraudSignals: v.optional(v.array(v.object({
        type: v.string(),
        severity: v.string(),
        timestamp: v.number(),
        details: v.optional(v.string()),
        reviewedAt: v.optional(v.number()),
        reviewedBy: v.optional(v.string()),
        reviewNote: v.optional(v.string()),
      }))),
      commissionOverrides: v.optional(v.array(v.object({
        campaignId: v.id("campaigns"),
        rate: v.number(),
        status: v.optional(v.union(
          v.literal("active"),
          v.literal("paused"),
        )),
      }))),
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
      vanitySlug: v.optional(v.string()),
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
      vanitySlug: v.optional(v.string()),
      promotionChannel: v.optional(v.string()),
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
 * List affiliates filtered by status.
 * Used for the Affiliates page with tabbed navigation.
 * @security Requires authentication. Results filtered by tenant and status.
 */
export const listAffiliatesByStatus = query({
  args: {
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("rejected")
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id("affiliates"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      passwordHash: v.optional(v.string()),
      uniqueCode: v.string(),
      status: v.string(),
      vanitySlug: v.optional(v.string()),
      promotionChannel: v.optional(v.string()),
      payoutMethod: v.optional(v.object({
        type: v.string(),
        details: v.string(),
      })),
    })
  ),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);

    return await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_status", (q) =>
        q.eq("tenantId", tenantId).eq("status", args.status)
      )
      .collect();
  },
});

/**
 * Get count of affiliates by status.
 * Used for displaying badge counts in the sidebar and tabs.
 * @security Requires authentication. Results filtered by tenant. Returns zeros if not authenticated.
 */
export const getAffiliateCountByStatus = query({
  args: {
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("rejected")
    )),
  },
  returns: v.object({
    pending: v.number(),
    active: v.number(),
    suspended: v.number(),
    rejected: v.number(),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx);

    // Return default counts if not authenticated (allows UI to render before auth is ready)
    if (!tenantId) {
      return {
        pending: 0,
        active: 0,
        suspended: 0,
        rejected: 0,
        total: 0,
      };
    }

    // If specific status requested, just count that one
    const statusFilter = args.status;
    if (statusFilter) {
      const affiliates = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant_and_status", (q) =>
          q.eq("tenantId", tenantId).eq("status", statusFilter)
        )
        .collect();

      const count = affiliates.length;
      return {
        pending: statusFilter === "pending" ? count : 0,
        active: statusFilter === "active" ? count : 0,
        suspended: statusFilter === "suspended" ? count : 0,
        rejected: statusFilter === "rejected" ? count : 0,
        total: count,
      };
    }

    // Count all statuses
    const allAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    const counts = {
      pending: 0,
      active: 0,
      suspended: 0,
      rejected: 0,
      total: allAffiliates.length,
    };

    for (const affiliate of allAffiliates) {
      if (affiliate.status === "pending") counts.pending++;
      else if (affiliate.status === "active") counts.active++;
      else if (affiliate.status === "suspended") counts.suspended++;
      else if (affiliate.status === "rejected") counts.rejected++;
    }

    return counts;
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

    // Check tier limits before creating affiliate
    const tierConfig = await ctx.runQuery(api.tierConfig.getMyTierConfig);
    if (tierConfig) {
      const currentAffiliates = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect();
      
      const affiliateCount = currentAffiliates.length;
      
      // Check if limit is enforced (not unlimited = -1)
      if (tierConfig.maxAffiliates !== -1 && affiliateCount >= tierConfig.maxAffiliates) {
        throw new Error(
          `Affiliate limit reached (${affiliateCount}/${tierConfig.maxAffiliates}). ` +
          `Please upgrade your plan to add more affiliates.`
        );
      }
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
      vanitySlug: v.optional(v.string()),
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
 * Suspend an active affiliate.
 * Changes status from "active" to "suspended", invalidates sessions, and sends suspension email.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission (Owner/Manager only).
 */
export const suspendAffiliate = mutation({
  args: {
    affiliateId: v.id("affiliates"),
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
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=suspendAffiliate`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to suspend affiliates");
    }

    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate affiliate is in "active" status
    if (affiliate.status !== "active") {
      throw new Error(`Cannot suspend affiliate with status "${affiliate.status}". Only active affiliates can be suspended.`);
    }

    // Update status to suspended
    await ctx.db.patch(args.affiliateId, { status: "suspended" });

    // Add fraud signal if reason provided
    if (args.reason) {
      const fraudSignals = affiliate.fraudSignals || [];
      fraudSignals.push({
        type: "manual_suspension",
        severity: "high",
        timestamp: Date.now(),
        details: args.reason,
      });
      await ctx.db.patch(args.affiliateId, { fraudSignals });
    }

    // Invalidate all affiliate sessions
    await ctx.runMutation(internal.affiliates.invalidateAffiliateSessions, {
      affiliateId: args.affiliateId,
      tenantId,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_suspended",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { status: "active" },
      newValue: { status: "suspended", reason: args.reason },
    });

    // Schedule suspension email to be sent (non-blocking)
    try {
      const tenant = await ctx.db.get(tenantId);
      const contactEmail = process.env.SUPPORT_EMAIL || "support@saligaffiliate.com";
      
      await ctx.scheduler.runAfter(0, api.email.sendSuspensionEmail, {
        tenantId,
        affiliateId: args.affiliateId,
        affiliateEmail: affiliate.email,
        affiliateName: affiliate.name,
        reason: args.reason,
        portalName: tenant?.branding?.portalName || tenant?.name || "Affiliate Portal",
        brandLogoUrl: tenant?.branding?.logoUrl,
        brandPrimaryColor: tenant?.branding?.primaryColor,
        contactEmail,
      });
    } catch (error) {
      // Log email scheduling failure but don't fail the suspension
      console.error("Failed to schedule suspension email:", error);
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "email_schedule_failed",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorType: "system",
        metadata: {
          additionalInfo: `Failed to schedule suspension email to ${affiliate.email}`,
        },
      });
    }

    return null;
  },
});

/**
 * Reactivate a suspended affiliate.
 * Changes status from "suspended" to "active" and sends reactivation email.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission (Owner/Manager only).
 */
export const reactivateAffiliate = mutation({
  args: {
    affiliateId: v.id("affiliates"),
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
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=reactivateAffiliate`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to reactivate affiliates");
    }

    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate affiliate is in "suspended" status
    if (affiliate.status !== "suspended") {
      throw new Error(`Cannot reactivate affiliate with status "${affiliate.status}". Only suspended affiliates can be reactivated.`);
    }

    // Update status to active
    await ctx.db.patch(args.affiliateId, { status: "active" });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_reactivated",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { status: "suspended" },
      newValue: { status: "active" },
    });

    // Schedule reactivation email to be sent (non-blocking)
    try {
      const tenant = await ctx.db.get(tenantId);
      const portalLoginUrl = tenant?.slug 
        ? `${process.env.SITE_URL || 'https://app.saligaffiliate.com'}/portal/login?tenant=${tenant.slug}`
        : `${process.env.SITE_URL || 'https://app.saligaffiliate.com'}/portal/login`;
      const contactEmail = process.env.SUPPORT_EMAIL || "support@saligaffiliate.com";
      
      await ctx.scheduler.runAfter(0, api.email.sendReactivationEmail, {
        tenantId,
        affiliateId: args.affiliateId,
        affiliateEmail: affiliate.email,
        affiliateName: affiliate.name,
        portalName: tenant?.branding?.portalName || tenant?.name || "Affiliate Portal",
        brandLogoUrl: tenant?.branding?.logoUrl,
        brandPrimaryColor: tenant?.branding?.primaryColor,
        portalLoginUrl,
        contactEmail,
      });
    } catch (error) {
      // Log email scheduling failure but don't fail the reactivation
      console.error("Failed to schedule reactivation email:", error);
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "email_schedule_failed",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorType: "system",
        metadata: {
          additionalInfo: `Failed to schedule reactivation email to ${affiliate.email}`,
        },
      });
    }

    return null;
  },
});

/**
 * Invalidate all sessions for an affiliate.
 * Internal mutation used when suspending an affiliate.
 */
export const invalidateAffiliateSessions = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    tenantId: v.id("tenants"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find all active sessions for this affiliate
    const sessions = await ctx.db
      .query("affiliateSessions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .collect();

    // Delete all sessions (immediate invalidation)
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    return null;
  },
});

/**
 * Approve a pending affiliate application.
 * Changes status from "pending" to "active" and sends approval email.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission (Owner/Manager only).
 */
export const approveAffiliate = mutation({
  args: {
    affiliateId: v.id("affiliates"),
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
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=approveAffiliate`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to approve affiliates");
    }

    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate affiliate is in "pending" status
    if (affiliate.status !== "pending") {
      throw new Error(`Cannot approve affiliate with status "${affiliate.status}". Only pending affiliates can be approved.`);
    }

    // Update status to active
    await ctx.db.patch(args.affiliateId, { status: "active" });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_approved",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { status: "pending" },
      newValue: { status: "active" },
    });

    // Schedule approval email to be sent (non-blocking)
    try {
      const tenant = await ctx.db.get(tenantId);
      // Construct portal login URL - in production, this should come from tenant config or custom domain
      const portalLoginUrl = tenant?.slug 
        ? `${process.env.SITE_URL || 'https://app.saligaffiliate.com'}/portal/login?tenant=${tenant.slug}`
        : `${process.env.SITE_URL || 'https://app.saligaffiliate.com'}/portal/login`;
      // Get contact email from tenant admin
      const contactEmail = process.env.SUPPORT_EMAIL || "support@saligaffiliate.com";
      
      await ctx.scheduler.runAfter(0, api.email.sendApprovalEmail, {
        tenantId,
        affiliateId: args.affiliateId,
        affiliateEmail: affiliate.email,
        affiliateName: affiliate.name,
        portalName: tenant?.branding?.portalName || tenant?.name || "Affiliate Portal",
        brandLogoUrl: tenant?.branding?.logoUrl,
        brandPrimaryColor: tenant?.branding?.primaryColor,
        portalLoginUrl,
        contactEmail,
      });
    } catch (error) {
      // Log email scheduling failure but don't fail the approval
      console.error("Failed to schedule approval email:", error);
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "email_schedule_failed",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorType: "system",
        metadata: {
          additionalInfo: `Failed to schedule approval email to ${affiliate.email}`,
        },
      });
    }

    return null;
  },
});

/**
 * Reject a pending affiliate application.
 * Changes status from "pending" to "rejected" and sends rejection email.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission (Owner/Manager only).
 */
export const rejectAffiliate = mutation({
  args: {
    affiliateId: v.id("affiliates"),
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
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=rejectAffiliate`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to reject affiliates");
    }

    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate affiliate is in "pending" status
    if (affiliate.status !== "pending") {
      throw new Error(`Cannot reject affiliate with status "${affiliate.status}". Only pending affiliates can be rejected.`);
    }

    // Update status to rejected
    await ctx.db.patch(args.affiliateId, { status: "rejected" });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_rejected",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { status: "pending" },
      newValue: { status: "rejected", reason: args.reason },
    });

    // Schedule rejection email to be sent (non-blocking)
    try {
      const tenant = await ctx.db.get(tenantId);
      const contactEmail = process.env.SUPPORT_EMAIL || "support@saligaffiliate.com";
      
      await ctx.scheduler.runAfter(0, api.email.sendRejectionEmail, {
        tenantId,
        affiliateId: args.affiliateId,
        affiliateEmail: affiliate.email,
        affiliateName: affiliate.name,
        reason: args.reason,
        portalName: tenant?.branding?.portalName || tenant?.name || "Affiliate Portal",
        brandLogoUrl: tenant?.branding?.logoUrl,
        brandPrimaryColor: tenant?.branding?.primaryColor,
        contactEmail,
      });
    } catch (error) {
      // Log email scheduling failure but don't fail the rejection
      console.error("Failed to schedule rejection email:", error);
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "email_schedule_failed",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorType: "system",
        metadata: {
          additionalInfo: `Failed to schedule rejection email to ${affiliate.email}`,
        },
      });
    }

    return null;
  },
});

/**
 * Bulk approve multiple pending affiliates.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission (Owner/Manager only).
 * @security Max 50 affiliates per bulk operation to prevent abuse.
 */
export const bulkApproveAffiliates = mutation({
  args: {
    affiliateIds: v.array(v.id("affiliates")),
  },
  returns: v.object({
    success: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx, args) => {
    // Rate limiting: max 50 affiliates per bulk operation
    const MAX_BULK_SIZE = 50;
    if (args.affiliateIds.length > MAX_BULK_SIZE) {
      throw new Error(`Bulk operation limited to ${MAX_BULK_SIZE} affiliates at a time. You selected ${args.affiliateIds.length}.`);
    }
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: "bulk_operation",
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=bulkApproveAffiliates, count=${args.affiliateIds.length}`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to bulk approve affiliates");
    }

    let success = 0;
    let failed = 0;

    for (const affiliateId of args.affiliateIds) {
      try {
        const affiliate = await ctx.db.get(affiliateId);
        if (!affiliate || affiliate.tenantId !== tenantId) {
          failed++;
          continue;
        }

        if (affiliate.status !== "pending") {
          failed++;
          continue;
        }

        // Update status to active
        await ctx.db.patch(affiliateId, { status: "active" });

        // Create audit log entry
        await ctx.db.insert("auditLogs", {
          tenantId,
          action: "affiliate_approved",
          entityType: "affiliate",
          entityId: affiliateId,
          actorId: authUser.userId,
          actorType: "user",
          previousValue: { status: "pending" },
          newValue: { status: "active" },
        });

        // Schedule approval email to be sent (non-blocking)
        try {
          const tenant = await ctx.db.get(tenantId);
          const portalLoginUrl = tenant?.slug 
            ? `${process.env.SITE_URL || 'https://app.saligaffiliate.com'}/portal/login?tenant=${tenant.slug}`
            : `${process.env.SITE_URL || 'https://app.saligaffiliate.com'}/portal/login`;
          const contactEmail = process.env.SUPPORT_EMAIL || "support@saligaffiliate.com";
          
          await ctx.scheduler.runAfter(0, api.email.sendApprovalEmail, {
            tenantId,
            affiliateId: affiliateId,
            affiliateEmail: affiliate.email,
            affiliateName: affiliate.name,
            portalName: tenant?.branding?.portalName || tenant?.name || "Affiliate Portal",
            brandLogoUrl: tenant?.branding?.logoUrl,
            brandPrimaryColor: tenant?.branding?.primaryColor,
            portalLoginUrl,
            contactEmail,
          });
        } catch (error) {
          console.error(`Failed to schedule approval email for ${affiliateId}:`, error);
        }

        success++;
      } catch (error) {
        console.error(`Failed to approve affiliate ${affiliateId}:`, error);
        failed++;
      }
    }

    // Create bulk operation audit log
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_bulk_approved",
      entityType: "affiliate",
      entityId: "bulk_operation",
      actorId: authUser.userId,
      actorType: "user",
      newValue: { success, failed, total: args.affiliateIds.length },
    });

    return { success, failed };
  },
});

/**
 * Bulk reject multiple pending affiliates.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission (Owner/Manager only).
 * @security Max 50 affiliates per bulk operation to prevent abuse.
 */
export const bulkRejectAffiliates = mutation({
  args: {
    affiliateIds: v.array(v.id("affiliates")),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx, args) => {
    // Rate limiting: max 50 affiliates per bulk operation
    const MAX_BULK_SIZE = 50;
    if (args.affiliateIds.length > MAX_BULK_SIZE) {
      throw new Error(`Bulk operation limited to ${MAX_BULK_SIZE} affiliates at a time. You selected ${args.affiliateIds.length}.`);
    }
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: "bulk_operation",
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=bulkRejectAffiliates, count=${args.affiliateIds.length}`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to bulk reject affiliates");
    }

    let success = 0;
    let failed = 0;

    for (const affiliateId of args.affiliateIds) {
      try {
        const affiliate = await ctx.db.get(affiliateId);
        if (!affiliate || affiliate.tenantId !== tenantId) {
          failed++;
          continue;
        }

        if (affiliate.status !== "pending") {
          failed++;
          continue;
        }

        // Update status to rejected
        await ctx.db.patch(affiliateId, { status: "rejected" });

        // Create audit log entry
        await ctx.db.insert("auditLogs", {
          tenantId,
          action: "affiliate_rejected",
          entityType: "affiliate",
          entityId: affiliateId,
          actorId: authUser.userId,
          actorType: "user",
          previousValue: { status: "pending" },
          newValue: { status: "rejected", reason: args.reason },
        });

        // Schedule rejection email to be sent (non-blocking)
        try {
          const tenant = await ctx.db.get(tenantId);
          const contactEmail = process.env.SUPPORT_EMAIL || "support@saligaffiliate.com";
          
          await ctx.scheduler.runAfter(0, api.email.sendRejectionEmail, {
            tenantId,
            affiliateId: affiliateId,
            affiliateEmail: affiliate.email,
            affiliateName: affiliate.name,
            reason: args.reason,
            portalName: tenant?.branding?.portalName || tenant?.name || "Affiliate Portal",
            brandLogoUrl: tenant?.branding?.logoUrl,
            brandPrimaryColor: tenant?.branding?.primaryColor,
            contactEmail,
          });
        } catch (error) {
          console.error(`Failed to schedule rejection email for ${affiliateId}:`, error);
        }

        success++;
      } catch (error) {
        console.error(`Failed to reject affiliate ${affiliateId}:`, error);
        failed++;
      }
    }

    // Create bulk operation audit log
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_bulk_rejected",
      entityType: "affiliate",
      entityId: "bulk_operation",
      actorId: authUser.userId,
      actorType: "user",
      newValue: { success, failed, total: args.affiliateIds.length, reason: args.reason },
    });

    return { success, failed };
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

/**
 * Get audit log entries for an affiliate.
 * Returns activity history including status changes, approvals, rejections.
 * @security Requires authentication. Validates tenant ownership.
 */
export const getAffiliateAuditLog = query({
  args: {
    affiliateId: v.id("affiliates"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("auditLogs"),
      _creationTime: v.number(),
      tenantId: v.optional(v.id("tenants")),
      action: v.string(),
      actorId: v.optional(v.string()),
      actorType: v.string(),
      entityId: v.string(),
      entityType: v.string(),
      previousValue: v.optional(v.any()),
      newValue: v.optional(v.any()),
    })
  ),
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx);
    if (!tenantId) {
      return [];
    }

    // Verify affiliate belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      return [];
    }

    // Query audit logs for this affiliate
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", "affiliate").eq("entityId", args.affiliateId)
      )
      .order("desc")
      .take(args.limit ?? 50);

    return logs;
  },
});

/**
 * Get recent affiliate activity across the tenant.
 * Returns activity history including status changes, approvals, rejections.
 * @security Requires authentication. Validates tenant ownership.
 */
/**
 * Get recent affiliate activity from audit logs.
 * @security Requires authentication. Results filtered by tenant.
 */
export const getRecentAffiliateActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("auditLogs"),
      _creationTime: v.number(),
      tenantId: v.optional(v.id("tenants")),
      action: v.string(),
      entityType: v.string(),
      entityId: v.string(),
      actorId: v.optional(v.string()),
      actorType: v.string(),
      previousValue: v.optional(v.any()),
      newValue: v.optional(v.any()),
    })
  ),
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx);
    if (!tenantId) {
      return [];
    }

    // Query audit logs for affiliates in this tenant
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .filter((q) =>
        q.or(
          q.eq(q.field("entityType"), "affiliate"),
          q.eq(q.field("action"), "affiliate_registered")
        )
      )
      .order("desc")
      .take(args.limit ?? 20);

    return logs;
  },
});

/**
 * Set or update a commission override for an affiliate on a specific campaign.
 * @security Requires authentication. Validates tenant ownership of both affiliate and campaign.
 * @security Requires 'affiliates:manage' or 'campaigns:manage' permission.
 */
export const setCommissionOverride = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    campaignId: v.id("campaigns"),
    rate: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage or campaigns:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && 
        !hasPermission(role, "campaigns:manage") && 
        !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=setCommissionOverride`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to set commission overrides");
    }

    // Validate affiliate belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate campaign belongs to tenant and is active
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign || campaign.tenantId !== tenantId) {
      throw new Error("Campaign not found or access denied");
    }

    if (campaign.status !== "active") {
      throw new Error(`Cannot set override for ${campaign.status} campaigns. Campaign must be active.`);
    }

    // Validate rate based on campaign commission type
    if (campaign.commissionType === "percentage") {
      if (args.rate < 0 || args.rate > 100) {
        throw new Error("Percentage commission rate must be between 0 and 100");
      }
    } else if (campaign.commissionType === "flatFee") {
      if (args.rate < 0) {
        throw new Error("Flat fee commission rate must be 0 or greater");
      }
    }

    // Initialize overrides array if needed
    const existingOverrides = affiliate.commissionOverrides || [];

    // Check if override already exists for this campaign
    const existingIndex = existingOverrides.findIndex(o => o.campaignId === args.campaignId);

    let previousValue: { campaignId: string; rate: number } | undefined;

    if (existingIndex >= 0) {
      // Update existing override
      previousValue = { 
        campaignId: existingOverrides[existingIndex].campaignId, 
        rate: existingOverrides[existingIndex].rate 
      };
      existingOverrides[existingIndex] = {
        campaignId: args.campaignId,
        rate: args.rate,
        status: "active",
      };
    } else {
      // Add new override
      existingOverrides.push({
        campaignId: args.campaignId,
        rate: args.rate,
        status: "active",
      });
    }

    await ctx.db.patch(args.affiliateId, {
      commissionOverrides: existingOverrides,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: previousValue ? "commission_override_updated" : "commission_override_created",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue,
      newValue: { campaignId: args.campaignId, rate: args.rate },
    });

    return null;
  },
});

/**
 * Remove a commission override for an affiliate on a specific campaign.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' or 'campaigns:manage' permission.
 */
export const removeCommissionOverride = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    campaignId: v.id("campaigns"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage or campaigns:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && 
        !hasPermission(role, "campaigns:manage") && 
        !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=removeCommissionOverride`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to remove commission overrides");
    }

    // Validate affiliate belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Check if override exists
    const existingOverrides = affiliate.commissionOverrides || [];
    const overrideToRemove = existingOverrides.find(o => o.campaignId === args.campaignId);

    if (!overrideToRemove) {
      throw new Error("No commission override found for this campaign");
    }

    const filteredOverrides = existingOverrides.filter(o => o.campaignId !== args.campaignId);

    await ctx.db.patch(args.affiliateId, {
      commissionOverrides: filteredOverrides,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "commission_override_removed",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { campaignId: args.campaignId, rate: overrideToRemove.rate },
    });

    return null;
  },
});

/**
 * Toggle the status of a commission override (active <-> paused).
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' or 'campaigns:manage' permission.
 */
export const toggleOverrideStatus = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    campaignId: v.id("campaigns"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage or campaigns:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && 
        !hasPermission(role, "campaigns:manage") && 
        !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=toggleOverrideStatus`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to toggle override status");
    }

    // Validate affiliate belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Check if override exists
    const existingOverrides = affiliate.commissionOverrides || [];
    const overrideIndex = existingOverrides.findIndex(o => o.campaignId === args.campaignId);

    if (overrideIndex < 0) {
      throw new Error("No commission override found for this campaign");
    }

    const currentOverride = existingOverrides[overrideIndex];
    const newStatus = currentOverride.status === "active" ? "paused" : "active";

    // Update the override status
    existingOverrides[overrideIndex] = {
      ...currentOverride,
      status: newStatus,
    };

    await ctx.db.patch(args.affiliateId, {
      commissionOverrides: existingOverrides,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "commission_override_toggled",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { campaignId: args.campaignId, status: currentOverride.status },
      newValue: { campaignId: args.campaignId, status: newStatus },
    });

    return null;
  },
});

/**
 * Get affiliate with all commission overrides populated with campaign details.
 * @security Requires authentication. Validates tenant ownership.
 */
export const getAffiliateWithOverrides = query({
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
      vanitySlug: v.optional(v.string()),
      promotionChannel: v.optional(v.string()),
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
      commissionOverrides: v.array(v.object({
        campaignId: v.id("campaigns"),
        campaignName: v.string(),
        campaignStatus: v.string(),
        commissionType: v.string(),
        defaultRate: v.number(),
        overrideRate: v.number(),
        status: v.string(),
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
    if (!affiliate || affiliate.tenantId !== tenantId) {
      return null;
    }

    // Populate overrides with campaign details
    const overrides = affiliate.commissionOverrides || [];
    const populatedOverrides = [];

    for (const override of overrides) {
      const campaign = await ctx.db.get(override.campaignId);
      if (campaign) {
        populatedOverrides.push({
          campaignId: override.campaignId,
          campaignName: campaign.name,
          campaignStatus: campaign.status,
          commissionType: campaign.commissionType,
          defaultRate: campaign.commissionValue,
          overrideRate: override.rate,
          status: override.status || "active",
        });
      }
    }

    return {
      _id: affiliate._id,
      _creationTime: affiliate._creationTime,
      tenantId: affiliate.tenantId,
      email: affiliate.email,
      name: affiliate.name,
      uniqueCode: affiliate.uniqueCode,
      status: affiliate.status,
      payoutMethod: affiliate.payoutMethod,
      fraudSignals: affiliate.fraudSignals,
      commissionOverrides: populatedOverrides,
    };
  },
});

/**
 * Update internal note for an affiliate.
 * Internal notes are only visible to Owner/Manager, not to affiliates.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission (Owner/Manager only).
 */
export const updateAffiliateNote = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    note: v.optional(v.string()),
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
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=updateAffiliateNote`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to update affiliate notes");
    }

    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    const previousNote = affiliate.note;

    // Update note
    await ctx.db.patch(args.affiliateId, { note: args.note });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_note_updated",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { note: previousNote },
      newValue: { note: args.note },
    });

    return null;
  },
});

/**
 * Internal query to get an affiliate by ID.
 * Used by internal actions that need to fetch affiliate data without authentication.
 */
export const getAffiliateInternal = internalQuery({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      vanitySlug: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      return null;
    }
    return {
      _id: affiliate._id,
      tenantId: affiliate.tenantId,
      email: affiliate.email,
      name: affiliate.name,
      uniqueCode: affiliate.uniqueCode,
      status: affiliate.status,
      vanitySlug: affiliate.vanitySlug,
    };
  },
});

/**
 * Internal mutation to add a fraud signal to an affiliate.
 * Used for chargeback fraud detection (Story 7.4).
 */
export const addFraudSignalInternal = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    type: v.string(),
    severity: v.string(),
    details: v.optional(v.string()),
    commissionId: v.optional(v.id("commissions")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error(`Affiliate ${args.affiliateId} not found`);
    }
    
    // Check if a similar fraud signal already exists for this commission
    const existingSignals = affiliate.fraudSignals || [];
    const duplicateSignal = existingSignals.find(
      (signal: any) => 
        signal.type === args.type && 
        signal.commissionId === args.commissionId &&
        signal.severity === args.severity
    );
    
    if (duplicateSignal) {
      // Don't add duplicate fraud signal
      return null;
    }
    
    // Add the new fraud signal
    const newSignal = {
      type: args.type,
      severity: args.severity,
      timestamp: Date.now(),
      details: args.details,
      commissionId: args.commissionId,
    };
    
    await ctx.db.patch(args.affiliateId, {
      fraudSignals: [...existingSignals, newSignal],
    });
    
    return null;
  },
});