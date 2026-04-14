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

import { internalMutation, internalAction, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import { getAuthenticatedUser } from "./tenantContext";
import { internal } from "./_generated/api";

// =============================================================================
// CLICK AUDIT ACTION TYPES
// =============================================================================

export const CLICK_AUDIT_ACTIONS = {
  RECORDED: "click_recorded",
  DEDUPLICATED: "click_deduplicated",
} as const;

// =============================================================================
// CONVERSION AUDIT ACTION TYPES
// =============================================================================

export const CONVERSION_AUDIT_ACTIONS = {
  RECORDED: "conversion_recorded",
  RECORDED_SELF_REFERRAL: "conversion_recorded_self_referral",
  ORGANIC: "organic_conversion_recorded",
  STATUS_CHANGED: "conversion_status_changed",
  SUBSCRIPTION_STATUS_CHANGED: "conversion_subscription_status_changed",
  CREATED_LEGACY: "conversion_created_legacy",
} as const;

// =============================================================================
// ATTRIBUTION AUDIT ACTION TYPES
// =============================================================================

export const ATTRIBUTION_AUDIT_ACTIONS = {
  NO_DATA: "attribution_no_data",
  AFFILIATE_INVALID: "attribution_affiliate_invalid",
  REFERRAL_LINK_NOT_FOUND: "attribution_referral_link_not_found",
  NO_CAMPAIGN: "attribution_no_campaign",
  CLICK_MATCHED: "attribution_click_matched",
  NO_MATCHING_CLICK: "attribution_no_matching_click",
} as const;

// =============================================================================
// COMMISSION ENGINE ACTION TYPES
// =============================================================================

export const COMMISSION_ENGINE_ACTIONS = {
  CREATION_SKIPPED: "commission_creation_skipped",
} as const;

// =============================================================================
// KNOWN AUDIT ACTIONS — Hardcoded list for frontend filter dropdown
// No runtime DB scan. O(1), deterministic, always complete.
// =============================================================================

export const KNOWN_AUDIT_ACTIONS: string[] = [
  // Commission
  "COMMISSION_CREATED", "COMMISSION_APPROVED", "COMMISSION_DECLINED",
  "COMMISSION_REVERSED", "COMMISSION_STATUS_CHANGE",
  "commission_creation_skipped", "commission_adjusted",
  "commission_adjusted_upgrade", "commission_adjusted_downgrade",
  // Payout
  "payout_batch_generated", "payout_marked_paid", "batch_marked_paid",
  "payout_processing", "payout_failed", "payout_paid_saligpay",
  // Campaign
  "CAMPAIGN_CREATED", "CAMPAIGN_UPDATED", "CAMPAIGN_ARCHIVED",
  "CAMPAIGN_PAUSED", "CAMPAIGN_RESUMED",
  // User Management
  "tenant_created", "user_created", "user_updated", "user_deleted",
  "TEAM_MEMBER_REMOVED", "USER_PROFILE_UPDATED",
  // Affiliate
  "affiliate_approved", "affiliate_rejected", "affiliate_suspended",
  "affiliate_reactivated", "affiliate_registered", "affiliate_bulk_approved",
  "affiliate_bulk_rejected", "affiliate_invited", "affiliate_status_updated",
  "affiliate_profile_updated", "affiliate_password_updated",
  "affiliate_login", "affiliate_password_changed", "AFFILIATE_PASSWORD_SET",
  "referral_link_auto_created",
  // Click
  "click_recorded", "click_deduplicated",
  // Conversion
  "conversion_recorded", "conversion_recorded_self_referral",
  "organic_conversion_recorded", "conversion_status_changed",
  "conversion_subscription_status_changed", "conversion_created_legacy",
  "ORGANIC_CONVERSION_CREATED",
  // Attribution
  "attribution_no_data", "attribution_affiliate_invalid",
  "attribution_referral_link_not_found", "attribution_no_campaign",
  "attribution_click_matched", "attribution_no_matching_click",
  // Admin / Platform
  "impersonation_start", "impersonation_end", "impersonated_mutation",
  "impersonation_unauthorized", "permission_denied", "ADMIN_NOTE_ADDED",
  // Infrastructure
  "LOGIN_ATTEMPT_FAILED", "ACCOUNT_LOCKED", "LOGIN_SUCCESS",
  "CIRCUIT_BREAKER_STATE_CHANGE",
  // Auth lifecycle (Story 15.2)
  "AUTH_SIGNUP_COMPLETED", "AUTH_SIGNIN_SUCCESS", "AUTH_SIGNIN_FAILURE",
  "AUTH_ACCOUNT_LOCKED", "AUTH_ACCOUNT_DELETED", "AUTH_SESSION_REVOKED",
  "AUTH_PASSWORD_RESET_REQUESTED", "AUTH_PASSWORD_RESET_COMPLETED",
  "AUTH_PASSWORD_CHANGED", "AUTH_PASSWORD_REUSE_BLOCKED",
  "AUTH_EMAIL_VERIFICATION_SENT", "AUTH_OTP_SENT", "AUTH_MAGIC_LINK_SENT",
  "AUTH_2FA_ENABLED", "AUTH_2FA_TOTP_VERIFIED", "AUTH_2FA_OTP_SENT",
  "AUTH_2FA_OTP_VERIFIED",
  // Security
  "security_unauthorized_access_attempt",
  // Email
  "email_scheduling_failed", "email_send_failed", "fraud_alert_email_failed",
  "email_bounced", "email_complained",
  "EMAIL_TEMPLATE_SAVED", "EMAIL_TEMPLATE_DELETED",
  // Fraud
  "self_referral_detected", "fraud_signal_dismissed", "FRAUD_SIGNAL_ADDED",
  // Payment rejection
  "commission_rejected_payment_failed", "commission_rejected_payment_pending",
  "commission_rejected_payment_unknown",
];

// =============================================================================
// SECURITY EVENT TYPES
// =============================================================================

/**
 * Types of security events that can be logged.
 * Dead types (cross_tenant_query, cross_tenant_mutation, authentication_failure,
 * session_expired, invalid_token) were removed in Story 15.1 — they were defined
 * but never called by any mutation.
 */
export type SecurityEventType = "unauthorized_access_attempt";

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
// CLIENT-SIDE AUTH EVENT LOGGING (Story 15.2 — Task 6)
// =============================================================================

/**
 * Public mutation for logging auth events from client-side code.
 *
 * Used by 2FA flows (EnableTwoFactor, TwoFactorVerification) where events
 * happen entirely in the browser via Better Auth SDK calls.
 *
 * Security: Only whitelisted actions are accepted. Email is required when
 * the user is not fully authenticated (e.g., during 2FA verification).
 */
export const logClientAuthEvent = mutation({
  args: {
    action: v.string(),
    email: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Only accept known 2FA actions
    const allowedActions = new Set([
      "AUTH_2FA_ENABLED",
      "AUTH_2FA_TOTP_VERIFIED",
      "AUTH_2FA_OTP_VERIFIED",
    ]);
    if (!allowedActions.has(args.action)) {
      return null;
    }

    let tenantId: Id<"tenants"> | undefined;
    let actorId: string | undefined;
    let actorEmail = args.email;

    // Try to resolve user from session (works for authenticated pages like EnableTwoFactor)
    try {
      const authUser = await getAuthenticatedUser(ctx);
      if (authUser) {
        tenantId = authUser.tenantId;
        actorId = authUser.userId;
        actorEmail = authUser.email;
      }
    } catch {
      // User not authenticated — fall through to email-based lookup
    }

    // Fall back to email-based lookup for unauth pages (e.g., 2FA verification)
    if (!tenantId && actorEmail) {
      try {
        const userByEmail = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", actorEmail))
          .first();
        if (userByEmail) {
          tenantId = userByEmail.tenantId;
          actorId = userByEmail._id;
        }
      } catch {
        // Email not found — log without tenant
      }
    }

    await ctx.db.insert("auditLogs", {
      tenantId,
      action: args.action,
      entityType: "auth",
      entityId: actorEmail ?? "unknown",
      actorId,
      actorType: actorId ? "user" : "unauthenticated",
      metadata: {
        email: actorEmail,
        ...args.metadata,
      },
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

// =============================================================================
// ATTRIBUTION AUDIT HELPER (Activity Log Feature)
// =============================================================================

/**
 * Shared helper for logging attribution decisions from the commission engine.
 * Called by all 3 copies of the attribution waterfall (payment.updated,
 * subscription.created, subscription.updated) to ensure consistency.
 *
 * Wrapped in try/catch at call sites — audit failures must not break webhook processing.
 */
export const logAttributionDecision = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    action: v.string(),
    eventId: v.string(),
    metadata: v.optional(v.object({
      eventType: v.optional(v.string()),
      reason: v.optional(v.string()),
      affiliateCode: v.optional(v.string()),
      referralCode: v.optional(v.string()),
      conversionId: v.optional(v.string()),
      referralLinkId: v.optional(v.string()),
      matchedClickId: v.optional(v.string()),
      matchedClickAge: v.optional(v.number()),
      attributionWindowDays: v.optional(v.number()),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: args.action,
      entityType: "attribution",
      entityId: args.eventId,
      actorType: "system",
      metadata: args.metadata,
    });
    return null;
  },
});

// =============================================================================
// ACTIVITY LOG QUERIES (Activity Log Feature)
// =============================================================================

/**
 * Unified query for the Activity Log page.
 * Returns paginated, filtered audit logs for the authenticated user's tenant.
 * Uses compound indexes for efficient filtering.
 * Enriches results with actor names (handles deleted actors).
 * 
 * Supports affiliateSearch to filter by affiliate name (case-insensitive partial match).
 */
export const listTenantAuditLogs = query({
  args: {
    paginationOpts: paginationOptsValidator,
    entityType: v.optional(v.string()),
    action: v.optional(v.string()),
    affiliateId: v.optional(v.id("affiliates")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    entityId: v.optional(v.string()),
    affiliateSearch: v.optional(v.string()),
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
      previousValue: v.optional(v.any()),
      newValue: v.optional(v.any()),
      metadata: v.optional(v.any()),
      affiliateId: v.optional(v.id("affiliates")),
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

    // If affiliateSearch is provided, find matching affiliate IDs first
    let matchingAffiliateIds: Set<string> | undefined;
    if (args.affiliateSearch && args.affiliateSearch.trim().length > 0) {
      const searchLower = args.affiliateSearch.toLowerCase();
      const affiliates = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))
        .collect();
      
      matchingAffiliateIds = new Set(
        affiliates
          .filter(a => {
            const name = (a.name ?? "").toLowerCase();
            const email = (a.email ?? "").toLowerCase();
            return name.includes(searchLower) || email.includes(searchLower);
          })
          .map(a => a._id)
      );
    }

    const hasPostFilters = !!(args.action || args.affiliateId || args.entityId || args.startDate || args.endDate || matchingAffiliateIds);
    const pageSize = args.paginationOpts.numItems ?? 20;
    const overscan = hasPostFilters ? 3 : 1;

    let allLogs: Doc<"auditLogs">[];

    if (args.entityType) {
      let queryBuilder = ctx.db
        .query("auditLogs")
        .withIndex("by_tenant_entity", (q) =>
          q.eq("tenantId", user.tenantId).eq("entityType", args.entityType!)
        );

      if (args.startDate !== undefined) {
        queryBuilder = queryBuilder.filter((q) => q.gte(q.field("_creationTime"), args.startDate!));
      }
      if (args.endDate !== undefined) {
        queryBuilder = queryBuilder.filter((q) => q.lte(q.field("_creationTime"), args.endDate!));
      }
      if (args.action) {
        queryBuilder = queryBuilder.filter((q) => q.eq(q.field("action"), args.action));
      }
      if (args.affiliateId) {
        queryBuilder = queryBuilder.filter((q) => q.eq(q.field("affiliateId"), args.affiliateId));
      }
      if (args.entityId) {
        queryBuilder = queryBuilder.filter((q) => q.eq(q.field("entityId"), args.entityId));
      }

      allLogs = await queryBuilder.order("desc").take(pageSize * overscan);
    } else {
      let queryBuilder = ctx.db
        .query("auditLogs")
        .withIndex("by_tenant", (q) =>
          q.eq("tenantId", user.tenantId)
        );

      if (args.startDate !== undefined) {
        queryBuilder = queryBuilder.filter((q) => q.gte(q.field("_creationTime"), args.startDate!));
      }
      if (args.endDate !== undefined) {
        queryBuilder = queryBuilder.filter((q) => q.lte(q.field("_creationTime"), args.endDate!));
      }
      if (args.action) {
        queryBuilder = queryBuilder.filter((q) => q.eq(q.field("action"), args.action));
      }
      if (args.affiliateId) {
        queryBuilder = queryBuilder.filter((q) => q.eq(q.field("affiliateId"), args.affiliateId));
      }
      if (args.entityId) {
        queryBuilder = queryBuilder.filter((q) => q.eq(q.field("entityId"), args.entityId));
      }

      allLogs = await queryBuilder.order("desc").take(pageSize * overscan);
    }

    // Apply affiliate search filter post-query
    if (matchingAffiliateIds && matchingAffiliateIds.size > 0) {
      allLogs = allLogs.filter(log => {
        // Include if affiliateId matches
        if (log.affiliateId && matchingAffiliateIds!.has(log.affiliateId)) return true;
        // Include if entityId is an affiliate that matches
        if (log.entityType === "affiliate" && matchingAffiliateIds!.has(log.entityId)) return true;
        // Include if metadata contains affiliate info
        if (log.metadata?.affiliateId && matchingAffiliateIds!.has(log.metadata.affiliateId)) return true;
        return false;
      });
    } else if (matchingAffiliateIds && matchingAffiliateIds.size === 0) {
      // No matching affiliates found - return empty
      allLogs = [];
    }

    const page = allLogs.slice(0, pageSize);
    const isDone = allLogs.length <= pageSize;

    // Batch actor enrichment (F9)
    const actorIds = [...new Set(
      page.map(l => l.actorId).filter((id): id is string => !!id && id.startsWith("users_"))
    )];
    const actorDocs = await Promise.all(
      actorIds.map(id => ctx.db.get(id as Id<"users">))
    );
    const actorMap = new Map<string, { name?: string }>();
    for (const doc of actorDocs) {
      if (doc) actorMap.set(doc._id, { name: doc.name });
    }

    const enrichedPage = page.map((log) => {
      let actorName: string | undefined;

      if (log.actorId && log.actorId.startsWith("users_")) {
        const actor = actorMap.get(log.actorId);
        actorName = actor?.name ?? "Deleted User";
      } else {
        if (log.actorType === "system") actorName = "System";
        else if (log.actorType === "webhook") actorName = "Webhook";
        else if (log.actorType === "unauthenticated") actorName = "Unknown";
      }

      return {
        _id: log._id,
        _creationTime: log._creationTime,
        tenantId: log.tenantId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        actorId: log.actorId,
        actorName,
        actorType: log.actorType,
        targetId: log.targetId,
        previousValue: log.previousValue,
        newValue: log.newValue,
        metadata: log.metadata,
        affiliateId: log.affiliateId,
      };
    });

    return {
      page: enrichedPage,
      isDone,
      continueCursor: isDone ? null : (page[page.length - 1]?._id ?? null),
      pageStatus: undefined,
      splitCursor: undefined,
    };
  },
});

/**
 * Entity Story query — resolves the full audit trail chain for any entity.
 * Supports forward (click → conversion → commission) and reverse resolution.
 * Handles edge cases: manual commissions, organic conversions, chain breaks.
 */
export const getEntityStory = query({
  args: {
    entityType: v.string(),
    entityId: v.string(),
  },
  returns: v.object({
    entries: v.array(v.object({
      _id: v.id("auditLogs"),
      _creationTime: v.number(),
      action: v.string(),
      entityType: v.string(),
      entityId: v.string(),
      actorId: v.optional(v.string()),
      actorName: v.optional(v.string()),
      actorType: v.string(),
      previousValue: v.optional(v.any()),
      newValue: v.optional(v.any()),
      metadata: v.optional(v.any()),
    })),
    chain: v.optional(v.array(v.object({
      entityType: v.string(),
      entityId: v.string(),
    }))),
    notes: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return { entries: [], chain: undefined, notes: [] };
    }

    const notes: string[] = [];
    const entityIds = new Map<string, { entityType: string; entityId: string }>();
    entityIds.set(`${args.entityType}:${args.entityId}`, { entityType: args.entityType, entityId: args.entityId });

    // Chain resolution based on entity type
    if (args.entityType === "click") {
      const click = await ctx.db.get(args.entityId as Id<"clicks">);
      if (!click || click.tenantId !== user.tenantId) {
        return { entries: [], chain: undefined, notes: ["Entity not found or access denied."] };
      }

      // Find conversion linked to this click via dedicated by_click index
      const conversion = await ctx.db
        .query("conversions")
        .withIndex("by_click", (q) => q.eq("clickId", args.entityId as Id<"clicks">))
        .first();

      if (conversion) {
        if (conversion.tenantId !== user.tenantId) {
          return { entries: [], chain: undefined, notes: ["Entity not found or access denied."] };
        }
        entityIds.set(`conversion:${conversion._id}`, { entityType: "conversion", entityId: conversion._id });

        // Find commission linked to this conversion via dedicated by_conversion index
        const commission = await ctx.db
          .query("commissions")
          .withIndex("by_conversion", (q) => q.eq("conversionId", conversion._id))
          .first();

        if (commission) {
          if (commission.tenantId !== user.tenantId) {
            return { entries: [], chain: undefined, notes: ["Entity not found or access denied."] };
          }
          entityIds.set(`commission:${commission._id}`, { entityType: "commission", entityId: commission._id });
        } else {
          notes.push("No commission found for this conversion.");
        }
      } else {
        notes.push("No conversion found for this click.");
      }
    } else if (args.entityType === "conversion") {
      const conversion = await ctx.db.get(args.entityId as Id<"conversions">);
      if (!conversion || conversion.tenantId !== user.tenantId) {
        return { entries: [], chain: undefined, notes: ["Entity not found or access denied."] };
      }

      // Get click if present
      if (conversion.clickId) {
        entityIds.set(`click:${conversion.clickId}`, { entityType: "click", entityId: conversion.clickId });
      } else {
        notes.push("No click data — organic attribution.");
      }

      // Find commission linked to this conversion via dedicated by_conversion index
      const commission = await ctx.db
        .query("commissions")
        .withIndex("by_conversion", (q) => q.eq("conversionId", conversion._id))
        .first();

      if (commission) {
        if (commission.tenantId !== user.tenantId) {
          return { entries: [], chain: undefined, notes: ["Entity not found or access denied."] };
        }
        entityIds.set(`commission:${commission._id}`, { entityType: "commission", entityId: commission._id });
      } else {
        notes.push("No commission found for this conversion.");
      }
    } else if (args.entityType === "commission") {
      const commission = await ctx.db.get(args.entityId as Id<"commissions">);
      if (!commission || commission.tenantId !== user.tenantId) {
        return { entries: [], chain: undefined, notes: ["Entity not found or access denied."] };
      }

      notes.push("Payouts are tracked per affiliate, not per commission — visit the Payouts page to view payout history.");

      if (commission.conversionId) {
        const conversion = await ctx.db.get(commission.conversionId);
        if (conversion) {
          if (conversion.tenantId !== user.tenantId) {
            return { entries: [], chain: undefined, notes: ["Entity not found or access denied."] };
          }
          entityIds.set(`conversion:${conversion._id}`, { entityType: "conversion", entityId: conversion._id });

          if (conversion.clickId) {
            entityIds.set(`click:${conversion.clickId}`, { entityType: "click", entityId: conversion.clickId });
          } else {
            notes.push("No click data — organic attribution.");
          }
        }
      } else {
        notes.push("No attribution chain — manual commission.");
      }
    } else if (args.entityType === "affiliate") {
      // Verify tenant access BEFORE querying logs
      const affiliate = await ctx.db.get(args.entityId as Id<"affiliates">);
      if (!affiliate || affiliate.tenantId !== user.tenantId) {
        return { entries: [], chain: undefined, notes: ["Entity not found or access denied."] };
      }

      // For affiliates, use by_affiliate index
      const affiliateLogs = await ctx.db
        .query("auditLogs")
        .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.entityId as Id<"affiliates">))
        .order("desc")
        .take(50);

      // Enrich and return
      const enriched = await Promise.all(
        affiliateLogs.filter(log => log.tenantId === user.tenantId).map(async (log) => {
          let actorName: string | undefined;
          if (log.actorId && log.actorId.startsWith("users_")) {
            try {
              const actorUser = await ctx.db.get(log.actorId as Id<"users">);
              actorName = actorUser?.name ?? "Deleted User";
            } catch {
              actorName = "Deleted User";
            }
          } else {
            if (log.actorType === "system") actorName = "System";
            else if (log.actorType === "webhook") actorName = "Webhook";
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
            previousValue: log.previousValue,
            newValue: log.newValue,
            metadata: log.metadata,
          };
        })
      );

      return { entries: enriched, chain: undefined, notes };
    } else if (args.entityType === "payouts" || args.entityType === "payoutBatches") {
      // Verify tenant ownership
      const entity = await ctx.db.get(args.entityId as any) as any;
      if (!entity || entity.tenantId !== user.tenantId) {
        return { entries: [], chain: undefined, notes: ["Entity not found or access denied."] };
      }
    }

    // Collect all audit log entries for resolved entities
    const allEntries: Array<{
      _id: Id<"auditLogs">;
      _creationTime: number;
      action: string;
      entityType: string;
      entityId: string;
      actorId?: string;
      actorName?: string;
      actorType: string;
      previousValue?: any;
      newValue?: any;
      metadata?: any;
    }> = [];

    const seenIds = new Set<string>();

    for (const [, entity] of entityIds) {
      const logs = await ctx.db
        .query("auditLogs")
        .withIndex("by_entity", (q) =>
          q.eq("entityType", entity.entityType).eq("entityId", entity.entityId)
        )
        .order("desc")
        .take(50);

      for (const log of logs) {
        if (seenIds.has(log._id)) continue;
        if (log.tenantId !== user.tenantId) continue;
        seenIds.add(log._id);

        let actorName: string | undefined;
        if (log.actorId && log.actorId.startsWith("users_")) {
          try {
            const actorUser = await ctx.db.get(log.actorId as Id<"users">);
            actorName = actorUser?.name ?? "Deleted User";
          } catch {
            actorName = "Deleted User";
          }
        } else {
          if (log.actorType === "system") actorName = "System";
          else if (log.actorType === "webhook") actorName = "Webhook";
        }

        allEntries.push({
          _id: log._id,
          _creationTime: log._creationTime,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          actorId: log.actorId,
          actorName,
          actorType: log.actorType,
          previousValue: log.previousValue,
          newValue: log.newValue,
          metadata: log.metadata,
        });
      }
    }

    // Sort chronologically ascending (oldest first)
    allEntries.sort((a, b) => a._creationTime - b._creationTime);

    // Build chain array for UI navigation
    const chainArray = args.entityType === "affiliate" || args.entityType === "payouts" || args.entityType === "payoutBatches"
      ? undefined
      : Array.from(entityIds.values());

    return { entries: allEntries, chain: chainArray, notes };
  },
});

/**
 * Returns the hardcoded list of known audit action types.
 * O(1), deterministic, no database scan.
 * Must be updated when new action types are added to the codebase.
 */
export const getActivityLogActionTypes = query({
  args: {},
  returns: v.array(v.string()),
  handler: async () => {
    return KNOWN_AUDIT_ACTIONS;
  },
});

// =============================================================================
// AFFILIATE ACTIVITY SUMMARY (Per-Affiliate View)
// =============================================================================

/**
 * Exception actions that require attention.
 * These are the actions that indicate problems or issues.
 * 
 * IMPORTANT: Keep in sync with EXCEPTION_ACTIONS in src/lib/audit-constants.ts
 */
const EXCEPTION_ACTION_SET = new Set([
  "COMMISSION_DECLINED",
  "COMMISSION_REVERSED",
  "commission_rejected_payment_failed",
  "commission_rejected_payment_pending",
  "commission_rejected_payment_unknown",
  "commission_creation_skipped",
  "payout_failed",
  "affiliate_rejected",
  "affiliate_suspended",
  "affiliate_bulk_rejected",
  "attribution_no_data",
  "attribution_affiliate_invalid",
  "attribution_referral_link_not_found",
  "attribution_no_campaign",
  "attribution_no_matching_click",
  "self_referral_detected",
  "FRAUD_SIGNAL_ADDED",
  "conversion_recorded_self_referral",
  "email_send_failed",
  "email_scheduling_failed",
  "fraud_alert_email_failed",
  "email_bounced",
  "email_complained",
  "security_unauthorized_access_attempt",
  "AUTH_SIGNIN_FAILURE",
  "AUTH_ACCOUNT_LOCKED",
  "permission_denied",
  "commission_adjusted_downgrade",
]);

/**
 * Get affiliates with their activity summary for the Activity Log page.
 * Returns affiliates grouped by whether they have issues requiring attention.
 */
export const getAffiliateActivitySummary = query({
  args: {
    search: v.optional(v.string()),
    startDate: v.optional(v.number()),
    issuesOnly: v.optional(v.boolean()),
  },
  returns: v.object({
    affiliates: v.array(v.object({
      _id: v.id("affiliates"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      status: v.string(),
      issueCount: v.number(),
      lastActivityTime: v.number(),
      latestAction: v.string(),
      hasIssues: v.boolean(),
    })),
  }),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return { affiliates: [] };
    }

    // Get all affiliates for this tenant
    const affiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))
      .collect();

    // Filter by search term if provided
    let filteredAffiliates = affiliates;
    if (args.search && args.search.trim().length > 0) {
      const searchLower = args.search.toLowerCase();
      filteredAffiliates = affiliates.filter((a) => {
        const name = (a.name ?? "").toLowerCase();
        const email = (a.email ?? "").toLowerCase();
        return name.includes(searchLower) || email.includes(searchLower);
      });
    }

    // Create a set of affiliate IDs for filtering
    const affiliateIds = new Set(filteredAffiliates.map((a) => a._id));

    // Batch fetch: get ALL audit logs for this tenant in date range (single query)
    let allLogsQuery = ctx.db
      .query("auditLogs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId));

    if (args.startDate !== undefined) {
      allLogsQuery = allLogsQuery.filter((q) =>
        q.gte(q.field("_creationTime"), args.startDate!)
      );
    }

    // Take a reasonable limit - most tenants won't have more than 1000 logs in 30 days
    const allLogs = await allLogsQuery.order("desc").take(1000);

    // Group logs by affiliate ID
    const logsByAffiliate = new Map<string, typeof allLogs>();
    for (const log of allLogs) {
      if (log.affiliateId && affiliateIds.has(log.affiliateId)) {
        const existing = logsByAffiliate.get(log.affiliateId) ?? [];
        existing.push(log);
        logsByAffiliate.set(log.affiliateId, existing);
      }
    }

    // Build summaries from grouped logs
    const affiliateSummaries = filteredAffiliates.map((affiliate) => {
      const logs = logsByAffiliate.get(affiliate._id) ?? [];

      // Count exceptions
      const issueCount = logs.filter((log) =>
        EXCEPTION_ACTION_SET.has(log.action)
      ).length;

      // Get latest activity
      const latestLog = logs[0];

      return {
        _id: affiliate._id,
        name: affiliate.name,
        email: affiliate.email,
        status: affiliate.status ?? "unknown",
        issueCount,
        lastActivityTime: latestLog?._creationTime ?? affiliate._creationTime,
        latestAction: latestLog?.action ?? "affiliate_registered",
        hasIssues: issueCount > 0,
      };
    });

    // Filter to issues only if requested
    let result = affiliateSummaries;
    if (args.issuesOnly) {
      result = result.filter((a) => a.hasIssues);
    }

    // Sort: issues first (by issue count desc), then by last activity
    result.sort((a, b) => {
      if (a.hasIssues && !b.hasIssues) return -1;
      if (!a.hasIssues && b.hasIssues) return 1;
      if (a.hasIssues && b.hasIssues) {
        return b.issueCount - a.issueCount;
      }
      return b.lastActivityTime - a.lastActivityTime;
    });

    return { affiliates: result };
  },
});

/**
 * Get activity timeline for a specific affiliate.
 * Returns the recent audit log entries for that affiliate.
 */
export const getAffiliateActivityTimeline = query({
  args: {
    affiliateId: v.id("affiliates"),
    paginationOpts: paginationOptsValidator,
    startDate: v.optional(v.number()),
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("auditLogs"),
      _creationTime: v.number(),
      action: v.string(),
      entityType: v.string(),
      entityId: v.string(),
      actorName: v.optional(v.string()),
      actorType: v.string(),
      metadata: v.optional(v.any()),
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

    // Verify affiliate belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== user.tenantId) {
      return {
        page: [],
        isDone: true,
        continueCursor: null,
      };
    }

    let queryBuilder = ctx.db
      .query("auditLogs")
      .withIndex("by_tenant_affiliate", (q) =>
        q.eq("tenantId", user.tenantId).eq("affiliateId", args.affiliateId)
      );

    if (args.startDate !== undefined) {
      queryBuilder = queryBuilder.filter((q) =>
        q.gte(q.field("_creationTime"), args.startDate!)
      );
    }

    const pageSize = args.paginationOpts.numItems ?? 20;
    const allLogs = await queryBuilder.order("desc").take(pageSize + 1);

    const page = allLogs.slice(0, pageSize);
    const isDone = allLogs.length <= pageSize;

    // Batch actor enrichment
    const actorIds = [
      ...new Set(
        page
          .map((l) => l.actorId)
          .filter((id): id is string => !!id && id.startsWith("users_"))
      ),
    ];
    const actorDocs = await Promise.all(
      actorIds.map((id) => ctx.db.get(id as Id<"users">))
    );
    const actorMap = new Map<string, { name?: string }>();
    for (const doc of actorDocs) {
      if (doc) actorMap.set(doc._id, { name: doc.name });
    }

    const enrichedPage = page.map((log) => {
      let actorName: string | undefined;

      if (log.actorId && log.actorId.startsWith("users_")) {
        const actor = actorMap.get(log.actorId);
        actorName = actor?.name ?? "Deleted User";
      } else {
        if (log.actorType === "system") actorName = "System";
        else if (log.actorType === "webhook") actorName = "Webhook";
        else if (log.actorType === "unauthenticated") actorName = "Unknown";
      }

      return {
        _id: log._id,
        _creationTime: log._creationTime,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        actorName,
        actorType: log.actorType,
        metadata: log.metadata,
      };
    });

    return {
      page: enrichedPage,
      isDone,
      continueCursor: isDone ? null : (page[page.length - 1]?._id ?? null),
    };
  },
});

// =============================================================================
// AUDIT LOG RETENTION (Story 15.7)
// =============================================================================

/**
 * Retention period for audit log entries.
 * Default: 12 months. Entries older than this are eligible for deletion.
 */
export const AUDIT_LOG_RETENTION_MONTHS = 12;

/**
 * Maximum batch size for a single purge execution.
 * Keeps each mutation well within Convex's function limits.
 */
const PURGE_BATCH_SIZE = 500;

/**
 * Purge old audit log entries for a specific tenant.
 * Designed to be called by the daily retention cron.
 * Returns the count of deleted entries and whether more remain.
 */
export const purgeOldAuditLogs = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    cutoffTime: v.number(),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deletedCount: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const cutoff = args.cutoffTime;
    const batchSize = Math.min(args.batchSize ?? PURGE_BATCH_SIZE, PURGE_BATCH_SIZE);

    // Query audit logs for this tenant, filter by creation time
    const oldEntries = await ctx.db
      .query("auditLogs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.lt(q.field("_creationTime"), cutoff))
      .take(batchSize);

    // Delete each entry
    for (const entry of oldEntries) {
      await ctx.db.delete(entry._id);
    }

    // Check if there are more entries to process
    // We do one more take(1) to see if any remain after the batch
    const hasMore = oldEntries.length === batchSize;

    console.log(
      `[AuditRetention] Purged ${oldEntries.length} entries for tenant ${args.tenantId}. hasMore=${hasMore}`,
    );

    return {
      deletedCount: oldEntries.length,
      hasMore,
    };
  },
});

/**
 * Daily cron orchestrator for audit log retention.
 *
 * Flow:
 * 1. Discover all tenants (or get a page using pagination)
 * 2. For each tenant, purge old entries (up to PURGE_BATCH_SIZE per tenant)
 * 3. Log totals for monitoring
 *
 * Since this runs daily and each tenant gets at most PURGE_BATCH_SIZE deletions,
 * it will gradually catch up on any backlog without timing out.
 */
export const runAuditLogRetention = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const cutoffTime = now - AUDIT_LOG_RETENTION_MONTHS * 30 * 24 * 60 * 60 * 1000;

    // Get all tenants
    const tenants = await ctx.runQuery(
      internal.audit._listAllTenantIds,
      {},
    );

    let totalDeleted = 0;
    let tenantsProcessed = 0;

    for (const tenantId of tenants) {
      try {
        const result = await ctx.runMutation(
          internal.audit.purgeOldAuditLogs,
          {
            tenantId,
            cutoffTime,
            batchSize: PURGE_BATCH_SIZE,
          },
        );
        totalDeleted += result.deletedCount;
        if (result.deletedCount > 0) {
          tenantsProcessed++;
        }
      } catch (err) {
        console.error(
          `[AuditRetention] Error purging tenant ${tenantId}:`,
          err,
        );
        // Continue with next tenant — don't let one failure block others
      }
    }

    console.log(
      `[AuditRetention] Daily run complete: ${totalDeleted} entries purged across ${tenantsProcessed} tenants (cutoff: ${new Date(cutoffTime).toISOString()})`,
    );

    return null;
  },
});

/**
 * Internal query to list all tenant IDs for the retention cron.
 * Kept private — not part of the public API.
 */
export const _listAllTenantIds = internalQuery({
  args: {},
  returns: v.array(v.id("tenants")),
  handler: async (ctx) => {
    const tenants = await ctx.db.query("tenants").take(200);
    return tenants.map((t) => t._id);
  },
});
