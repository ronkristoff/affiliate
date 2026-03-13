/**
 * Security Audit Logging Module
 * 
 * Provides security event logging for unauthorized access attempts and
 * other security-relevant events.
 * 
 * @see Story 1.5: Multi-Tenant Data Isolation (AC3)
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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
