// Story 11.3: Tenant Impersonation
// Backend mutations and queries for platform admin impersonation
// Tasks 1-4: Session creation, termination, status, and mutation tagging

import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

// =============================================================================
// Shared Helpers
// =============================================================================

/**
 * Verify that the caller is a platform admin.
 * Returns the admin user document or null.
 * Reuses the same pattern as requireAdmin in tenants.ts.
 */
async function requireAdmin(ctx: QueryCtx) {
  const { betterAuthComponent } = await import("../auth");
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

// =============================================================================
// Task 1: startImpersonation Mutation (AC: #2, #7)
// =============================================================================

/**
 * Start impersonating a tenant.
 * Creates an impersonation session and logs the action.
 */
export const startImpersonation = mutation({
  args: {
    tenantId: v.id("tenants"),
    ipAddress: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    redirectUrl: v.string(),
  }),
  handler: async (ctx: MutationCtx, args) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      // Log security event for unauthorized attempt
      await ctx.db.insert("auditLogs", {
        action: "impersonation_unauthorized",
        entityType: "users",
        entityId: "unknown",
        actorType: "system",
        metadata: { tenantId: args.tenantId, reason: "Admin access required" },
      });
      throw new Error("Unauthorized: Admin access required");
    }

    // Verify tenant exists
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Check if admin already has an active impersonation session
    const existingSession = await ctx.db
      .query("impersonationSessions")
      .withIndex("active_by_admin", (q: any) =>
        q.eq("adminId", admin._id).eq("endedAt", undefined)
      )
      .first();

    if (existingSession) {
      throw new Error(
        "Already in an impersonation session. End current session first."
      );
    }

    // Create impersonation session with IP address for audit trail
    const sessionId = await ctx.db.insert("impersonationSessions", {
      adminId: admin._id,
      targetTenantId: args.tenantId,
      startedAt: Date.now() / 1000,
      mutationsPerformed: [],
      ipAddress: args.ipAddress,
    });

    // Log to audit with IP address for security tracking
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "impersonation_start",
      entityType: "impersonationSessions",
      entityId: sessionId,
      actorId: admin.authId,
      actorType: "admin",
      metadata: {
        adminId: admin._id,
        adminEmail: admin.email,
        sessionId,
        ipAddress: args.ipAddress,
      },
    });

    return {
      success: true,
      redirectUrl: "/dashboard",
    };
  },
});

// =============================================================================
// Task 2: endImpersonation Mutation (AC: #6)
// =============================================================================

/**
 * End the current impersonation session.
 * Logs session summary and clears impersonation state.
 */
export const endImpersonation = mutation({
  args: {
    returnToTenantId: v.optional(v.id("tenants")),
  },
  returns: v.object({
    success: v.boolean(),
    redirectUrl: v.string(),
    sessionSummary: v.object({
      duration: v.number(),
      mutationsCount: v.number(),
    }),
  }),
  handler: async (ctx: MutationCtx, args) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Find active session
    const activeSession = await ctx.db
      .query("impersonationSessions")
      .withIndex("active_by_admin", (q: any) =>
        q.eq("adminId", admin._id).eq("endedAt", undefined)
      )
      .first();

    if (!activeSession) {
      throw new Error("No active impersonation session found");
    }

    const endedAt = Date.now() / 1000;
    const duration = endedAt - activeSession.startedAt;

    // Update session with end time
    await ctx.db.patch(activeSession._id, {
      endedAt,
    });

    // Log to audit with full session summary
    await ctx.db.insert("auditLogs", {
      tenantId: activeSession.targetTenantId,
      action: "impersonation_end",
      entityType: "impersonationSessions",
      entityId: activeSession._id,
      actorId: admin.authId,
      actorType: "admin",
      metadata: {
        adminId: admin._id,
        adminEmail: admin.email,
        sessionId: activeSession._id,
        duration,
        mutationsPerformed: activeSession.mutationsPerformed,
      },
    });

    const redirectUrl = args.returnToTenantId
      ? `/admin/tenants/${args.returnToTenantId}`
      : "/admin/tenants";

    return {
      success: true,
      redirectUrl,
      sessionSummary: {
        duration,
        mutationsCount: activeSession.mutationsPerformed.length,
      },
    };
  },
});

// =============================================================================
// Task 3: getImpersonationStatus Query (AC: #3, #8)
// =============================================================================

/**
 * Get current impersonation status for the logged-in admin.
 * Returns null if not impersonating.
 */
export const getImpersonationStatus = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      targetTenantId: v.id("tenants"),
      targetTenantName: v.string(),
      targetOwnerEmail: v.string(),
      startedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      return null; // Not an admin, not impersonating
    }

    // Find active session for this admin
    const activeSession = await ctx.db
      .query("impersonationSessions")
      .withIndex("active_by_admin", (q: any) =>
        q.eq("adminId", admin._id).eq("endedAt", undefined)
      )
      .first();

    if (!activeSession) {
      return null;
    }

    // Get tenant details
    const tenant = await ctx.db.get(activeSession.targetTenantId);
    if (!tenant) {
      return null; // Should not happen, but handle gracefully
    }

    // Get owner email by finding the owner user for this tenant
    const users = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", activeSession.targetTenantId))
      .collect();
    const owner = users.find((u: { role: string }) => u.role === "owner");

    return {
      targetTenantId: activeSession.targetTenantId,
      targetTenantName: tenant.name,
      targetOwnerEmail: owner?.email ?? "",
      startedAt: activeSession.startedAt,
    };
  },
});

// =============================================================================
// Task 4: recordImpersonatedMutation Mutation (AC: #5)
// =============================================================================

/**
 * Record a mutation performed during impersonation.
 * Called by mutation wrappers when impersonation is active.
 * Appends mutation info to the active session's mutationsPerformed array
 * and logs to auditLogs with "impersonated_mutation" prefix.
 */
export const recordImpersonatedMutation = mutation({
  args: {
    action: v.string(),
    details: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx: MutationCtx, args) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      return null;
    }

    const activeSession = await ctx.db
      .query("impersonationSessions")
      .withIndex("active_by_admin", (q: any) =>
        q.eq("adminId", admin._id).eq("endedAt", undefined)
      )
      .first();

    if (!activeSession) {
      return null; // Not in impersonation, nothing to record
    }

    const mutationRecord = {
      action: args.action,
      timestamp: Date.now() / 1000,
      details: args.details,
    };

    // Append mutation to session record
    await ctx.db.patch(activeSession._id, {
      mutationsPerformed: [
        ...activeSession.mutationsPerformed,
        mutationRecord,
      ],
    });

    // Log to audit with impersonated_mutation prefix
    await ctx.db.insert("auditLogs", {
      tenantId: activeSession.targetTenantId,
      action: "impersonated_mutation",
      entityType: "impersonationSessions",
      entityId: activeSession._id,
      actorId: admin.authId,
      actorType: "admin",
      metadata: {
        adminId: admin._id,
        adminEmail: admin.email,
        sessionId: activeSession._id,
        originalAction: args.action,
        details: args.details,
        performedByImpersonator: true,
      },
    });

    return null;
  },
});
