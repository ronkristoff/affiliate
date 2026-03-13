import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Session information for authenticated users.
 * Note: Better Auth manages sessions internally in the betterAuth_sessions table.
 * These functions provide additional session-related utilities for the application layer.
 */

/**
 * Get session information for a user.
 * Used by client components to check session status.
 */
export const getSessionInfo = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.object({
      userId: v.id("users"),
      tenantId: v.id("tenants"),
      role: v.string(),
      email: v.string(),
      isActive: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    return {
      userId: user._id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      isActive: true,
    };
  },
});

/**
 * Get tenant ID from session.
 * Used for multi-tenant data isolation.
 */
export const getTenantIdFromSession = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(v.id("tenants"), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.tenantId ?? null;
  },
});

/**
 * Invalidate a session (logout).
 * Called when user logs out.
 */
export const invalidateSession = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Create audit log entry for logout
    const user = await ctx.db.get(args.userId);
    if (user) {
      await ctx.db.insert("auditLogs", {
        tenantId: user.tenantId,
        action: "user_logout",
        entityType: "user",
        entityId: args.userId,
        actorId: args.userId,
        actorType: "user",
      });
    }

    // Note: Better Auth handles actual session destruction
    // This function is for application-level logout tracking
    return null;
  },
});

/**
 * Destroy all sessions for a user.
 * Used for security purposes (e.g., password change, suspicious activity).
 */
export const destroyAllSessions = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Create audit log entry
    const user = await ctx.db.get(args.userId);
    if (user) {
      await ctx.db.insert("auditLogs", {
        tenantId: user.tenantId,
        action: "all_sessions_destroyed",
        entityType: "user",
        entityId: args.userId,
        actorType: "system",
      });
    }

    // Note: Better Auth handles actual session destruction
    // This function tracks the action in our audit logs
    return null;
  },
});

/**
 * Validate session for a user.
 * Checks if user exists and is part of the expected tenant.
 */
export const validateSession = internalQuery({
  args: {
    userId: v.id("users"),
    tenantId: v.optional(v.id("tenants")),
  },
  returns: v.object({
    valid: v.boolean(),
    user: v.optional(v.object({
      _id: v.id("users"),
      email: v.string(),
      role: v.string(),
      tenantId: v.id("tenants"),
    })),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      return { valid: false };
    }

    // If tenantId is provided, validate user belongs to that tenant
    if (args.tenantId && user.tenantId !== args.tenantId) {
      return { valid: false };
    }

    return {
      valid: true,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  },
});
