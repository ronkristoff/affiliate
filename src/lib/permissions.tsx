"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Role,
  ROLE_PERMISSIONS,
  hasPermission as checkPermission,
} from "../../convex/permissions";

// Re-export types and constants for convenience
export type { Role };
export { ROLE_PERMISSIONS };

/**
 * Permission utilities for client-side usage.
 * Provides hooks and helpers for RBAC checks.
 */

/**
 * Hook to check if a user has a specific permission.
 */
export function usePermission(
  userId: Id<"users"> | null,
  permission: string
) {
  const result = useQuery(
    api.permissions.checkPermission,
    userId ? { userId, permission } : "skip"
  );

  if (!result) {
    return { allowed: false, role: undefined };
  }

  return {
    allowed: result.allowed,
    role: result.role,
  };
}

/**
 * Hook to check multiple permissions at once.
 */
export function usePermissions(
  userId: Id<"users"> | null,
  permissions: string[]
) {
  const result = useQuery(
    api.permissions.checkPermissions,
    userId && permissions.length > 0 ? { userId, permissions } : "skip"
  );

  if (!result) {
    return { allowed: [], denied: [], role: undefined };
  }

  return {
    allowed: result.allowed,
    denied: result.denied,
    role: result.role,
  };
}

/**
 * Hook to get all permissions for a user.
 */
export function useUserPermissions(userId: Id<"users"> | null) {
  const result = useQuery(
    api.permissions.getUserPermissions,
    userId ? { userId } : "skip"
  );

  if (!result) {
    return { role: "none", permissions: [] };
  }

  return {
    role: result.role,
    permissions: result.permissions,
  };
}

/**
 * Hook to check if user can manage a resource.
 */
export function useCanManage(userId: Id<"users"> | null, resource: string) {
  const result = useQuery(
    api.permissions.canManage,
    userId && resource ? { userId, resource } : "skip"
  );

  return result ?? false;
}

/**
 * Hook to check if user can view a resource.
 */
export function useCanView(userId: Id<"users"> | null, resource: string) {
  const result = useQuery(
    api.permissions.canView,
    userId && resource ? { userId, resource } : "skip"
  );

  return result ?? false;
}

/**
 * Check if a role has a specific permission.
 * Client-side version that doesn't require a Convex query.
 */
export function hasPermission(role: Role, permission: string): boolean {
  return checkPermission(role, permission);
}

/**
 * Get all permissions for a role.
 */
export function getRolePermissions(role: Role): string[] {
  return [...(ROLE_PERMISSIONS[role] || [])];
}

/**
 * Check if user is an owner.
 */
export function isOwner(role: string): boolean {
  return role === "owner";
}

/**
 * Check if user is a manager.
 */
export function isManager(role: string): boolean {
  return role === "manager";
}

/**
 * Check if user is a viewer.
 */
export function isViewer(role: string): boolean {
  return role === "viewer";
}

/**
 * Permission guard component props.
 */
export interface PermissionGuardProps {
  userRole: string;
  requiredPermission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Resource types for permission checking.
 */
export type ResourceType =
  | "campaigns"
  | "affiliates"
  | "commissions"
  | "payouts"
  | "users"
  | "settings"
  | "billing";

/**
 * Action types for permission checking.
 */
export type ActionType = "view" | "create" | "edit" | "delete" | "manage";

/**
 * Build a permission string from resource and action.
 */
export function buildPermission(
  resource: ResourceType,
  action: ActionType
): string {
  return `${resource}:${action}`;
}

/**
 * Permission Guard Component
 *
 * A component that only renders its children if the user has the required permission.
 * Use this to conditionally show/hide UI elements based on user permissions.
 *
 * @example
 * ```tsx
 * <PermissionGuard userRole={user.role} requiredPermission="affiliates:manage" fallback={<p>Access denied</p>}>
 *   <button>Manage Affiliates</button>
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({
  userRole,
  requiredPermission,
  children,
  fallback = null,
}: PermissionGuardProps) {
  if (!userRole) {
    return <>{fallback}</>;
  }

  if (hasPermission(userRole as Role, requiredPermission)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Role Guard Component
 *
 * A component that only renders its children if the user has one of the allowed roles.
 *
 * @example
 * ```tsx
 * <RoleGuard userRole={user.role} allowedRoles={["owner", "manager"]}>
 *   <button>Admin Actions</button>
 * </RoleGuard>
 * ```
 */
export interface RoleGuardProps {
  userRole: string;
  allowedRoles: Array<"owner" | "manager" | "viewer">;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({
  userRole,
  allowedRoles,
  children,
  fallback = null,
}: RoleGuardProps) {
  if (!userRole) {
    return <>{fallback}</>;
  }

  if (allowedRoles.includes(userRole as "owner" | "manager" | "viewer")) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Hook to require a permission mutation.
 * Returns a function that can be called to check permission.
 *
 * @example
 * ```tsx
 * const { checkPermission } = useRequirePermission();
 * const result = await checkPermission(userId, "campaigns:create", "create campaign");
 * ```
 */
export function useRequirePermission() {
  const requirePermission = useMutation(api.permissions.requirePermission);

  return {
    checkPermission: async (
      userId: Id<"users">,
      permission: string,
      action: string
    ) => {
      try {
        await requirePermission({ userId, permission, action });
        return { isAllowed: true, error: null };
      } catch (error) {
        return {
          isAllowed: false,
          error: error instanceof Error ? error.message : "Permission denied",
        };
      }
    },
  };
}
