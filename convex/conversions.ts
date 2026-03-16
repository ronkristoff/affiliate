import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";

/**
 * Internal: Get tenant by tracking public key
 * Used for conversion tracking endpoint validation
 */
export const getTenantByTrackingKeyInternal = internalQuery({
  args: {
    trackingKey: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("tenants"),
      name: v.string(),
      slug: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_tracking_key", (q) => q.eq("trackingPublicKey", args.trackingKey))
      .first();

    if (!tenant) {
      return null;
    }

    return {
      _id: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
    };
  },
});

/**
 * Internal: Find recent click for attribution chain
 * Looks for clicks within the cookie attribution window (configurable per campaign)
 * Optimized query: Uses time-based filtering with efficient pagination
 */
export const findRecentClickInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    campaignId: v.optional(v.id("campaigns")),
    attributionWindowDays: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      _id: v.id("clicks"),
      referralLinkId: v.id("referralLinks"),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Use campaign-specific window or default to 30 days
    const windowDays = args.attributionWindowDays ?? 30;
    const attributionWindowMs = windowDays * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - attributionWindowMs;

    // Optimized query: Use by_affiliate index with time-based filtering
    // Take only 20 most recent clicks (attribution window is 30 days)
    const clicks = await ctx.db
      .query("clicks")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .order("desc")
      .take(20);

    // Find most recent click within attribution window
    for (const click of clicks) {
      // Early exit if click is outside attribution window (clicks are ordered by time desc)
      if (click._creationTime < cutoffTime) {
        break;
      }
      
      // If campaign specified, match it; otherwise return any click
      if (!args.campaignId || click.campaignId === args.campaignId) {
        return {
          _id: click._id,
          referralLinkId: click.referralLinkId,
        };
      }
    }

    return null;
  },
});

/**
 * Internal: Get referral link by code
 */
export const getReferralLinkByCodeInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    code: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("referralLinks"),
      affiliateId: v.id("affiliates"),
      campaignId: v.optional(v.id("campaigns")),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const referralLink = await ctx.db
      .query("referralLinks")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!referralLink || referralLink.tenantId !== args.tenantId) {
      return null;
    }

    return {
      _id: referralLink._id,
      affiliateId: referralLink.affiliateId,
      campaignId: referralLink.campaignId,
    };
  },
});

/**
 * Internal: Detect self-referral fraud
 * Compares customer data with affiliate's stored data
 * Includes device fingerprint matching per Task 3.1 requirements
 */
export const detectSelfReferralInternal = internalQuery({
  args: {
    affiliateId: v.id("affiliates"),
    customerEmail: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    paymentMethodLastDigits: v.optional(v.string()),
    deviceFingerprint: v.optional(v.string()),
  },
  returns: v.object({
    isSelfReferral: v.boolean(),
    reasons: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      return { isSelfReferral: false, reasons: [] };
    }

    const reasons: string[] = [];

    // Email match check
    if (args.customerEmail && affiliate.email === args.customerEmail.toLowerCase()) {
      reasons.push("email_match");
    }

    // IP address match check
    if (args.ipAddress && affiliate.lastLoginIp === args.ipAddress) {
      reasons.push("ip_match");
    }

    // Payment method last digits match
    if (args.paymentMethodLastDigits && 
        affiliate.payoutMethodLastDigits === args.paymentMethodLastDigits) {
      reasons.push("payment_method_match");
    }

    // Device fingerprint match check (Task 3.1 requirement)
    if (args.deviceFingerprint && 
        affiliate.lastDeviceFingerprint === args.deviceFingerprint) {
      reasons.push("device_fingerprint_match");
    }

    return {
      isSelfReferral: reasons.length > 0,
      reasons,
    };
  },
});

/**
 * Internal: Add fraud signal to affiliate record
 */
export const addFraudSignalInternal = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    signalType: v.string(),
    severity: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    details: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      return null;
    }

    const currentSignals = affiliate.fraudSignals || [];
    const newSignal = {
      type: args.signalType,
      severity: args.severity,
      timestamp: Date.now(),
      details: args.details,
    };

    await ctx.db.patch(affiliate._id, {
      fraudSignals: [...currentSignals, newSignal],
    });

    return null;
  },
});

/**
 * Internal: Create conversion with full attribution chain
 * Handles cookie-based, webhook-based, and organic conversions
 */
export const createConversionWithAttribution = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    referralLinkId: v.optional(v.id("referralLinks")),
    clickId: v.optional(v.id("clicks")),
    campaignId: v.optional(v.id("campaigns")),
    customerEmail: v.optional(v.string()),
    amount: v.number(),
    status: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    deviceFingerprint: v.optional(v.string()),
    paymentMethodLastDigits: v.optional(v.string()),
    paymentMethodProcessorId: v.optional(v.string()),
    attributionSource: v.union(
      v.literal("cookie"),
      v.literal("webhook"),
      v.literal("organic")
    ),
    metadata: v.optional(v.object({
      orderId: v.optional(v.string()),
      products: v.optional(v.array(v.string())),
      subscriptionId: v.optional(v.string()),
      planId: v.optional(v.string()),
      subscriptionStatus: v.optional(v.string()),
      previousPlanId: v.optional(v.string()),
      previousAmount: v.optional(v.number()),
    })),
  },
  returns: v.id("conversions"),
  handler: async (ctx, args) => {
    // Check for self-referral if customer data provided
    let isSelfReferral = false;
    if (args.customerEmail || args.ipAddress || args.paymentMethodLastDigits || args.deviceFingerprint) {
      const selfReferralCheck = await ctx.runQuery(internal.conversions.detectSelfReferralInternal, {
        affiliateId: args.affiliateId,
        customerEmail: args.customerEmail,
        ipAddress: args.ipAddress,
        paymentMethodLastDigits: args.paymentMethodLastDigits,
        deviceFingerprint: args.deviceFingerprint,
      });

      if (selfReferralCheck.isSelfReferral) {
        isSelfReferral = true;

        // Add fraud signal to affiliate record (fire-and-forget)
        ctx.runMutation(internal.conversions.addFraudSignalInternal, {
          affiliateId: args.affiliateId,
          signalType: "self_referral",
          severity: "high",
          details: `Self-referral detected: ${selfReferralCheck.reasons.join(", ")}`,
        }).catch(err => {
          console.error("Failed to add fraud signal:", err);
        });
      }
    }

    // Create conversion record
    const conversionId = await ctx.db.insert("conversions", {
      tenantId: args.tenantId,
      affiliateId: args.affiliateId,
      referralLinkId: args.referralLinkId,
      clickId: args.clickId,
      campaignId: args.campaignId,
      customerEmail: args.customerEmail?.toLowerCase(),
      amount: args.amount,
      status: args.status || "pending",
      ipAddress: args.ipAddress,
      deviceFingerprint: args.deviceFingerprint,
      paymentMethodLastDigits: args.paymentMethodLastDigits,
      paymentMethodProcessorId: args.paymentMethodProcessorId,
      attributionSource: args.attributionSource,
      isSelfReferral,
      metadata: args.metadata,
    });

    // Log to audit trail
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: isSelfReferral ? "conversion_recorded_self_referral" : "conversion_recorded",
      entityType: "conversion",
      entityId: conversionId,
      actorType: "system",
      newValue: {
        affiliateId: args.affiliateId,
        amount: args.amount,
        attributionSource: args.attributionSource,
        isSelfReferral,
        reasons: isSelfReferral ? ["self_referral_detected"] : [],
      },
      metadata: {
        ipAddress: args.ipAddress,
      },
    });

    return conversionId;
  },
});

/**
 * Internal: Create organic conversion (no affiliate attribution)
 * Stores conversions without affiliate credit for analytics
 */
export const createOrganicConversion = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    customerEmail: v.optional(v.string()),
    amount: v.number(),
    status: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    deviceFingerprint: v.optional(v.string()),
    metadata: v.optional(v.object({
      orderId: v.optional(v.string()),
      products: v.optional(v.array(v.string())),
      subscriptionId: v.optional(v.string()),
      planId: v.optional(v.string()),
      subscriptionStatus: v.optional(v.string()),
    })),
  },
  returns: v.id("conversions"),
  handler: async (ctx, args) => {
    // Find or create a system "organic" affiliate for this tenant
    // This affiliate represents organic (non-referred) conversions
    let organicAffiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_code", (q) => 
        q.eq("tenantId", args.tenantId).eq("uniqueCode", "__ORGANIC__")
      )
      .first();

    // Create organic affiliate if it doesn't exist
    if (!organicAffiliate) {
      const organicAffiliateId = await ctx.db.insert("affiliates", {
        tenantId: args.tenantId,
        email: "organic@system.internal",
        name: "Organic Traffic",
        uniqueCode: "__ORGANIC__",
        status: "system", // Special system status
      });
      organicAffiliate = await ctx.db.get(organicAffiliateId);
    }

    if (!organicAffiliate) {
      throw new Error("Failed to create or find organic affiliate");
    }

    // Create conversion record with organic attribution
    const conversionId = await ctx.db.insert("conversions", {
      tenantId: args.tenantId,
      affiliateId: organicAffiliate._id,
      customerEmail: args.customerEmail?.toLowerCase(),
      amount: args.amount,
      status: args.status || "pending",
      ipAddress: args.ipAddress,
      deviceFingerprint: args.deviceFingerprint,
      attributionSource: "organic",
      isSelfReferral: false,
      metadata: args.metadata,
    });

    // Log to audit trail
    await ctx.db.insert("auditLogs", {
      tenantId: args.tenantId,
      action: "organic_conversion_recorded",
      entityType: "conversion",
      entityId: conversionId,
      actorType: "system",
      newValue: {
        amount: args.amount,
        attributionSource: "organic",
      },
      metadata: {
        ipAddress: args.ipAddress,
      },
    });

    return conversionId;
  },
});

/**
 * Internal: Validate cookie attribution window
 * Story 6.4: Cookie-Based Attribution Window
 * Checks if a cookie's timestamp is still within the attribution window
 * Uses campaign's cookieDuration or defaults to 30 days
 */
export const validateCookieAttributionWindow = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    affiliateCode: v.string(),
    campaignId: v.optional(v.id("campaigns")),
    cookieTimestamp: v.number(),
  },
  returns: v.object({
    isValid: v.boolean(),
    isExpired: v.boolean(),
    campaignCookieDuration: v.number(),
    elapsedMs: v.number(),
    elapsedDays: v.number(),
  }),
  handler: async (ctx, args) => {
    const currentTime = Date.now();
    const elapsedMs = currentTime - args.cookieTimestamp;
    const elapsedDays = elapsedMs / (24 * 60 * 60 * 1000);

    // Default 30 days in milliseconds
    const defaultCookieDurationMs = 30 * 24 * 60 * 60 * 1000;
    let campaignCookieDuration = defaultCookieDurationMs;

    // Get campaign's cookie duration if campaign specified
    if (args.campaignId) {
      const campaign = await ctx.db.get(args.campaignId);
      if (campaign?.cookieDuration) {
        // cookieDuration is stored in days in schema, convert to milliseconds for comparison
        campaignCookieDuration = campaign.cookieDuration * 24 * 60 * 60 * 1000;
      }
    }

    // Reject future timestamps (potential tampering) and expired cookies
    const isExpired = elapsedMs > campaignCookieDuration || elapsedMs < 0;

    return {
      isValid: !isExpired,
      isExpired,
      campaignCookieDuration,
      elapsedMs,
      elapsedDays: Math.round(elapsedDays * 100) / 100, // Round to 2 decimal places
    };
  },
});

/**
 * List recent conversions with attribution data for a tenant
 * Used by the AttributionVerifier component
 */
export const listRecentWithAttribution = query({
  args: {
    count: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("conversions"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      affiliateId: v.id("affiliates"),
      referralLinkId: v.optional(v.id("referralLinks")),
      clickId: v.optional(v.id("clicks")),
      amount: v.number(),
      status: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const count = args.count ?? 10;
    
    // Get the current user's tenant
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get user's tenant from users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique();
    
    if (!user) {
      throw new Error("User not found");
    }

    // Query conversions for this tenant, ordered by creation time (descending)
    const conversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => 
        q.eq("tenantId", user.tenantId)
      )
      .order("desc")
      .take(count);

    return conversions;
  },
});

/**
 * Create a new conversion with attribution data
 * Called from webhook processing
 */
export const createConversion = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    referralLinkId: v.optional(v.id("referralLinks")),
    clickId: v.optional(v.id("clicks")),
    customerEmail: v.optional(v.string()),
    amount: v.number(),
    status: v.optional(v.string()),
    metadata: v.optional(v.object({
      orderId: v.optional(v.string()),
      products: v.optional(v.array(v.string())),
    })),
  },
  returns: v.id("conversions"),
  handler: async (ctx, args) => {
    const conversionId = await ctx.db.insert("conversions", {
      ...args,
    });

    return conversionId;
  },
});

/**
 * Find affiliate by unique code (for webhook attribution)
 * Public query for admin use
 */
export const findAffiliateByCode = query({
  args: {
    tenantId: v.id("tenants"),
    code: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_code", (q) => 
        q.eq("tenantId", args.tenantId).eq("uniqueCode", args.code)
      )
      .unique();

    return affiliate ?? null;
  },
});

/**
 * Internal version for webhook processing
 */
export const findAffiliateByCodeInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    code: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_code", (q) => 
        q.eq("tenantId", args.tenantId).eq("uniqueCode", args.code)
      )
      .unique();

    return affiliate ?? null;
  },
});

/**
 * Update conversion status (e.g., when payment completes or refunds)
 */
export const updateConversionStatus = mutation({
  args: {
    conversionId: v.id("conversions"),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("refunded")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Verify user has access to this conversion's tenant
    const conversion = await ctx.db.get(args.conversionId);
    if (!conversion) {
      throw new Error("Conversion not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique();

    if (!user || user.tenantId !== conversion.tenantId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.conversionId, { status: args.status });
    return null;
  },
});

/**
 * Get conversion statistics for a tenant
 */
export const getConversionStats = query({
  args: {},
  returns: v.object({
    totalConversions: v.number(),
    totalAmount: v.number(),
    attributedConversions: v.number(),
    organicConversions: v.number(),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    // Get conversions for this tenant with a reasonable limit to avoid memory issues
    // For accurate stats with large datasets, consider adding aggregation indices
    const conversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))
      .take(1000); // Limit to 1000 most recent for performance

    const totalConversions = conversions.length;
    const totalAmount = conversions.reduce((sum, c) => sum + c.amount, 0);
    const attributedConversions = conversions.filter(c => c.affiliateId !== undefined).length;
    const organicConversions = totalConversions - attributedConversions;

    return {
      totalConversions,
      totalAmount,
      attributedConversions,
      organicConversions,
    };
  },
});

/**
 * Query: Get conversions by affiliate with pagination
 * Task 5.1: Dashboard conversion queries for affiliate view
 */
export const getConversionsByAffiliate = query({
  args: {
    affiliateId: v.id("affiliates"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.union(v.literal("pending"), v.literal("completed"), v.literal("refunded"))),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("conversions"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      affiliateId: v.id("affiliates"),
      referralLinkId: v.optional(v.id("referralLinks")),
      clickId: v.optional(v.id("clicks")),
      campaignId: v.optional(v.id("campaigns")),
      customerEmail: v.optional(v.string()),
      amount: v.number(),
      status: v.optional(v.string()),
      attributionSource: v.optional(v.string()),
      isSelfReferral: v.optional(v.boolean()),
      metadata: v.optional(v.any()),
    })),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Use the by_affiliate index for efficient querying
    let query = ctx.db
      .query("conversions")
      .withIndex("by_affiliate", (q) => 
        q.eq("affiliateId", args.affiliateId)
      );

    const result = await query.order("desc").paginate(args.paginationOpts);

    // Apply status filtering if provided
    let filteredPage = result.page;
    if (args.status) {
      filteredPage = filteredPage.filter(conv => conv.status === args.status);
    }

    // Apply date range filtering if provided
    if (args.startDate || args.endDate) {
      filteredPage = filteredPage.filter(conv => {
        const timestamp = conv._creationTime;
        if (args.startDate && timestamp < args.startDate) return false;
        if (args.endDate && timestamp > args.endDate) return false;
        return true;
      });
    }

    return {
      page: filteredPage,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Query: Get conversions by tenant with date filtering
 * Task 5.2: Dashboard conversion queries for tenant owner
 */
export const getConversionsByTenant = query({
  args: {
    tenantId: v.id("tenants"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.union(v.literal("pending"), v.literal("completed"), v.literal("refunded"))),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    affiliateId: v.optional(v.id("affiliates")),
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("conversions"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      affiliateId: v.id("affiliates"),
      affiliateName: v.optional(v.string()),
      referralLinkId: v.optional(v.id("referralLinks")),
      clickId: v.optional(v.id("clicks")),
      campaignId: v.optional(v.id("campaigns")),
      campaignName: v.optional(v.string()),
      customerEmail: v.optional(v.string()),
      amount: v.number(),
      status: v.optional(v.string()),
      attributionSource: v.optional(v.string()),
      isSelfReferral: v.optional(v.boolean()),
      metadata: v.optional(v.any()),
    })),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Use the by_tenant index for efficient querying
    let query = ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => 
        q.eq("tenantId", args.tenantId)
      );

    const result = await query.order("desc").paginate(args.paginationOpts);

    // Apply status filtering if provided
    let filteredPage = result.page;
    if (args.status) {
      filteredPage = filteredPage.filter(conv => conv.status === args.status);
    }

    // Apply date range filtering if provided
    if (args.startDate || args.endDate) {
      filteredPage = filteredPage.filter(conv => {
        const timestamp = conv._creationTime;
        if (args.startDate && timestamp < args.startDate) return false;
        if (args.endDate && timestamp > args.endDate) return false;
        return true;
      });
    }

    // Apply affiliate filtering if provided
    if (args.affiliateId) {
      filteredPage = filteredPage.filter(conv => 
        conv.affiliateId === args.affiliateId
      );
    }

    // Enrich with affiliate and campaign names (batch fetch to avoid N+1)
    const affiliateIds = [...new Set(filteredPage.map(c => c.affiliateId))];
    const affiliateMap: Record<string, { name: string }> = {};
    for (const id of affiliateIds) {
      const affiliate = await ctx.db.get(id);
      if (affiliate) {
        affiliateMap[id] = { name: affiliate.name };
      }
    }

    const campaignIds = [...new Set(
      filteredPage
        .map(c => c.campaignId)
        .filter((id): id is Id<"campaigns"> => !!id)
    )];
    const campaignMap: Record<string, { name: string }> = {};
    for (const id of campaignIds) {
      const campaign = await ctx.db.get(id);
      if (campaign) {
        campaignMap[id] = { name: campaign.name };
      }
    }

    const enrichedPage = filteredPage.map(conv => ({
      ...conv,
      affiliateName: affiliateMap[conv.affiliateId]?.name,
      campaignName: conv.campaignId ? campaignMap[conv.campaignId]?.name : undefined,
    }));

    return {
      page: enrichedPage,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

/**
 * Query: Get conversion statistics with filters
 * Task 5.3: Aggregate statistics for dashboard
 */
export const getConversionStatsByTenant = query({
  args: {
    tenantId: v.id("tenants"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    affiliateId: v.optional(v.id("affiliates")),
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.object({
    totalConversions: v.number(),
    totalAmount: v.number(),
    pendingConversions: v.number(),
    completedConversions: v.number(),
    refundedConversions: v.number(),
    attributedConversions: v.number(),
    organicConversions: v.number(),
    selfReferralCount: v.number(),
    byAttributionSource: v.record(v.string(), v.number()),
    topAffiliates: v.array(v.object({
      affiliateId: v.id("affiliates"),
      affiliateName: v.string(),
      count: v.number(),
      amount: v.number(),
    })),
    topCampaigns: v.array(v.object({
      campaignId: v.id("campaigns"),
      campaignName: v.string(),
      count: v.number(),
      amount: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    // Get conversions based on provided filters
    let conversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Apply date range filtering if provided
    if (args.startDate || args.endDate) {
      conversions = conversions.filter(conv => {
        const timestamp = conv._creationTime;
        if (args.startDate && timestamp < args.startDate) return false;
        if (args.endDate && timestamp > args.endDate) return false;
        return true;
      });
    }

    // Apply affiliate filtering if provided
    if (args.affiliateId) {
      conversions = conversions.filter(conv => 
        conv.affiliateId === args.affiliateId
      );
    }

    // Apply campaign filtering if provided
    if (args.campaignId) {
      conversions = conversions.filter(conv => 
        conv.campaignId === args.campaignId
      );
    }

    // Calculate statistics
    const totalConversions = conversions.length;
    const totalAmount = conversions.reduce((sum, c) => sum + c.amount, 0);
    const pendingConversions = conversions.filter(c => c.status === "pending").length;
    const completedConversions = conversions.filter(c => c.status === "completed").length;
    const refundedConversions = conversions.filter(c => c.status === "refunded").length;
    const attributedConversions = conversions.filter(c => 
      c.attributionSource === "cookie" || c.attributionSource === "webhook"
    ).length;
    const organicConversions = conversions.filter(c => 
      c.attributionSource === "organic" || !c.attributionSource
    ).length;
    const selfReferralCount = conversions.filter(c => c.isSelfReferral).length;

    // By attribution source
    const byAttributionSource: Record<string, number> = {};
    conversions.forEach(c => {
      const source = c.attributionSource || "none";
      byAttributionSource[source] = (byAttributionSource[source] || 0) + 1;
    });

    // Top affiliates
    const affiliateStats: Record<string, { name: string; count: number; amount: number }> = {};
    conversions.forEach(conv => {
      const aid = conv.affiliateId;
      if (!affiliateStats[aid]) {
        affiliateStats[aid] = { name: "", count: 0, amount: 0 };
      }
      affiliateStats[aid].count++;
      affiliateStats[aid].amount += conv.amount;
    });

    // Batch fetch affiliate names
    for (const aid of Object.keys(affiliateStats)) {
      const affiliate = await ctx.db.get(aid as Id<"affiliates">);
      if (affiliate) {
        affiliateStats[aid].name = affiliate.name;
      }
    }

    const topAffiliates = Object.entries(affiliateStats)
      .map(([affiliateId, stats]) => ({
        affiliateId: affiliateId as Id<"affiliates">,
        affiliateName: stats.name,
        count: stats.count,
        amount: stats.amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Top campaigns
    const campaignStats: Record<string, { name: string; count: number; amount: number }> = {};
    conversions.forEach(conv => {
      if (conv.campaignId) {
        const cid = conv.campaignId;
        if (!campaignStats[cid]) {
          campaignStats[cid] = { name: "", count: 0, amount: 0 };
        }
        campaignStats[cid].count++;
        campaignStats[cid].amount += conv.amount;
      }
    });

    // Batch fetch campaign names
    for (const cid of Object.keys(campaignStats)) {
      const campaign = await ctx.db.get(cid as Id<"campaigns">);
      if (campaign) {
        campaignStats[cid].name = campaign.name;
      }
    }

    const topCampaigns = Object.entries(campaignStats)
      .map(([campaignId, stats]) => ({
        campaignId: campaignId as Id<"campaigns">,
        campaignName: stats.name,
        count: stats.count,
        amount: stats.amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return {
      totalConversions,
      totalAmount,
      pendingConversions,
      completedConversions,
      refundedConversions,
      attributedConversions,
      organicConversions,
      selfReferralCount,
      byAttributionSource,
      topAffiliates,
      topCampaigns,
    };
  },
});

/**
 * Internal: Find conversion by subscription ID
 * Used by subscription lifecycle event processing to detect upgrades/downgrades
 */
export const findConversionBySubscriptionIdInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    subscriptionId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("conversions"),
      amount: v.number(),
      metadata: v.optional(v.object({
        orderId: v.optional(v.string()),
        products: v.optional(v.array(v.string())),
        subscriptionId: v.optional(v.string()),
        planId: v.optional(v.string()),
        subscriptionStatus: v.optional(v.string()),
        previousPlanId: v.optional(v.string()),
        previousAmount: v.optional(v.number()),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Query conversions by tenant and filter for matching subscriptionId in metadata
    const conversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    
    // Find conversion with matching subscriptionId
    for (const conversion of conversions) {
      if (conversion.metadata?.subscriptionId === args.subscriptionId) {
        return {
          _id: conversion._id,
          amount: conversion.amount,
          metadata: conversion.metadata,
        };
      }
    }
    
    return null;
  },
});

/**
 * Internal: Update conversion subscription status
 * Used by subscription.cancelled event processing
 */
export const updateConversionSubscriptionStatusInternal = internalMutation({
  args: {
    conversionId: v.id("conversions"),
    subscriptionStatus: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const conversion = await ctx.db.get(args.conversionId);
    
    if (!conversion) {
      return null;
    }
    
    // Update the subscription status in metadata
    await ctx.db.patch(args.conversionId, {
      metadata: {
        ...conversion.metadata,
        subscriptionStatus: args.subscriptionStatus,
      },
    });
    
    return null;
  },
});
