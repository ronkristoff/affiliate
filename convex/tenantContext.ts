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
 * Also checks write access - blocks writes for cancelled subscriptions after billing period ends.
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
      // Check write access - blocks writes for cancelled subscriptions after billing period ends
      await requireWriteAccess(ctx);
      return handler(ctx, args as Args, tenantId);
    },
  });
}

/**
 * Get the tenant ID for the currently authenticated affiliate.
 * Looks up the `affiliates` table (not `users`) via Better Auth session.
 * Returns null if the user is not authenticated or not an affiliate.
 */
export async function getAffiliateTenantId(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"tenants"> | null> {
  let betterAuthUser;
  try {
    betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
  } catch {
    return null;
  }

  if (!betterAuthUser) {
    return null;
  }

  const affiliate = await ctx.db
    .query("affiliates")
    .withIndex("by_email", (q) => q.eq("email", betterAuthUser.email))
    .first();

  if (!affiliate) {
    return null;
  }

  return affiliate.tenantId;
}

/**
 * Get the tenant ID for the currently authenticated affiliate.
 * Throws an error if not authenticated or not an affiliate.
 */
export async function requireAffiliateTenantId(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"tenants">> {
  const tenantId = await getAffiliateTenantId(ctx);
  if (!tenantId) {
    throw new Error("Unauthorized: Affiliate authentication required");
  }
  return tenantId;
}

/**
 * Check if write operations are allowed for the current tenant.
 * Write operations are blocked when:
 * 1. subscriptionStatus is "past_due" (immediate block)
 * 2. subscriptionStatus is "cancelled" (regardless of billingEndDate)
 * 
 * @param ctx - The Convex context
 * @returns Object with canWrite flag and reason if blocked
 */
export async function checkWriteAccess(
  ctx: QueryCtx | MutationCtx
): Promise<{ canWrite: boolean; reason?: string }> {
  const tenant = await getTenant(ctx);
  
  if (!tenant) {
    return { canWrite: false, reason: "Tenant not found" };
  }

  const subscriptionStatus = tenant.subscriptionStatus;

  // Block writes for past_due subscriptions (immediate)
  if (subscriptionStatus === "past_due") {
    return { 
      canWrite: false, 
      reason: "Write operations are blocked because your subscription payment is overdue" 
    };
  }

  // Block writes for all cancelled subscriptions (regardless of reason)
  if (subscriptionStatus === "cancelled") {
    return { 
      canWrite: false, 
      reason: "Write operations are blocked because your subscription has been cancelled" 
    };
  }

  return { canWrite: true };
}

/**
 * Require that write operations are allowed for the current tenant.
 * Throws an error if writes are blocked.
 */
export async function requireWriteAccess(ctx: QueryCtx | MutationCtx): Promise<void> {
  const { canWrite, reason } = await checkWriteAccess(ctx);
  if (!canWrite) {
    throw new Error(reason || "Write operations are not allowed");
  }
}