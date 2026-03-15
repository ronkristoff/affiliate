import { mutation, internalMutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthenticatedUser } from "./tenantContext";
import { internal } from "./_generated/api";

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
export const getAffiliateCommissions = query({
  args: {
    affiliateId: v.id("affiliates"),
    limit: v.optional(v.number()),
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

    // Verify affiliate belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      return [];
    }

    // Query commissions for this affiliate
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .order("desc")
      .take(args.limit ?? 10);

    // Populate campaign names
    const commissionsWithCampaigns = [];
    for (const commission of commissions) {
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
