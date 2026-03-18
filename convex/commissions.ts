import { mutation, internalMutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthenticatedUser } from "./tenantContext";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";

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
      return null; // Return null to indicate commission was not created
    }

    // Get campaign for threshold check (Story 4.6)
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) {
      console.log("Commission blocked: Campaign not found");
      return null;
    }

    // Story 4.7: Get affiliate to check for commission override
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      console.log("Commission blocked: Affiliate not found");
      return null;
    }

    // Story 5.6: Self-referral detection
    let isSelfReferral = false;
    let matchedIndicators: string[] = [];
    
    // Check if conversion has fraud detection data (ipAddress, deviceFingerprint, etc.)
    const conversion = await ctx.db.get(args.conversionId);
    if (conversion) {
      // Only run detection if conversion has tracking data
      if (conversion.ipAddress || conversion.deviceFingerprint || conversion.customerEmail) {
        // Run self-referral detection
        const detectionResult: { isSelfReferral: boolean; matchedIndicators: string[] } = await ctx.runQuery(
          internal.fraudDetection.detectSelfReferral as any,
          {
            tenantId: args.tenantId,
            conversionId: args.conversionId,
            affiliateId: args.affiliateId,
          }
        );
        
        isSelfReferral = detectionResult.isSelfReferral;
        matchedIndicators = detectionResult.matchedIndicators;
        
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

    // Story 7.8: Log COMMISSION_CREATED audit event
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

    // If self-referral detected, add fraud signal and audit log AFTER commission creation
    if (isSelfReferral) {
      try {
        // Add fraud signal to affiliate record with actual commissionId
        await ctx.runMutation(internal.fraudDetection.addSelfReferralFraudSignal as any, {
          tenantId: args.tenantId,
          affiliateId: args.affiliateId,
          matchedIndicators,
          commissionId,
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
  returns: v.array(
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
      })),
      reversalReason: v.optional(v.string()),
      // Self-referral fraud detection fields (Story 5.6)
      isSelfReferral: v.optional(v.boolean()),
      fraudIndicators: v.optional(v.array(v.string())),
    })
  ),
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

    const commissions = await query.order("desc").collect();
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
      })),
      reversalReason: v.optional(v.string()),
      // Self-referral fraud detection fields (Story 5.6)
      isSelfReferral: v.optional(v.boolean()),
      fraudIndicators: v.optional(v.array(v.string())),
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
    status: v.optional(v.string()), // "all" | "confirmed" | "pending" | "reversed" | "paid"
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
    })
  ),
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    const tenantId = user.tenantId;

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

    // Collect all commissions (we need to filter after querying since Convex doesn't support date range filtering in index queries)
    const allCommissions = await query.take(args.limit ?? 50);

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
          "confirmed": ["confirmed"],
          "pending": ["pending"],
          "reversed": ["reversed"],
          "paid": ["paid"],
        };
        const allowedStatuses = statusMap[args.status!];
        return allowedStatuses.includes(commission.status);
      });
    }

    // Populate campaign names and affiliate data
    const commissionsWithCampaigns = [];
    
    for (const commission of filteredCommissions) {
      const campaign = await ctx.db.get(commission.campaignId);
      
      // Get customer email from conversion if available
      let customerEmail: string | undefined;
      if (commission.conversionId) {
        const conversion = await ctx.db.get(commission.conversionId);
        customerEmail = conversion?.customerEmail;
      }

      commissionsWithCampaigns.push({
        _id: commission._id,
        _creationTime: commission._creationTime,
        affiliateId: commission.affiliateId,
        campaignId: commission.campaignId,
        conversionId: commission.conversionId,
        amount: commission.amount,
        status: commission.status,
        campaignName: campaign?.name || "Unknown Campaign",
        customerEmail,
        createdAt: commission._creationTime,
        referralCode, // Include for sharing (AC10)
        // Self-referral fraud detection fields
        isSelfReferral: commission.isSelfReferral,
        fraudIndicators: commission.fraudIndicators,
      });
    }

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
    
    // Update commission status to "reversed" and set reversalReason
    await ctx.db.patch(args.commissionId, {
      status: "reversed",
      reversalReason: args.reversalReason,
    });
    
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
    await ctx.db.patch(args.commissionId, {
      status: "approved",
    });
    
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

    // 7. Send commission confirmed email (Story 10.2)
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
            emailType: "commission_confirmed",
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
