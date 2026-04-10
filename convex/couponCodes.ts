/**
 * Coupon Code Generation and Validation
 *
 * Implements vanity coupon codes for affiliate attribution.
 * One code per affiliate (not per campaign).
 * Format: {AFFILIATE_PREFIX}{TENANT_SLUG} (max 10 chars, A-Z only)
 */

import { query, internalMutation, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// =============================================================================
// Pure Functions (testable, no DB access)
// =============================================================================

/**
 * Generate a vanity coupon code from affiliate name and tenant slug.
 * ADR-1 Algorithm:
 * 1. affiliate_prefix = first 4 chars of name, uppercase, strip accents/special chars
 * 2. tenant_prefix = first 4 chars of slug, uppercase, strip hyphens
 * 3. candidate = affiliate_prefix + tenant_prefix (max 10 chars)
 * 4. All base characters: A-Z only (numbers only as collision suffix)
 */
export function generateVanityCode(affiliateName: string, tenantSlug: string): string {
  // Clean affiliate name: uppercase, strip accents/special chars, keep only A-Z
  const cleanName = affiliateName
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritical marks
    .replace(/[^A-Z]/g, "");

  // Clean tenant slug: uppercase, strip hyphens, keep only A-Z
  const cleanSlug = tenantSlug
    .toUpperCase()
    .replace(/-/g, "")
    .replace(/[^A-Z]/g, "");

  // Generate affiliate prefix (min 3 chars, pad from slug if needed)
  let affiliatePrefix = cleanName.slice(0, 4);
  if (affiliatePrefix.length < 3) {
    // Pad with characters from tenant slug
    const needed = 3 - affiliatePrefix.length;
    affiliatePrefix = (affiliatePrefix + cleanSlug.slice(0, needed)).toUpperCase();
  }
  if (affiliatePrefix.length < 3) {
    // Extremely short — just use what we have
    affiliatePrefix = cleanName + cleanSlug;
  }

  // Truncate affiliate prefix to max 6 chars to leave room for tenant prefix
  affiliatePrefix = affiliatePrefix.slice(0, 6);

  // Tenant prefix: up to 4 chars
  const tenantPrefix = cleanSlug.slice(0, 4);

  // Combine, max 10 chars total
  const combined = affiliatePrefix + tenantPrefix;
  return combined.slice(0, 10);
}

/**
 * Validate coupon code format.
 * Rules: 3-20 chars, A-Z and 0-9 only.
 */
export function validateCouponCodeFormat(code: string): boolean {
  return /^[A-Z0-9]{3,20}$/.test(code);
}

// =============================================================================
// Internal Mutations
// =============================================================================

/**
 * Internal: Generate and assign a coupon code to an affiliate.
 * Checks uniqueness via by_tenant_coupon_code index.
 * Appends numeric suffix on collision.
 */
export const generateCouponCodeForAffiliate = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) return null;

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return null;

    // Generate base code
    let code = generateVanityCode(affiliate.name, tenant.slug);

    // Check uniqueness and append suffix on collision
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 20;

    while (!isUnique && attempts < maxAttempts) {
      const existing = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant_coupon_code", (q) =>
          q.eq("tenantId", args.tenantId).eq("couponCode", code)
        )
        .first();

      if (!existing) {
        isUnique = true;
      } else {
        attempts++;
        code = generateVanityCode(affiliate.name, tenant.slug) + String(attempts);
      }
    }

    if (!isUnique) {
      console.error(`[CouponCode] Failed to generate unique code for affiliate ${args.affiliateId} after ${maxAttempts} attempts`);
      return null;
    }

    await ctx.db.patch(args.affiliateId, {
      couponCode: code,
      couponAttributionEnabled: true, // Default: enabled
    });

    return null;
  },
});

/**
 * Internal: Hook called when an affiliate is activated.
 * Shared entry point for all 5 activation paths.
 * Preserves existing couponCode on reactivation.
 */
export const onAffiliateActivated = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) return null;

    // If affiliate already has a couponCode, preserve it (reactivation case)
    if (affiliate.couponCode) {
      return null;
    }

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return null;

    // Generate base code (inlined from generateCouponCodeForAffiliate to avoid circular ref)
    let code = generateVanityCode(affiliate.name, tenant.slug);
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 20;

    while (!isUnique && attempts < maxAttempts) {
      const existing = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant_coupon_code", (q) =>
          q.eq("tenantId", args.tenantId).eq("couponCode", code)
        )
        .first();

      if (!existing) {
        isUnique = true;
      } else {
        attempts++;
        code = generateVanityCode(affiliate.name, tenant.slug) + String(attempts);
      }
    }

    if (isUnique) {
      await ctx.db.patch(args.affiliateId, {
        couponCode: code,
        couponAttributionEnabled: true,
      });
    } else {
      console.error(`[CouponCode] Failed to generate unique code for affiliate ${args.affiliateId} after ${maxAttempts} attempts`);
    }

    return null;
  },
});

// =============================================================================
// Internal Query: Get most recent active enrollment
// =============================================================================

/**
 * Internal: Get the most recent active campaign enrollment for an affiliate.
 * Used for coupon-only campaign resolution (ADR-8).
 */
export const getMostRecentActiveEnrollment = internalQuery({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.nullable(
    v.object({
      campaignId: v.id("campaigns"),
    })
  ),
  handler: async (ctx, args) => {
    // Query by affiliate with status filter, ordered by most recent
    const enrollments = await ctx.db
      .query("affiliateCampaigns")
      .withIndex("by_affiliate_and_status", (q) =>
        q.eq("affiliateId", args.affiliateId).eq("status", "active")
      )
      .order("desc")
      .take(1);

    if (enrollments.length === 0) {
      return null;
    }

    return {
      campaignId: enrollments[0].campaignId,
    };
  },
});

// =============================================================================
// Public Query: Validate Coupon Code
// =============================================================================

/**
 * Public: Validate a coupon code for a tenant.
 * Returns affiliate + campaign info if valid, null if invalid.
 * Public query because it's called from tracking endpoints (no auth).
 */
export const validateCouponCode = query({
  args: {
    tenantId: v.id("tenants"),
    couponCode: v.string(),
  },
  returns: v.nullable(
    v.object({
      affiliateId: v.id("affiliates"),
      affiliateName: v.string(),
      campaignId: v.id("campaigns"),
      referralLinkId: v.optional(v.id("referralLinks")),
    })
  ),
  handler: async (ctx, args) => {
    // Look up affiliate by coupon code
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_coupon_code", (q) =>
        q.eq("tenantId", args.tenantId).eq("couponCode", args.couponCode)
      )
      .first();

    if (!affiliate) {
      return null;
    }

    // Check affiliate is active
    if (affiliate.status !== "active") {
      return null;
    }

    // Check coupon attribution is enabled
    if (affiliate.couponAttributionEnabled === false) {
      return null;
    }

    // Resolve campaign (ADR-8: defaultCouponCampaignId → most recent active enrollment)
    let campaignId: Id<"campaigns"> | null = null;

    if (affiliate.defaultCouponCampaignId) {
      // Verify the campaign still exists and is active
      const campaign = await ctx.db.get(affiliate.defaultCouponCampaignId);
      if (campaign && campaign.status === "active") {
        campaignId = affiliate.defaultCouponCampaignId;
      }
    }

    if (!campaignId) {
      // Fall back to most recent active enrollment (inlined to avoid circular reference)
      const enrollments = await ctx.db
        .query("affiliateCampaigns")
        .withIndex("by_affiliate_and_status", (q) =>
          q.eq("affiliateId", affiliate._id).eq("status", "active")
        )
        .order("desc")
        .take(1);

      if (enrollments.length > 0) {
        campaignId = enrollments[0].campaignId;
      }
    }

    if (!campaignId) {
      // No active campaign — reject coupon
      return null;
    }

    // Look for a referral link for this affiliate (may not exist for coupon-only)
    const referralLink = await ctx.db
      .query("referralLinks")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliate._id))
      .first();

    return {
      affiliateId: affiliate._id,
      affiliateName: affiliate.name,
      campaignId,
      referralLinkId: referralLink?._id,
    };
  },
});

// =============================================================================
// Public Mutation: Update Affiliate Coupon Code
// =============================================================================

/**
 * Mutation: Update an affiliate's coupon code.
 * Validates format and uniqueness. Creates audit log.
 */
export const updateAffiliateCouponCode = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    newCode: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Validate format
    if (!validateCouponCodeFormat(args.newCode)) {
      throw new Error("Invalid coupon code format. Must be 3-20 characters, letters A-Z and numbers only.");
    }

    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }

    const tenantId = affiliate.tenantId;

    // Check uniqueness within tenant (exclude self)
    const existing = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_coupon_code", (q) =>
        q.eq("tenantId", tenantId).eq("couponCode", args.newCode)
      )
      .first();

    if (existing && existing._id !== args.affiliateId) {
      throw new Error("This coupon code is already used by another affiliate in your program.");
    }

    const oldCode = affiliate.couponCode || null;

    await ctx.db.patch(args.affiliateId, {
      couponCode: args.newCode,
    });

    // Create audit log
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "coupon_code_updated",
      entityType: "affiliate",
      entityId: args.affiliateId,
      affiliateId: args.affiliateId,
      actorId: identity.subject,
      actorType: "user",
      previousValue: { couponCode: oldCode },
      newValue: { couponCode: args.newCode },
    });

    return null;
  },
});
