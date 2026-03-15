import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getTenantId, requireTenantId, getAuthenticatedUser } from "./tenantContext";
import { hasPermission } from "./permissions";
import type { Role } from "./permissions";
import { api } from "./_generated/api";

type FraudSignalSeverity = "low" | "medium" | "high";
type FraudSignalType = "selfReferral" | "botTraffic" | "ipAnomaly" | "manual_suspension";
type ReviewedStatus = "all" | "reviewed" | "unreviewed";
type SortBy = "newest" | "oldest" | "severity";

/**
 * Fraud Signals Query Functions
 * 
 * Provides fraud signal data for affiliate risk assessment.
 * Used by Story 5.5 (Affiliate Profile and Activity View), Story 5.6 (Self-Referral Detection),
 * and Story 5.7 (Fraud Signals Dashboard).
 */

/**
 * Filter and sort options for fraud signals query
 */
const filterValidator = v.optional(v.object({
  signalType: v.optional(v.union(
    v.literal("all"),
    v.literal("selfReferral"),
    v.literal("botTraffic"),
    v.literal("ipAnomaly"),
    v.literal("manual_suspension")
  )),
  severity: v.optional(v.union(
    v.literal("all"),
    v.literal("low"),
    v.literal("medium"),
    v.literal("high")
  )),
  reviewedStatus: v.optional(v.union(
    v.literal("all"),
    v.literal("reviewed"),
    v.literal("unreviewed")
  )),
  sortBy: v.optional(v.union(
    v.literal("newest"),
    v.literal("oldest"),
    v.literal("severity")
  )),
}));

// Type for fraud signal from database
interface FraudSignal {
  type: string;
  severity: string;
  timestamp: number;
  details?: string;
  reviewedAt?: number;
  reviewedBy?: string;
  reviewNote?: string;
}

/**
 * Get fraud signals for a specific affiliate with optional filtering and sorting.
 * Returns array of fraud signals ordered by the specified sort criteria.
 * @security Requires authentication. Validates tenant ownership and permissions.
 */
export const getAffiliateFraudSignals = query({
  args: {
    affiliateId: v.id("affiliates"),
    filters: filterValidator,
  },
  returns: v.array(
    v.object({
      type: v.string(),
      severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
      timestamp: v.number(),
      details: v.optional(v.string()),
      reviewedAt: v.optional(v.number()),
      reviewedBy: v.optional(v.string()),
      reviewedByName: v.optional(v.string()),
      reviewNote: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      return [];
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:view permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:view") && 
        !hasPermission(role, "affiliates:manage") && 
        !hasPermission(role, "view:*") &&
        !hasPermission(role, "manage:*")) {
      return [];
    }

    // Verify affiliate exists and belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      return [];
    }

    // Get fraud signals from affiliate record
    let fraudSignals: FraudSignal[] = affiliate.fraudSignals || [];

    // Apply filters
    if (args.filters) {
      // Filter by signal type
      if (args.filters.signalType && args.filters.signalType !== "all") {
        fraudSignals = fraudSignals.filter((s: FraudSignal) => s.type === args.filters!.signalType);
      }

      // Filter by severity
      if (args.filters.severity && args.filters.severity !== "all") {
        fraudSignals = fraudSignals.filter((s: FraudSignal) => s.severity === args.filters!.severity);
      }

      // Filter by reviewed status
      if (args.filters.reviewedStatus) {
        if (args.filters.reviewedStatus === "reviewed") {
          fraudSignals = fraudSignals.filter((s: FraudSignal) => s.reviewedAt !== undefined);
        } else if (args.filters.reviewedStatus === "unreviewed") {
          fraudSignals = fraudSignals.filter((s: FraudSignal) => s.reviewedAt === undefined);
        }
      }
    }

    // Sort signals
    const sortBy = args.filters?.sortBy || "newest";
    if (sortBy === "newest") {
      fraudSignals.sort((a: FraudSignal, b: FraudSignal) => b.timestamp - a.timestamp);
    } else if (sortBy === "oldest") {
      fraudSignals.sort((a: FraudSignal, b: FraudSignal) => a.timestamp - b.timestamp);
    } else if (sortBy === "severity") {
      const severityOrder = { "high": 3, "medium": 2, "low": 1 };
      fraudSignals.sort((a: FraudSignal, b: FraudSignal) => severityOrder[b.severity as FraudSignalSeverity] - severityOrder[a.severity as FraudSignalSeverity]);
    }

    // Collect unique reviewer IDs to batch-fetch user names
    const reviewerIds = [...new Set(
      fraudSignals
        .filter((s: FraudSignal) => s.reviewedBy)
        .map((s: FraudSignal) => s.reviewedBy as string)
    )];

    // Batch fetch reviewer users
    const reviewerMap: Record<string, string> = {};
    for (const reviewerId of reviewerIds) {
      try {
        // reviewerId is stored as the authId from the users table
        const usersWithAuthId = await ctx.db
          .query("users")
          .withIndex("by_auth_id", (q) => q.eq("authId", reviewerId))
          .first();
        if (usersWithAuthId) {
          reviewerMap[reviewerId] = usersWithAuthId.name || usersWithAuthId.email;
        }
      } catch {
        // If lookup fails, just use the ID
        reviewerMap[reviewerId] = reviewerId;
      }
    }

    // Map signals with resolved reviewer names
    return fraudSignals.map((signal: FraudSignal) => ({
      type: signal.type,
      severity: signal.severity as FraudSignalSeverity,
      timestamp: signal.timestamp,
      details: signal.details,
      reviewedAt: signal.reviewedAt,
      reviewedBy: signal.reviewedBy,
      reviewedByName: signal.reviewedBy ? reviewerMap[signal.reviewedBy] : undefined,
      reviewNote: signal.reviewNote,
    }));
  },
});

/**
 * Dismiss a fraud signal by marking it as reviewed.
 * Adds review timestamp, reviewer ID, and optional note.
 * @security Requires authentication. Requires 'affiliates:manage' permission.
 * @security Validates tenant ownership of the fraud signal.
 */
export const dismissFraudSignal = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    signalIndex: v.number(), // Index in the fraudSignals array
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && !hasPermission(role, "manage:*")) {
      // Log unauthorized access attempt
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "fraud_signal",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=dismissFraudSignal, signalIndex=${args.signalIndex}`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to dismiss fraud signals");
    }

    // Verify affiliate exists and belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Get current fraud signals
    const fraudSignals: FraudSignal[] = affiliate.fraudSignals || [];

    // Validate signal index
    if (args.signalIndex < 0 || args.signalIndex >= fraudSignals.length) {
      throw new Error("Fraud signal not found");
    }

    const signal = fraudSignals[args.signalIndex];

    // Check if already reviewed
    if (signal.reviewedAt) {
      throw new Error("Fraud signal has already been reviewed");
    }

    // Note is required for high severity signals
    if (signal.severity === "high" && (!args.note || args.note.trim().length === 0)) {
      throw new Error("A dismissal note is required for high-severity fraud signals");
    }

    // Validate note length
    if (args.note && args.note.length > 500) {
      throw new Error("Dismissal note must be 500 characters or less");
    }

    // Update the signal with review information
    const updatedSignals = [...fraudSignals];
    updatedSignals[args.signalIndex] = {
      ...signal,
      reviewedAt: Date.now(),
      reviewedBy: authUser.userId,
      reviewNote: args.note,
    };

    // Update affiliate record
    await ctx.db.patch(args.affiliateId, { fraudSignals: updatedSignals });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "fraud_signal_dismissed",
      entityType: "fraud_signal",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { 
        signal: signal,
        status: "unreviewed" 
      },
      newValue: { 
        signal: { ...signal, reviewedAt: Date.now(), reviewedBy: authUser.userId, reviewNote: args.note },
        status: "reviewed",
        note: args.note,
      },
      metadata: {
        securityEvent: true,
        additionalInfo: `signalIndex=${args.signalIndex}, affiliateId=${args.affiliateId}`,
      },
    });

    return null;
  },
});

/**
 * Suspend an affiliate from a fraud signal view.
 * Wrapper around suspendAffiliate that adds fraud signal context to audit log.
 * @security Requires authentication. Requires 'affiliates:manage' permission.
 * @security Validates tenant ownership.
 */
export const suspendAffiliateFromFraudSignal = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    signalIndex: v.optional(v.number()), // Optional: specific fraud signal that triggered suspension
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=suspendAffiliateFromFraudSignal`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to suspend affiliates");
    }

    // Verify affiliate exists and belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate affiliate is in "active" status
    if (affiliate.status !== "active") {
      throw new Error(`Cannot suspend affiliate with status "${affiliate.status}". Only active affiliates can be suspended.`);
    }

    // Get fraud signal details if provided
    let fraudSignalDetails: FraudSignal | null = null;
    if (args.signalIndex !== undefined) {
      const fraudSignals: FraudSignal[] = affiliate.fraudSignals || [];
      if (args.signalIndex >= 0 && args.signalIndex < fraudSignals.length) {
        fraudSignalDetails = fraudSignals[args.signalIndex];
      }
    }

    // Call the main suspendAffiliate mutation
    await ctx.runMutation(api.affiliates.suspendAffiliate, {
      affiliateId: args.affiliateId,
      reason: args.reason,
    });

    // Create additional audit log entry with fraud signal context
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_suspended_from_fraud_signal",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { status: "active" },
      newValue: { 
        status: "suspended", 
        reason: args.reason,
        triggeredByFraudSignal: fraudSignalDetails ? true : false,
        fraudSignalType: fraudSignalDetails?.type,
        fraudSignalSeverity: fraudSignalDetails?.severity,
      },
      metadata: {
        securityEvent: true,
        additionalInfo: `signalIndex=${args.signalIndex || 'none'}, affiliateId=${args.affiliateId}`,
      },
    });

    return null;
  },
});

/**
 * Get fraud signal statistics for an affiliate.
 * Returns counts by severity and review status.
 * @security Requires authentication. Validates tenant ownership.
 */
export const getFraudSignalStats = query({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.object({
    total: v.number(),
    high: v.number(),
    medium: v.number(),
    low: v.number(),
    reviewed: v.number(),
    unreviewed: v.number(),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      return { total: 0, high: 0, medium: 0, low: 0, reviewed: 0, unreviewed: 0 };
    }

    const tenantId = authUser.tenantId;

    // Check permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:view") && 
        !hasPermission(role, "affiliates:manage") && 
        !hasPermission(role, "view:*") &&
        !hasPermission(role, "manage:*")) {
      return { total: 0, high: 0, medium: 0, low: 0, reviewed: 0, unreviewed: 0 };
    }

    // Verify affiliate exists and belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      return { total: 0, high: 0, medium: 0, low: 0, reviewed: 0, unreviewed: 0 };
    }

    const fraudSignals: FraudSignal[] = affiliate.fraudSignals || [];

    return {
      total: fraudSignals.length,
      high: fraudSignals.filter((s: FraudSignal) => s.severity === "high").length,
      medium: fraudSignals.filter((s: FraudSignal) => s.severity === "medium").length,
      low: fraudSignals.filter((s: FraudSignal) => s.severity === "low").length,
      reviewed: fraudSignals.filter((s: FraudSignal) => s.reviewedAt !== undefined).length,
      unreviewed: fraudSignals.filter((s: FraudSignal) => s.reviewedAt === undefined).length,
    };
  },
});

/**
 * Internal mutation to mark a fraud signal as reviewed.
 * Used by system processes when automatic actions are taken.
 */
export const markFraudSignalReviewed = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    signalIndex: v.number(),
    reviewedBy: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      return null;
    }

    const fraudSignals: FraudSignal[] = affiliate.fraudSignals || [];

    if (args.signalIndex < 0 || args.signalIndex >= fraudSignals.length) {
      return null;
    }

    const updatedSignals = [...fraudSignals];
    updatedSignals[args.signalIndex] = {
      ...updatedSignals[args.signalIndex],
      reviewedAt: Date.now(),
      reviewedBy: args.reviewedBy || "system",
      reviewNote: args.reviewNote,
    };

    await ctx.db.patch(args.affiliateId, { fraudSignals: updatedSignals });

    return null;
  },
});
