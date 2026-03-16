import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Role-Based Access Control (RBAC) System
 * 
 * Roles:
 * - owner: Full access to everything
 * - manager: Can manage campaigns, affiliates, commissions
 * - viewer: Read-only access
 * 
 * Permissions follow the pattern: resource:action
 * Examples:
 * - manage:* - Full management access
 * - campaigns:create - Create campaigns
 * - affiliates:view - View affiliates
 */

// Role permission mappings
export const ROLE_PERMISSIONS = {
  owner: [
    "manage:*",
    "billing:*",
    "users:*",
    "campaigns:*",
    "affiliates:*",
    "commissions:*",
    "payouts:*",
    "settings:*",
    "view:*",
  ],
  manager: [
    "manage:campaigns",
    "manage:affiliates",
    "manage:commissions",
    "campaigns:*",
    "affiliates:*",
    "commissions:*",
    "payouts:view",
    "view:*",
  ],
  viewer: [
    "view:*",
    "campaigns:view",
    "affiliates:view",
    "commissions:view",
    "payouts:view",
  ],
} as const;

export type Role = keyof typeof ROLE_PERMISSIONS;
export type Permission = typeof ROLE_PERMISSIONS[Role][number];

/**
 * Check if a permission matches a required permission.
 * Supports wildcards (e.g., "manage:*" matches "manage:campaigns").
 */
function permissionMatches(required: string, granted: string): boolean {
  if (granted === required) return true;
  if (granted === "*") return true;
  if (granted.endsWith(":*")) {
    const prefix = granted.slice(0, -1);
    return required.startsWith(prefix);
  }
  return false;
}

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: Role, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.some((granted) => permissionMatches(permission, granted as string));
}

/**
 * Check if a user has a specific permission.
 * Considers both role permissions and permission overrides.
 */
export const checkPermission = query({
  args: {
    userId: v.id("users"),
    permission: v.string(),
  },
  returns: v.object({
    allowed: v.boolean(),
    role: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { allowed: false };
    }

    const role = user.role as Role;

    // Check role-based permissions
    if (hasPermission(role, args.permission)) {
      return { allowed: true, role };
    }

    // Check permission overrides (for future extensibility)
    if (user.permissionOverrides) {
      // Map permission to override field
      const overrideMap: Record<string, keyof typeof user.permissionOverrides> = {
        "affiliates:manage": "canManageAffiliates",
        "campaigns:manage": "canManageCampaigns",
        "commissions:view": "canViewCommissions",
      };

      const overrideField = overrideMap[args.permission];
      if (overrideField && user.permissionOverrides[overrideField]) {
        return { allowed: true, role };
      }
    }

    return { allowed: false, role };
  },
});

/**
 * Check multiple permissions at once.
 */
export const checkPermissions = query({
  args: {
    userId: v.id("users"),
    permissions: v.array(v.string()),
  },
  returns: v.object({
    allowed: v.array(v.string()),
    denied: v.array(v.string()),
    role: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { allowed: [], denied: args.permissions };
    }

    const role = user.role as Role;
    const allowed: string[] = [];
    const denied: string[] = [];

    for (const permission of args.permissions) {
      if (hasPermission(role, permission)) {
        allowed.push(permission);
      } else {
        denied.push(permission);
      }
    }

    return { allowed, denied, role };
  },
});

/**
 * Get all permissions for a user.
 */
export const getUserPermissions = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    role: v.string(),
    permissions: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { role: "none", permissions: [] };
    }

    const role = user.role as Role;
    const permissions = ROLE_PERMISSIONS[role] || [];

    return {
      role,
      permissions: [...permissions],
    };
  },
});

/**
 * Require a specific permission for an action.
 * Throws an error if permission is not granted.
 */
export const requirePermission = mutation({
  args: {
    userId: v.id("users"),
    permission: v.string(),
    action: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const role = user.role as Role;

    if (!hasPermission(role, args.permission)) {
      // Log unauthorized access attempt
      await ctx.db.insert("auditLogs", {
        tenantId: user.tenantId,
        action: "permission_denied",
        entityType: "user",
        entityId: args.userId,
        actorId: args.userId,
        actorType: "user",
        metadata: {
          ipAddress: "",
          userAgent: `attemptedPermission:${args.permission};attemptedAction:${args.action}`,
        },
      });

      throw new Error(
        `Access denied: User does not have permission "${args.permission}" to perform "${args.action}"`
      );
    }

    return null;
  },
});

/**
 * Check if user can manage a specific resource type.
 */
export const canManage = query({
  args: {
    userId: v.id("users"),
    resource: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return false;
    }

    const role = user.role as Role;
    return hasPermission(role, `${args.resource}:manage`) || hasPermission(role, "manage:*");
  },
});

/**
 * Check if user can view a specific resource type.
 */
export const canView = query({
  args: {
    userId: v.id("users"),
    resource: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return false;
    }

    const role = user.role as Role;
    return (
      hasPermission(role, `${args.resource}:view`) ||
      hasPermission(role, "view:*") ||
      hasPermission(role, `${args.resource}:*`)
    );
  },
});

/**
 * Internal query to check if a user has a specific permission.
 * Used by actions that need permission checking.
 */
export const _checkPermissionInternal = internalQuery({
  args: {
    userId: v.id("users"),
    permission: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return false;
    }

    const role = user.role as Role;
    return hasPermission(role, args.permission) || hasPermission(role, "manage:*");
  },
});
