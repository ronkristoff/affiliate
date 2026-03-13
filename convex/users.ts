import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { betterAuthComponent } from "./auth";
import { getTenantId, requireTenantId, getTenant } from "./tenantContext";

/**
 * User document type for type safety.
 */
type UserDoc = Doc<"users">;

/**
 * Generate a unique slug from a company name.
 * Internal helper to avoid circular dependencies.
 */
async function generateUniqueSlug(ctx: any, companyName: string): Promise<string> {
  const baseSlug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  let slug = baseSlug;
  let counter = 1;

  // Check if slug is available, append counter if not
  while (true) {
    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .first();

    if (!existing) {
      return slug;
      }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * Sync user creation from Better Auth.
 * Creates a user with proper tenant and role assignment.
 * This is called by the Better Auth database hook.
 * 
 * Note: This is an internal function called by the auth system,
 * so it does NOT use tenant-scoped wrappers.
 */
export const syncUserCreation = internalMutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    companyName: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args): Promise<Id<"users">> => {
    // Server-side validation
    if (!args.email || args.email.trim().length === 0) {
      throw new Error("Email is required");
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email.trim())) {
      throw new Error("Invalid email format");
    }
    
    // Generate a slug from company name or email
    const companyName = args.companyName || args.email.split("@")[0];
    
    // Company name validation
    if (companyName.length < 2) {
      throw new Error("Company name must be at least 2 characters");
    }
    if (companyName.length > 100) {
      throw new Error("Company name must be less than 100 characters");
    }
    
    const slug = await generateUniqueSlug(ctx, companyName);

    // Create tenant for this user (they are the owner)
    const trialEndsAt = Date.now() + 14 * 24 * 60 * 60 * 1000; // 14 days from now

    const tenantId: Id<"tenants"> = await ctx.db.insert("tenants", {
      name: companyName,
      slug,
      plan: "starter",
      trialEndsAt,
      status: "active",
      branding: {
        portalName: companyName,
      },
    });

    // Create audit log entry for tenant creation
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "tenant_created",
      entityType: "tenant",
      entityId: tenantId,
      actorType: "system",
      newValue: { name: companyName, slug, plan: "starter" },
    });

    // Create user with owner role
    const userId = await ctx.db.insert("users", {
      tenantId,
      email: args.email,
      name: args.name,
      role: "owner",
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "user_created",
      entityType: "user",
      entityId: userId,
      actorType: "system",
      newValue: { email: args.email, name: args.name, role: "owner" },
    });

    return userId;
  },
});

/**
 * Sync user deletion from Better Auth.
 * Note: In a real SaaS, you might want to soft-delete instead.
 * 
 * Note: This is an internal function called by the auth system,
 * so it does NOT use tenant-scoped wrappers.
 */
export const syncUserDeletion = internalMutation({
  args: {
    email: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find user by email using index
    const users = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    for (const user of users) {
      // Create audit log entry before deletion
      await ctx.db.insert("auditLogs", {
        tenantId: user.tenantId,
        action: "user_deleted",
        entityType: "user",
        entityId: user._id,
        actorType: "system",
        previousValue: user,
      });

      await ctx.db.delete(user._id);
    }

    return null;
  },
});

// =============================================================================
// TENANT-SCOPED FUNCTIONS
// =============================================================================

/**
 * Create a new user within the current tenant.
 * 
 * @security Requires authentication. User is created in the authenticated user's tenant.
 */
export const createUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    role: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    
    // Check if user already exists in this tenant
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", tenantId).eq("email", args.email)
      )
      .first();

    if (existingUser) {
      throw new Error(`User with email "${args.email}" already exists in this tenant`);
    }

    // Create user in the authenticated user's tenant
    const userId = await ctx.db.insert("users", {
      tenantId,
      email: args.email,
      name: args.name,
      role: args.role,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "user_created",
      entityType: "user",
      entityId: userId,
        actorType: "user",
        newValue: { email: args.email, name: args.name, role: args.role },
      });

    return userId;
  },
});

/**
 * Get user by ID within the current tenant.
 * 
 * @security Requires authentication. Returns null if user belongs to another tenant.
 */
export const getUser = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.optional(v.string()),
      role: v.string(),
      authId: v.optional(v.string()),
      permissionOverrides: v.optional(v.object({
        canManageAffiliates: v.boolean(),
        canManageCampaigns: v.boolean(),
        canViewCommissions: v.boolean(),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx);
    if (!tenantId) {
      return null;
    }
    
    const user = await ctx.db.get(args.userId);
    
    // Validate tenant ownership - return null if user belongs to another tenant
    if (!user || (user as any).tenantId !== tenantId) {
      return null;
    }
    
    return user as UserDoc | null;
  },
});

/**
 * Get user by email within the current tenant.
 * 
 * @security Requires authentication. Results are automatically filtered by tenant.
 */
export const getUserByEmail = query({
  args: {
    email: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.optional(v.string()),
      role: v.string(),
      authId: v.optional(v.string()),
      permissionOverrides: v.optional(v.object({
        canManageAffiliates: v.boolean(),
        canManageCampaigns: v.boolean(),
        canViewCommissions: v.boolean(),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    
    return await ctx.db
      .query("users")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", tenantId).eq("email", args.email)
      )
      .first();
  },
});

/**
 * Get all users within the current tenant.
 * 
 * @security Requires authentication. Results are automatically filtered by tenant.
 */
export const getUsersByTenant = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.optional(v.string()),
      role: v.string(),
      authId: v.optional(v.string()),
      permissionOverrides: v.optional(v.object({
        canManageAffiliates: v.boolean(),
        canManageCampaigns: v.boolean(),
        canViewCommissions: v.boolean(),
      })),
    })
  ),
  handler: async (ctx) => {
    const tenantId = await requireTenantId(ctx);
    
    return await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();
  },
});

/**
 * Update user information within the current tenant.
 * 
 * @security Requires authentication. Validates that the user belongs to the current tenant.
 */
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    updates: v.object({
      name: v.optional(v.string()),
      role: v.optional(v.string()),
      permissionOverrides: v.optional(v.object({
        canManageAffiliates: v.boolean(),
        canManageCampaigns: v.boolean(),
        canViewCommissions: v.boolean(),
      })),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    const user = await ctx.db.get(args.userId);
    
    // Validate tenant ownership
    if (!user) {
      throw new Error("User not found or access denied");
    }
    
    if ((user as any).tenantId !== tenantId) {
      throw new Error("User not found or access denied");
    }

    await ctx.db.patch(args.userId, args.updates);

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "user_updated",
      entityType: "user",
      entityId: args.userId,
      actorType: "user",
      previousValue: user,
      newValue: { ...user, ...args.updates },
    });

    return null;
  },
});

/**
 * Get user role within the current tenant.
 * 
 * @security Requires authentication. Returns null if user belongs to another tenant.
 */
export const getUserRole = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx);
    if (!tenantId) {
      return null;
    }
    
    const user = await ctx.db.get(args.userId);
    
    // Validate tenant ownership - return null if user belongs to another tenant
    if (!user || (user as any).tenantId !== tenantId) {
      return null;
    }
    
    return (user as any).role ?? null;
  },
});

/**
 * Get user with tenant context.
 * Used for loading complete user context after authentication.
 * 
 * Note: This is a special query used during authentication flow.
 * It does NOT use tenant-scoped wrapper because it's used to ESTABLISH
 * the tenant context, not to validate against it.
 */
export const getUserWithTenant = query({
  args: {
    email: v.string(),
  },
  returns: v.union(
    v.object({
      user: v.object({
        _id: v.id("users"),
        _creationTime: v.number(),
        tenantId: v.id("tenants"),
        email: v.string(),
        name: v.optional(v.string()),
        role: v.string(),
      }),
      tenant: v.object({
        _id: v.id("tenants"),
        _creationTime: v.number(),
        name: v.string(),
        slug: v.string(),
        plan: v.string(),
        status: v.string(),
      }),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Find user by email using index
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!appUser) {
      return null;
    }

    const tenant = await ctx.db.get(appUser.tenantId);
    if (!tenant) {
      return null;
    }

    return {
      user: {
        _id: appUser._id,
        _creationTime: appUser._creationTime,
        tenantId: appUser.tenantId,
        email: appUser.email,
        name: appUser.name,
        role: appUser.role,
      },
      tenant: {
        _id: tenant._id,
        _creationTime: tenant._creationTime,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
      },
    };
  },
});
