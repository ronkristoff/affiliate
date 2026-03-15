import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Self-Referral Detection Functions
 * 
 * Provides detection logic to identify when an affiliate attempts to earn
 * commissions on their own purchases (self-referral fraud).
 * Used by Story 5.6 (Self-Referral Detection).
 */

/**
 * Helper function to check if two IP addresses are in the same /24 subnet.
 */
function isSameSubnet(ip1: string, ip2: string, subnetMask: number = 24): boolean {
  if (!ip1 || !ip2) return false;
  
  const parts1 = ip1.split(".").map(Number);
  const parts2 = ip2.split(".").map(Number);
  
  if (parts1.length !== 4 || parts2.length !== 4) return false;
  
  // Convert IPs to numbers
  const num1 = (parts1[0] << 24) + (parts1[1] << 16) + (parts1[2] << 8) + parts1[3];
  const num2 = (parts2[0] << 24) + (parts2[1] << 16) + (parts2[2] << 8) + parts2[3];
  
  // Create subnet mask
  const mask = ~((1 << (32 - subnetMask)) - 1);
  
  return (num1 & mask) === (num2 & mask);
}

/**
 * Detect self-referral by comparing affiliate data with customer/conversion data.
 * Compares email (case-insensitive), IP address (exact or /24 subnet match),
 * device fingerprint (exact match), and payment method (last 4 digits or processor ID).
 * 
 * @returns { isSelfReferral: boolean, matchedIndicators: string[] }
 */
export const detectSelfReferral = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    conversionId: v.id("conversions"),
    affiliateId: v.id("affiliates"),
  },
  returns: v.object({
    isSelfReferral: v.boolean(),
    matchedIndicators: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const matchedIndicators: string[] = [];

    // 1. Fetch conversion data
    const conversion = await ctx.db.get(args.conversionId);
    if (!conversion) {
      console.log("Self-referral detection: Conversion not found");
      return { isSelfReferral: false, matchedIndicators: [] };
    }

    // Verify conversion belongs to the same tenant
    if (conversion.tenantId !== args.tenantId) {
      console.log("Self-referral detection: Conversion tenant mismatch");
      return { isSelfReferral: false, matchedIndicators: [] };
    }

    // 2. Fetch affiliate data
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      console.log("Self-referral detection: Affiliate not found");
      return { isSelfReferral: false, matchedIndicators: [] };
    }

    // Verify affiliate belongs to the same tenant
    if (affiliate.tenantId !== args.tenantId) {
      console.log("Self-referral detection: Affiliate tenant mismatch");
      return { isSelfReferral: false, matchedIndicators: [] };
    }

    // 3. Compare email (case-insensitive)
    if (conversion.customerEmail && affiliate.email) {
      if (conversion.customerEmail.toLowerCase() === affiliate.email.toLowerCase()) {
        matchedIndicators.push("email_match");
      }
    }

    // 4. Compare IP address (exact or /24 subnet match)
    if (conversion.ipAddress && affiliate.lastLoginIp) {
      // Exact match
      if (conversion.ipAddress === affiliate.lastLoginIp) {
        matchedIndicators.push("ip_match");
      }
      // /24 subnet match
      else if (isSameSubnet(conversion.ipAddress, affiliate.lastLoginIp, 24)) {
        matchedIndicators.push("ip_subnet_match");
      }
    }

    // 5. Compare device fingerprint (exact match)
    if (conversion.deviceFingerprint && affiliate.lastDeviceFingerprint) {
      if (conversion.deviceFingerprint === affiliate.lastDeviceFingerprint) {
        matchedIndicators.push("device_match");
      }
    }

    // 6. Compare payment method (last 4 digits or processor ID)
    if (conversion.paymentMethodLastDigits && affiliate.payoutMethodLastDigits) {
      if (conversion.paymentMethodLastDigits === affiliate.payoutMethodLastDigits) {
        matchedIndicators.push("payment_method_match");
      }
    }

    if (conversion.paymentMethodProcessorId && affiliate.payoutMethodProcessorId) {
      if (conversion.paymentMethodProcessorId === affiliate.payoutMethodProcessorId) {
        matchedIndicators.push("payment_processor_match");
      }
    }

    // Threshold: Any 1+ match = self-referral detected
    const isSelfReferral = matchedIndicators.length >= 1;

    console.log(`Self-referral detection result: isSelfReferral=${isSelfReferral}, indicators=${JSON.stringify(matchedIndicators)}`);

    return { isSelfReferral, matchedIndicators };
  },
});

/**
 * Internal mutation to add a fraud signal to an affiliate record.
 * This adds a self-referral fraud signal to the embedded fraudSignals array.
 */
export const addSelfReferralFraudSignal = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    matchedIndicators: v.array(v.string()),
    commissionId: v.optional(v.id("commissions")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      console.log("Cannot add fraud signal: Affiliate not found");
      return null;
    }

    // Verify tenant ownership
    if (affiliate.tenantId !== args.tenantId) {
      console.log("Cannot add fraud signal: Tenant mismatch");
      return null;
    }

    // Get existing fraud signals or initialize empty array
    const fraudSignals = affiliate.fraudSignals || [];

    // Create the fraud signal
    const fraudSignal = {
      type: "selfReferral",
      severity: "high", // Self-referral is serious fraud
      timestamp: Date.now(),
      details: JSON.stringify({
        matchedIndicators: args.matchedIndicators,
        commissionId: args.commissionId,
        detectedAt: new Date().toISOString(),
      }),
    };

    // Add to fraud signals array
    fraudSignals.push(fraudSignal);

    // Update the affiliate record
    await ctx.db.patch(args.affiliateId, { fraudSignals });

    console.log(`Added self-referral fraud signal to affiliate ${args.affiliateId}`);

    return null;
  },
});

/**
 * Query to check if a conversion has already been flagged as self-referral.
 * Used to prevent duplicate fraud signal creation.
 */
export const isConversionSelfReferred = internalQuery({
  args: {
    conversionId: v.id("conversions"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const conversion = await ctx.db.get(args.conversionId);
    if (!conversion) {
      return false;
    }

    // Query commissions for this conversion
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_conversion", (q) => q.eq("conversionId", args.conversionId))
      .collect();

    // Check if any commission for this conversion is flagged as self-referral
    for (const commission of commissions) {
      if (commission.isSelfReferral === true) {
        return true;
      }
    }

    return false;
  },
});

/**
 * Internal mutation to update an affiliate's login tracking data.
 * Stores the IP address and device fingerprint from their last login
 * for self-referral detection.
 */
export const updateAffiliateLoginTracking = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    ipAddress: v.optional(v.string()),
    deviceFingerprint: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: Record<string, any> = {};

    if (args.ipAddress) {
      updates.lastLoginIp = args.ipAddress;
    }

    if (args.deviceFingerprint) {
      updates.lastDeviceFingerprint = args.deviceFingerprint;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.affiliateId, updates);
    }

    return null;
  },
});

/**
 * Internal mutation to update an affiliate's payout method tracking data.
 * Stores the last 4 digits and processor ID for self-referral detection.
 */
export const updateAffiliatePayoutTracking = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    payoutMethodLastDigits: v.optional(v.string()),
    payoutMethodProcessorId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: Record<string, any> = {};

    if (args.payoutMethodLastDigits) {
      updates.payoutMethodLastDigits = args.payoutMethodLastDigits;
    }

    if (args.payoutMethodProcessorId) {
      updates.payoutMethodProcessorId = args.payoutMethodProcessorId;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.affiliateId, updates);
    }

    return null;
  },
});
