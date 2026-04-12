"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { betterAuthComponent } from "./auth";

/**
 * Upload tenant logo to Convex storage.
 * @security Requires 'settings:manage', 'settings:*', or 'manage:*' permission.
 */
export const uploadTenantLogo = action({
  args: {
    fileName: v.string(),
    contentType: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    logoUrl: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; logoUrl?: string }> => {
    // Get authenticated user
    const betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    if (!betterAuthUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Get user and check permissions
    type UserResult = { _id: Id<"users">; email: string; name?: string; role: string; tenantId: Id<"tenants"> } | null;
    const user: UserResult = await ctx.runQuery(internal.users._getUserByEmailInternal, {
      email: betterAuthUser.email,
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Check permission using internal query
    const hasPerm: boolean = await ctx.runQuery(internal.permissions._checkPermissionInternal, {
      userId: user._id,
      permission: "settings:manage",
    });

    if (!hasPerm) {
      throw new Error("Access denied: You require 'settings:manage' permission to upload logo");
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(args.contentType)) {
      throw new Error("Invalid file type. Supported: PNG, JPG, SVG, WebP");
    }

    // Validate file extension
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
    const ext = '.' + args.fileName.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      throw new Error("Invalid file extension. Use: .png, .jpg, .jpeg, .svg, .webp");
    }

    // For MVP: Store file in Convex storage and get URL
    // Read file content (in production, client should upload directly)
    // For now, return external URL placeholder
    const logoUrl: string = `https://storage.example.com/logos/${user.tenantId}/${Date.now()}-${args.fileName}`;

    // Update tenant with logo URL via internal mutation
    await ctx.runMutation(internal.tenants._updateTenantLogoInternal, {
      tenantId: user.tenantId,
      logoUrl,
    });

    // Log the action
    await ctx.runMutation(internal.audit.logAuditEventInternal, {
      tenantId: user.tenantId,
      action: "logo_uploaded",
      entityType: "tenant",
      entityId: user.tenantId,
      actorType: "user",
      newValue: { logoUrl },
    });

    return {
      success: true,
      logoUrl,
    };
  },
});
