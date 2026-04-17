import { query, internalQuery } from "./_generated/server";
import { mutation, internalMutation } from "./triggers";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";
import { conversionsAggregate, clicksAggregate, commissionsAggregate } from "./aggregates";
import { onOrganicConversionCreated, incrementTotalConversions } from "./tenantStats";
import { normalizeEmail } from "./emailNormalization";
import { requireWriteAccess } from "./tenantContext";

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
      affiliateId: v.optional(v.id("affiliates")),
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
 * Compares customer data with affiliate's stored data.
 * Includes device fingerprint matching per Task 3.1 requirements.
 *
 * NOTE: This is a simplified pre-creation check used before a conversion is created.
 * For the full weighted-scoring version (with IP subnet matching and threshold calibration),
 * see fraudDetection.ts → detectSelfReferral. That version runs post-creation via conversionId.
 *
 * Both functions are intentionally separate because:
 * - This one runs BEFORE conversion creation (no conversionId available yet)
 * - The fraudDetection version runs AFTER conversion creation (requires conversionId)
 * Consolidating them would require changing the creation flow, which is out of scope.
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
      v.literal("organic"),
      v.literal("body"),
      v.literal("coupon"),
      v.literal("lead_email")
    ),
    couponCode: v.optional(v.string()), // First-class coupon code field for reporting
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
    // Normalize customer email for consistent storage and lead matching
    const normalizedCustomerEmail = args.customerEmail
      ? normalizeEmail(args.customerEmail)
      : undefined;

    // Check for self-referral if customer data provided
    let isSelfReferral = false;
    if (normalizedCustomerEmail || args.ipAddress || args.paymentMethodLastDigits || args.deviceFingerprint) {
      const selfReferralCheck = await ctx.runQuery(internal.conversions.detectSelfReferralInternal, {
        affiliateId: args.affiliateId,
        customerEmail: normalizedCustomerEmail,
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
      customerEmail: normalizedCustomerEmail,
      amount: args.amount,
      status: args.status || "pending",
      ipAddress: args.ipAddress,
      deviceFingerprint: args.deviceFingerprint,
      paymentMethodLastDigits: args.paymentMethodLastDigits,
      paymentMethodProcessorId: args.paymentMethodProcessorId,
      attributionSource: args.attributionSource,
      couponCode: args.couponCode,
      isSelfReferral,
      metadata: args.metadata,
    });

    // Auto-capture: Create/update referralLead when conversion has email + attribution
    // This locks attribution in the database for future cross-device purchases
    if (normalizedCustomerEmail) {
      if (args.referralLinkId || args.attributionSource === "coupon") {
        // Lead can be created with or without referralLinkId
        // Coupon-only conversions have no referral link but still need a lead
        ctx.runMutation(internal.referralLeads.createOrUpdateLead, {
          tenantId: args.tenantId,
          email: normalizedCustomerEmail,
          affiliateId: args.affiliateId,
          referralLinkId: args.referralLinkId ?? undefined,
          campaignId: args.campaignId,
          clickId: args.clickId,
        }).catch((err) => {
          console.error("[Auto-Capture] Failed to create/update lead:", err);
        });
      }
    } else if (args.affiliateId) {
      console.warn("[Auto-Capture] Attributed conversion missing customerEmail. Lead not captured. Email is required for future cross-device attribution.");
    }

    // Log to audit trail (non-fatal — conversion must succeed regardless)
    try {
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
    } catch (err) {
      console.error("[Audit] Failed to log conversion_recorded (non-fatal):", err);
    }

    // Send new referral alert email to SaaS Owner (if not self-referral)
    if (!isSelfReferral) {
      // Get owner email for notification
      const ownerUser = await ctx.runQuery(internal.users.getOwnerByTenantInternal, {
        tenantId: args.tenantId,
      });
      
      // Get affiliate and campaign details
      const affiliate = await ctx.db.get(args.affiliateId);
      const campaign = args.campaignId ? await ctx.db.get(args.campaignId) : null;
      const tenant = await ctx.db.get(args.tenantId);
      
      // Calculate commission amount based on campaign structure
      let commissionAmount = 0;
      if (campaign) {
        if (campaign.commissionType === "percentage") {
          commissionAmount = args.amount * (campaign.commissionValue / 100);
        } else {
          commissionAmount = campaign.commissionValue; // flat_fee
        }
      }
      
      // Schedule email (non-blocking) if owner found
      if (ownerUser && affiliate && tenant) {
        const portalName = tenant.branding?.portalName || tenant.name || "Your Portal";
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.boboddy.business";
        
        ctx.scheduler.runAfter(0, internal.emails.sendNewReferralAlertEmail, {
          tenantId: args.tenantId,
          conversionId,
          affiliateId: args.affiliateId,
          ownerEmail: ownerUser.email,
          ownerName: ownerUser.name,
          affiliateName: affiliate.name,
          affiliateEmail: affiliate.email,
          conversionAmount: args.amount,
          commissionAmount,
          customerEmail: normalizedCustomerEmail,
          campaignName: campaign?.name,
          portalName,
          brandLogoUrl: tenant.branding?.logoUrl,
          brandPrimaryColor: tenant.branding?.primaryColor,
          conversionTimestamp: Date.now(),
          dashboardAffiliateUrl: `${appUrl}/affiliates/${args.affiliateId}`,
          dashboardConversionUrl: `${appUrl}/conversions/${conversionId}`,
        }).catch(async (err) => {
          // Log to audit trail but don't fail the conversion if email fails
          const errorMessage = err instanceof Error ? err.message : String(err);
          await ctx.db.insert("auditLogs", {
            tenantId: args.tenantId,
            action: "email_scheduling_failed",
            entityType: "conversion",
            entityId: conversionId,
            actorType: "system",
            newValue: {
              emailType: "new_referral_alert",
              error: errorMessage,
              recipientEmail: ownerUser.email,
            },
          });
        });
      }
    }

    return conversionId;
  },
});

/**
 * Internal: Create organic conversion (no affiliate attribution)
 * Stores conversions without affiliate credit for analytics.
 * No fake affiliate record is created — affiliateId is simply omitted.
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
    // Create conversion record without an affiliate — organic traffic
    const conversionId = await ctx.db.insert("conversions", {
      tenantId: args.tenantId,
      customerEmail: args.customerEmail?.toLowerCase(),
      amount: args.amount,
      status: args.status || "pending",
      ipAddress: args.ipAddress,
      deviceFingerprint: args.deviceFingerprint,
      attributionSource: "organic",
      isSelfReferral: false,
      metadata: args.metadata,
    });

    // Increment organic + total conversion counters
    await onOrganicConversionCreated(ctx, args.tenantId);

    // Log to audit trail (non-fatal — organic conversion must succeed regardless)
    try {
      await ctx.runMutation(internal.audit.logAuditEventInternal, {
        tenantId: args.tenantId,
        action: "ORGANIC_CONVERSION_CREATED",
        entityType: "conversion",
        entityId: conversionId,
        actorType: "system",
        newValue: {
          amount: args.amount,
          attributionSource: "organic",
        },
        metadata: {
          ipAddress: args.ipAddress,
          customerEmail: args.customerEmail,
        },
      });
    } catch (err) {
      console.error("[Audit] Failed to log ORGANIC_CONVERSION_CREATED (non-fatal):", err);
    }

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
 * Internal: Validate click attribution window
 * Story 10.0: Tenant Domain Rework
 * Checks if a specific click exists and is still within the attribution window
 * Used for body-based attribution from track.js
 */
export const validateClickAttributionWindow = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    clickId: v.id("clicks"),
  },
  returns: v.object({
    valid: v.boolean(),
    reason: v.optional(v.string()),
    elapsedDays: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    // Get the click record
    const click = await ctx.db.get(args.clickId);

    if (!click) {
      return {
        valid: false,
        reason: "click_not_found",
      };
    }

    // Verify click belongs to this tenant
    if (click.tenantId !== args.tenantId) {
      return {
        valid: false,
        reason: "tenant_mismatch",
      };
    }

    // Calculate elapsed time
    const currentTime = Date.now();
    const elapsedMs = currentTime - click._creationTime;
    const elapsedDays = elapsedMs / (24 * 60 * 60 * 1000);

    // Default 30 days in milliseconds
    const defaultCookieDurationMs = 30 * 24 * 60 * 60 * 1000;
    let attributionWindowMs = defaultCookieDurationMs;

    // Get campaign's cookie duration if click has campaign
    if (click.campaignId) {
      const campaign = await ctx.db.get(click.campaignId);
      if (campaign?.cookieDuration) {
        attributionWindowMs = campaign.cookieDuration * 24 * 60 * 60 * 1000;
      }
    }

    // Check if click is within attribution window
    if (elapsedMs > attributionWindowMs) {
      return {
        valid: false,
        reason: "click_expired",
        elapsedDays: Math.round(elapsedDays * 100) / 100,
      };
    }

    return {
      valid: true,
      elapsedDays: Math.round(elapsedDays * 100) / 100,
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
      affiliateId: v.optional(v.id("affiliates")),
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
      return [];
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

    // Increment total conversion counter (fixes pre-existing bug)
    await incrementTotalConversions(ctx, args.tenantId);

    // Log legacy conversion creation to audit trail (non-fatal)
    try {
      await ctx.runMutation(internal.audit.logAuditEventInternal, {
        tenantId: args.tenantId,
        action: "conversion_created_legacy",
        entityType: "conversion",
        entityId: conversionId,
        actorType: "system",
        metadata: {
          affiliateId: args.affiliateId,
          amount: args.amount,
        },
      });
    } catch (err) {
      console.error("[Audit] Failed to log legacy conversion creation (non-fatal):", err);
    }

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
      _creationTime: v.number(),
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
      _creationTime: v.number(),
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

    await requireWriteAccess(ctx);

    // Log conversion status change to audit trail (non-fatal)
    try {
      await ctx.runMutation(internal.audit.logAuditEventInternal, {
        tenantId: conversion.tenantId,
        action: "conversion_status_changed",
        entityType: "conversion",
        entityId: args.conversionId,
        actorId: user._id,
        actorType: "user",
        previousValue: { status: conversion.status },
        newValue: { status: args.status },
      });
    } catch (err) {
      console.error("[Audit] Failed to log conversion status change (non-fatal):", err);
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
      return {
        totalConversions: 0,
        totalAmount: 0,
        attributedConversions: 0,
        organicConversions: 0,
      };
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
      affiliateId: v.optional(v.id("affiliates")),
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
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || !("tenantId" in affiliate)) {
      throw new Error("Affiliate not found");
    }
    const tenantId = (affiliate as { tenantId: Id<"tenants"> }).tenantId;

    // Use O(log n) aggregate pagination — no silent truncation, correct isDone.
    const numItems = args.paginationOpts.numItems ?? 20;
    const cursor = args.paginationOpts.cursor;

    // Paginate through all tenant conversions, then filter by affiliateId in-memory.
    // This is correct because the aggregate covers all conversions for the namespace (tenantId).
    const aggResult = await conversionsAggregate.paginate(ctx, {
      namespace: tenantId,
      pageSize: numItems + 50, // overscan for post-filter by affiliateId
      cursor: cursor ?? undefined,
      order: "desc",
    });

    // Collect full pages until we have enough matching items or exhaust the namespace
    // Note: item.id is Id<"conversions">, so we must resolve docs to check affiliateId
    let allItems = aggResult.page;
    let nextCursor = aggResult.isDone ? undefined : aggResult.cursor;
    let lastAggCursor = aggResult.cursor;

    const resolveAndFilter = async (items: typeof allItems) => {
      const docs = await Promise.all(
        items.map((item: any) => ctx.db.get(item.id as Id<"conversions">))
      );
      return docs.filter((doc): doc is NonNullable<typeof doc> =>
        doc !== null && doc.affiliateId === args.affiliateId
      );
    };

    let filtered = await resolveAndFilter(allItems);

    // Keep fetching pages until we have numItems matches or run out
    while (filtered.length < numItems && nextCursor) {
      const moreResult = await conversionsAggregate.paginate(ctx, {
        namespace: tenantId,
        pageSize: numItems + 50,
        cursor: nextCursor,
        order: "desc",
      });
      allItems = moreResult.page;
      nextCursor = moreResult.isDone ? undefined : moreResult.cursor;
      lastAggCursor = moreResult.cursor;
      const moreFiltered = await resolveAndFilter(allItems);
      filtered.push(...moreFiltered);
    }

    // Apply status filter
    let page = filtered.slice(0, numItems);
    if (args.status) {
      page = page.filter(conv => conv.status === args.status);
    }

    // Apply date range filter
    if (args.startDate || args.endDate) {
      page = page.filter(conv => {
        const timestamp = conv._creationTime;
        if (args.startDate && timestamp < args.startDate) return false;
        if (args.endDate && timestamp > args.endDate) return false;
        return true;
      });
    }

    const isDone = !nextCursor || filtered.length <= numItems;

    return {
      page,
      continueCursor: lastAggCursor,
      pageStatus: undefined,
      splitCursor: undefined,
      isDone,
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
      affiliateId: v.optional(v.id("affiliates")),
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
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Use O(log n) aggregate pagination — no silent truncation.
    const numItems = args.paginationOpts.numItems ?? 20;
    const cursor = args.paginationOpts.cursor;

    const aggResult = await conversionsAggregate.paginate(ctx, {
      namespace: args.tenantId,
      pageSize: numItems + 50,
      cursor: cursor ?? undefined,
      order: "desc",
    });

    // Resolve conversion documents from aggregate IDs
    const convDocs = await Promise.all(
      aggResult.page.map((item: any) => ctx.db.get(item.id as Id<"conversions">))
    );
    let page = convDocs.filter((doc): doc is NonNullable<typeof doc> => doc !== null);

    // Apply status filtering
    if (args.status) {
      page = page.filter(conv => conv.status === args.status);
    }

    // Apply date range filtering
    if (args.startDate || args.endDate) {
      page = page.filter(conv => {
        const timestamp = conv._creationTime;
        if (args.startDate && timestamp < args.startDate) return false;
        if (args.endDate && timestamp > args.endDate) return false;
        return true;
      });
    }

    // Apply affiliate filtering
    if (args.affiliateId) {
      page = page.filter(conv => conv.affiliateId === args.affiliateId);
    }

    const isDone = aggResult.isDone;
    const continueCursor = aggResult.cursor;

    // Enrich with affiliate and campaign names (batch fetch to avoid N+1)
    const affiliateIds = [...new Set(page.map(c => c.affiliateId).filter((id): id is Id<"affiliates"> => !!id))];
    const affiliateMap: Record<string, { name: string }> = {};
    for (const id of affiliateIds) {
      const affiliate = await ctx.db.get(id);
      if (affiliate && "name" in affiliate) {
        affiliateMap[id] = { name: affiliate.name as string };
      }
    }

    const campaignIds = [...new Set(
      page
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

    const enrichedPage = page.map(conv => ({
      ...conv,
      affiliateName: conv.affiliateId ? affiliateMap[conv.affiliateId]?.name : undefined,
      campaignName: conv.campaignId ? campaignMap[conv.campaignId]?.name : undefined,
    }));

    return {
      page: enrichedPage,
      continueCursor,
      pageStatus: undefined,
      splitCursor: undefined,
      isDone,
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
      affiliateId: v.optional(v.id("affiliates")),
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
    // Use O(log n) aggregate count for totalConversions — accurate regardless of dataset size.
    const totalConversions = await conversionsAggregate.count(ctx, { namespace: args.tenantId });

    // NOTE: Breakdown stats below are computed from the most recent 500 conversions.
    // For tenants with >500 conversions, breakdown counts may undercount.
    // totalConversions is always accurate. Use tenantStats denormalized counters
    // for precise dashboard totals when available.
    let filteredConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .take(500);

    // Apply date range filtering if provided
    if (args.startDate || args.endDate) {
      filteredConversions = filteredConversions.filter(conv => {
        const timestamp = conv._creationTime;
        if (args.startDate && timestamp < args.startDate) return false;
        if (args.endDate && timestamp > args.endDate) return false;
        return true;
      });
    }

    // Apply affiliate filtering if provided
    if (args.affiliateId) {
      filteredConversions = filteredConversions.filter(conv => 
        conv.affiliateId === args.affiliateId
      );
    }

    // Apply campaign filtering if provided
    if (args.campaignId) {
      filteredConversions = filteredConversions.filter(conv => 
        conv.campaignId === args.campaignId
      );
    }

    // Calculate statistics from filtered set
    const totalAmount = filteredConversions.reduce((sum, c) => sum + c.amount, 0);
    const pendingConversions = filteredConversions.filter(c => c.status === "pending").length;
    const completedConversions = filteredConversions.filter(c => c.status === "completed").length;
    const refundedConversions = filteredConversions.filter(c => c.status === "refunded").length;
    const attributedConversions = filteredConversions.filter(c => 
      c.attributionSource === "cookie" || c.attributionSource === "webhook"
    ).length;
    const organicConversions = filteredConversions.filter(c => 
      c.attributionSource === "organic" || !c.attributionSource
    ).length;
    const selfReferralCount = filteredConversions.filter(c => c.isSelfReferral).length;

    // By attribution source
    const byAttributionSource: Record<string, number> = {};
    filteredConversions.forEach(c => {
      const source = c.attributionSource || "none";
      byAttributionSource[source] = (byAttributionSource[source] || 0) + 1;
    });

    // Top affiliates
    const affiliateStats: Record<string, { name: string; count: number; amount: number }> = {};
    filteredConversions.forEach(conv => {
      const aid = conv.affiliateId;
      if (!aid) return;
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
    filteredConversions.forEach(conv => {
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
    // Scan conversions by tenant using aggregate pagination to find matching subscriptionId.
    // This avoids the .take(500) silent truncation — we paginate until found or exhausted.
    const pageSize = 200;
    let cursor: string | undefined;
    let done = false;

    while (!done) {
      const aggResult = await conversionsAggregate.paginate(ctx, {
        namespace: args.tenantId,
        pageSize,
        cursor,
        order: "desc",
      });

      // Resolve documents and check for matching subscriptionId
      const docs = await Promise.all(
        aggResult.page.map((item: any) => ctx.db.get(item.id as Id<"conversions">))
      );

      for (const conversion of docs) {
        if (conversion && conversion.metadata?.subscriptionId === args.subscriptionId) {
          return {
            _id: conversion._id,
            amount: conversion.amount,
            metadata: conversion.metadata,
          };
        }
      }

      cursor = aggResult.isDone ? undefined : aggResult.cursor;
      done = !cursor;
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
    trigger: v.optional(v.string()),
    planId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const conversion = await ctx.db.get(args.conversionId);
    
    if (!conversion) {
      return null;
    }

    const oldSubscriptionStatus = conversion.metadata?.subscriptionStatus ?? null;

    // Update the subscription status in metadata
    await ctx.db.patch(args.conversionId, {
      metadata: {
        ...conversion.metadata,
        subscriptionStatus: args.subscriptionStatus,
      },
    });

    // Log subscription status change to audit trail (non-fatal)
    try {
      await ctx.runMutation(internal.audit.logAuditEventInternal, {
        tenantId: conversion.tenantId,
        action: "conversion_subscription_status_changed",
        entityType: "conversion",
        entityId: args.conversionId,
        actorType: "system",
        previousValue: { subscriptionStatus: oldSubscriptionStatus },
        newValue: { subscriptionStatus: args.subscriptionStatus },
        metadata: {
          conversionId: args.conversionId,
          trigger: args.trigger ?? "unknown",
          planId: args.planId ?? null,
        },
      });
    } catch (err) {
      console.error("[Audit] Failed to log subscription status change (non-fatal):", err);
    }
    
    return null;
  },
});

/**
 * Query: Get organic conversions for a tenant (no affiliate attribution).
 * Uses .take() with overscan instead of .paginate() because post-filter
 * after pagination is broken (cursor advances past filtered-out documents).
 */
export const getOrganicConversions = query({
  args: {
    tenantId: v.id("tenants"),
    limit: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("conversions"),
    _creationTime: v.number(),
    tenantId: v.id("tenants"),
    affiliateId: v.optional(v.id("affiliates")),
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
    attributionSource: v.optional(v.string()),
    isSelfReferral: v.optional(v.boolean()),
    metadata: v.optional(v.any()),
  })),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);

    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", q => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(limit * 5); // Overscan to account for attributed conversions being filtered out

    const organic = allConversions
      .filter(c => !c.affiliateId || c.attributionSource === "organic")
      .filter(c => {
        if (args.startDate && c._creationTime < args.startDate) return false;
        if (args.endDate && c._creationTime > args.endDate) return false;
        return true;
      });

    return organic.slice(0, limit);
  },
});
