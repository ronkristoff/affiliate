import { query, internalQuery, action } from "./_generated/server";
import { mutation, internalMutation } from "./triggers";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { getAuthenticatedUser, getTenantId, getAffiliateTenantId, requireWriteAccess } from "./tenantContext";
import { api, internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";
import { betterAuthComponent } from "./auth";
import { adjustPendingPayoutTotals } from "./tenantStats";
import { commissionArrayValidator, commissionValidator, commissionEnrichedArrayValidator } from "./lib/validators";


/**
 * Commission Management Functions
 * 
 * Provides commission creation with campaign status validation.
 * Blocked by Story 4.5: Campaigns that are paused or archived cannot earn commissions.
 * Supports per-affiliate commission rate overrides (Story 4.7).
 */

/**
 * Helper function to get the effective commission rate for an affiliate-campaign combination.
 * Checks for affiliate-specific override and returns it if active, otherwise returns campaign default.
 */
async function getEffectiveCommissionRate(
  ctx: any,
  affiliateId: Id<"affiliates">,
  campaignId: Id<"campaigns">
): Promise<number> {
  const affiliate = await ctx.db.get(affiliateId);
  const campaign = await ctx.db.get(campaignId);

  if (!affiliate || !campaign) {
    throw new Error("Affiliate or campaign not found");
  }

  // Check for affiliate-specific override for this campaign
  const override = affiliate.commissionOverrides?.find(
    (o: { campaignId: Id<"campaigns">; status?: string }) =>
      o.campaignId === campaignId && o.status === "active"
  );

  // Use override rate if exists, otherwise campaign default
  return override?.rate ?? campaign.commissionRate;
}

/**
 * Create a commission for an affiliate.
 * Validates campaign status before creating - blocked if paused or archived.
 * Calculates commission amount using effective rate (campaign default or affiliate override).
 */
export const createCommission = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    campaignId: v.id("campaigns"),
    conversionId: v.optional(v.id("conversions")),
    saleAmount: v.number(), // The sale/transaction amount (commission is calculated from this)
    eventMetadata: v.optional(v.object({
      source: v.string(),
      transactionId: v.optional(v.string()),
      timestamp: v.number(),
    })),
  },
  returns: v.id("commissions"),
  handler: async (ctx, args) => {
    // Get authenticated user
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    await requireWriteAccess(ctx);

    const tenantId = user.tenantId;

    // Validate affiliate belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate campaign belongs to tenant and check status
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign || campaign.tenantId !== tenantId) {
      throw new Error("Campaign not found or access denied");
    }

    // CRITICAL: Check campaign status - Story 4.5 AC #2
    // Paused campaigns cannot earn new commissions
    if (campaign.status === "paused") {
      throw new Error("Cannot create commissions for paused campaigns");
    }

    // Archived campaigns cannot earn commissions
    if (campaign.status === "archived") {
      throw new Error("Cannot create commissions for archived campaigns");
    }

    // Only active campaigns can earn commissions
    if (campaign.status !== "active") {
      throw new Error(`Cannot create commissions for campaigns with status: ${campaign.status}`);
    }

    // Validate sale amount
    if (args.saleAmount < 0) {
      throw new Error("Sale amount must be 0 or greater");
    }

    // Validate conversion if provided
    if (args.conversionId) {
      const conversion = await ctx.db.get(args.conversionId);
      if (!conversion || conversion.tenantId !== tenantId) {
        throw new Error("Conversion not found or access denied");
      }
    }

    // Story 4.7: Get effective commission rate (applies affiliate override if exists)
    const effectiveRate = await getEffectiveCommissionRate(ctx, args.affiliateId, args.campaignId);

    // Calculate commission amount based on campaign type
    let commissionAmount: number;
    if (campaign.commissionType === "percentage") {
      commissionAmount = args.saleAmount * (effectiveRate / 100);
    } else {
      // flatFee - the rate IS the commission amount (regardless of sale amount)
      commissionAmount = effectiveRate;
    }

    // Determine commission status based on campaign approval threshold (Story 4.6 AC #1, #2, #3, #5)
    let commissionStatus: "pending" | "approved" = "pending";
    if (campaign.autoApproveCommissions) {
      const threshold = campaign.approvalThreshold;
      // AC #2: If autoApproveCommissions=true but NO threshold set, auto-approve ALL
      if (threshold === null || threshold === undefined) {
        commissionStatus = "approved";
      } else {
        // AC #1: Commissions below threshold are auto-approved
        // AC #1: Commissions at or above threshold require manual review
        if (commissionAmount < threshold) {
          commissionStatus = "approved";
        }
      }
    }
    // AC #3: If autoApproveCommissions is false/null, all commissions are pending

    // Create the commission with calculated amount
    const commissionId = await ctx.db.insert("commissions", {
      tenantId,
      affiliateId: args.affiliateId,
      campaignId: args.campaignId,
      conversionId: args.conversionId,
      amount: commissionAmount,
      status: commissionStatus,
      eventMetadata: args.eventMetadata,
    });

    if (commissionStatus === "approved") {
      await adjustPendingPayoutTotals(ctx, tenantId, 1, commissionAmount);
    }

    return commissionId;
  },
});

/**
 * Internal mutation to create commission from conversion (used by webhook handler).
 * Checks campaign status, applies approval threshold, and uses effective commission rate.
 * Includes self-referral detection (Story 5.6).
 */
export const createCommissionFromConversionInternal = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    campaignId: v.id("campaigns"),
    conversionId: v.id("conversions"),
    saleAmount: v.number(), // The sale/transaction amount (commission is calculated from this)
    eventMetadata: v.optional(v.object({
      source: v.string(),
      transactionId: v.optional(v.string()),
      timestamp: v.number(),
      subscriptionId: v.optional(v.string()),
    })),
  },
  returns: v.union(v.id("commissions"), v.null()),
  handler: async (ctx, args) => {
    // Check campaign status using the internal query
    const campaignStatus = await ctx.runQuery(internal.campaigns.canCampaignEarnCommissions, {
      campaignId: args.campaignId,
    });

    // Block commission creation if campaign cannot earn
    if (!campaignStatus.canEarn) {
      console.log(`Commission blocked: ${campaignStatus.reason}`);
      // Audit: log commission creation skipped (non-fatal)
      try {
        await ctx.runMutation(internal.audit.logAuditEventInternal, {
          tenantId: args.tenantId,
          action: "commission_creation_skipped",
          entityType: "commission",
          entityId: args.conversionId,
          actorType: "system",
          metadata: {
            reason: "campaign_cannot_earn",
            campaignId: args.campaignId,
            affiliateId: args.affiliateId,
            conversionId: args.conversionId,
            detail: campaignStatus.reason,
          },
        });
      } catch (err) {
        console.error("[Audit] Failed to log commission_creation_skipped (non-fatal):", err);
      }
      return null; // Return null to indicate commission was not created
    }

    // Get campaign for threshold check (Story 4.6)
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) {
      console.log("Commission blocked: Campaign not found");
      try {
        await ctx.runMutation(internal.audit.logAuditEventInternal, {
          tenantId: args.tenantId,
          action: "commission_creation_skipped",
          entityType: "commission",
          entityId: args.conversionId,
          actorType: "system",
          metadata: {
            reason: "campaign_not_found",
            campaignId: args.campaignId,
            affiliateId: args.affiliateId,
            conversionId: args.conversionId,
          },
        });
      } catch (err) {
        console.error("[Audit] Failed to log commission_creation_skipped (non-fatal):", err);
      }
      return null;
    }

    // Story 4.7: Get affiliate to check for commission override
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      console.log("Commission blocked: Affiliate not found");
      try {
        await ctx.runMutation(internal.audit.logAuditEventInternal, {
          tenantId: args.tenantId,
          action: "commission_creation_skipped",
          entityType: "commission",
          entityId: args.conversionId,
          actorType: "system",
          metadata: {
            reason: "affiliate_not_found",
            campaignId: args.campaignId,
            affiliateId: args.affiliateId,
            conversionId: args.conversionId,
          },
        });
      } catch (err) {
        console.error("[Audit] Failed to log commission_creation_skipped (non-fatal):", err);
      }
      return null;
    }

    // Story 5.6: Self-referral detection
    let isSelfReferral = false;
    let matchedIndicators: string[] = [];
    let totalScore = 0;
    
    // Check if conversion has fraud detection data (ipAddress, deviceFingerprint, etc.)
    const conversion = await ctx.db.get(args.conversionId);
    if (conversion) {
      // Only run detection if conversion has tracking data
      if (conversion.ipAddress || conversion.deviceFingerprint || conversion.customerEmail) {
        // Run self-referral detection
        const detectionResult: { isSelfReferral: boolean; matchedIndicators: string[]; totalScore: number } = await ctx.runQuery(
          internal.fraudDetection.detectSelfReferral as any,
          {
            tenantId: args.tenantId,
            conversionId: args.conversionId,
            affiliateId: args.affiliateId,
          }
        );
        
        isSelfReferral = detectionResult.isSelfReferral;
        matchedIndicators = detectionResult.matchedIndicators;
        totalScore = detectionResult.totalScore;
        
        if (isSelfReferral) {
          console.log(`Self-referral detected! Indicators: ${matchedIndicators.join(", ")}`);
          // Fraud signal and audit log will be created AFTER commission creation when we have commissionId
        }
      }
    }

    // Story 4.7: Get effective commission rate (applies affiliate override if exists)
    const effectiveRate = affiliate.commissionOverrides?.find(
      (o: { campaignId: Id<"campaigns">; status?: string }) =>
        o.campaignId === args.campaignId && o.status === "active"
    )?.rate ?? campaign.commissionValue;

    // Calculate commission amount based on campaign type
    let commissionAmount: number;
    if (campaign.commissionType === "percentage") {
      commissionAmount = args.saleAmount * (effectiveRate / 100);
    } else {
      // flatFee - the rate IS the commission amount (regardless of sale amount)
      commissionAmount = effectiveRate;
    }

    // Determine commission status based on campaign approval threshold (Story 4.6 AC #1, #2, #3, #5)
    // Story 5.6 AC #7: If self-referral detected, set status to "pending" for review
    let commissionStatus: "pending" | "approved" = "pending";
    
    if (isSelfReferral) {
      // Self-referral commissions require manual review regardless of threshold
      commissionStatus = "pending";
    } else if (campaign.autoApproveCommissions) {
      const threshold = campaign.approvalThreshold;
      // AC #2: If autoApproveCommissions=true but NO threshold set, auto-approve ALL
      if (threshold === null || threshold === undefined) {
        commissionStatus = "approved";
      } else {
        // AC #1: Commissions below threshold are auto-approved
        // AC #1: Commissions at or above threshold require manual review
        if (commissionAmount < threshold) {
          commissionStatus = "approved";
        }
      }
    }
    // AC #3: If autoApproveCommissions is false/null, all commissions are pending

    console.log(`Commission created with effective rate: ${effectiveRate}%, amount: ${commissionAmount} (override applied)`);

    // Create the commission with calculated amount and fraud fields (Story 5.6)
    const commissionId = await ctx.db.insert("commissions", {
      tenantId: args.tenantId,
      affiliateId: args.affiliateId,
      campaignId: args.campaignId,
      conversionId: args.conversionId,
      amount: commissionAmount,
      status: commissionStatus,
      // Self-referral fraud detection fields
      isSelfReferral: isSelfReferral || undefined,
      fraudIndicators: matchedIndicators.length > 0 ? matchedIndicators : undefined,
      eventMetadata: args.eventMetadata,
    });

    if (commissionStatus === "approved") {
      await adjustPendingPayoutTotals(ctx, args.tenantId, 1, commissionAmount);
    }

    // Story 7.8: Log COMMISSION_CREATED audit event
    try {
      await ctx.runMutation(internal.audit.logCommissionAuditEvent, {
        tenantId: args.tenantId,
        action: "COMMISSION_CREATED",
        commissionId: commissionId,
        affiliateId: args.affiliateId,
        actorId: undefined, // System-generated
        actorType: "system",
        newValue: {
          status: commissionStatus,
          amount: commissionAmount,
        },
        metadata: {
          amount: commissionAmount,
          campaignId: args.campaignId,
          transactionId: args.eventMetadata?.transactionId,
          source: args.eventMetadata?.source,
        },
      });
    } catch (err) {
      console.error("[Audit] Failed to log COMMISSION_CREATED (non-fatal):", err);
    }

    // If self-referral detected, add fraud signal and audit log AFTER commission creation
    if (isSelfReferral) {
      try {
        // Add fraud signal to affiliate record with actual commissionId
        await ctx.runMutation(internal.fraudDetection.addSelfReferralFraudSignal as any, {
          tenantId: args.tenantId,
          affiliateId: args.affiliateId,
          matchedIndicators,
          commissionId,
          totalScore,
        });

        // Log security event with actual commissionId
        await ctx.db.insert("auditLogs", {
          tenantId: args.tenantId,
          action: "self_referral_detected",
          entityType: "commission",
          entityId: commissionId,
          actorType: "system",
          metadata: {
            securityEvent: true,
            additionalInfo: `Self-referral detected: affiliate=${args.affiliateId}, conversion=${args.conversionId}, commission=${commissionId}, indicators=${matchedIndicators.join(", ")}`,
          },
        });
      } catch (error) {
        console.error("Failed to create fraud signal or audit log:", error);
        // Don't fail commission creation if fraud signal creation fails
      }
    }

    // If self-referral detected, schedule fraud alert email to SaaS Owner (non-blocking)
    if (isSelfReferral) {
      try {
        await ctx.scheduler.runAfter(0, internal.emails.sendFraudAlertEmail as any, {
          tenantId: args.tenantId,
          affiliateId: args.affiliateId,
          commissionId,
          matchedIndicators,
        });
      } catch (error) {
        // Log email failure but don't fail commission creation
        console.error("Failed to schedule fraud alert email:", error);
        await ctx.db.insert("auditLogs", {
          tenantId: args.tenantId,
          action: "fraud_alert_email_failed",
          entityType: "commission",
          entityId: commissionId,
          actorType: "system",
          metadata: {
            additionalInfo: `Failed to send fraud alert email for commission ${commissionId}`,
          },
        });
      }
    }

    // Commission earned notification (non-fatal, best-effort)
    try {
      const ownerUsers = await ctx.db
        .query("users")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .filter((q) => q.eq(q.field("role") as any, "owner"))
        .take(5);
      for (const owner of ownerUsers) {
        await ctx.runMutation(internal.notifications.createNotification, {
          tenantId: args.tenantId,
          userId: owner._id,
          type: "commission.earned",
          title: "New Commission",
          message: `${affiliate.name || "An affiliate"} earned a commission of ₱${commissionAmount.toFixed(2)}.`,
          severity: "success",
          shouldAggregate: true,
        });
      }

      // Affiliate notification — look up user by email (affiliates may not have a users record)
      const affiliateUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", affiliate.email))
        .first();
      if (affiliateUser) {
        await ctx.runMutation(internal.notifications.createNotification, {
          tenantId: args.tenantId,
          userId: affiliateUser._id,
          type: "commission.earned",
          title: "New Commission",
          message: `You earned a commission of ₱${commissionAmount.toFixed(2)}.`,
          severity: "success",
          shouldAggregate: true,
        });
      }
    } catch (notifErr) {
      console.error("[Notification] Failed to send commission earned notifications:", notifErr);
    }

    return commissionId;
  },
});

/**
 * List commissions for the current tenant.
 * Supports filtering by affiliate, campaign, and status.
 * Includes self-referral fraud detection fields (Story 5.6).
 */
export const listCommissions = query({
  args: {
    affiliateId: v.optional(v.id("affiliates")),
    campaignId: v.optional(v.id("campaigns")),
    status: v.optional(v.string()),
  },
  returns: commissionArrayValidator,
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = user.tenantId;

    // Build query with filters
    let query = ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId));

    // Apply optional filters
    if (args.affiliateId) {
      query = query.filter((q) => q.eq(q.field("affiliateId"), args.affiliateId));
    }

    if (args.campaignId) {
      query = query.filter((q) => q.eq(q.field("campaignId"), args.campaignId));
    }

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }

    const commissions = await query.order("desc").take(500);
    return commissions;
  },
});

/**
 * Get a single commission by ID.
 * Returns null if not found or doesn't belong to tenant.
 * Includes self-referral fraud detection fields (Story 5.6).
 */
export const getCommission = query({
  args: {
    commissionId: v.id("commissions"),
  },
  returns: v.union(commissionValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const commission = await ctx.db.get(args.commissionId);

    if (!commission) {
      return null;
    }

    // Verify tenant ownership
    if (commission.tenantId !== user.tenantId) {
      throw new Error("Commission not found or access denied");
    }

    return commission;
  },
});

/**
 * Get the effective commission rate for an affiliate-campaign combination.
 * Public query for UI display purposes.
 */
export const getEffectiveRate = query({
  args: {
    affiliateId: v.id("affiliates"),
    campaignId: v.id("campaigns"),
  },
  returns: v.object({
    effectiveRate: v.number(),
    isOverride: v.boolean(),
    campaignDefaultRate: v.number(),
    campaignType: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const affiliate = await ctx.db.get(args.affiliateId);
    const campaign = await ctx.db.get(args.campaignId);

    if (!affiliate || !campaign) {
      throw new Error("Affiliate or campaign not found");
    }

    // Verify tenant ownership
    if (affiliate.tenantId !== user.tenantId || campaign.tenantId !== user.tenantId) {
      throw new Error("Access denied");
    }

    // Check for affiliate-specific override for this campaign
    const override = affiliate.commissionOverrides?.find(
      (o: { campaignId: Id<"campaigns">; status?: string }) =>
        o.campaignId === args.campaignId && o.status === "active"
    );

    return {
      effectiveRate: override?.rate ?? campaign.commissionValue,
      isOverride: !!override,
      campaignDefaultRate: campaign.commissionValue,
      campaignType: campaign.commissionType,
    };
  },
});

/**
 * Get commission history for a specific affiliate.
 * Returns recent commissions ordered by creation time (most recent first).
 * Includes self-referral fraud detection fields (Story 5.6).
 * @security Requires authentication. Validates tenant ownership.
 */
// Period calculation helpers
function getPeriodRange(period: string): { start: number; end: number } | null {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const endOfLastMonth = startOfMonth - 1;
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).getTime();

  switch (period) {
    case "this_month":
      return { start: startOfMonth, end: now.getTime() };
    case "last_month":
      return { start: startOfLastMonth, end: endOfLastMonth };
    case "last_3_months":
      return { start: threeMonthsAgo, end: now.getTime() };
    default:
      return null; // All time
  }
}

export const getAffiliateCommissions = query({
  args: {
    affiliateId: v.id("affiliates"),
    limit: v.optional(v.number()),
    period: v.optional(v.string()), // "all" | "this_month" | "last_month" | "last_3_months"
    status: v.optional(v.string()), // "all" | "approved" | "pending" | "reversed" | "paid"
  },
  returns: v.array(
    v.object({
      _id: v.id("commissions"),
      _creationTime: v.number(),
      affiliateId: v.id("affiliates"),
      campaignId: v.id("campaigns"),
      conversionId: v.optional(v.id("conversions")),
      amount: v.number(),
      status: v.string(),
      campaignName: v.string(),
      customerEmail: v.optional(v.string()),
      createdAt: v.number(),
      referralCode: v.string(), // For sharing (AC10)
      // Self-referral fraud detection fields (Story 5.6)
      isSelfReferral: v.optional(v.boolean()),
      fraudIndicators: v.optional(v.array(v.string())),
      // NEW computation fields for affiliate portal
      commissionType: v.string(),
      effectiveRate: v.number(),
      saleAmount: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    // Support both admin/owner (users table) and affiliate (affiliates table) callers.
    // Admin pages use this to view any affiliate's commissions; the affiliate portal
    // uses this for self-service commission history.
    const tenantId = (await getTenantId(ctx)) ?? (await getAffiliateTenantId(ctx));
    if (!tenantId) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Verify affiliate belongs to tenant and get referral code
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      return [];
    }
    const referralCode = affiliate?.uniqueCode || "";

    // Calculate period range if specified
    const periodRange = args.period ? getPeriodRange(args.period) : null;

    // Query commissions for this affiliate
    let query = ctx.db
      .query("commissions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .order("desc");

    // When a period or status filter is active, fetch more than the display limit
    // so post-filtering still yields the expected number of results.
    const effectiveLimit = periodRange || (args.status && args.status !== "all")
      ? Math.min((args.limit ?? 50) * 5, 500)
      : (args.limit ?? 50);

    // Collect all commissions (we need to filter after querying since Convex doesn't support date range filtering in index queries)
    const allCommissions = await query.take(effectiveLimit);

    // Filter by period and status
    let filteredCommissions = allCommissions;
    
    // Filter by period
    if (periodRange) {
      filteredCommissions = filteredCommissions.filter(commission => {
        const commissionTime = commission._creationTime;
        return commissionTime >= periodRange.start && commissionTime <= periodRange.end;
      });
    }
    
    // Filter by status
    if (args.status && args.status !== "all") {
      filteredCommissions = filteredCommissions.filter(commission => {
        // Map status filter to actual commission status values
        const statusMap: Record<string, string[]> = {
          "approved": ["approved"],
          "pending": ["pending"],
          "reversed": ["reversed"],
          "paid": ["paid"],
        };
        const allowedStatuses = statusMap[args.status!];
        return allowedStatuses.includes(commission.status);
      });
    }

    // Trim to the requested limit after filtering
    filteredCommissions = filteredCommissions.slice(0, args.limit ?? 50);

    // Batch-fetch campaign names and conversion emails to eliminate N+1 reads
    const uniqueCampaignIds = [...new Set(filteredCommissions.map(c => c.campaignId.toString()))];
    const uniqueConversionIds = [...new Set(
      filteredCommissions
        .filter(c => c.conversionId)
        .map(c => c.conversionId!.toString())
    )];

    const [campaignDocs, conversionDocs] = await Promise.all([
      uniqueCampaignIds.length > 0
        ? Promise.all(uniqueCampaignIds.map(id => ctx.db.get(id as Id<"campaigns">)))
        : Promise.resolve([]),
      uniqueConversionIds.length > 0
        ? Promise.all(uniqueConversionIds.map(id => ctx.db.get(id as Id<"conversions">)))
        : Promise.resolve([]),
    ]);

    const campaignNameMap = new Map<string, string>();
    for (const doc of campaignDocs) {
      if (doc) {
        campaignNameMap.set(doc._id.toString(), doc.name);
      }
    }

    const conversionEmailMap = new Map<string, string | undefined>();
    for (const doc of conversionDocs) {
      if (doc) {
        conversionEmailMap.set(doc._id.toString(), doc.customerEmail);
      }
    }

    // Build full document maps for computation fields
    const campaignDocMap = new Map(campaignDocs.filter(Boolean).map((c: any) => [c._id, c]));
    const conversionDocMap = new Map(conversionDocs.filter(Boolean).map((c: any) => [c._id, c]));

    // Build result array using batched lookups
    const commissionsWithCampaigns = filteredCommissions.map(commission => {
      const campaignDoc = campaignDocMap.get(commission.campaignId);
      const commissionType = campaignDoc?.commissionType ?? "percentage";
      const activeOverride = affiliate?.commissionOverrides?.find(
        (o: any) => o.campaignId === commission.campaignId && o.status === "active"
      );
      const effectiveRate = activeOverride?.rate ?? (campaignDoc?.commissionValue ?? 0);
      const conversionDoc = commission.conversionId
        ? conversionDocMap.get(commission.conversionId)
        : undefined;
      const saleAmount = conversionDoc?.amount;

      return {
        _id: commission._id,
        _creationTime: commission._creationTime,
        affiliateId: commission.affiliateId,
        campaignId: commission.campaignId,
        conversionId: commission.conversionId,
        amount: commission.amount,
        status: commission.status,
        campaignName: campaignNameMap.get(commission.campaignId.toString()) ?? "Unknown Campaign",
        customerEmail: commission.conversionId
          ? conversionEmailMap.get(commission.conversionId.toString())
          : undefined,
        createdAt: commission._creationTime,
        referralCode, // Include for sharing (AC10)
        // Self-referral fraud detection fields
        isSelfReferral: commission.isSelfReferral,
        fraudIndicators: commission.fraudIndicators,
        // Computation fields
        commissionType,
        effectiveRate,
        saleAmount,
      };
    });

    return commissionsWithCampaigns;
  },
});

/**
 * Internal query to get a commission by ID.
 * Used by internal actions that need to fetch commission data without authentication.
 */
export const getCommissionInternal = internalQuery({
  args: {
    commissionId: v.id("commissions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("commissions"),
      tenantId: v.id("tenants"),
      affiliateId: v.id("affiliates"),
      campaignId: v.id("campaigns"),
      amount: v.number(),
      status: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) {
      return null;
    }
    return {
      _id: commission._id,
      tenantId: commission.tenantId,
      affiliateId: commission.affiliateId,
      campaignId: commission.campaignId,
      amount: commission.amount,
      status: commission.status,
    };
  },
});

/**
 * Internal query to get all commissions for a conversion.
 * Used by subscription event processing to find pending commissions for adjustment.
 */
export const getCommissionsByConversionInternal = internalQuery({
  args: {
    conversionId: v.id("conversions"),
  },
  returns: v.array(v.object({
    _id: v.id("commissions"),
    amount: v.number(),
    status: v.string(),
  })),
  handler: async (ctx, args) => {
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_conversion", (q) => q.eq("conversionId", args.conversionId))
      .collect();
    
    return commissions.map(c => ({
      _id: c._id,
      amount: c.amount,
      status: c.status,
    }));
  },
});

/**
 * Internal mutation to adjust a commission amount.
 * Used for subscription upgrade/downgrade adjustments.
 */
export const adjustCommissionAmountInternal = internalMutation({
  args: {
    commissionId: v.id("commissions"),
    newAmount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Fetch commission to capture old values for tenantStats hook
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) {
      throw new Error(`Commission ${args.commissionId} not found`);
    }
    const oldAmount = commission.amount;

    await ctx.db.patch(args.commissionId, {
      amount: args.newAmount,
    });

    return null;
  },
});

/**
 * Internal query to find a commission by transaction ID.
 * Used for commission reversal when refund/chargeback events are received.
 * Story 7.4 - Commission Reversal (AC3)
 */
export const findCommissionByTransactionIdInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    transactionId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("commissions"),
      tenantId: v.id("tenants"),
      affiliateId: v.id("affiliates"),
      campaignId: v.id("campaigns"),
      conversionId: v.optional(v.id("conversions")),
      amount: v.number(),
      status: v.string(),
      reversalReason: v.optional(v.string()),
      eventMetadata: v.optional(v.object({
        source: v.string(),
        transactionId: v.optional(v.string()),
        timestamp: v.number(),
        subscriptionId: v.optional(v.string()),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Query commissions by transactionId using the new index
    const commission = await ctx.db
      .query("commissions")
      .withIndex("by_tenant_and_transaction", (q) => 
        q.eq("tenantId", args.tenantId).eq("transactionId", args.transactionId)
      )
      .first();
    
    if (!commission) {
      return null;
    }
    
    return {
      _id: commission._id,
      tenantId: commission.tenantId,
      affiliateId: commission.affiliateId,
      campaignId: commission.campaignId,
      conversionId: commission.conversionId,
      amount: commission.amount,
      status: commission.status,
      reversalReason: commission.reversalReason,
      eventMetadata: commission.eventMetadata,
    };
  },
});

/**
 * Internal mutation to reverse a commission.
 * Story 7.4 - Commission Reversal (AC1, AC2)
 */
export const reverseCommissionInternal = internalMutation({
  args: {
    commissionId: v.id("commissions"),
    reversalReason: v.union(v.literal("refund"), v.literal("chargeback")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) {
      throw new Error(`Commission ${args.commissionId} not found`);
    }
    
    const previousStatus = commission.status;
    const wasFlagged = (commission.fraudIndicators?.length ?? 0) > 0 || commission.isSelfReferral === true;
    
    // Update commission status to "reversed" and set reversalReason
    await ctx.db.patch(args.commissionId, {
      status: "reversed",
      reversalReason: args.reversalReason,
    });
    
    if (previousStatus === "approved") {
      await adjustPendingPayoutTotals(ctx, commission.tenantId, -1, commission.amount);
    }
    
    // Story 7.8: Log COMMISSION_REVERSED audit event
    await ctx.runMutation(internal.audit.logCommissionAuditEvent, {
      tenantId: commission.tenantId,
      action: "COMMISSION_REVERSED",
      commissionId: args.commissionId,
      affiliateId: commission.affiliateId,
      actorId: undefined, // System-generated
      actorType: "system",
      previousValue: { status: previousStatus },
      newValue: { status: "reversed" },
      metadata: {
        amount: commission.amount,
        campaignId: commission.campaignId,
        reason: args.reversalReason,
      },
    });

    // Commission reversed notification (non-fatal, best-effort)
    try {
      const ownerUsers = await ctx.db
        .query("users")
        .withIndex("by_tenant", (q) => q.eq("tenantId", commission.tenantId))
        .filter((q) => q.eq(q.field("role") as any, "owner"))
        .take(5);
      for (const owner of ownerUsers) {
        await ctx.runMutation(internal.notifications.createNotification, {
          tenantId: commission.tenantId,
          userId: owner._id,
          type: "commission.reversed",
          title: "Commission Reversed",
          message: `A commission of ₱${commission.amount.toFixed(2)} has been reversed (${args.reversalReason}).`,
          severity: "critical",
        });
      }

      // Affiliate notification
      const affiliateDoc = await ctx.db.get(commission.affiliateId);
      if (affiliateDoc) {
        const affiliateUser = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", affiliateDoc.email))
          .first();
        if (affiliateUser) {
          await ctx.runMutation(internal.notifications.createNotification, {
            tenantId: commission.tenantId,
            userId: affiliateUser._id,
            type: "commission.reversed",
            title: "Commission Reversed",
            message: `Your commission of ₱${commission.amount.toFixed(2)} has been reversed (${args.reversalReason}).`,
            severity: "critical",
          });
        }
      }
    } catch (notifErr) {
      console.error("[Notification] Failed to send commission reversed notifications:", notifErr);
    }
    
    return null;
  },
});

// =============================================================================
// STORY 7.7: MANUAL COMMISSION APPROVAL
// =============================================================================

/**
 * Approve a pending commission.
 * Story 7.7 - Manual Commission Approval (AC1)
 * 
 * Validates that:
 * - Commission exists and belongs to current tenant
 * - Commission status is "pending"
 * - User has permission to approve
 * 
 * Then updates status to "approved" and logs the action.
 */
export const approveCommission = mutation({
  args: {
    commissionId: v.id("commissions"),
  },
  returns: v.object({
    success: v.boolean(),
    commissionId: v.id("commissions"),
    newStatus: v.string(),
  }),
  handler: async (ctx, args) => {
    // 1. Get authenticated user with tenant
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    await requireWriteAccess(ctx);
    
    // 2. Get commission and validate existence
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) {
      throw new Error("Commission not found");
    }
    
    // 3. Validate tenant isolation (AC3)
    if (commission.tenantId !== user.tenantId) {
      // Log unauthorized access attempt
      await ctx.runMutation(internal.audit.logUnauthorizedAccess, {
        action: "cross_tenant_commission_approval",
        currentTenantId: user.tenantId,
        attemptedTenantId: commission.tenantId,
        resourceType: "commission",
        resourceId: args.commissionId,
      });
      throw new Error("Unauthorized: Commission does not belong to your tenant");
    }
    
    // 4. Validate status is "pending" (AC4)
    if (commission.status !== "pending") {
      throw new Error(`Cannot approve commission with status "${commission.status}". Only pending commissions can be approved.`);
    }
    
    // 5. Update status atomically
    const previousStatus = commission.status;
    const wasFlagged = (commission.fraudIndicators?.length ?? 0) > 0 || commission.isSelfReferral === true;
    await ctx.db.patch(args.commissionId, {
      status: "approved",
    });

    await adjustPendingPayoutTotals(ctx, user.tenantId, 1, commission.amount);

    // 6. Log audit trail (Story 7.8 - Task 3)
    await ctx.runMutation(internal.audit.logCommissionAuditEvent, {
      tenantId: user.tenantId,
      action: "COMMISSION_APPROVED",
      commissionId: args.commissionId,
      affiliateId: commission.affiliateId,
      actorId: user.userId,
      actorType: "user",
      previousValue: { status: previousStatus },
      newValue: { status: "approved" },
      metadata: {
        amount: commission.amount,
        campaignId: commission.campaignId,
      },
    });

    // Commission approved notification (non-fatal, best-effort)
    try {
      const ownerUsers = await ctx.db
        .query("users")
        .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))
        .filter((q) => q.eq(q.field("role") as any, "owner"))
        .take(5);
      for (const owner of ownerUsers) {
        await ctx.runMutation(internal.notifications.createNotification, {
          tenantId: user.tenantId,
          userId: owner._id,
          type: "commission.approved",
          title: "Commission Approved",
          message: `A commission of ₱${commission.amount.toFixed(2)} has been approved.`,
          severity: "success",
        });
      }

      // Affiliate notification
      const affiliateDoc = await ctx.db.get(commission.affiliateId);
      if (affiliateDoc) {
        const affiliateUser = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", affiliateDoc.email))
          .first();
        if (affiliateUser) {
          await ctx.runMutation(internal.notifications.createNotification, {
            tenantId: user.tenantId,
            userId: affiliateUser._id,
            type: "commission.approved",
            title: "Commission Approved",
            message: `Your commission of ₱${commission.amount.toFixed(2)} has been approved.`,
            severity: "success",
          });
        }
      }
    } catch (notifErr) {
      console.error("[Notification] Failed to send commission approved notification:", notifErr);
    }

    // 7. Send commission approved email (Story 10.2)
    // Track approval timestamp for 5-minute SLA monitoring
    const approvalTimestamp = Date.now();
    
    // Fetch affiliate and tenant data for email
    const affiliate = await ctx.db.get(commission.affiliateId);
    if (affiliate) {
      const tenant = await ctx.db.get(commission.tenantId);
      const campaign = await ctx.db.get(commission.campaignId);
      
      // Get conversion data for accurate timestamp and plan type
      let conversionDate = approvalTimestamp;
      let customerPlanType: string | undefined;
      
      if (commission.conversionId) {
        const conversion = await ctx.db.get(commission.conversionId);
        if (conversion) {
          // Use conversion's own timestamp from the actual event
          conversionDate = conversion._creationTime;
          
          // Determine customer plan type from conversion metadata
          if (conversion.metadata?.planId) {
            customerPlanType = conversion.metadata.planId;
          } else if (conversion.metadata?.subscriptionId) {
            customerPlanType = "Subscription";
          } else if (conversion.metadata?.products && conversion.metadata.products.length > 0) {
            customerPlanType = conversion.metadata.products[0];
          }
        }
      }
      
      // Build portal earnings URL if available
      const portalEarningsUrl = tenant?.branding?.customDomain
        ? `https://${tenant.branding.customDomain}/earnings`
        : undefined;
      
      // Schedule email sending (non-blocking)
      // AC1: Email must be sent within 5 minutes - logged for monitoring
      try {
        await ctx.scheduler.runAfter(0, internal.emails.sendCommissionConfirmedEmail, {
          tenantId: commission.tenantId,
          commissionId: commission._id,
          affiliateId: commission.affiliateId,
          affiliateEmail: affiliate.email,
          affiliateName: affiliate.name,
          commissionAmount: commission.amount,
          campaignName: campaign?.name || "Campaign",
          conversionDate,
          portalName: tenant?.branding?.portalName || tenant?.name || "Portal",
          brandLogoUrl: tenant?.branding?.logoUrl,
          brandPrimaryColor: tenant?.branding?.primaryColor,
          portalEarningsUrl,
          transactionId: commission.transactionId,
          customerPlanType,
          approvalTimestamp, // Pass for SLA monitoring
        });
      } catch (schedulerError) {
        // Log scheduler failure but don't fail the approval
        // Email will need to be retried manually or by a background job
        await ctx.runMutation(internal.audit.logCommissionAuditEvent, {
          tenantId: user.tenantId,
          action: "EMAIL_SCHEDULE_FAILED",
          commissionId: args.commissionId,
          affiliateId: commission.affiliateId,
          actorId: user.userId,
          actorType: "user",
          metadata: {
            error: schedulerError instanceof Error ? schedulerError.message : String(schedulerError),
            emailType: "commission_approved",
          },
        });
      }
    }
    
    return {
      success: true,
      commissionId: args.commissionId,
      newStatus: "approved",
    };
  },
});

/**
 * Decline a pending commission with a reason.
 * Story 7.7 - Manual Commission Approval (AC2)
 * 
 * Validates that:
 * - Commission exists and belongs to current tenant
 * - Commission status is "pending"
 * - User provides a decline reason
 * 
 * Then updates status to "declined", stores reason, and logs the action.
 * Note: Decline reason is NOT exposed to affiliates (per AC2).
 */
export const declineCommission = mutation({
  args: {
    commissionId: v.id("commissions"),
    reason: v.string(), // Required - must provide reason
  },
  returns: v.object({
    success: v.boolean(),
    commissionId: v.id("commissions"),
    newStatus: v.string(),
  }),
  handler: async (ctx, args) => {
    // 1. Get authenticated user with tenant
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    await requireWriteAccess(ctx);
    
    // Validate reason is not empty
    if (!args.reason || args.reason.trim().length === 0) {
      throw new Error("Decline reason is required");
    }
    
    // 2. Get commission and validate existence
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) {
      throw new Error("Commission not found");
    }
    
    // 3. Validate tenant isolation (AC3)
    if (commission.tenantId !== user.tenantId) {
      // Log unauthorized access attempt
      await ctx.runMutation(internal.audit.logUnauthorizedAccess, {
        action: "cross_tenant_commission_decline",
        currentTenantId: user.tenantId,
        attemptedTenantId: commission.tenantId,
        resourceType: "commission",
        resourceId: args.commissionId,
      });
      throw new Error("Unauthorized: Commission does not belong to your tenant");
    }
    
    // 4. Validate status is "pending" (AC4)
    if (commission.status !== "pending") {
      throw new Error(`Cannot decline commission with status "${commission.status}". Only pending commissions can be declined.`);
    }
    
    // 5. Update status and store decline reason (reusing reversalReason field)
    const previousStatus = commission.status;
    const wasFlagged = (commission.fraudIndicators?.length ?? 0) > 0 || commission.isSelfReferral === true;
    await ctx.db.patch(args.commissionId, {
      status: "declined",
      reversalReason: args.reason, // Store decline reason (internal only)
    });

    // 6. Log audit trail with reason (Story 7.8 - Task 3)
    // Note: Decline reason is stored internally but NOT exposed to affiliates (AC2)
    await ctx.runMutation(internal.audit.logCommissionAuditEvent, {
      tenantId: user.tenantId,
      action: "COMMISSION_DECLINED",
      commissionId: args.commissionId,
      affiliateId: commission.affiliateId,
      actorId: user.userId,
      actorType: "user",
      previousValue: { status: previousStatus },
      newValue: { status: "declined" },
      metadata: {
        amount: commission.amount,
        campaignId: commission.campaignId,
        reason: args.reason,
      },
    });
    
    // Commission declined notification (non-fatal, best-effort)
    try {
      const ownerUsers = await ctx.db
        .query("users")
        .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))
        .filter((q) => q.eq(q.field("role") as any, "owner"))
        .take(5);
      for (const owner of ownerUsers) {
        await ctx.runMutation(internal.notifications.createNotification, {
          tenantId: user.tenantId,
          userId: owner._id,
          type: "commission.declined",
          title: "Commission Declined",
          message: `A commission of ₱${commission.amount.toFixed(2)} has been declined.`,
          severity: "warning",
        });
      }

      // Affiliate notification
      const affiliateDoc = await ctx.db.get(commission.affiliateId);
      if (affiliateDoc) {
        const affiliateUser = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", affiliateDoc.email))
          .first();
        if (affiliateUser) {
          await ctx.runMutation(internal.notifications.createNotification, {
            tenantId: user.tenantId,
            userId: affiliateUser._id,
            type: "commission.declined",
            title: "Commission Declined",
            message: `Your commission of ₱${commission.amount.toFixed(2)} has been declined.`,
            severity: "warning",
          });
        }
      }
    } catch (notifErr) {
      console.error("[Notification] Failed to send commission declined notification:", notifErr);
    }

    return {
      success: true,
      commissionId: args.commissionId,
      newStatus: "declined",
    };
  },
});

/**
 * List pending commissions for review.
 * Story 7.7 - Manual Commission Approval (AC5)
 * 
 * Returns paginated list of commissions with "pending" status.
 * Each entry includes affiliate info, commission amount, and fraud indicators.
 */
export const listPendingCommissions = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("commissions"),
      _creationTime: v.number(),
      amount: v.number(),
      status: v.string(),
      affiliateId: v.id("affiliates"),
      affiliateName: v.string(),
      affiliateEmail: v.string(),
      campaignId: v.id("campaigns"),
      campaignName: v.string(),
      isSelfReferral: v.optional(v.boolean()),
      fraudIndicators: v.optional(v.array(v.string())),
    })),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    // Get authenticated user with tenant
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }
    
    // Query pending commissions for this tenant
    const results = await ctx.db
      .query("commissions")
      .withIndex("by_tenant_and_status", (q) => 
        q.eq("tenantId", user.tenantId).eq("status", "pending")
      )
      .order("desc")
      .paginate(args.paginationOpts);
    
    // Enrich with affiliate and campaign info
    const enrichedPage = await Promise.all(
      results.page.map(async (commission) => {
        const affiliate = await ctx.db.get(commission.affiliateId);
        const campaign = await ctx.db.get(commission.campaignId);
        return {
          _id: commission._id,
          _creationTime: commission._creationTime,
          amount: commission.amount,
          status: commission.status,
          affiliateId: commission.affiliateId,
          affiliateName: affiliate?.name ?? "Unknown",
          affiliateEmail: affiliate?.email ?? "Unknown",
          campaignId: commission.campaignId,
          campaignName: campaign?.name ?? "Unknown",
          isSelfReferral: commission.isSelfReferral,
          fraudIndicators: commission.fraudIndicators,
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

/**
 * Get commission details for review.
 * Story 7.7 - Manual Commission Approval (AC5)
 * 
 * Returns full commission details including fraud indicators for review.
 * Used by the review detail view.
 */
export const getCommissionForReview = query({
  args: {
    commissionId: v.id("commissions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("commissions"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      affiliateId: v.id("affiliates"),
      affiliateName: v.string(),
      affiliateEmail: v.string(),
      campaignId: v.id("campaigns"),
      campaignName: v.string(),
      amount: v.number(),
      status: v.string(),
      isSelfReferral: v.optional(v.boolean()),
      fraudIndicators: v.optional(v.array(v.string())),
      conversionId: v.optional(v.id("conversions")),
      eventMetadata: v.optional(v.object({
        source: v.string(),
        transactionId: v.optional(v.string()),
        timestamp: v.number(),
        subscriptionId: v.optional(v.string()),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Get authenticated user with tenant
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }
    
    // Get commission
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) {
      return null;
    }
    
    // Validate tenant isolation (AC3)
    if (commission.tenantId !== user.tenantId) {
      throw new Error("Commission not found or access denied");
    }
    
    // Only return pending commissions for review (AC4)
    if (commission.status !== "pending") {
      throw new Error(`Commission is not pending review. Current status: ${commission.status}`);
    }
    
    // Get affiliate and campaign info
    const affiliate = await ctx.db.get(commission.affiliateId);
    const campaign = await ctx.db.get(commission.campaignId);
    
    return {
      _id: commission._id,
      _creationTime: commission._creationTime,
      tenantId: commission.tenantId,
      affiliateId: commission.affiliateId,
      affiliateName: affiliate?.name ?? "Unknown",
      affiliateEmail: affiliate?.email ?? "Unknown",
      campaignId: commission.campaignId,
      campaignName: campaign?.name ?? "Unknown",
      amount: commission.amount,
      status: commission.status,
      isSelfReferral: commission.isSelfReferral,
      fraudIndicators: commission.fraudIndicators,
      conversionId: commission.conversionId,
      eventMetadata: commission.eventMetadata,
    };
  },
});

// =============================================================================
// OWNER COMMISSIONS PAGE — NEW QUERIES/ACTIONS
// =============================================================================

/**
 * Event source type mapping for plan/event display.
 */
function formatEventType(source: string | undefined): string {
  switch (source) {
    case "webhook": return "Subscription";
    case "manual": return "Manual Entry";
    case "api": return "API Triggered";
    default: return source ?? "Event";
  }
}

/**
 * List all commissions with enriched data (affiliate name/email, campaign name, customer email, plan/event).
 * Used by the Owner Commissions page DataTable.
 * Capped at 500 for performance. Client-side filters handle status/search/campaign.
 */
export const listCommissionsEnriched = query({
  args: {},
  returns: commissionEnrichedArrayValidator,
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))
      .order("desc")
      .take(500);

    // Batch-fetch unique affiliates, campaigns, conversions to minimize N+1
    const affiliateIds = [...new Set(commissions.map((c) => c.affiliateId))];
    const campaignIds = [...new Set(commissions.map((c) => c.campaignId))];
    const conversionIds = [...new Set(
      commissions.map((c) => c.conversionId).filter((id): id is Id<"conversions"> => id !== undefined)
    )];

    const [affiliates, campaigns, conversions] = await Promise.all([
      Promise.all(affiliateIds.map((id) => ctx.db.get(id))),
      Promise.all(campaignIds.map((id) => ctx.db.get(id))),
      Promise.all(conversionIds.map((id) => ctx.db.get(id))),
    ]);

    const affiliateMap: Record<string, (typeof affiliates)[number]> = {};
    for (const a of affiliates) {
      if (a) affiliateMap[a._id] = a;
    }
    const campaignMap: Record<string, (typeof campaigns)[number]> = {};
    for (const c of campaigns) {
      if (c) campaignMap[c._id] = c;
    }
    const conversionMap: Record<string, (typeof conversions)[number]> = {};
    for (const c of conversions) {
      if (c) conversionMap[c._id] = c;
    }

    return commissions.map((commission) => {
      const affiliate = affiliateMap[commission.affiliateId];
      const campaign = campaignMap[commission.campaignId];
      const conversion = commission.conversionId
        ? conversionMap[commission.conversionId]
        : undefined;

      const campaignName = campaign?.name ?? "Unknown";
      const source = commission.eventMetadata?.source;
      const eventType = formatEventType(source);
      const planEvent = `${campaignName} · ${eventType}`;

      let customerEmail: string | undefined;
      if (conversion) {
        customerEmail = conversion.customerEmail;
      }

      return {
        _id: commission._id,
        _creationTime: commission._creationTime,
        tenantId: commission.tenantId,
        affiliateId: commission.affiliateId,
        campaignId: commission.campaignId,
        conversionId: commission.conversionId,
        amount: commission.amount,
        status: commission.status,
        eventMetadata: commission.eventMetadata,
        reversalReason: commission.reversalReason,
        transactionId: commission.transactionId,
        batchId: commission.batchId,
        isSelfReferral: commission.isSelfReferral,
        fraudIndicators: commission.fraudIndicators,
        affiliateName: affiliate?.name ?? "Unknown",
        affiliateEmail: affiliate?.email ?? "Unknown",
        campaignName,
        customerEmail,
        planEvent,
      };
    });
  },
});

/**
 * Column filter types for server-side filtering
 */
interface ParsedColumnFilter {
  columnKey: string;
  type: "text" | "select" | "number-range" | "date-range";
  value?: string;
  values?: string[];
  min?: number;
  max?: number;
  after?: number;
  before?: number;
}

/**
 * List commissions with server-side pagination, sorting, and filtering.
 * Used by the Owner Commissions page for better performance with large datasets.
 */
export const listCommissionsPaginated = query({
  args: {
    page: v.number(),
    numItems: v.number(),
    // Optional filters
    statusFilter: v.optional(v.array(v.string())),
    campaignIdFilter: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
    amountMin: v.optional(v.number()),
    amountMax: v.optional(v.number()),
    dateAfter: v.optional(v.number()),
    dateBefore: v.optional(v.number()),
    affiliateSearch: v.optional(v.string()),
    customerSearch: v.optional(v.string()),
    planEventSearch: v.optional(v.string()),
    batchIdFilter: v.optional(v.id("payoutBatches")),
    // Optional sorting
    sortBy: v.optional(v.union(
      v.literal("_creationTime"),
      v.literal("amount"),
      v.literal("affiliateName"),
      v.literal("campaignName"),
      v.literal("customerEmail"),
      v.literal("planEvent"),
      v.literal("status")
    )),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.object({
    page: commissionEnrichedArrayValidator,
    total: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const numItems = Math.min(args.numItems, 100);

    // Fetch commissions for the tenant (capped for safety).
    // When a search query is active, raise the cap so older records are reachable.
    // When a single status filter is provided, use the status index to reduce
    // the working set before the cap.
    const hasSearch = !!args.searchQuery || !!args.affiliateSearch || !!args.customerSearch || !!args.planEventSearch;
    const MAX_COMMISSIONS = hasSearch ? 10000 : 5000;

    let commissions: Doc<"commissions">[];

    // Use status-specific index when filtering to a single known status
    if (
      args.statusFilter &&
      args.statusFilter.length === 1 &&
      ["pending", "approved", "paid", "reversed", "declined"].includes(args.statusFilter[0])
    ) {
      commissions = await ctx.db
        .query("commissions")
        .withIndex("by_tenant_and_status", (q) =>
          q.eq("tenantId", user.tenantId).eq("status", args.statusFilter![0])
        )
        .order("desc")
        .take(MAX_COMMISSIONS);
    } else {
      commissions = await ctx.db
        .query("commissions")
        .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))
        .order("desc")
        .take(MAX_COMMISSIONS);
    }

    // Apply filters in memory
    if (args.statusFilter && args.statusFilter.length > 0) {
      const statusSet = new Set(args.statusFilter.map((s) => s.toLowerCase()));
      commissions = commissions.filter((c) => statusSet.has(c.status.toLowerCase()));
    }

    if (args.campaignIdFilter) {
      commissions = commissions.filter((c) => c.campaignId === args.campaignIdFilter);
    }

    if (args.batchIdFilter) {
      commissions = commissions.filter((c) => c.batchId === args.batchIdFilter);
    }

    // Batch-fetch unique affiliates, campaigns, conversions
    const affiliateIds = [...new Set(commissions.map((c) => c.affiliateId))];
    const campaignIds = [...new Set(commissions.map((c) => c.campaignId))];
    const conversionIds = [...new Set(
      commissions.map((c) => c.conversionId).filter((id): id is Id<"conversions"> => id !== undefined)
    )];

    const [affiliates, campaigns, conversions] = await Promise.all([
      Promise.all(affiliateIds.map((id) => ctx.db.get(id))),
      Promise.all(campaignIds.map((id) => ctx.db.get(id))),
      Promise.all(conversionIds.map((id) => ctx.db.get(id))),
    ]);

    const affiliateMap: Record<string, (typeof affiliates)[number]> = {};
    for (const a of affiliates) {
      if (a) affiliateMap[a._id] = a;
    }
    const campaignMap: Record<string, (typeof campaigns)[number]> = {};
    for (const c of campaigns) {
      if (c) campaignMap[c._id] = c;
    }
    const conversionMap: Record<string, (typeof conversions)[number]> = {};
    for (const c of conversions) {
      if (c) conversionMap[c._id] = c;
    }

    // Enrich results
    let enriched = commissions.map((commission) => {
      const affiliate = affiliateMap[commission.affiliateId];
      const campaign = campaignMap[commission.campaignId];
      const conversion = commission.conversionId
        ? conversionMap[commission.conversionId]
        : undefined;

      const campaignName = campaign?.name ?? "Unknown";
      const source = commission.eventMetadata?.source;
      const eventType = formatEventType(source);
      const planEvent = `${campaignName} · ${eventType}`;

      let customerEmail: string | undefined;
      if (conversion) {
        customerEmail = (conversion as any).customerEmail;
      }

      return {
        _id: commission._id,
        _creationTime: commission._creationTime,
        tenantId: commission.tenantId,
        affiliateId: commission.affiliateId,
        campaignId: commission.campaignId,
        conversionId: commission.conversionId,
        amount: commission.amount,
        status: commission.status,
        eventMetadata: commission.eventMetadata,
        reversalReason: commission.reversalReason,
        transactionId: commission.transactionId,
        batchId: commission.batchId,
        isSelfReferral: commission.isSelfReferral,
        fraudIndicators: commission.fraudIndicators,
        affiliateName: affiliate?.name ?? "Unknown",
        affiliateEmail: affiliate?.email ?? "Unknown",
        campaignName,
        customerEmail,
        planEvent,
      };
    });

    // Apply search filter
    if (args.searchQuery) {
      const search = args.searchQuery.toLowerCase();
      enriched = enriched.filter((c) => {
        return (
          c.affiliateName.toLowerCase().includes(search) ||
          c.affiliateEmail.toLowerCase().includes(search) ||
          (c.customerEmail ?? "").toLowerCase().includes(search) ||
          (c.transactionId ?? "").toLowerCase().includes(search)
        );
      });
    }

    // Apply amount range filter
    if (args.amountMin != null) {
      enriched = enriched.filter((c) => c.amount >= args.amountMin!);
    }
    if (args.amountMax != null) {
      enriched = enriched.filter((c) => c.amount <= args.amountMax!);
    }

    // Apply date range filter
    if (args.dateAfter != null) {
      enriched = enriched.filter((c) => c._creationTime >= args.dateAfter!);
    }
    if (args.dateBefore != null) {
      enriched = enriched.filter((c) => c._creationTime <= args.dateBefore!);
    }

    // Apply column-level text filters
    if (args.affiliateSearch) {
      const q = args.affiliateSearch.toLowerCase();
      enriched = enriched.filter((c) =>
        c.affiliateName.toLowerCase().includes(q) ||
        c.affiliateEmail.toLowerCase().includes(q)
      );
    }
    if (args.customerSearch) {
      const q = args.customerSearch.toLowerCase();
      enriched = enriched.filter((c) =>
        (c.customerEmail ?? "").toLowerCase().includes(q)
      );
    }
    if (args.planEventSearch) {
      const q = args.planEventSearch.toLowerCase();
      enriched = enriched.filter((c) =>
        c.planEvent.toLowerCase().includes(q)
      );
    }

    const total = enriched.length;

    // Apply sorting before pagination
    if (args.sortBy && args.sortOrder) {
      const field = args.sortBy as keyof typeof enriched[number];
      const order = args.sortOrder === "asc" ? 1 : -1;
      
      enriched = [...enriched].sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === "number" && typeof bVal === "number") {
          return (aVal - bVal) * order;
        }
        return String(aVal).localeCompare(String(bVal)) * order;
      });
    }

    // Page-based pagination
    const startIndex = (args.page - 1) * numItems;
    const endIndex = startIndex + numItems;
    const pageItems = enriched.slice(startIndex, endIndex);
    const hasMore = endIndex < total;

    return {
      page: pageItems,
      total,
      hasMore,
    };
  },
});

/**
 * Get full commission detail for the drawer — works for ALL statuses.
 * Unlike getCommissionForReview which only returns pending commissions.
 */
export const getCommissionDetail = query({
  args: {
    commissionId: v.id("commissions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("commissions"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      affiliateId: v.id("affiliates"),
      campaignId: v.id("campaigns"),
      conversionId: v.optional(v.id("conversions")),
      amount: v.number(),
      status: v.string(),
      eventMetadata: v.optional(v.object({
        source: v.string(),
        transactionId: v.optional(v.string()),
        timestamp: v.number(),
        subscriptionId: v.optional(v.string()),
      })),
      reversalReason: v.optional(v.string()),
      transactionId: v.optional(v.string()),
      batchId: v.optional(v.id("payoutBatches")),
      isSelfReferral: v.optional(v.boolean()),
      fraudIndicators: v.optional(v.array(v.string())),
      affiliateName: v.string(),
      affiliateEmail: v.string(),
      campaignName: v.string(),
      customerEmail: v.optional(v.string()),
      planInfo: v.optional(v.string()),
      planEvent: v.string(),
      // NEW computation fields
      commissionType: v.string(),
      campaignDefaultRate: v.number(),
      effectiveRate: v.number(),
      isOverride: v.boolean(),
      saleAmount: v.optional(v.number()),
      recurringCommission: v.boolean(),
      recurringRate: v.optional(v.number()),
      recurringRateType: v.optional(v.string()),
      // NEW audit trail
      auditTrail: v.array(v.object({
        _id: v.id("auditLogs"),
        _creationTime: v.number(),
        action: v.string(),
        actorId: v.optional(v.string()),
        actorType: v.string(),
        previousValue: v.optional(v.any()),
        newValue: v.optional(v.any()),
        metadata: v.optional(v.any()),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    const commission = await ctx.db.get(args.commissionId);
    if (!commission) {
      return null;
    }

    if (commission.tenantId !== user.tenantId) {
      throw new Error("Commission not found or access denied");
    }

    const affiliate = await ctx.db.get(commission.affiliateId);
    const campaign = await ctx.db.get(commission.campaignId);

    let customerEmail: string | undefined;
    let planInfo: string | undefined;
    let conversionAmount: number | undefined;

    if (commission.conversionId) {
      const conversion = await ctx.db.get(commission.conversionId);
      if (conversion) {
        customerEmail = conversion.customerEmail;
        conversionAmount = conversion.amount;
        const meta = conversion.metadata;
        if (meta?.planId) {
          planInfo = meta.planId;
        } else if (meta?.subscriptionId) {
          planInfo = "Subscription";
        }
      }
    }

    // Compute effective rate (check for affiliate-specific override)
    const activeOverride = affiliate?.commissionOverrides?.find(
      (o: any) => o.campaignId === commission.campaignId && o.status === "active"
    );
    const effectiveRate = activeOverride?.rate ?? campaign?.commissionValue ?? 0;
    const isOverride = !!activeOverride;

    // Fetch audit trail for this commission
    const allAuditLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", "commission").eq("entityId", args.commissionId)
      )
      .order("asc")
      .collect();
    const auditTrail = allAuditLogs
      .filter((log) => log.tenantId === commission.tenantId)
      .map((log) => ({
        _id: log._id,
        _creationTime: log._creationTime,
        action: log.action,
        actorId: log.actorId,
        actorType: log.actorType,
        previousValue: log.previousValue,
        newValue: log.newValue,
        metadata: log.metadata,
      }));

    return {
      _id: commission._id,
      _creationTime: commission._creationTime,
      tenantId: commission.tenantId,
      affiliateId: commission.affiliateId,
      campaignId: commission.campaignId,
      conversionId: commission.conversionId,
      amount: commission.amount,
      status: commission.status,
      eventMetadata: commission.eventMetadata,
      reversalReason: commission.reversalReason,
      transactionId: commission.transactionId,
      batchId: commission.batchId,
      isSelfReferral: commission.isSelfReferral,
      fraudIndicators: commission.fraudIndicators,
      affiliateName: affiliate?.name ?? "Unknown",
      affiliateEmail: affiliate?.email ?? "Unknown",
      campaignName: campaign?.name ?? "Unknown",
      customerEmail,
      planInfo,
      planEvent: `${campaign?.name ?? "Unknown"} · ${formatEventType(commission.eventMetadata?.source)}`,
      // Computation fields
      commissionType: campaign?.commissionType ?? "N/A",
      campaignDefaultRate: campaign?.commissionValue ?? 0,
      effectiveRate,
      isOverride,
      saleAmount: conversionAmount,
      recurringCommission: campaign?.recurringCommission ?? false,
      recurringRate: campaign?.recurringRate,
      recurringRateType: campaign?.recurringRateType,
      // Audit trail
      auditTrail,
    };
  },
});

/**
 * Get aggregated commission stats for the metric cards.
 * Computes pending, approved, reversed, and flagged counts/values in a single pass.
 */
export const getCommissionStats = query({
  args: {},
  returns: v.object({
    pendingCount: v.number(),
    pendingValue: v.number(),
    approvedValue: v.number(),
    approvedCount: v.number(),
    confirmedCountThisMonth: v.number(),
    confirmedValueThisMonth: v.number(),
    reversedCountThisMonth: v.number(),
    reversedValueThisMonth: v.number(),
    flaggedCount: v.number(),
  }),
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Read from denormalized tenantStats — zero table scans
    const stats = await ctx.db
      .query("tenantStats")
      .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))
      .first();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const stale = stats && stats.currentMonthStart < monthStart;

    return {
      pendingCount: stats?.commissionsPendingCount ?? 0,
      pendingValue: stats?.commissionsPendingValue ?? 0,
      approvedValue: stats?.pendingPayoutTotal ?? 0,
      approvedCount: stats?.pendingPayoutCount ?? 0,
      confirmedCountThisMonth: stale ? 0 : (stats?.commissionsConfirmedThisMonth ?? 0),
      confirmedValueThisMonth: stale ? 0 : (stats?.commissionsConfirmedValueThisMonth ?? 0),
      reversedCountThisMonth: stale ? 0 : (stats?.commissionsReversedThisMonth ?? 0),
      reversedValueThisMonth: stale ? 0 : (stats?.commissionsReversedValueThisMonth ?? 0),
      flaggedCount: stats?.commissionsFlagged ?? 0,
    };
  },
});

/**
 * Export commissions as CSV (base64-encoded string).
 * Follows dashboardExport.ts pattern — "use node" action with betterAuthComponent auth.
 */
"use node";
export const exportCommissionsCSV = action({
  args: {
    dateRange: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    if (!betterAuthUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    type AppUser = { _id: Id<"users">; email: string; name?: string; role: string; tenantId: Id<"tenants"> };
    const appUser: AppUser | null = await ctx.runQuery(internal.users._getUserByEmailInternal, {
      email: betterAuthUser.email,
    });

    if (!appUser) {
      throw new Error("Unauthorized: User not found");
    }

    // Get enriched commissions data
    const commissions = await ctx.runQuery(api.commissions.listCommissionsEnriched, {});

    // Apply optional date range filter
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const startDate = args.dateRange?.start ?? thirtyDaysAgo;
    const endDate = args.dateRange?.end ?? now;

    const filtered = commissions.filter(
      (c: any) => c._creationTime >= startDate && c._creationTime <= endDate
    );

    const formatDate = (timestamp: number) => {
      return new Date(timestamp).toISOString().split("T")[0];
    };

    const rows: string[] = [];
    rows.push("Date,Affiliate Name,Affiliate Email,Customer Email,Campaign,Plan/Event,Amount,Status,Transaction ID");
    for (const c of filtered) {
      rows.push([
        formatDate(c._creationTime),
        `"${c.affiliateName.replace(/"/g, '""')}"`,
        `"${c.affiliateEmail.replace(/"/g, '""')}"`,
        c.customerEmail ? `"${c.customerEmail.replace(/"/g, '""')}"` : "",
        `"${c.campaignName.replace(/"/g, '""')}"`,
        `"${c.planEvent.replace(/"/g, '""')}"`,
        c.amount.toFixed(2),
        c.status,
        c.eventMetadata?.transactionId ?? "",
      ].join(","));
    }

    return btoa(rows.join("\n"));
  },
});
