# Role-Based Access Control (RBAC) Permission System

## Overview

This document describes the RBAC (Role-Based Access Control) system implemented in the salig-affiliate project. The system provides centralized permission management for SaaS owner operations within a multi-tenant environment.

## Roles

The system defines three roles with hierarchical permissions:

| Role | Description |
|------|-------------|
| **owner** | Full access to all operations within the tenant |
| **manager** | Can manage campaigns, affiliates, and commissions |
| **viewer** | Read-only access to resources |

## Role Hierarchy

```
owner (full access)
  └── manager (limited management)
        └── viewer (read-only)
```

## Permissions

Permissions follow the pattern `resource:action` and support wildcards:

### Permission Format
- `resource:action` - Specific permission (e.g., `campaigns:create`)
- `resource:*` - All actions on a resource (e.g., `campaigns:*`)
- `manage:*` - Full management access across all resources

### Owner Permissions

| Permission | Description |
|------------|-------------|
| `manage:*` | Full management access to all resources |
| `billing:*` | All billing operations |
| `users:*` | All user management |
| `campaigns:*` | All campaign operations |
| `affiliates:*` | All affiliate operations |
| `commissions:*` | All commission operations |
| `payouts:*` | All payout operations |
| `settings:*` | All tenant settings |
| `view:*` | View all resources |

### Manager Permissions

| Permission | Description |
|-----------|------------|
| `campaigns:manage` | Create, edit, pause, archive campaigns |
| `affiliates:manage` | Approve, suspend, reactivate affiliates |
| `commissions:manage` | Approve, deny commissions |
| `billing:*` | All billing operations (owner only) |
| `campaigns:*` | All campaign operations |
| `affiliates:*` | All affiliate operations |
| `commissions:*` | All commission operations |
| `payouts:view` | View payout information |
| `view:*` | View all resources |

### Viewer Permissions

| Permission | Description |
|------------|-------------|
| `view:*` | View all resources |
| `campaigns:view` | View campaigns |
| `affiliates:view` | View affiliates |
| `commissions:view` | View commissions |
| `payouts:view` | View payouts |

## Implementation

### Files

- `convex/permissions.ts` - Server-side permission functions and types
- `src/lib/permissions.tsx` - Client-side hooks and components
- `src/lib/permissions.test.ts` - Unit tests

### Server-Side Usage

#### Importing Permission Functions

```typescript
import { hasPermission, ROLE_PERMISSIONS, checkPermission, requirePermission } from "./permissions";
import type { Role } from "./permissions";
```

#### Checking Permissions

```typescript
// Simple role-based check
const canManage = hasPermission(userRole as Role, "campaigns:create");

// Using Convex query for database-backed check
const result = await ctx.runQuery(api.permissions.checkPermission, {
  userId: user._id,
  permission: "affiliates:manage"
});
```

#### Requiring Permissions (with enforcement)

```typescript
// This mutation will throw if user lacks permission
export const myMutation = mutation({
  args: { ... },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(api.permissions.requirePermission, {
      userId: currentUser._id,
      permission: "affiliates:manage",
      action: "updateAffiliateStatus"
    });
    // ... mutation logic
  }
});
```

#### Resource-Level Helpers

```typescript
// Check if user can manage a resource type
const canManageCampaigns = await ctx.runQuery(api.permissions.canManage, {
  userId: user._id,
  resource: "campaigns"
});

// Check if user can view a resource type
const canViewAffiliates = await ctx.runQuery(api.permissions.canView, {
  userId: user._id,
  resource: "affiliates"
});
```

### Client-Side Usage

#### Importing Hooks

```typescript
import { usePermission, useCanManage, useCanView, PermissionGuard, RoleGuard } from "@/lib/permissions";
```

#### Using Hooks

```typescript
// Check specific permission
const { allowed } = usePermission(userId, "campaigns:create");

// Check multiple permissions
const { allowed, denied } = usePermissions(userId, ["campaigns:create", "affiliates:manage"]);

// Check resource management permission
const canManage = useCanManage(userId, "campaigns");

// Check resource view permission
const canView = useCanView(userId, "affiliates");
```

#### Using Permission Guard Components

```tsx
// Hide content based on permission
<PermissionGuard
  userRole={user.role}
  requiredPermission="affiliates:manage"
  fallback={<p>You don't have permission to manage affiliates</p>}
>
  <button>Manage Affiliates</button>
</PermissionGuard>

// Hide content based on role
<RoleGuard
  userRole={user.role}
  allowedRoles={["owner", "manager"]}
>
  <AdminPanel />
</RoleGuard>
```

## Audit Logging

All permission denials are logged to the `auditLogs` table for security auditing:

```typescript
// Automatic logging in requirePermission
await ctx.db.insert("auditLogs", {
  tenantId,
  action: "permission_denied",
  entityType: "...",
  entityId: "...",
  actorId: userId,
  actorType: "user",
  metadata: {
    securityEvent: true,
    additionalInfo: `attemptedPermission=..., attemptedAction=...`
  }
});
```

## Applying Permissions to New Features

When implementing new Convex functions, follow these steps:

### 1. Identify Required Permission

Determine what permission is needed based on the operation:

| Operation | Permission |
|-----------|------------|
| Create resource | `resource:manage` or `resource:*` or `manage:*` |
| Edit resource | `resource:manage` or `resource:*` or `manage:*` |
| Delete resource | `resource:manage` or `resource:*` or `manage:*` |
| View resource | `resource:view` or `view:*` |
| Manage specific feature | `resource:manage` or `manage:*` |

### 2. Add Permission Check

Add permission checking to mutations:

```typescript
export const createResource = mutation({
  args: { ... },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized");
    }
    
    const role = authUser.role as Role;
    if (!hasPermission(role, "resource:create") && !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId: authUser.tenantId,
        action: "permission_denied",
        entityType: "resource",
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=resource:create`
        }
      });
      throw new Error("Access denied: You require 'resource:create' permission");
    }
    
    // ... mutation logic
  }
});
```

### 3. Add UI Permission Guards

Add permission guards to UI components:

```tsx
<PermissionGuard
  userRole={currentUser?.role}
  requiredPermission="resource:create"
>
  <CreateResourceButton />
</PermissionGuard>
```

## Testing

Run tests to verify permission logic:

```bash
pnpm test -- src/lib/permissions.test.ts
```

## Future Enhancements

Potential improvements to the RBAC system:

1. **Permission Overrides** - Allow granular permission overrides for specific users
2. **Custom Roles** - Allow tenants to define custom roles
3. **Resource-Level Permissions** - Fine-grained permissions per resource instance
4. **Time-Based Permissions** - Temporary access grants
5. **Department-Based Access** - Restrict access by department/team
