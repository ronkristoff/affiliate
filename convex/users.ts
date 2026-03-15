import { internalMutation, internalQuery, internalAction, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { betterAuthComponent } from "./auth";
import { getTenantId, requireTenantId, getTenant, getAuthenticatedUser } from "./tenantContext";
import { internal } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";
import { render } from "@react-email/components";
import React from "react";

// Initialize Resend with the convex component
const resend = new Resend(components.resend, {
  testMode: process.env.NODE_ENV === "test",
});

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
 * Get all active users within the current tenant.
 * Filters out removed users (soft deleted).
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
    
    const users = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();
    
    // Filter out removed users (soft delete)
    return users.filter(user => user.status !== "removed");
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

/**
 * Remove a team member from the current tenant.
 * Only Owners can remove team members.
 * Self-removal is prevented.
 * Last Owner cannot be removed.
 * User data is preserved (soft delete).
 * 
 * @security Requires Owner role. Validates target user belongs to current tenant.
 */
export const removeTeamMember = mutation({
  args: {
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // 1. Get current user from auth context
    const currentUser = await getAuthenticatedUser(ctx);
    if (!currentUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    // 2. Verify current user has Owner role
    if (currentUser.role !== "owner") {
      throw new Error("Only Owners can remove team members");
    }

    // 3. Get target user
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    // 4. Verify target user belongs to current tenant (multi-tenant isolation)
    if (targetUser.tenantId !== currentUser.tenantId) {
      throw new Error("User not found");
    }

    // 5. Prevent self-removal
    if (targetUser._id === currentUser.userId) {
      throw new Error("Cannot remove yourself. Transfer ownership first.");
    }

    // 6. Prevent removal of last Owner
    if (targetUser.role === "owner") {
      const allUsers = await ctx.db
        .query("users")
        .withIndex("by_tenant", (q) => q.eq("tenantId", currentUser.tenantId))
        .collect();
      
      const activeOwners = allUsers.filter(u => 
        u.role === "owner" && u.status !== "removed"
      );
      
      if (activeOwners.length <= 1) {
        throw new Error("Cannot remove the last Owner. Add another Owner first.");
      }
    }

    // 7. Soft delete - mark as removed
    await ctx.db.patch(args.userId, {
      status: "removed",
      removedAt: Date.now(),
      removedBy: currentUser.userId,
    });

    // 8. Log audit trail
    await ctx.db.insert("auditLogs", {
      tenantId: currentUser.tenantId,
      action: "TEAM_MEMBER_REMOVED",
      entityType: "user",
      entityId: args.userId,
      actorId: currentUser.userId,
      actorType: "user",
      previousValue: {
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        status: targetUser.status,
      },
      newValue: {
        status: "removed",
        removedAt: Date.now(),
        removedBy: currentUser.userId,
      },
      metadata: {
        additionalInfo: args.reason || "No reason provided",
      },
    });

    // 9. Schedule removal notification email
    await ctx.scheduler.runAfter(0, internal.users.sendRemovalNotification, {
      userId: args.userId,
      tenantId: currentUser.tenantId,
      removedByEmail: currentUser.email,
      reason: args.reason,
    });

    return null;
  },
});

/**
 * Send removal notification email to the removed team member.
 * Internal action - called by removeTeamMember mutation.
 */
export const sendRemovalNotification = internalAction({
  args: {
    userId: v.id("users"),
    tenantId: v.id("tenants"),
    removedByEmail: v.string(),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get user details via internal query
    const user = await ctx.runQuery(internal.users.getUserInternal, {
      userId: args.userId,
    });
    
    // Get tenant details via internal query
    const tenant = await ctx.runQuery(internal.tenants.getTenantInternal, {
      tenantId: args.tenantId,
    });

    if (!user || !tenant) {
      console.error("Cannot send removal notification: user or tenant not found");
      return null;
    }

    // Import email template dynamically
    const TeamRemovalEmail = (await import("./emails/TeamRemovalNotification")).default;

    try {
      // Send email via Resend component
      await resend.sendEmail(ctx, {
        from: "Team Notifications <notifications@boboddy.business>",
        to: user.email,
        subject: `You've been removed from ${tenant.name}`,
        html: await render(
          React.createElement(TeamRemovalEmail, {
            userEmail: user.email,
            userName: user.name,
            tenantName: tenant.name || "Your Organization",
            removedByEmail: args.removedByEmail,
            removedAt: new Date().toISOString(),
            reason: args.reason,
          })
        ),
      });

      // Track email in the emails table via runMutation
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "team_removal_notification",
        recipientEmail: user.email,
        subject: `You've been removed from ${tenant.name}`,
        status: "sent",
      });

      console.log(`Team removal notification sent to ${user.email}`);
    } catch (error) {
      console.error("Failed to send removal notification:", error);

      // Track failed email via runMutation
      await ctx.runMutation(internal.emails.trackEmailSent, {
        tenantId: args.tenantId,
        type: "team_removal_notification",
        recipientEmail: user.email,
        subject: `You've been removed from ${tenant.name}`,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return null;
  },
});

/**
 * Internal query to get user details for email notification.
 */
export const getUserInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.object({
      email: v.string(),
      name: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }
    return {
      email: user.email,
      name: user.name,
    };
  },
});

// =============================================================================
// PROFILE FUNCTIONS
// =============================================================================

/**
 * Get the current user's profile with tenant information.
 * This query returns the authenticated user's profile data for the settings page.
 * 
 * @security Requires authentication. Returns null if not authenticated.
 */
export const getCurrentUserProfile = query({
  args: {},
  returns: v.union(
    v.object({
      user: v.object({
        _id: v.id("users"),
        _creationTime: v.number(),
        tenantId: v.id("tenants"),
        email: v.string(),
        name: v.optional(v.string()),
        role: v.string(),
        emailVerified: v.optional(v.boolean()),
      }),
      tenant: v.object({
        _id: v.id("tenants"),
        name: v.string(),
        plan: v.string(),
      }),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      return null;
    }

    // Get full user record
    const user = await ctx.db.get(authUser.userId);
    if (!user) {
      return null;
    }

    // Get tenant information
    const tenant = await ctx.db.get(authUser.tenantId);
    if (!tenant) {
      return null;
    }

    return {
      user: {
        _id: user._id,
        _creationTime: user._creationTime,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        plan: tenant.plan,
      },
    };
  },
});

/**
 * Update the current user's profile.
 * Only allows updating name (email is read-only for security).
 * 
 * @security Requires authentication. Only updates the current user's own profile.
 */
export const updateUserProfile = mutation({
  args: {
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Validate name field
    if (args.name.length < 2) {
      throw new Error("Name must be at least 2 characters");
    }
    if (args.name.length > 100) {
      throw new Error("Name must be less than 100 characters");
    }

    // Validate name format (letters, spaces, hyphens, apostrophes only)
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(args.name)) {
      throw new Error("Name can only contain letters, spaces, hyphens, and apostrophes");
    }

    // Get current user record for audit logging
    const currentUser = await ctx.db.get(authUser.userId);
    if (!currentUser) {
      throw new Error("User not found");
    }

    // Multi-tenant isolation: verify user belongs to current tenant
    if (currentUser.tenantId !== authUser.tenantId) {
      throw new Error("Access denied: Cannot update profile for another tenant");
    }

    // Store previous values for audit log
    const previousName = currentUser.name;

    // Update user profile (only name can be updated - email is read-only)
    await ctx.db.patch(authUser.userId, {
      name: args.name,
    });

    // Log audit trail for profile update
    await ctx.db.insert("auditLogs", {
      tenantId: authUser.tenantId,
      action: "USER_PROFILE_UPDATED",
      entityType: "user",
      entityId: authUser.userId,
      targetId: authUser.userId, // Target is the user being updated (self)
      actorId: authUser.userId,
      actorType: "user",
      previousValue: {
        name: previousName,
      },
      newValue: {
        name: args.name,
      },
      metadata: {
        additionalInfo: "Profile update - changed fields: name",
      },
    });

    return null;
  },
});

/**
 * Internal query to get owners by tenant.
 * Used by actions that need to contact tenant owners.
 */
export const _getOwnersByTenantInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.optional(v.string()),
      role: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("role"), "owner"))
      .collect();

    return users.map((user) => ({
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    }));
  },
});

/**
 * Internal query to get the first owner user by tenant ID.
 * Used by fraud alert email to find the SaaS owner to notify.
 */
export const getOwnerByTenantInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.string(),
      name: v.optional(v.string()),
      role: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("role"), "owner"))
      .first();

    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  },
});
