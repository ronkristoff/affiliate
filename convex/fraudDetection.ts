import { internalQuery } from "./_generated/server";
import { internalMutation } from "./triggers";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

/**
 * Self-Referral Detection Functions
 * 
 * Provides detection logic to identify when an affiliate attempts to earn
 * commissions on their own purchases (self-referral fraud).
 * Used by Story 5.6 (Self-Referral Detection).
 */

/**
 * Signal weights for weighted scoring.
 * Each matched indicator contributes its weight to the total score.
 * Detection triggers when totalScore >= SELF_REFERRAL_THRESHOLD.
 */
const SIGNAL_WEIGHTS: Record<string, number> = {
  email_match: 3,
  ip_match: 3,
  ip_subnet_match: 1,
  device_match: 2,
  payment_method_match: 2,
  payment_processor_match: 2,
};

/**
 * Minimum weighted score required to flag as self-referral.
 * Calibrated for PH/SEA market where shared networks are common:
 * - email_match alone triggers (3pts)
 * - ip_subnet_match alone does NOT trigger (1pt)
 * - ip_subnet_match + device_match triggers (1+2=3pts)
 */
const SELF_REFERRAL_THRESHOLD = 3;

/**
 * Generate a unique signal ID for fraud signals.
 * Format: sig_{timestamp}_{random} — prefix prevents accidental collision,
 * 11-char random suffix provides ~58 bits of entropy.
 */
function generateSignalId(): string {
  return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

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
 * Uses weighted scoring — each matched indicator contributes its weight to totalScore.
 * Detection triggers when totalScore >= SELF_REFERRAL_THRESHOLD (3).
 * 
 * @returns { isSelfReferral: boolean, matchedIndicators: string[], totalScore: number }
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
    totalScore: v.number(),
  }),
  handler: async (ctx, args) => {
    const matchedIndicators: string[] = [];

    // 1. Fetch conversion data
    const conversion = await ctx.db.get(args.conversionId);
    if (!conversion) {
      console.log("Self-referral detection: Conversion not found");
      return { isSelfReferral: false, matchedIndicators: [], totalScore: 0 };
    }

    // Verify conversion belongs to the same tenant
    if (conversion.tenantId !== args.tenantId) {
      console.log("Self-referral detection: Conversion tenant mismatch");
      return { isSelfReferral: false, matchedIndicators: [], totalScore: 0 };
    }

    // 2. Fetch affiliate data
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      console.log("Self-referral detection: Affiliate not found");
      return { isSelfReferral: false, matchedIndicators: [], totalScore: 0 };
    }

    // Verify affiliate belongs to the same tenant
    if (affiliate.tenantId !== args.tenantId) {
      console.log("Self-referral detection: Affiliate tenant mismatch");
      return { isSelfReferral: false, matchedIndicators: [], totalScore: 0 };
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

    // Weighted scoring: sum weights of matched indicators
    const totalScore = matchedIndicators.reduce(
      (sum, indicator) => sum + (SIGNAL_WEIGHTS[indicator] ?? 1),
      0
    );
    const isSelfReferral = totalScore >= SELF_REFERRAL_THRESHOLD;

    console.log(`Self-referral detection result: isSelfReferral=${isSelfReferral}, totalScore=${totalScore}, threshold=${SELF_REFERRAL_THRESHOLD}, indicators=${JSON.stringify(matchedIndicators)}`);

    return { isSelfReferral, matchedIndicators, totalScore };
  },
});

/**
 * Internal mutation to add a fraud signal to an affiliate record.
 * This adds a self-referral fraud signal to the embedded fraudSignals array.
 * Includes dedup guard: skips if a signal with same type + commissionId + severity exists.
 */
export const addSelfReferralFraudSignal = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    matchedIndicators: v.array(v.string()),
    commissionId: v.optional(v.id("commissions")),
    totalScore: v.optional(v.number()),
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

    // Dedup guard: check if a signal with same type + commissionId + severity already exists
    const isDuplicate = fraudSignals.some(
      (s: any) => s.type === "selfReferral"
        && s.commissionId === args.commissionId
        && s.severity === "high"
    );
    if (isDuplicate) {
      console.log(`Duplicate self-referral signal skipped for affiliate ${args.affiliateId}`);
      return null;
    }

    // Create the fraud signal
    const fraudSignal = {
      type: "selfReferral",
      severity: "high", // Self-referral is serious fraud
      timestamp: Date.now(),
      signalId: generateSignalId(),
      details: JSON.stringify({
        matchedIndicators: args.matchedIndicators,
        commissionId: args.commissionId,
        detectedAt: new Date().toISOString(),
        totalScore: args.totalScore,
        threshold: SELF_REFERRAL_THRESHOLD,
      }),
      commissionId: args.commissionId,
    };

    // Add to fraud signals array
    fraudSignals.push(fraudSignal);

    // Update the affiliate record
    await ctx.db.patch(args.affiliateId, { fraudSignals });

    console.log(`Added self-referral fraud signal to affiliate ${args.affiliateId} (signalId=${fraudSignal.signalId})`);

    // Audit log — self-referral fraud signal added (non-fatal)
    try {
      await ctx.runMutation(internal.audit.logAuditEventInternal, {
        tenantId: args.tenantId,
        action: "FRAUD_SIGNAL_ADDED",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorType: "system",
        metadata: {
          signalType: "selfReferral",
          severity: "high",
          matchedIndicators: args.matchedIndicators,
          commissionId: args.commissionId,
          totalScore: args.totalScore,
        },
      });
    } catch (err) {
      console.error("[Audit] Failed to log FRAUD_SIGNAL_ADDED (self-referral, non-fatal):", err);
    }

    return null;
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
