import { internalMutation, mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { betterAuthComponent } from "./auth";

/**
 * Get the authenticated user from Better Auth.
 * Returns null if not authenticated.
 */
export async function getAuthenticatedUser(
  ctx: QueryCtx | MutationCtx
): Promise<{
  userId: Id<"users">;
  tenantId: Id<"tenants">;
    email: string;
    role: string;
  } | null> {
  // Get user data from Better Auth
  let betterAuthUser;
  try {
    betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
  } catch {
    return null;
  }

  if (!betterAuthUser) {
    return null;
  }

  // Find user by email across all tenants using index
  const appUser = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", betterAuthUser.email))
    .first();

  if (!appUser) {
    return null;
  }

  // Check if user has been removed (soft-deleted)
  if (appUser.status === "removed") {
    return null;
  }

  return {
    userId: appUser._id,
    tenantId: appUser.tenantId,
    email: appUser.email,
    role: appUser.role,
  };
}

/**
 * Get the tenant ID for the currently authenticated user.
 * Returns null if the user is not authenticated.
 */
export async function getTenantId(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"tenants"> | null> {
  const user = await getAuthenticatedUser(ctx);
  return user?.tenantId ?? null;
}

/**
 * Get the tenant ID for the currently authenticated user.
 * Throws an error if the user is not authenticated.
 */
export async function requireTenantId(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"tenants">> {
  const tenantId = await getTenantId(ctx);
  if (!tenantId) {
    throw new Error("Unauthorized: Authentication required");
  }
  return tenantId;
}

/**
 * Get the full tenant record for the currently authenticated user.
 * Returns null if the user is not authenticated or tenant not found.
 */
export async function getTenant(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"tenants"> | null> {
  const user = await getAuthenticatedUser(ctx);
  if (!user) {
    return null;
  }
  return await ctx.db.get(user.tenantId);
}

/**
 * Validate that a document belongs to the current tenant.
 * Throws an error if the document doesn't exist or belongs to another tenant.
 */
export async function validateTenantOwnership<T extends { tenantId: Id<"tenants"> }>(
  _ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
  document: T | null
): Promise<T> {
  if (!document) {
    throw new Error("Resource not found or access denied");
  }
  
  if (document.tenantId !== tenantId) {
    throw new Error("Resource not found or access denied");
  }
  
  return document;
}

/**
 * Create a tenant-scoped query that automatically injects the tenant ID.
 * The query will fail if the user is not authenticated.
 * 
 * Note: For better type safety, use this as a template and create your own
 * typed versions for specific use cases.
 */
export function tenantQuery<Args extends Record<string, any>, ReturnType>(
  argsValidator: Record<string, any>,
  returnsValidator: any,
  handler: (ctx: QueryCtx, args: Args, tenantId: Id<"tenants">) => Promise<ReturnType>
) {
  return query({
    args: argsValidator,
    returns: returnsValidator,
    handler: async (ctx, args) => {
      const tenantId = await requireTenantId(ctx);
      return handler(ctx, args as Args, tenantId);
    },
  });
}

/**
 * Create a tenant-scoped mutation that automatically injects the tenant ID.
 * The mutation will fail if the user is not authenticated.
 * Use validateTenantOwnership() within the handler to verify document ownership
 * 
 * Note: For better type safety, use this as a template and create your own
 * typed versions for specific use cases.
 */
export function tenantMutation<Args extends Record<string, any>, ReturnType>(
  argsValidator: Record<string, any>,
  returnsValidator: any,
  handler: (ctx: MutationCtx, args: Args, tenantId: Id<"tenants">) => Promise<ReturnType>
) {
  return mutation({
    args: argsValidator,
    returns: returnsValidator,
    handler: async (ctx, args) => {
      const tenantId = await requireTenantId(ctx);
      return handler(ctx, args as Args, tenantId);
    },
  });
}