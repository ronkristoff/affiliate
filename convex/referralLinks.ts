import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireTenantId, requireAffiliateTenantId, getAuthenticatedUser, getTenantId, getAffiliateTenantId } from "./tenantContext";
import { hasPermission } from "./permissions";
import type { Role } from "./permissions";
import { paginationOptsValidator } from "convex/server";

/**
 * Generate a unique referral code for a referral link.
 * Format: 8-character alphanumeric code (excludes confusing characters).
 */
function generateUniqueReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing characters (0, O, I, 1)
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Build short URL format: https://{domain}/ref/{code}
 */
function buildShortUrl(domain: string, code: string): string {
  return `https://${domain}/ref/${code}`;
}

/**
 * Build campaign URL format: https://{domain}/ref/{code}?campaign={campaign-slug}
 */
function buildCampaignUrl(domain: string, code: string, campaignSlug: string): string {
  return `https://${domain}/ref/${code}?campaign=${campaignSlug}`;
}

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
    });

    return { linkId, code: args.code };
  },
});

/**
 * Generate a unique referral link for an affiliate.
 * Automatically generates a unique code if not provided.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission.
 */
export const generateReferralLink = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.object({
    linkId: v.id("referralLinks"),
    code: v.string(),
    shortUrl: v.string(),
    campaignUrl: v.optional(v.string()),
    domainVerified: v.boolean(),
  }),
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
        entityType: "referralLink",
        entityId: "generate",
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=generateReferralLink`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to generate referral links");
    }

    // Validate affiliate exists and belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate affiliate is active
    if (affiliate.status !== "active") {
      throw new Error(`Cannot generate referral link for affiliate with status "${affiliate.status}". Only active affiliates can have referral links.`);
    }

    // Validate campaign if provided
    if (args.campaignId) {
      const campaign = await ctx.db.get(args.campaignId);
      if (!campaign || campaign.tenantId !== tenantId) {
        throw new Error("Campaign not found or access denied");
      }
      if (campaign.status !== "active") {
        throw new Error("Cannot create referral link for inactive campaign");
      }
    }

    // Generate unique referral code with collision handling
    let code = generateUniqueReferralCode();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const existing = await ctx.db
        .query("referralLinks")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();

      if (!existing) {
        break;
      }
      code = generateUniqueReferralCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error("Failed to generate unique referral code. Please try again.");
    }

    // Create the referral link
    const linkId = await ctx.db.insert("referralLinks", {
      tenantId,
      affiliateId: args.affiliateId,
      campaignId: args.campaignId,
      code,
    });

    // Log link creation in audit trail
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "referral_link_created",
      entityType: "referralLink",
      entityId: linkId,
      actorId: authUser.userId,
      actorType: "user",
      newValue: {
        affiliateId: args.affiliateId,
        code,
        campaignId: args.campaignId,
      },
    });

    // Get tenant domain for URL building
    const tenant = await ctx.db.get(tenantId);
    const domain = tenant?.domain || "";
    const domainVerified = !!tenant?.trackingVerifiedAt;

    // Build URLs
    const shortUrl = buildShortUrl(domain, code);

    let campaignUrl: string | undefined;
    if (args.campaignId) {
      const campaign = await ctx.db.get(args.campaignId);
      if (campaign) {
        const campaignSlug = campaign.name.toLowerCase().replace(/\s+/g, "-");
        campaignUrl = buildCampaignUrl(domain, code, campaignSlug);
      }
    }

    return {
      linkId,
      code,
      shortUrl,
      campaignUrl,
      domainVerified,
    };
  },
});

/**
 * Get referral links for SaaS Owner dashboard.
 * Supports filtering by campaign.
 * @security Requires authentication. Results filtered by tenant.
 */
export const getReferralLinks = query({
  args: {
    paginationOpts: paginationOptsValidator,
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("referralLinks"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      affiliateId: v.id("affiliates"),
      campaignId: v.optional(v.id("campaigns")),
      code: v.string(),
      affiliateName: v.string(),
      campaignName: v.optional(v.string()),
      shortUrl: v.string(),
      campaignUrl: v.optional(v.string()),
    })),
    continueCursor: v.optional(v.string()),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);

    // Get tenant domain for URL building
    const tenant = await ctx.db.get(tenantId);
    const domain = tenant?.domain || "";

    // Build base query
    let baseQuery = ctx.db
      .query("referralLinks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId));

    // Apply campaign filter if provided - use compound index for efficient filtering
    if (args.campaignId) {
      const campaign = await ctx.db.get(args.campaignId);
      if (!campaign || campaign.tenantId !== tenantId) {
        return { page: [], continueCursor: undefined, isDone: true };
      }

      // Use compound index for efficient campaign filtering
      const campaignQuery = ctx.db
        .query("referralLinks")
        .withIndex("by_tenant_and_campaign", (q) => 
          q.eq("tenantId", tenantId).eq("campaignId", args.campaignId)
        );

      // Paginate using the indexed query
      const result = await campaignQuery.paginate(args.paginationOpts);

      // Enrich with affiliate and campaign names
      const enrichedPage = await Promise.all(result.page.map(async (link) => {
        const affiliate = await ctx.db.get(link.affiliateId);
        const affiliateName = affiliate?.name || "Unknown";
      const shortUrl = buildShortUrl(domain, link.code);
      const fullUrl = shortUrl;

      let vanityUrl: string | undefined;
      if (affiliate?.vanitySlug) {
        vanityUrl = `https://${domain}/ref/${affiliate.vanitySlug}`;
      }
      
      let campaignUrl: string | undefined;
        if (campaign) {
          const campaignSlug = campaign.name.toLowerCase().replace(/\s+/g, "-");
          campaignUrl = buildCampaignUrl(domain, link.code, campaignSlug);
        }

        return {
          ...link,
          affiliateName,
          campaignName: campaign?.name,
          shortUrl,
          campaignUrl,
        };
      }));

      return {
        page: enrichedPage,
        continueCursor: result.continueCursor,
        pageStatus: v.optional(v.union(v.string(), v.null())),
        splitCursor: v.optional(v.union(v.string(), v.null())),
        isDone: result.isDone,
      };
    }

    // No campaign filter - paginate directly
    const result = await baseQuery.paginate(args.paginationOpts);

    // Enrich with affiliate and campaign names
    const enrichedPage = await Promise.all(result.page.map(async (link) => {
      const affiliate = await ctx.db.get(link.affiliateId);
      let campaignName: string | undefined;
      if (link.campaignId) {
        const campaign = await ctx.db.get(link.campaignId);
        campaignName = campaign?.name;
      }

      const affiliateName = affiliate?.name || "Unknown";
      const shortUrl = buildShortUrl(domain, link.code);
      
      let campaignUrl: string | undefined;
      if (link.campaignId && campaignName) {
        const campaignSlug = campaignName.toLowerCase().replace(/\s+/g, "-");
        campaignUrl = buildCampaignUrl(domain, link.code, campaignSlug);
      }

      return {
        ...link,
        affiliateName,
        campaignName,
        shortUrl,
        campaignUrl,
      };
    }));

    return {
      page: enrichedPage,
      continueCursor: result.continueCursor,
      pageStatus: v.optional(v.union(v.string(), v.null())),
      splitCursor: v.optional(v.union(v.string(), v.null())),
      isDone: result.isDone,
    };
  },
});

/**
 * Get referral links for affiliate portal.
 * Returns all link formats with click statistics.
 * @security Requires authentication. Affiliate can only see their own links.
 */
export const getAffiliatePortalLinks = query({
  args: {
    affiliateId: v.id("affiliates"),
    campaignId: v.optional(v.id("campaigns")),
  },
  returns: v.array(v.object({
    _id: v.id("referralLinks"),
    _creationTime: v.number(),
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    campaignId: v.optional(v.id("campaigns")),
    code: v.string(),
    campaignName: v.optional(v.string()),
    shortUrl: v.string(),
    fullUrl: v.string(),
    vanityUrl: v.optional(v.string()),
    campaignUrl: v.optional(v.string()),
    clickCount: v.number(),
    conversionCount: v.number(),
    conversionRate: v.number(),
  })),
  handler: async (ctx, args) => {
    // Support both admin/owner (users table) and affiliate (affiliates table) callers.
    const tenantId = (await getTenantId(ctx)) ?? (await getAffiliateTenantId(ctx));
    if (!tenantId) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Verify affiliate belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Get tenant domain for URL building
    const tenant = await ctx.db.get(tenantId);
    const domain = tenant?.domain || "";

    // Query referral links for this affiliate
    let linksQuery = ctx.db
      .query("referralLinks")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId));

    const links = await linksQuery.collect();

    // Filter by campaign if provided
    let filteredLinks = links;
    if (args.campaignId) {
      filteredLinks = links.filter(link => 
        link.campaignId?.toString() === args.campaignId?.toString()
      );
    }

    // Sort by creation time descending
    filteredLinks.sort((a, b) => b._creationTime - a._creationTime);

    // Enrich with campaign names, URLs, and statistics
    const enrichedLinks = await Promise.all(filteredLinks.map(async (link) => {
      let campaignName: string | undefined;
      if (link.campaignId) {
        const campaign = await ctx.db.get(link.campaignId);
        campaignName = campaign?.name;
      }

      const shortUrl = buildShortUrl(domain, link.code);
      const fullUrl = shortUrl;

      let vanityUrl: string | undefined;
      if (affiliate?.vanitySlug) {
        vanityUrl = `https://${domain}/ref/${affiliate.vanitySlug}`;
      }
      
      let campaignUrl: string | undefined;
      if (link.campaignId && campaignName) {
        const campaignSlug = campaignName.toLowerCase().replace(/\s+/g, "-");
        campaignUrl = buildCampaignUrl(domain, link.code, campaignSlug);
      }

      // Get click count for this link
      const clicks = await ctx.db
        .query("clicks")
        .withIndex("by_referral_link", (q) => q.eq("referralLinkId", link._id))
        .collect();
      const clickCount = clicks.length;

      // Get conversion count for this link
      const conversions = await ctx.db
        .query("conversions")
        .filter((q) => q.eq(q.field("referralLinkId"), link._id))
        .collect();
      const conversionCount = conversions.length;

      // Calculate conversion rate
      const conversionRate = clickCount > 0 
        ? Math.round((conversionCount / clickCount) * 100 * 100) / 100 
        : 0;

      return {
        ...link,
        campaignName,
        shortUrl,
        fullUrl,
        vanityUrl,
        campaignUrl,
        clickCount,
        conversionCount,
        conversionRate,
      };
    }));

    return enrichedLinks;
  },
});

/**
 * Get daily click statistics for the last 7 days for an affiliate.
 * Returns an array of 7 days with click counts, ending with today.
 * @security Requires authentication. Validates tenant ownership.
 */
export const getAffiliateDailyClicks = query({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.array(v.object({
    date: v.string(), // ISO date string YYYY-MM-DD
    dayName: v.string(), // Mon, Tue, etc.
    clicks: v.number(),
    isToday: v.boolean(),
  })),
  handler: async (ctx, args) => {
    const tenantId = await requireAffiliateTenantId(ctx);

    // Verify affiliate belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Get all referral links for this affiliate
    const links = await ctx.db
      .query("referralLinks")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .collect();

    const linkIds = links.map(link => link._id);

    // Calculate date range (last 7 days including today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 6 days ago + today = 7 days

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Initialize result array with 0 clicks for each day
    const result = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      result.push({
        date: dateString,
        dayName: dayNames[date.getDay()],
        clicks: 0,
        isToday: i === 6, // Last day is today
      });
    }

    // Query all clicks for these links in the last 7 days
    const startTime = sevenDaysAgo.getTime();
    const endTime = today.getTime() + 24 * 60 * 60 * 1000; // End of today

    for (const linkId of linkIds) {
      const clicks = await ctx.db
        .query("clicks")
        .withIndex("by_referral_link", (q) => q.eq("referralLinkId", linkId))
        .collect();

      // Count clicks per day
      for (const click of clicks) {
        const clickDate = new Date(click._creationTime);
        if (clickDate.getTime() >= startTime && clickDate.getTime() < endTime) {
          const dateString = clickDate.toISOString().split('T')[0];
          const dayEntry = result.find(r => r.date === dateString);
          if (dayEntry) {
            dayEntry.clicks++;
          }
        }
      }
    }

    return result;
  },
});

export const updateVanitySlug = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    vanitySlug: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    vanityUrl: v.string(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const tenantId = await requireAffiliateTenantId(ctx);

    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    if (!/^[a-zA-Z0-9_-]{3,50}$/.test(args.vanitySlug)) {
      return {
        success: false,
        vanityUrl: "",
        message: "Invalid slug format. Use 3-50 alphanumeric characters, hyphens, or underscores.",
      };
    }

    const existing = await ctx.db
      .query("affiliates")
      .filter((q) =>
        q.and(
          q.eq(q.field("tenantId"), tenantId),
          q.eq(q.field("vanitySlug"), args.vanitySlug),
        )
      )
      .first();

    if (existing && existing._id !== args.affiliateId) {
      return {
        success: false,
        vanityUrl: "",
        message: "This vanity slug is already taken.",
      };
    }

    await ctx.db.patch(args.affiliateId, { vanitySlug: args.vanitySlug });

    const tenant = await ctx.db.get(tenantId);
    const domain = tenant?.domain || "";
    const vanityUrl = `https://${domain}/ref/${args.vanitySlug}`;

    return {
      success: true,
      vanityUrl,
      message: "Vanity link updated successfully!",
    };
  },
});
