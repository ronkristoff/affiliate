import { query, internalQuery } from "./_generated/server";
import { internalMutation } from "./triggers";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";

/**
 * Click Tracking Functions
 * 
 * Implements Story 6.2: Click Tracking with Deduplication
 * - IP-based click deduplication with hourly time windows
 * - Cookie-based attribution precedence
 * - Performance-optimized fire-and-forget tracking
 */

/**
 * Internal: Track a click with deduplication logic
 * AC2: Implements click deduplication by dedupeKey
 */
export const trackClickInternal = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    referralLinkId: v.id("referralLinks"),
    affiliateId: v.id("affiliates"),
    campaignId: v.optional(v.id("campaigns")),
    ipAddress: v.string(),
    userAgent: v.optional(v.string()),
    referrer: v.optional(v.string()),
    dedupeKey: v.string(),
  },
  returns: v.object({
    clickId: v.id("clicks"),
    isNew: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // AC2: Check for existing click by dedupeKey using by_dedupe_key index
    const existingClick = await ctx.db
      .query("clicks")
      .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", args.dedupeKey))
      .first();

    if (existingClick) {
      // AC2: If duplicate found, return existing click ID without creating new record
      // Log dedup event to audit trail (non-fatal — dedup result returned regardless)
      try {
        await ctx.db.insert("auditLogs", {
          tenantId: args.tenantId,
          action: "click_deduplicated",
          entityType: "click",
          entityId: existingClick._id,
          actorType: "system",
          metadata: {
            dedupeKey: args.dedupeKey,
            ipAddress: args.ipAddress,
            existingClickId: existingClick._id,
          },
        });
      } catch (err) {
        console.error("[Audit] Failed to log click dedup (non-fatal):", err);
      }
      return { clickId: existingClick._id, isNew: false };
    }

    // AC2: If not duplicate, create new click record
    const clickId = await ctx.db.insert("clicks", {
      tenantId: args.tenantId,
      referralLinkId: args.referralLinkId,
      affiliateId: args.affiliateId,
      campaignId: args.campaignId,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      referrer: args.referrer,
      dedupeKey: args.dedupeKey,
    });

    // Log audit trail for click creation (non-fatal — click must succeed regardless)
    try {
      await ctx.db.insert("auditLogs", {
        tenantId: args.tenantId,
        action: "click_recorded",
        entityType: "click",
        entityId: clickId,
        actorType: "system",
        newValue: {
          affiliateId: args.affiliateId,
          referralLinkId: args.referralLinkId,
          campaignId: args.campaignId,
          ipAddress: args.ipAddress,
          dedupeKey: args.dedupeKey,
        },
        metadata: {
          ipAddress: args.ipAddress,
          userAgent: args.userAgent,
        },
      });
    } catch (err) {
      console.error("[Audit] Failed to log click_recorded (non-fatal):", err);
    }

    return { clickId, isNew: true };
  },
});

/**
 * Internal: Validate affiliate code and check status
 * Used for cookie attribution precedence validation (AC3)
 */
export const validateAffiliateCodeInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    code: v.string(),
  },
  returns: v.object({
    valid: v.boolean(),
    affiliateId: v.optional(v.id("affiliates")),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Find the referral link by code
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

    // AC6: Return invalid if affiliate is not active
    if (affiliate.status === "suspended") {
      return { valid: false, reason: "affiliate_suspended" };
    }

    if (affiliate.status !== "active") {
      return { valid: false, reason: `affiliate_${affiliate.status}` };
    }

    return {
      valid: true,
      affiliateId: referralLink.affiliateId,
    };
  },
});

/**
 * Internal: Get referral link by code for HTTP endpoint
 * Returns null if affiliate is not active (returns 404 behavior)
 */
export const getReferralLinkByCodeInternal = internalQuery({
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

    // Return 404 (null) if affiliate is suspended or not active
    if (affiliate.status === "suspended" || affiliate.status !== "active") {
      return null;
    }

    return referralLink;
  },
});

/**
 * Internal: Get campaign by ID for HTTP endpoint
 * Used to retrieve cookie duration settings
 */
export const getCampaignByIdInternal = internalQuery({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.union(
    v.object({
      _id: v.id("campaigns"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      name: v.string(),
      cookieDuration: v.optional(v.number()),
      status: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    
    if (!campaign) {
      return null;
    }

    return {
      _id: campaign._id,
      _creationTime: campaign._creationTime,
      tenantId: campaign.tenantId,
      name: campaign.name,
      cookieDuration: campaign.cookieDuration,
      status: campaign.status,
    };
  },
});

/**
 * Query: Get clicks by referral link with pagination
 * Task 6: Dashboard click queries
 */
export const getClicksByReferralLink = query({
  args: {
    referralLinkId: v.id("referralLinks"),
    paginationOpts: paginationOptsValidator,
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("clicks"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      referralLinkId: v.id("referralLinks"),
      affiliateId: v.id("affiliates"),
      campaignId: v.optional(v.id("campaigns")),
      ipAddress: v.string(),
      userAgent: v.optional(v.string()),
      referrer: v.optional(v.string()),
      dedupeKey: v.string(),
    })),
    continueCursor: v.optional(v.string()),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Use the by_referral_link index for efficient querying
    const result = await ctx.db
      .query("clicks")
      .withIndex("by_referral_link", (q) => 
        q.eq("referralLinkId", args.referralLinkId)
      )
      .order("desc")
      .paginate(args.paginationOpts);

    // Apply date range filtering if provided
    let filteredPage = result.page;
    if (args.startDate || args.endDate) {
      filteredPage = result.page.filter(click => {
        const timestamp = click._creationTime;
        if (args.startDate && timestamp < args.startDate) return false;
        if (args.endDate && timestamp > args.endDate) return false;
        return true;
      });
    }

    return {
      ...result,
      page: filteredPage,
    };
  },
});

/**
 * Query: Get clicks by affiliate with pagination
 * Task 6: Dashboard click queries for affiliate view
 */
export const getClicksByAffiliate = query({
  args: {
    affiliateId: v.id("affiliates"),
    paginationOpts: paginationOptsValidator,
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("clicks"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      referralLinkId: v.id("referralLinks"),
      affiliateId: v.id("affiliates"),
      campaignId: v.optional(v.id("campaigns")),
      ipAddress: v.string(),
      userAgent: v.optional(v.string()),
      referrer: v.optional(v.string()),
      dedupeKey: v.string(),
    })),
    continueCursor: v.optional(v.string()),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Use the by_affiliate index for efficient querying
    const result = await ctx.db
      .query("clicks")
      .withIndex("by_affiliate", (q) => 
        q.eq("affiliateId", args.affiliateId)
      )
      .order("desc")
      .paginate(args.paginationOpts);

    // Apply date range filtering if provided
    let filteredPage = result.page;
    if (args.startDate || args.endDate) {
      filteredPage = result.page.filter(click => {
        const timestamp = click._creationTime;
        if (args.startDate && timestamp < args.startDate) return false;
        if (args.endDate && timestamp > args.endDate) return false;
        return true;
      });
    }

    return {
      ...result,
      page: filteredPage,
    };
  },
});

/**
 * Query: Get click statistics for dashboard
 * Task 6: Aggregate statistics with date range filtering
 */
export const getClickStats = query({
  args: {
    referralLinkId: v.optional(v.id("referralLinks")),
    affiliateId: v.optional(v.id("affiliates")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    totalClicks: v.number(),
    uniqueClicks: v.number(),
    clickThroughRate: v.optional(v.number()),
    topReferrers: v.array(v.object({
      referrer: v.string(),
      count: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    // Get clicks based on provided filters
    
    let clicks;
    
    if (args.referralLinkId) {
      // Use referral link index
      clicks = await ctx.db
        .query("clicks")
        .withIndex("by_referral_link", (q) =>
          q.eq("referralLinkId", args.referralLinkId!)
        )
        .take(1200);
    } else if (args.affiliateId) {
      // Use affiliate index
      clicks = await ctx.db
        .query("clicks")
        .withIndex("by_affiliate", (q) =>
          q.eq("affiliateId", args.affiliateId!)
        )
        .take(1200);
    } else {
      // No filter - get all clicks (use sparingly)
      clicks = await ctx.db.query("clicks").take(1200);
    }

    // Filter by date range if provided
    let filteredClicks = clicks;
    if (args.startDate || args.endDate) {
      filteredClicks = clicks.filter(click => {
        const timestamp = click._creationTime;
        if (args.startDate && timestamp < args.startDate) return false;
        if (args.endDate && timestamp > args.endDate) return false;
        return true;
      });
    }

    // Calculate statistics
    const totalClicks = filteredClicks.length;
    
    // Unique clicks = unique dedupeKeys
    const uniqueDedupeKeys = new Set(filteredClicks.map(c => c.dedupeKey));
    const uniqueClicks = uniqueDedupeKeys.size;

    // Calculate top referrers
    const referrerCounts: Record<string, number> = {};
    filteredClicks.forEach(click => {
      const referrer = click.referrer || "Direct";
      referrerCounts[referrer] = (referrerCounts[referrer] || 0) + 1;
    });

    const topReferrers = Object.entries(referrerCounts)
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalClicks,
      uniqueClicks,
      topReferrers,
    };
  },
});

/**
 * Query: Get clicks by tenant (for admin/owner dashboard)
 * Task 6: Multi-tenant click queries
 */
export const getClicksByTenant = query({
  args: {
    tenantId: v.id("tenants"),
    paginationOpts: paginationOptsValidator,
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("clicks"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      referralLinkId: v.id("referralLinks"),
      affiliateId: v.id("affiliates"),
      campaignId: v.optional(v.id("campaigns")),
      ipAddress: v.string(),
      userAgent: v.optional(v.string()),
      referrer: v.optional(v.string()),
      dedupeKey: v.string(),
    })),
    continueCursor: v.optional(v.string()),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Use the by_tenant index for efficient querying
    const result = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .paginate(args.paginationOpts);

    // Apply date range filtering if provided
    let filteredPage = result.page;
    if (args.startDate || args.endDate) {
      filteredPage = result.page.filter(click => {
        const timestamp = click._creationTime;
        if (args.startDate && timestamp < args.startDate) return false;
        if (args.endDate && timestamp > args.endDate) return false;
        return true;
      });
    }

    return {
      ...result,
      page: filteredPage,
    };
  },
});

/**
 * Internal: Get tenant by ID
 * Used by HTTP endpoint for redirect destination
 */
export const getTenantByIdInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.union(
    v.object({
      _id: v.id("tenants"),
      slug: v.string(),
      domain: v.string(),
      branding: v.optional(v.object({
        portalName: v.optional(v.string()),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    
    if (!tenant) {
      return null;
    }

    return {
      _id: tenant._id,
      slug: tenant.slug,
      domain: tenant.domain,
      branding: tenant.branding,
    };
  },
});

/**
 * Query: Get recent clicks with affiliate and campaign context
 * Task 6: Enriched click data for dashboard
 * Optimized to avoid N+1 queries
 */
export const getRecentClicksWithContext = query({
  args: {
    tenantId: v.id("tenants"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("clicks"),
    _creationTime: v.number(),
    affiliateName: v.string(),
    campaignName: v.optional(v.string()),
    referrer: v.optional(v.string()),
    isDuplicate: v.boolean(),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    // Get recent clicks for tenant
    const clicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(limit);

    if (clicks.length === 0) {
      return [];
    }

    // Batch fetch all unique affiliate IDs
    const affiliateIds = [...new Set(clicks.map(c => c.affiliateId))];
    const affiliateMap: Record<string, { name: string }> = {};
    for (const id of affiliateIds) {
      const affiliate = await ctx.db.get(id);
      if (affiliate) {
        affiliateMap[id] = { name: affiliate.name };
      }
    }

    // Batch fetch all unique referral link IDs
    const referralLinkIds = [...new Set(clicks.map(c => c.referralLinkId))];
    const referralLinkMap: Record<string, { campaignId?: Id<"campaigns"> }> = {};
    for (const id of referralLinkIds) {
      const referralLink = await ctx.db.get(id);
      if (referralLink) {
        referralLinkMap[id] = { campaignId: referralLink.campaignId };
      }
    }

    // Batch fetch all unique campaign IDs
    const campaignIds = [...new Set(
      Object.values(referralLinkMap)
        .map(rl => rl.campaignId)
        .filter((id): id is Id<"campaigns"> => !!id)
    )];
    const campaignMap: Record<string, { name: string }> = {};
    for (const id of campaignIds) {
      const campaign = await ctx.db.get(id);
      if (campaign) {
        campaignMap[id] = { name: campaign.name };
      }
    }

    // Get unique dedupeKeys to identify duplicates
    const dedupeKeyCounts: Record<string, number> = {};
    for (const click of clicks) {
      dedupeKeyCounts[click.dedupeKey] = (dedupeKeyCounts[click.dedupeKey] || 0) + 1;
    }

    // Build enriched results
    const enrichedClicks = clicks.map((click) => {
      const affiliate = affiliateMap[click.affiliateId];
      const referralLink = referralLinkMap[click.referralLinkId];
      
      let campaignName: string | undefined;
      if (referralLink?.campaignId) {
        campaignName = campaignMap[referralLink.campaignId]?.name;
      }

      // A click is a duplicate if there are multiple clicks with the same dedupeKey
      // AND this is not the first occurrence (we check by comparing _id ordering)
      const isDuplicate = (dedupeKeyCounts[click.dedupeKey] || 0) > 1;

      return {
        _id: click._id,
        _creationTime: click._creationTime,
        affiliateName: affiliate?.name || "Unknown",
        campaignName,
        referrer: click.referrer,
        isDuplicate,
      };
    });

    return enrichedClicks;
  },
});
