// Shared admin helpers for platform administration
// Extracted to avoid duplication across admin modules

import type { QueryCtx } from "../_generated/server";
import { betterAuthComponent } from "../auth";
import { Id } from "../_generated/dataModel";

// =============================================================================
// Shared Tenant Stats Reader
// =============================================================================

/**
 * Shape of the denormalized tenantStats document.
 * Mirrors the fields in convex/schema.ts for convenience.
 */
export interface TenantStatsData {
  affiliatesPending: number;
  affiliatesActive: number;
  affiliatesSuspended: number;
  affiliatesRejected: number;
  commissionsPendingCount: number;
  commissionsPendingValue: number;
  commissionsConfirmedThisMonth: number;
  commissionsConfirmedValueThisMonth: number;
  commissionsFlagged: number;
  totalPaidOut: number;
  pendingPayoutTotal: number | undefined;
  pendingPayoutCount: number | undefined;
}

/**
 * Read the denormalized tenantStats for a tenant.
 * Returns null-safe defaults if no stats document exists.
 * Used across all admin views to avoid table scans for aggregate counts.
 */
export async function readTenantStats(
  ctx: QueryCtx,
  tenantId: Id<"tenants">,
): Promise<TenantStatsData> {
  const stats = await ctx.db
    .query("tenantStats")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .first();

  return {
    affiliatesPending: stats?.affiliatesPending ?? 0,
    affiliatesActive: stats?.affiliatesActive ?? 0,
    affiliatesSuspended: stats?.affiliatesSuspended ?? 0,
    affiliatesRejected: stats?.affiliatesRejected ?? 0,
    commissionsPendingCount: stats?.commissionsPendingCount ?? 0,
    commissionsPendingValue: stats?.commissionsPendingValue ?? 0,
    commissionsConfirmedThisMonth: stats?.commissionsConfirmedThisMonth ?? 0,
    commissionsConfirmedValueThisMonth: stats?.commissionsConfirmedValueThisMonth ?? 0,
    commissionsFlagged: stats?.commissionsFlagged ?? 0,
    totalPaidOut: stats?.totalPaidOut ?? 0,
    pendingPayoutTotal: stats?.pendingPayoutTotal ?? 0,
    pendingPayoutCount: stats?.pendingPayoutCount ?? 0,
  };
}

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
