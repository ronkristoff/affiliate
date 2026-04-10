/**
 * Security Audit Logging Module
 * 
 * Provides security event logging for unauthorized access attempts and
 * other security-relevant events.
 * 
 * @see Story 1.5: Multi-Tenant Data Isolation (AC3)
 * @see Story 7.8: Commission Audit Log (FR29)
 */

/**
 * IMMUTABILITY GUARANTEE
 * =====================
 * This module provides append-only audit logging.
 * 
 * - No mutations exist to update audit log entries
 * - No mutations exist to delete audit log entries
 * - All functions only INSERT new records
 * 
 * If modification is absolutely required (legal compliance),
 * it must be done through a separate admin migration with
 * full documentation of the exception.
 */

import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import { getAuthenticatedUser } from "./tenantContext";

// =============================================================================
// SECURITY EVENT TYPES
// =============================================================================

/**
 * Types of security events that can be logged.
 */
export type SecurityEventType =
  | "unauthorized_access_attempt"
  | "cross_tenant_query"
  | "cross_tenant_mutation"
  | "authentication_failure"
  | "session_expired"
  | "invalid_token";

// =============================================================================
// INTERNAL MUTATIONS
// =============================================================================

/**
 * Log a security event to the audit logs.
 * This is an internal mutation that should only be called by other Convex functions.
 * 
 * Note: The audit log schema currently only supports a subset of fields.
 * Security-specific fields (attemptedTenantId, securityEvent, crossTenantAttempt, additionalInfo)
 * will be stored in the newValue field until schema is updated.
 * 
 * @param action - Type of security event
 * @param attemptedTenantId - The tenant ID that was attempted to be accessed (optional)
 * @param resourceType - Type of resource being accessed (optional)
 * @param resourceId - ID of the resource being accessed (optional)
 * @param additionalInfo - Additional context about the event (optional)
 */
export const logSecurityEvent = internalMutation({
  args: {
    action: v.string(),
    attemptedTenantId: v.optional(v.id("tenants")),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    additionalInfo: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get current user info if available
    let userId: Id<"users"> | undefined;
    let tenantId: Id<"tenants"> | undefined;
    
    try {
      // Try to get the authenticated user's info
      const auth = await ctx.auth.getUserIdentity();
      if (auth) {
        // Find user by email
        const user = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", auth.email ?? ""))
          .first();
        if (user) {
          userId = user._id;
          tenantId = user.tenantId;
        }
      }
    } catch {
      // User might not be authenticated, which is fine for logging
    }
    
    // Insert the security audit log
    // Using newValue field to store security-specific data since schema is limited
    await ctx.db.insert("auditLogs", {
      tenantId: tenantId,
      action: `security_${args.action}`,
      entityType: args.resourceType ?? "security_event",
      entityId: args.resourceId ?? "unknown",
      actorId: userId,
      actorType: userId ? "user" : "unauthenticated",
      newValue: {
        attemptedTenantId: args.attemptedTenantId,
        securityEvent: true,
        crossTenantAttempt: args.attemptedTenantId !== undefined && tenantId !== undefined && tenantId !== args.attemptedTenantId,
        additionalInfo: args.additionalInfo,
      },
    });
    
    return null;
  },
});

/**
 * Log an unauthorized access attempt with full context.
 * Convenience wrapper around logSecurityEvent.
 * 
 * @param action - Type of unauthorized attempt
 * @param currentTenantId - The authenticated user's tenant ID
 * @param attemptedTenantId - The tenant ID that was attempted to be accessed
 * @param resourceType - Type of resource being accessed
 * @param resourceId - ID of the resource being accessed
 */
export const logUnauthorizedAccess = internalMutation({
  args: {
    action: v.string(),
    currentTenantId: v.id("tenants"),
    attemptedTenantId: v.id("tenants"),
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get current user info
    let userId: Id<"users"> | undefined;
    
    try {
      const auth = await ctx.auth.getUserIdentity();
      if (auth) {
        const user = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", auth.email ?? ""))
          .first();
        if (user) {
          userId = user._id;
        }
      }
    } catch {
      // Ignore errors
    }
    
    // Log the unauthorized access attempt
    await ctx.db.insert("auditLogs", {
      tenantId: args.currentTenantId,
      action: `security_${args.action}`,
      entityType: args.resourceType ?? "security_event",
      entityId: args.resourceId ?? "unknown",
      actorId: userId,
      actorType: userId ? "user" : "unauthenticated",
      newValue: {
        attemptedTenantId: args.attemptedTenantId,
        securityEvent: true,
        crossTenantAttempt: args.currentTenantId !== args.attemptedTenantId,
        additionalInfo: `User from tenant ${args.currentTenantId} attempted to access resource from tenant ${args.attemptedTenantId}`,
      },
    });
    
    return null;
  },
});

/**
 * Internal mutation to log a generic audit event.
 * Used by commission engine for subscription lifecycle event logging.
 */
export const logAuditEventInternal = internalMutation({
  args: {
    tenantId: v.optional(v.id("tenants")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    actorId: v.optional(v.id("users")),
    actorType: v.string(),
    previousValue: v.optional(v.any()),
    newValue: v.optional(v.any()),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      actorId: args.actorId,
      actorType: args.actorType,
      previousValue: args.previousValue,
      newValue: args.newValue,
      metadata: args.metadata,
    });
    return null;
  },
});

// =============================================================================
// COMMISSION AUDIT LOGGING (Story 7.8)
// =============================================================================

/**
 * Commission audit action types
 * Export for use by other modules
 */
export const COMMISSION_AUDIT_ACTIONS = {
  CREATED: "COMMISSION_CREATED",
  APPROVED: "COMMISSION_APPROVED",
  DECLINED: "COMMISSION_DECLINED",
  REVERSED: "COMMISSION_REVERSED",
  STATUS_CHANGE: "COMMISSION_STATUS_CHANGE",
} as const;

export type CommissionAuditAction = typeof COMMISSION_AUDIT_ACTIONS[keyof typeof COMMISSION_AUDIT_ACTIONS];

// =============================================================================
// PAYOUT AUDIT LOGGING (Story 13.6)
// =============================================================================

/**
 * Payout audit action types
 * Export for use by other modules
 */
export const PAYOUT_AUDIT_ACTIONS = {
  BATCH_GENERATED: "payout_batch_generated",
  PAYOUT_MARKED_PAID: "payout_marked_paid",
  BATCH_MARKED_PAID: "batch_marked_paid",
} as const;

export type PayoutAuditAction = typeof PAYOUT_AUDIT_ACTIONS[keyof typeof PAYOUT_AUDIT_ACTIONS];

/**
 * Internal mutation to log a payout-related audit event.
 * Centralized function for all payout lifecycle events.
 *
 * Story 13.6 - Payout Audit Log (FR50)
 *
 * @param tenantId - The tenant ID
 * @param action - The payout action type (from PAYOUT_AUDIT_ACTIONS)
 * @param entityType - "payouts" or "payoutBatches"
 * @param entityId - The payout or batch ID
 * @param actorId - The user who performed the action
 * @param actorType - "user" or "system"
 * @param targetId - Related entity ID (e.g., batchId for payout actions, null for batch actions)
 * @param metadata - Additional context (amounts, counts, references, etc.)
 */
export const logPayoutAuditEvent = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    actorId: v.optional(v.string()),
    actorType: v.string(),
    targetId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      actorId: args.actorId,
      actorType: args.actorType,
      targetId: args.targetId,
      metadata: args.metadata,
    });
    return null;
  },
});

/**
 * Internal mutation to log a commission-related audit event.
 * Centralized function for all commission lifecycle events.
 * 
 * Story 7.8 - Commission Audit Log (AC1, AC2)
 * 
 * @param tenantId - The tenant ID
 * @param action - The commission action type
 * @param commissionId - The commission ID
 * @param affiliateId - The affiliate ID (required for commission audit)
 * @param actorId - The user/system that performed the action
 * @param actorType - "user", "system", or "webhook"
 * @param previousValue - Previous state (for status changes)
 * @param newValue - New state
 * @param metadata - Additional context (amount, reason, etc.)
 */
export const logCommissionAuditEvent = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    action: v.string(),
    commissionId: v.id("commissions"),
    affiliateId: v.id("affiliates"), // Made required per AC1
    actorId: v.optional(v.string()),
    actorType: v.string(),
    previousValue: v.optional(v.any()),
    newValue: v.optional(v.any()),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: args.action,
      entityType: "commission",
      entityId: args.commissionId,
      actorId: args.actorId,
      actorType: args.actorType,
      previousValue: args.previousValue,
      newValue: args.newValue,
      metadata: args.metadata,
      affiliateId: args.affiliateId,
    });
    return null;
  },
});

// =============================================================================
// AUDIT LOG QUERY FUNCTIONS (Story 7.8)
// =============================================================================

/**
 * Get audit log entries for a specific commission.
 * Only returns entries for the authenticated user's tenant.
 * 
 * Story 7.8 - Commission Audit Log (AC4, AC5)
 */
export const getCommissionAuditLog = query({
  args: {
    commissionId: v.id("commissions"),
  },
  returns: v.array(v.object({
    _id: v.id("auditLogs"),
    _creationTime: v.number(),
    action: v.string(),
    actorId: v.optional(v.string()),
    actorType: v.string(),
    previousValue: v.optional(v.any()),
    newValue: v.optional(v.any()),
    metadata: v.optional(v.any()),
    affiliateId: v.optional(v.id("affiliates")),
  })),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }
    
    // Verify commission belongs to user's tenant
    const commission = await ctx.db.get(args.commissionId);
    if (!commission || commission.tenantId !== user.tenantId) {
      return []; // Return empty for cross-tenant access
    }
    
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) => 
        q.eq("entityType", "commission").eq("entityId", args.commissionId)
      )
      .order("asc") // Chronological order
      .collect();
    
    // Filter by tenant (additional safety)
    return logs.filter(log => log.tenantId === user.tenantId);
  },
});

/**
 * List audit logs for commissions with pagination and filtering.
 * Story 7.8 - Commission Audit Log (AC4, AC5)
 */
export const listCommissionAuditLogs = query({
  args: {
    paginationOpts: paginationOptsValidator,
    affiliateId: v.optional(v.id("affiliates")),
    action: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("auditLogs"),
      _creationTime: v.number(),
      action: v.string(),
      entityId: v.string(),
      actorId: v.optional(v.string()),
      actorType: v.string(),
      previousValue: v.optional(v.any()),
      newValue: v.optional(v.any()),
      metadata: v.optional(v.any()),
      affiliateId: v.optional(v.id("affiliates")),
    })),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return {
        page: [],
        isDone: true,
        continueCursor: null,
      };
    }
    
    let query = ctx.db
      .query("auditLogs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))
      .filter((q) => q.eq(q.field("entityType"), "commission"));
    
    // Apply optional filters
    if (args.affiliateId) {
      query = query.filter((q) => q.eq(q.field("affiliateId"), args.affiliateId!));
    }
    if (args.action) {
      query = query.filter((q) => q.eq(q.field("action"), args.action));
    }
    if (args.startDate !== undefined) {
      query = query.filter((q) => q.gte(q.field("_creationTime"), args.startDate!));
    }
    if (args.endDate !== undefined) {
      query = query.filter((q) => q.lte(q.field("_creationTime"), args.endDate!));
    }
    
    const results = await query.order("desc").paginate(args.paginationOpts);
    
    return results;
  },
});

/**
 * List audit logs for payout-related events with pagination and filtering.
 * SaaS Owner-facing query (not admin).
 * 
 * Enriches results with actor names by joining with users table.
 *
 * Story 13.6 - Payout Audit Log (AC3)
 */
export const listPayoutAuditLogs = query({
  args: {
    paginationOpts: paginationOptsValidator,
    action: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("auditLogs"),
      _creationTime: v.number(),
      tenantId: v.optional(v.id("tenants")),
      action: v.string(),
      entityType: v.string(),
      entityId: v.string(),
      actorId: v.optional(v.string()),
      actorName: v.optional(v.string()),
      actorType: v.string(),
      targetId: v.optional(v.string()),
      metadata: v.optional(v.any()),
    })),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return {
        page: [],
        isDone: true,
        continueCursor: null,
        pageStatus: null,
        splitCursor: null,
      };
    }

    // Build query using by_tenant index with post-filter for entityType
    let queryBuilder = ctx.db
      .query("auditLogs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))
      .filter((q) =>
        q.or(
          q.eq(q.field("entityType"), "payouts"),
          q.eq(q.field("entityType"), "payoutBatches")
        )
      );

    // Apply optional filters
    if (args.action) {
      queryBuilder = queryBuilder.filter((q) => q.eq(q.field("action"), args.action));
    }
    if (args.startDate !== undefined) {
      queryBuilder = queryBuilder.filter((q) => q.gte(q.field("_creationTime"), args.startDate!));
    }
    if (args.endDate !== undefined) {
      queryBuilder = queryBuilder.filter((q) => q.lte(q.field("_creationTime"), args.endDate!));
    }

    const results = await queryBuilder.order("desc").paginate(args.paginationOpts);
    
    // Enrich with actor names
    const enrichedPage = await Promise.all(
      results.page.map(async (log) => {
        let actorName: string | undefined;
        
        if (log.actorId && log.actorId.startsWith("users_")) {
          try {
            const actorUser = await ctx.db.get(log.actorId as Id<"users">);
            actorName = actorUser?.name;
          } catch {
            // Actor user not found or invalid ID format
            actorName = undefined;
          }
        }
        
        return {
          _id: log._id,
          _creationTime: log._creationTime,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          actorId: log.actorId,
          actorName,
          actorType: log.actorType,
          targetId: log.targetId,
          metadata: log.metadata,
        };
      })
    );
    
    return {
      page: enrichedPage,
      isDone: results.isDone,
      continueCursor: results.continueCursor,
    };
  },
});

// =============================================================================
// Admin Query Builder Export Record (internal helper)
// =============================================================================

/**
 * Create an admin query export record in adminQueryExports table.
 * Called from admin/queryBuilderExport action (Node.js runtime).
 */
export const _createAdminExportRecord = internalMutation({
  args: {
    createdBy: v.id("users"),
    storageFileId: v.id("_storage"),
    fileName: v.string(),
    totalRows: v.number(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    createdAt: v.number(),
    expiresAt: v.number(),
  },
  returns: v.id("adminQueryExports"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("adminQueryExports", {
      createdBy: args.createdBy,
      storageFileId: args.storageFileId,
      fileName: args.fileName,
      totalRows: args.totalRows,
      status: args.status,
      createdAt: args.createdAt,
      expiresAt: args.expiresAt,
    });
  },
});
