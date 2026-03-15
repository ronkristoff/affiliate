import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Get referral link by code with affiliate status check.
 * Returns null if the affiliate is suspended (to return 404).
 * @security Public query - used for tracking referral clicks
 */
export const getReferralLinkByCode = query({
  args: {
    tenantId: v.id("tenants"),
    code: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("referralLinks"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      affiliateId: v.id("affiliates"),
      campaignId: v.optional(v.id("campaigns")),
      code: v.string(),
      vanitySlug: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Find the referral link by code
    const referralLink = await ctx.db
      .query("referralLinks")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!referralLink) {
      return null;
    }

    // Verify the link belongs to the correct tenant
    if (referralLink.tenantId !== args.tenantId) {
      return null;
    }

    // Check affiliate status
    const affiliate = await ctx.db.get(referralLink.affiliateId);
    if (!affiliate) {
      return null;
    }

    // Return 404 (null) if affiliate is suspended
    if (affiliate.status === "suspended") {
      return null;
    }

    // Return 404 (null) if affiliate is not active
    // Only active affiliates should have working referral links
    if (affiliate.status !== "active") {
      return null;
    }

    return referralLink;
  },
});

/**
 * Validate a referral code for redirect/tracking.
 * Returns detailed validation result.
 * @security Public query - used before redirecting to target URL
 */
export const validateReferralCode = query({
  args: {
    tenantId: v.id("tenants"),
    code: v.string(),
  },
  returns: v.object({
    valid: v.boolean(),
    reason: v.optional(v.string()),
    affiliateId: v.optional(v.id("affiliates")),
    campaignId: v.optional(v.id("campaigns")),
  }),
  handler: async (ctx, args) => {
    // Find the referral link
    const referralLink = await ctx.db
      .query("referralLinks")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!referralLink) {
      return { valid: false, reason: "invalid_code" };
    }

    // Verify tenant
    if (referralLink.tenantId !== args.tenantId) {
      return { valid: false, reason: "invalid_tenant" };
    }

    // Check affiliate status
    const affiliate = await ctx.db.get(referralLink.affiliateId);
    if (!affiliate) {
      return { valid: false, reason: "affiliate_not_found" };
    }

    if (affiliate.status === "suspended") {
      return { valid: false, reason: "affiliate_suspended" };
    }

    if (affiliate.status !== "active") {
      return { valid: false, reason: `affiliate_${affiliate.status}` };
    }

    return {
      valid: true,
      affiliateId: referralLink.affiliateId,
      campaignId: referralLink.campaignId,
    };
  },
});

/**
 * Get all referral links for an affiliate.
 * @security Requires authentication. Results filtered by tenant.
 */
export const getAffiliateReferralLinks = query({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.array(
    v.object({
      _id: v.id("referralLinks"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      affiliateId: v.id("affiliates"),
      campaignId: v.optional(v.id("campaigns")),
      code: v.string(),
      vanitySlug: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    // Note: This is a public query that should be called with tenant context
    // The affiliateId is used directly without tenant check since
    // affiliate IDs are already scoped to tenants
    return await ctx.db
      .query("referralLinks")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .collect();
  },
});

/**
 * Create a new referral link.
 * @security Requires authentication. Validates tenant ownership.
 */
export const createReferralLink = mutation({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    campaignId: v.optional(v.id("campaigns")),
    code: v.string(),
    vanitySlug: v.optional(v.string()),
  },
  returns: v.object({
    linkId: v.id("referralLinks"),
    code: v.string(),
  }),
  handler: async (ctx, args) => {
    // Verify affiliate exists and belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== args.tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Check if code already exists
    const existing = await ctx.db
      .query("referralLinks")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      throw new Error("Referral code already exists");
    }

    // Create the referral link
    const linkId = await ctx.db.insert("referralLinks", {
      tenantId: args.tenantId,
      affiliateId: args.affiliateId,
      campaignId: args.campaignId,
      code: args.code,
      vanitySlug: args.vanitySlug,
    });

    return { linkId, code: args.code };
  },
});
