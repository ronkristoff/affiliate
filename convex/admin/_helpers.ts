// Shared admin helpers for platform administration
// Extracted to avoid duplication across admin modules

import type { QueryCtx } from "../_generated/server";
import { betterAuthComponent } from "../auth";

/**
 * Verify that the caller is a platform admin.
 * Returns the admin user document or throws descriptive errors.
 * 
 * This is the canonical implementation used across all admin files.
 * Throws descriptive errors for better debugging and UX.
 */
export async function requireAdmin(ctx: QueryCtx) {
  let betterAuthUser;
  try {
    betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
  } catch {
    throw new Error("Unauthorized: Not authenticated");
  }

  if (!betterAuthUser) {
    throw new Error("Unauthorized: Not authenticated");
  }

  const appUser = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", betterAuthUser.email))
    .first();

  if (!appUser || appUser.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }

  return appUser;
}

/**
 * Verify that the caller is a platform admin (legacy null-returning variant).
 * Used for gradual migration - prefer requireAdmin that throws.
 * 
 * @deprecated Use requireAdmin instead for consistent error handling
 */
export async function requireAdminLegacy(ctx: QueryCtx) {
  let betterAuthUser;
  try {
    betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
  } catch {
    return null;
  }

  if (!betterAuthUser) {
    return null;
  }

  const appUser = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", betterAuthUser.email))
    .first();

  if (!appUser || appUser.role !== "admin") {
    return null;
  }

  return appUser;
}
