import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthenticatedUser } from "./tenantContext";
import { hasPermission } from "./permissions";
import type { Role } from "./permissions";

/**
 * Create a new tenant with the given name and slug.
 * Used during user registration to create a tenant for the new SaaS owner.
 */
export const createTenant = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  returns: v.id("tenants"),
  handler: async (ctx, args) => {
    // Check if slug is already taken
    const existingTenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existingTenant) {
      throw new Error(`Tenant slug "${args.slug}" is already taken`);
    }

    // Create tenant with default settings
    const trialEndsAt = Date.now() + 14 * 24 * 60 * 60 * 1000; // 14 days from now

    const tenantId = await ctx.db.insert("tenants", {
      name: args.name,
      slug: args.slug,
      plan: "starter",
      trialEndsAt,
      status: "active",
      branding: {
        portalName: args.name,
      },
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "tenant_created",
      entityType: "tenant",
      entityId: tenantId,
      actorType: "system",
      newValue: { name: args.name, slug: args.slug, plan: "starter" },
    });

    return tenantId;
  },
});

/**
 * Get tenant by ID.
 */
export const getTenant = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.union(
    v.object({
      _id: v.id("tenants"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      plan: v.string(),
      trialEndsAt: v.optional(v.number()),
      status: v.string(),
      branding: v.optional(v.object({
        logoUrl: v.optional(v.string()),
        primaryColor: v.optional(v.string()),
        portalName: v.optional(v.string()),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.tenantId);
  },
});

/**
 * Get tenant by slug.
 */
export const getTenantBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("tenants"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.string(),
      plan: v.string(),
      trialEndsAt: v.optional(v.number()),
      status: v.string(),
      branding: v.optional(v.object({
        logoUrl: v.optional(v.string()),
        primaryColor: v.optional(v.string()),
        portalName: v.optional(v.string()),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

/**
 * Get tenant context including branding and subscription info.
 * Used to load tenant context for authenticated requests.
 */
export const getTenantContext = query({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.union(
    v.object({
      tenantId: v.id("tenants"),
      name: v.string(),
      slug: v.string(),
      plan: v.string(),
      status: v.string(),
      isTrial: v.boolean(),
      trialDaysRemaining: v.optional(v.number()),
      branding: v.object({
        logoUrl: v.optional(v.string()),
        primaryColor: v.optional(v.string()),
        portalName: v.optional(v.string()),
      }),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      return null;
    }

    const now = Date.now();
    const isTrial = tenant.trialEndsAt ? tenant.trialEndsAt > now : false;
    const trialDaysRemaining = tenant.trialEndsAt && isTrial
      ? Math.ceil((tenant.trialEndsAt - now) / (24 * 60 * 60 * 1000))
      : undefined;

    return {
      tenantId: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      status: tenant.status,
      isTrial,
      trialDaysRemaining,
      branding: tenant.branding || { portalName: tenant.name },
    };
  },
});

/**
 * Update tenant information.
 * @security Requires 'settings:manage' or 'manage:*' permission.
 */
export const updateTenant = mutation({
  args: {
    tenantId: v.id("tenants"),
    updates: v.object({
      name: v.optional(v.string()),
      branding: v.optional(v.object({
        logoUrl: v.optional(v.string()),
        primaryColor: v.optional(v.string()),
        portalName: v.optional(v.string()),
      })),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }
    
    // Check permission - require billing:* or billing:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "billing:*") && !hasPermission(role, "billing:manage") && !hasPermission(role, "manage:*")) {
      // Log unauthorized access attempt
      await ctx.db.insert("auditLogs", {
        tenantId: args.tenantId,
        action: "permission_denied",
        entityType: "tenant",
        entityId: args.tenantId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=settings:manage, attemptedAction=updateTenant`,
        },
      });
      throw new Error("Access denied: You require 'settings:manage' permission to update tenant settings");
    }
    
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Validate tenant ownership
    if (tenant._id !== authUser.tenantId) {
      throw new Error("Tenant not found or access denied");
    }

    await ctx.db.patch(args.tenantId, args.updates);

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "tenant_updated",
      entityType: "tenant",
      entityId: args.tenantId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: tenant,
      newValue: { ...tenant, ...args.updates },
    });

    return null;
  },
});

/**
 * Check if a tenant slug is available.
 */
export const isSlugAvailable = query({
  args: {
    slug: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    return existing === null;
  },
});

/**
 * Generate a unique slug from a company name.
 */
export const generateSlug = query({
  args: {
    companyName: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const baseSlug = args.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    let slug = baseSlug;
    let counter = 1;

    // Check if slug is available, append counter if not
    while (true) {
      const existing = await ctx.db
        .query("tenants")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  },
});
