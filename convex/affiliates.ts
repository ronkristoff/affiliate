import { query, mutation, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getTenantId, requireTenantId, validateTenantOwnership, getAuthenticatedUser } from "./tenantContext";
import { hasPermission } from "./permissions";
import type { Role } from "./permissions";
import { api, internal } from "./_generated/api";
import { updateAffiliateCount } from "./tenantStats";

/**
 * Generate a unique signal ID for fraud signals.
 * Duplicated from fraudDetection.ts — Convex queries/mutations can't share code via dynamic imports.
 */
function generateSignalId(): string {
  return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Generate a unique referral code for an affiliate.
 * Format: 8-character alphanumeric code.
 */
async function generateUniqueReferralCode(ctx: any): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing characters
  let code = "";
  
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Ensure uniqueness within tenant (will be checked at creation)
  return code;
}

/**
 * Check if a referral code is unique within a tenant.
 */
async function isCodeUnique(ctx: any, tenantId: Id<"tenants">, code: string): Promise<boolean> {
  const existing = await ctx.db
    .query("affiliates")
    .withIndex("by_tenant_and_code", (q: any) => 
      q.eq("tenantId", tenantId).eq("uniqueCode", code)
    )
    .first();
  
  return !existing;
}

/**
 * Get affiliate by ID.
 * Returns null if the affiliate doesn't exist or belongs to another tenant.
 * @security Requires authentication. Results filtered by tenant.
 */
export const getAffiliate = query({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      vanitySlug: v.optional(v.string()),
      note: v.optional(v.string()),
      promotionChannel: v.optional(v.string()),
      payoutMethod: v.optional(v.object({
        type: v.string(),
        details: v.string(),
      })),
      // Fraud signals with review tracking (Story 5.7)
      fraudSignals: v.optional(v.array(v.object({
        type: v.string(),
        severity: v.string(),
        timestamp: v.number(),
        details: v.optional(v.string()),
        reviewedAt: v.optional(v.number()),
        reviewedBy: v.optional(v.string()),
        reviewNote: v.optional(v.string()),
      }))),
      commissionOverrides: v.optional(v.array(v.object({
        campaignId: v.id("campaigns"),
        rate: v.number(),
        status: v.optional(v.union(
          v.literal("active"),
          v.literal("paused"),
        )),
      }))),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx);
    if (!tenantId) {
      return null;
    }

    const affiliate = await ctx.db.get(args.affiliateId);

    // Validate tenant ownership - return null if affiliate belongs to another tenant
    if (!affiliate || affiliate.tenantId !== tenantId) {
      return null;
    }

    // Only return safe fields, exclude sensitive data like passwordHash
    return {
      _id: affiliate._id,
      _creationTime: affiliate._creationTime,
      tenantId: affiliate.tenantId,
      email: affiliate.email,
      name: affiliate.name,
      uniqueCode: affiliate.uniqueCode,
      status: affiliate.status,
      vanitySlug: affiliate.vanitySlug,
      promotionChannel: affiliate.promotionChannel,
      note: affiliate.note,
      payoutMethod: affiliate.payoutMethod,
      fraudSignals: affiliate.fraudSignals,
      commissionOverrides: affiliate.commissionOverrides,
    };
  },
});

/**
 * Get affiliate by email within a tenant.
 * Used for authentication lookup.
 */
export const getAffiliateByEmail = query({
  args: {
    tenantId: v.id("tenants"),
    email: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      vanitySlug: v.optional(v.string()),
      promotionChannel: v.optional(v.string()),
      payoutMethod: v.optional(v.object({
        type: v.string(),
        details: v.string(),
      })),
      // Fraud signals with review tracking (Story 5.7)
      fraudSignals: v.optional(v.array(v.object({
        type: v.string(),
        severity: v.string(),
        timestamp: v.number(),
        details: v.optional(v.string()),
        reviewedAt: v.optional(v.number()),
        reviewedBy: v.optional(v.string()),
        reviewNote: v.optional(v.string()),
      }))),
      commissionOverrides: v.optional(v.array(v.object({
        campaignId: v.id("campaigns"),
        rate: v.number(),
        status: v.optional(v.union(
          v.literal("active"),
          v.literal("paused"),
        )),
      }))),
      passwordHash: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", args.tenantId).eq("email", args.email)
      )
      .first();
  },
});

/**
 * Get affiliate by ID including passwordHash (for password verification in actions).
 */
export const getAffiliateWithPasswordHash = query({
  args: { affiliateId: v.id("affiliates") },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      passwordHash: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) return null;
    return {
      _id: affiliate._id,
      tenantId: affiliate.tenantId,
      email: affiliate.email,
      name: affiliate.name,
      uniqueCode: affiliate.uniqueCode,
      status: affiliate.status,
      passwordHash: affiliate.passwordHash,
    };
  },
});

/**
 * Get affiliate by referral code.
 * Used for tracking clicks and conversions.
 */
export const getAffiliateByCode = query({
  args: {
    tenantId: v.id("tenants"),
    code: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      vanitySlug: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_code", (q) =>
        q.eq("tenantId", args.tenantId).eq("uniqueCode", args.code)
      )
      .first();
  },
});

/**
 * Get all affiliates for the current tenant.
 * Used for owner dashboard to view affiliate list.
 * @security Requires authentication. Results automatically filtered by tenant.
 */
export const getAffiliatesByTenant = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("affiliates"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      vanitySlug: v.optional(v.string()),
      promotionChannel: v.optional(v.string()),
      payoutMethod: v.optional(v.object({
        type: v.string(),
        details: v.string(),
      })),
    })
  ),
  handler: async (ctx) => {
    const tenantId = await requireTenantId(ctx);

    return await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .take(500);
  },
});

/**
 * List affiliates filtered by status.
 * Used for the Affiliates page with tabbed navigation.
 * @security Requires authentication. Results filtered by tenant and status.
 */
export const listAffiliatesByStatus = query({
  args: {
    status: v.union(
      v.literal("all"),
      v.literal("pending"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("rejected")
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id("affiliates"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      vanitySlug: v.optional(v.string()),
      promotionChannel: v.optional(v.string()),
      payoutMethod: v.optional(v.object({
        type: v.string(),
        details: v.string(),
      })),
      referralCount: v.number(),
      clickCount: v.number(),
      totalEarnings: v.number(),
      fraudSignals: v.optional(v.array(v.object({
        type: v.string(),
        details: v.optional(v.string()),
        severity: v.string(),
        timestamp: v.number(),
        reviewedAt: v.optional(v.number()),
        reviewedBy: v.optional(v.string()),
        reviewNote: v.optional(v.string()),
        commissionId: v.optional(v.id("commissions")),
      }))),
    })
  ),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    const MAX_AFFILIATES = 1000;

    // Fetch affiliates for the tenant — capped to prevent unbounded reads
    let affiliates;
    if (args.status === "all") {
      affiliates = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .take(MAX_AFFILIATES);
    } else {
      affiliates = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant_and_status", (q) =>
          q.eq("tenantId", tenantId).eq("status", args.status)
        )
        .take(MAX_AFFILIATES);
    }

    if (affiliates.length === 0) {
      return [];
    }

    // Initialize maps for aggregation
    const clickCounts = new Map<Id<"affiliates">, number>();
    const conversionCounts = new Map<Id<"affiliates">, number>();
    const commissionTotals = new Map<Id<"affiliates">, number>();

    for (const affiliate of affiliates) {
      clickCounts.set(affiliate._id, 0);
      conversionCounts.set(affiliate._id, 0);
      commissionTotals.set(affiliate._id, 0);
    }

    // Fetch all clicks for the tenant and aggregate by affiliate
    const allClicks = await ctx.db
      .query("clicks")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .take(500);

    for (const click of allClicks) {
      if (clickCounts.has(click.affiliateId)) {
        clickCounts.set(click.affiliateId, (clickCounts.get(click.affiliateId) ?? 0) + 1);
      }
    }

    // Fetch all conversions for the tenant and aggregate by affiliate
    const allConversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .take(500);

    for (const conversion of allConversions) {
      if (conversion.affiliateId && conversionCounts.has(conversion.affiliateId)) {
        conversionCounts.set(conversion.affiliateId, (conversionCounts.get(conversion.affiliateId) ?? 0) + 1);
      }
    }

    // Fetch all commissions for the tenant and aggregate by affiliate
    // Only count approved commissions as earnings
    const allCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .take(500);

    for (const commission of allCommissions) {
      if (commissionTotals.has(commission.affiliateId)) {
        if (commission.status === "approved") {
          commissionTotals.set(commission.affiliateId, (commissionTotals.get(commission.affiliateId) ?? 0) + commission.amount);
        }
      }
    }

    // Build results with aggregated stats — explicitly pick fields (never leak passwordHash)
    return affiliates.map(affiliate => ({
      _id: affiliate._id,
      _creationTime: affiliate._creationTime,
      tenantId: affiliate.tenantId,
      email: affiliate.email,
      name: affiliate.name,
      uniqueCode: affiliate.uniqueCode,
      status: affiliate.status,
      vanitySlug: affiliate.vanitySlug,
      promotionChannel: affiliate.promotionChannel,
      payoutMethod: affiliate.payoutMethod,
      fraudSignals: affiliate.fraudSignals,
      referralCount: conversionCounts.get(affiliate._id) ?? 0,
      clickCount: clickCounts.get(affiliate._id) ?? 0,
      totalEarnings: commissionTotals.get(affiliate._id) ?? 0,
    }));
  },
});

// =============================================================================
// Internal Helpers — per-affiliate stats and campaign name resolution
// =============================================================================

type AffiliateDoc = {
  _id: Id<"affiliates">;
  _creationTime: number;
  tenantId: Id<"tenants">;
  email: string;
  name: string;
  uniqueCode: string;
  status: string;
  vanitySlug?: string;
  promotionChannel?: string;
  payoutMethod?: { type: string; details: string };
};

/**
 * Fetch per-affiliate stats using by_affiliate indexes.
 * Only fetches for the given affiliates (typically a page slice of 10-100),
 * avoiding full-table scans of clicks/conversions/commissions.
 * 
 * Caps are kept modest since these are list-view counts, not exact totals.
 * The detail page (getAffiliateStats) uses higher caps for accuracy.
 */
async function fetchPerAffiliateStats(
  ctx: any,
  affiliates: AffiliateDoc[],
  campaignNameMap: Map<string, string>,
): Promise<Array<{
  _id: Id<"affiliates">;
  _creationTime: number;
  tenantId: Id<"tenants">;
  email: string;
  name: string;
  uniqueCode: string;
  status: string;
  vanitySlug?: string;
  promotionChannel?: string;
  payoutMethod?: { type: string; details: string };
  campaignName?: string;
  referralCount: number;
  clickCount: number;
  totalEarnings: number;
}>> {
  const statPromises = affiliates.map(async (affiliate) => {
    const [clicks, conversions, commissions] = await Promise.all([
      ctx.db.query("clicks").withIndex("by_affiliate", (q: any) => q.eq("affiliateId", affiliate._id)).take(200),
      ctx.db.query("conversions").withIndex("by_tenant", (q: any) => q.eq("tenantId", affiliate.tenantId)).take(200).then((items: any[]) => items.filter((c: any) => c.affiliateId === affiliate._id)),
      ctx.db.query("commissions").withIndex("by_affiliate", (q: any) => q.eq("affiliateId", affiliate._id)).take(100),
    ]);

    const clickCount = clicks.length;
    const referralCount = conversions.length;
    let totalEarnings = 0;
    for (const comm of commissions) {
      if (comm.status === "approved") {
        totalEarnings += comm.amount;
      }
    }

    return {
      _id: affiliate._id,
      _creationTime: affiliate._creationTime,
      tenantId: affiliate.tenantId,
      email: affiliate.email,
      name: affiliate.name,
      uniqueCode: affiliate.uniqueCode,
      status: affiliate.status,
      vanitySlug: affiliate.vanitySlug,
      promotionChannel: affiliate.promotionChannel,
      payoutMethod: affiliate.payoutMethod,
      campaignName: campaignNameMap.get(affiliate._id.toString()),
      referralCount,
      clickCount,
      totalEarnings,
    };
  });

  return Promise.all(statPromises);
}

/**
 * Resolve campaign names for a set of affiliates using their referral links.
 * Fetches only the unique campaign documents needed.
 */
async function resolveCampaignNames(
  ctx: any,
  affiliates: AffiliateDoc[],
  allReferralLinks: Array<{ affiliateId: Id<"affiliates">; campaignId?: Id<"campaigns"> }>,
): Promise<Map<string, string>> {
  const affiliateIds = new Set(affiliates.map((a) => a._id.toString()));

  const campaignIdSet = new Set<string>();
  for (const link of allReferralLinks) {
    if (link.campaignId && affiliateIds.has(link.affiliateId.toString())) {
      campaignIdSet.add(link.campaignId.toString());
    }
  }

  if (campaignIdSet.size === 0) {
    return new Map();
  }

  const campaignDocs = await Promise.all(
    Array.from(campaignIdSet).map((id) => ctx.db.get(id as Id<"campaigns">))
  );
  const campaignIdToName = new Map<string, string>();
  for (const doc of campaignDocs) {
    if (doc) {
      campaignIdToName.set(doc._id.toString(), doc.name);
    }
  }

  const campaignNameMap = new Map<string, string>();
  for (const link of allReferralLinks) {
    const affKey = link.affiliateId.toString();
    if (!campaignNameMap.has(affKey) && link.campaignId) {
      const name = campaignIdToName.get(link.campaignId.toString());
      if (name) {
        campaignNameMap.set(affKey, name);
      }
    }
  }

  return campaignNameMap;
}

/**
 * List affiliates with server-side pagination, campaign filtering, and per-affiliate stats.
 * FAST PATH (default): fetches per-page stats via by_affiliate indexes (~30-75 reads).
 * STATS-REQUIRED PATH: batch-fetches tenant-wide stats only when stat filters/sort are active.
 * @security Requires authentication. Results filtered by tenant.
 */
export const listAffiliatesFiltered = query({
  args: {
    status: v.union(
      v.literal("all"),
      v.literal("pending"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("rejected")
    ),
    statuses: v.optional(v.array(v.string())),
    campaignIds: v.optional(v.array(v.id("campaigns"))),
    page: v.number(),
    numItems: v.number(),
    // ── Column-level filter args ──────────────────────────────────────
    searchQuery: v.optional(v.string()),
    referralMin: v.optional(v.number()),
    referralMax: v.optional(v.number()),
    clickMin: v.optional(v.number()),
    clickMax: v.optional(v.number()),
    earningsMin: v.optional(v.number()),
    earningsMax: v.optional(v.number()),
    joinedAfter: v.optional(v.number()),
    joinedBefore: v.optional(v.number()),
    sortBy: v.optional(v.union(
      v.literal("name"),
      v.literal("status"),
      v.literal("campaignName"),
      v.literal("referralCount"),
      v.literal("clickCount"),
      v.literal("totalEarnings"),
      v.literal("_creationTime")
    )),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("affiliates"),
        _creationTime: v.number(),
        tenantId: v.id("tenants"),
        email: v.string(),
        name: v.string(),
        uniqueCode: v.string(),
        status: v.string(),
        vanitySlug: v.optional(v.string()),
        promotionChannel: v.optional(v.string()),
        payoutMethod: v.optional(v.object({
          type: v.string(),
          details: v.string(),
        })),
        campaignName: v.optional(v.string()),
        referralCount: v.number(),
        clickCount: v.number(),
        totalEarnings: v.number(),
      })
    ),
    total: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    const { status, campaignIds, page } = args;
    // Cap numItems to prevent excessive data dumps
    const numItems = Math.min(args.numItems, 100);

    // Performance guard
    const MAX_AFFILIATES = 1000;

    // Detect whether stat-based filters or sorting require full table scans
    const needsStatPreFetch =
      args.referralMin != null || args.referralMax != null ||
      args.clickMin != null || args.clickMax != null ||
      args.earningsMin != null || args.earningsMax != null ||
      args.sortBy === "referralCount" || args.sortBy === "clickCount" || args.sortBy === "totalEarnings";

    // ── Step 1: Fetch referralLinks only when needed ──
    // Only fetch the full tenant-wide set when a campaign filter is active.
    // In the fast path (no campaign filter), campaign names are resolved lazily
    // for the page slice using by_affiliate indexes (much smaller reads).
    let allReferralLinks: Array<{ affiliateId: Id<"affiliates">; campaignId?: Id<"campaigns"> }> = [];
    const needsCampaignFilter = campaignIds && campaignIds.length > 0;

    if (needsCampaignFilter) {
      allReferralLinks = await ctx.db
        .query("referralLinks")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .take(5000);
    }

    // Build campaign allowlist if campaign filter is active
    let campaignAllowlist: Set<Id<"affiliates">> | null = null;
    if (campaignIds && campaignIds.length > 0) {
      const campaignSet = new Set(campaignIds.map((id) => id.toString()));
      campaignAllowlist = new Set<Id<"affiliates">>();
      for (const link of allReferralLinks) {
        if (link.campaignId && campaignSet.has(link.campaignId.toString())) {
          campaignAllowlist.add(link.affiliateId);
        }
      }
    }

    // ── Step 2: Fetch affiliates matching status filter — capped reads ──
    let affiliates;
    if (status === "all") {
      affiliates = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .take(MAX_AFFILIATES);
    } else {
      affiliates = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant_and_status", (q) =>
          q.eq("tenantId", tenantId).eq("status", status)
        )
        .take(MAX_AFFILIATES);
    }

    // ── Step 3: Apply statuses multi-select filter ──
    if (args.statuses && args.statuses.length > 0) {
      const statusSet = new Set(args.statuses.map((s) => s.toLowerCase()));
      affiliates = affiliates.filter((a) => statusSet.has(a.status.toLowerCase()));
    }

    // ── Step 4: Apply campaign allowlist ──
    if (campaignAllowlist) {
      affiliates = affiliates.filter((a) => campaignAllowlist!.has(a._id));
    }

    if (affiliates.length > MAX_AFFILIATES) {
      console.warn(
        `[listAffiliatesFiltered] Tenant ${tenantId} has ${affiliates.length} affiliates (max ${MAX_AFFILIATES}).`
      );
    }

    if (affiliates.length === 0) {
      return { page: [], total: 0, hasMore: false };
    }

    // ── Step 5: Text search and date filters (no stats needed) ──
    if (args.searchQuery && args.searchQuery.trim()) {
      const q = args.searchQuery.toLowerCase().trim();
      affiliates = affiliates.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.uniqueCode.toLowerCase().includes(q)
      );
    }
    if (args.joinedAfter != null) {
      affiliates = affiliates.filter((a) => a._creationTime >= args.joinedAfter!);
    }
    if (args.joinedBefore != null) {
      affiliates = affiliates.filter((a) => a._creationTime <= args.joinedBefore!);
    }

    // ── Step 6a: FAST PATH — no stat filters/sort, fetch per-page stats only ──
    if (!needsStatPreFetch) {
      const total = affiliates.length;

      // Sort by affiliate-level fields only (name, status, _creationTime)
      const sortByField = args.sortBy ?? "_creationTime";
      const sortDirection = args.sortOrder === "asc" ? 1 : -1;

      affiliates.sort((a, b) => {
        let aVal: string | number;
        let bVal: string | number;
        switch (sortByField) {
          case "name":
            aVal = a.name.toLowerCase();
            bVal = b.name.toLowerCase();
            break;
          case "status":
            aVal = a.status.toLowerCase();
            bVal = b.status.toLowerCase();
            break;
          case "_creationTime":
          default:
            aVal = a._creationTime;
            bVal = b._creationTime;
            break;
        }
        if (typeof aVal === "string" && typeof bVal === "string") {
          return aVal.localeCompare(bVal) * sortDirection;
        }
        return ((aVal as number) - (bVal as number)) * sortDirection;
      });

      // Paginate
      const startIndex = (page - 1) * numItems;
      const endIndex = startIndex + numItems;
      const pageAffiliates = affiliates.slice(startIndex, endIndex);
      const hasMore = endIndex < total;

      if (pageAffiliates.length === 0) {
        return { page: [], total, hasMore: false };
      }

      // Fetch stats ONLY for the page slice — by_affiliate indexes, bounded per affiliate
      // For campaign names: use pre-loaded allReferralLinks if available (campaign filter),
      // otherwise fetch only the page-slice links via by_affiliate index (lazy load).
      let campaignNameMap: Map<string, string>;
      if (allReferralLinks.length > 0) {
        campaignNameMap = await resolveCampaignNames(
          ctx, pageAffiliates, allReferralLinks
        );
      } else {
        // Lazy-load referral links for the page slice in PARALLEL (not sequential).
        // Each affiliate typically has 1-5 links, so by_affiliate with take(50) is cheap.
        const pageReferralLinks: Array<{ affiliateId: Id<"affiliates">; campaignId?: Id<"campaigns"> }> = [];
        const linkBatches = await Promise.all(
          pageAffiliates.map(affiliate =>
            ctx.db
              .query("referralLinks")
              .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliate._id))
              .take(50)
          )
        );
        for (const batch of linkBatches) {
          pageReferralLinks.push(...batch);
        }
        campaignNameMap = await resolveCampaignNames(
          ctx, pageAffiliates, pageReferralLinks
        );
      }

      const pageWithStats = await fetchPerAffiliateStats(ctx, pageAffiliates, campaignNameMap);
      return { page: pageWithStats, total, hasMore };
    }

    // ── Step 6b: STATS-REQUIRED PATH — batch fetch for stat filters/sort ──
    // Needed when user filters/sorts by referralCount, clickCount, or totalEarnings.
    // Must fetch all stats to pre-filter and sort. Capped reads prevent 1MB crashes.

    if (affiliates.length > 200) {
      console.warn(
        `[listAffiliatesFiltered] Stats-required path with ${affiliates.length} affiliates.`
      );
    }

    const [allClicks, allConversions, allCommissions] = await Promise.all([
      ctx.db.query("clicks").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).take(5000),
      ctx.db.query("conversions").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).take(2000),
      ctx.db.query("commissions").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).take(2000),
    ]);

    // Build stat maps
    const clickCountMap = new Map<string, number>();
    const referralCountMap = new Map<string, number>();
    const earningsMap = new Map<string, number>();

    for (const click of allClicks) {
      const key = click.affiliateId.toString();
      clickCountMap.set(key, (clickCountMap.get(key) ?? 0) + 1);
    }
    for (const conv of allConversions) {
      if (conv.affiliateId) {
        const key = conv.affiliateId.toString();
        referralCountMap.set(key, (referralCountMap.get(key) ?? 0) + 1);
      }
    }
    for (const comm of allCommissions) {
      if (comm.status === "approved") {
        const key = comm.affiliateId.toString();
        earningsMap.set(key, (earningsMap.get(key) ?? 0) + comm.amount);
      }
    }

    // Merge stats onto affiliate objects
    let affiliatesWithStats = affiliates.map((affiliate) => {
      const key = affiliate._id.toString();
      return {
        ...affiliate,
        referralCount: referralCountMap.get(key) ?? 0,
        clickCount: clickCountMap.get(key) ?? 0,
        totalEarnings: earningsMap.get(key) ?? 0,
      };
    });

    // Apply stat range filters
    if (args.referralMin != null) {
      affiliatesWithStats = affiliatesWithStats.filter((a) => a.referralCount >= args.referralMin!);
    }
    if (args.referralMax != null) {
      affiliatesWithStats = affiliatesWithStats.filter((a) => a.referralCount <= args.referralMax!);
    }
    if (args.clickMin != null) {
      affiliatesWithStats = affiliatesWithStats.filter((a) => a.clickCount >= args.clickMin!);
    }
    if (args.clickMax != null) {
      affiliatesWithStats = affiliatesWithStats.filter((a) => a.clickCount <= args.clickMax!);
    }
    if (args.earningsMin != null) {
      affiliatesWithStats = affiliatesWithStats.filter((a) => a.totalEarnings >= args.earningsMin!);
    }
    if (args.earningsMax != null) {
      affiliatesWithStats = affiliatesWithStats.filter((a) => a.totalEarnings <= args.earningsMax!);
    }

    const total = affiliatesWithStats.length;

    // Resolve campaign names for all filtered affiliates
    const campaignNameMap = await resolveCampaignNames(
      ctx, affiliatesWithStats, allReferralLinks
    );

    // Dynamic sort (supports all fields including stat-based)
    const sortByField = args.sortBy ?? "_creationTime";
    const sortDirection = args.sortOrder === "asc" ? 1 : -1;

    affiliatesWithStats.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortByField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "status":
          aVal = a.status.toLowerCase();
          bVal = b.status.toLowerCase();
          break;
        case "campaignName":
          aVal = (campaignNameMap.get(a._id.toString()) ?? "").toLowerCase();
          bVal = (campaignNameMap.get(b._id.toString()) ?? "").toLowerCase();
          break;
        case "referralCount":
          aVal = a.referralCount;
          bVal = b.referralCount;
          break;
        case "clickCount":
          aVal = a.clickCount;
          bVal = b.clickCount;
          break;
        case "totalEarnings":
          aVal = a.totalEarnings;
          bVal = b.totalEarnings;
          break;
        case "_creationTime":
        default:
          aVal = a._creationTime;
          bVal = b._creationTime;
          break;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal) * sortDirection;
      }
      return ((aVal as number) - (bVal as number)) * sortDirection;
    });

    // Paginate
    const startIndex = (page - 1) * numItems;
    const endIndex = startIndex + numItems;
    const pageAffiliates = affiliatesWithStats.slice(startIndex, endIndex);
    const hasMore = endIndex < total;

    if (pageAffiliates.length === 0) {
      return { page: [], total, hasMore: false };
    }

    const pageWithStats = pageAffiliates.map((affiliate) => ({
      _id: affiliate._id,
      _creationTime: affiliate._creationTime,
      tenantId: affiliate.tenantId,
      email: affiliate.email,
      name: affiliate.name,
      uniqueCode: affiliate.uniqueCode,
      status: affiliate.status,
      vanitySlug: affiliate.vanitySlug,
      promotionChannel: affiliate.promotionChannel,
      payoutMethod: affiliate.payoutMethod,
      campaignName: campaignNameMap.get(affiliate._id.toString()),
      referralCount: affiliate.referralCount,
      clickCount: affiliate.clickCount,
      totalEarnings: affiliate.totalEarnings,
    }));

    return { page: pageWithStats, total, hasMore };
  },
});

/**
 * Get count of affiliates by status.
 * Uses denormalized tenantStats counters for fast reads.
 * These are maintained by updateAffiliateCount hooks on every status change.
 * @security Requires authentication. Results filtered by tenant. Returns zeros if not authenticated.
 */
export const getAffiliateCountByStatus = query({
  args: {
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("rejected")
    )),
  },
  returns: v.object({
    pending: v.number(),
    active: v.number(),
    suspended: v.number(),
    rejected: v.number(),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx);

    if (!tenantId) {
      return {
        pending: 0,
        active: 0,
        suspended: 0,
        rejected: 0,
        total: 0,
      };
    }

    const stats = await ctx.db
      .query("tenantStats")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .first();

    const pending = stats?.affiliatesPending ?? 0;
    const active = stats?.affiliatesActive ?? 0;
    const suspended = stats?.affiliatesSuspended ?? 0;
    const rejected = stats?.affiliatesRejected ?? 0;

    return { pending, active, suspended, rejected, total: pending + active + suspended + rejected };
  },
});

/**
 * Register a new affiliate.
 * This is the primary registration function for the affiliate portal.
 * Creates an affiliate record with "pending" status (requires approval).
 * @security Requires authentication. Affiliate is created in the authenticated user's tenant.
 */
export const registerAffiliate = mutation({
  args: {
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    passwordHash: v.string(),
  },
  returns: v.object({
    affiliateId: v.id("affiliates"),
    uniqueCode: v.string(),
    status: v.string(),
  }),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    
    // Check if affiliate already exists for this tenant
    const existingAffiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", tenantId).eq("email", args.email)
      )
      .first();

    if (existingAffiliate) {
      throw new Error("An affiliate with this email already exists in this tenant");
    }

    // Check tier limits before creating affiliate
    const tierConfig = await ctx.runQuery(api.tierConfig.getMyTierConfig);
    if (tierConfig) {
      const currentAffiliates = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .take(500);
      
      const affiliateCount = currentAffiliates.length;
      
      // Check if limit is enforced (not unlimited = -1)
      if (tierConfig.maxAffiliates !== -1 && affiliateCount >= tierConfig.maxAffiliates) {
        throw new Error(
          `Affiliate limit reached (${affiliateCount}/${tierConfig.maxAffiliates}). ` +
          `Please upgrade your plan to add more affiliates.`
        );
      }
    }

    // Generate unique referral code
    let uniqueCode = await generateUniqueReferralCode(ctx);
    let attempts = 0;
    while (!(await isCodeUnique(ctx, tenantId, uniqueCode)) && attempts < 10) {
      uniqueCode = await generateUniqueReferralCode(ctx);
      attempts++;
    }

    if (attempts >= 10) {
      throw new Error("Failed to generate unique referral code");
    }

    const fullName = `${args.firstName} ${args.lastName}`.trim();

    // Create affiliate with pending status (requires approval)
    const affiliateId = await ctx.db.insert("affiliates", {
      tenantId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      name: fullName,
      uniqueCode,
      status: "pending",
      passwordHash: args.passwordHash,
    });

    await updateAffiliateCount(ctx, tenantId, undefined, "pending");

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_registered",
      entityType: "affiliate",
      entityId: affiliateId,
      actorType: "system",
      newValue: { email: args.email, name: fullName, uniqueCode, status: "pending" },
    });

    return {
      affiliateId,
      uniqueCode,
      status: "pending",
    };
  },
});

export const inviteAffiliate = mutation({
  args: {
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    promotionChannel: v.optional(v.string()),
  },
  returns: v.object({
    affiliateId: v.id("affiliates"),
    uniqueCode: v.string(),
    status: v.string(),
  }),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }
    if (authUser.role !== "owner" && authUser.role !== "manager") {
      throw new Error("Forbidden: Only owners and managers can invite affiliates");
    }

    const tenantId = authUser.tenantId;

    const existingAffiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", tenantId).eq("email", args.email)
      )
      .first();

    if (existingAffiliate) {
      throw new Error("An affiliate with this email already exists in your program");
    }

    const tierConfig = await ctx.runQuery(api.tierConfig.getMyTierConfig);
    if (tierConfig) {
      const currentAffiliates = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .take(500);

      if (tierConfig.maxAffiliates !== -1 && currentAffiliates.length >= tierConfig.maxAffiliates) {
        throw new Error(
          `Affiliate limit reached (${currentAffiliates.length}/${tierConfig.maxAffiliates}). Please upgrade your plan to add more affiliates.`
        );
      }
    }

    let uniqueCode = await generateUniqueReferralCode(ctx);
    let attempts = 0;
    while (!(await isCodeUnique(ctx, tenantId, uniqueCode)) && attempts < 10) {
      uniqueCode = await generateUniqueReferralCode(ctx);
      attempts++;
    }

    if (attempts >= 10) {
      throw new Error("Failed to generate unique referral code");
    }

    const fullName = `${args.firstName} ${args.lastName}`.trim();

    const affiliateId = await ctx.db.insert("affiliates", {
      tenantId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      name: fullName,
      uniqueCode,
      status: "active",
      promotionChannel: args.promotionChannel,
    });

    await updateAffiliateCount(ctx, tenantId, undefined, "active");

    // Attribution Resilience: Generate coupon code on activation (invited affiliates start as active)
    ctx.runMutation(internal.couponCodes.onAffiliateActivated, {
      tenantId,
      affiliateId,
    }).catch((err) => {
      console.error("[CouponCode] Failed to generate coupon code on invite:", err);
    });

    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_invited",
      entityType: "affiliate",
      entityId: affiliateId,
      actorType: "user",
      actorId: authUser.userId,
      newValue: { email: args.email, name: fullName, uniqueCode, status: "active" },
    });

    return {
      affiliateId,
      uniqueCode,
      status: "active",
    };
  },
});

/**
 * Approve or reject an affiliate application.
 * Used by SaaS Owner/Manager to approve affiliate registrations.
 * @security Requires authentication. Validates that the affiliate belongs to the current tenant.
 * @security Requires 'affiliates:manage' permission.
 */
export const updateAffiliateStatus = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    status: v.string(),
  },
  returns: v.null(),
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
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=updateAffiliateStatus`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to manage affiliates");
    }
    
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }
    
    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    const validStatuses = ["pending", "active", "suspended", "rejected"];
    if (!validStatuses.includes(args.status)) {
      throw new Error(`Invalid status: ${args.status}. Must be one of: ${validStatuses.join(", ")}`);
    }

    const previousStatus = affiliate.status;
    await ctx.db.patch(args.affiliateId, { status: args.status });

    await updateAffiliateCount(ctx, tenantId, previousStatus, args.status);

    // Attribution Resilience: Generate coupon code on activation
    if (args.status === "active" && previousStatus !== "active") {
      ctx.runMutation(internal.couponCodes.onAffiliateActivated, {
        tenantId,
        affiliateId: args.affiliateId,
      }).catch((err) => {
        console.error("[CouponCode] Failed to generate coupon code on status update:", err);
      });
    }

    // Auto-generate a referral link when an affiliate is approved (if they don't have one)
    if (args.status === "active" && previousStatus !== "active") {
      const existingLinks = await ctx.db
        .query("referralLinks")
        .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
        .first();

      if (!existingLinks) {
        const referralCode = await generateUniqueReferralCode(ctx);
        await ctx.db.insert("referralLinks", {
          tenantId,
          affiliateId: args.affiliateId,
          code: referralCode,
        });

        // Create audit log for auto-generated referral link
        await ctx.db.insert("auditLogs", {
          tenantId,
          action: "referral_link_auto_created",
          entityType: "referralLink",
          entityId: args.affiliateId,
          actorType: "system",
          newValue: {
            affiliateId: args.affiliateId,
            code: referralCode,
            reason: "auto_created_on_approval",
          },
        });
      }
    }

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_status_updated",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { status: previousStatus },
      newValue: { status: args.status },
    });

    return null;
  },
});

/**
 * Authenticate affiliate by email and password.
 * Used for affiliate portal login.
 * Returns null if authentication fails.
 */
export const authenticateAffiliate = query({
  args: {
    tenantId: v.id("tenants"),
    email: v.string(),
    passwordHash: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      vanitySlug: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", args.tenantId).eq("email", args.email)
      )
      .first();

    if (!affiliate) {
      return null;
    }

    // Check if affiliate has password set
    if (!affiliate.passwordHash) {
      return null;
    }

    // Compare password hashes (client should send hashed password)
    if (affiliate.passwordHash !== args.passwordHash) {
      return null;
    }

    // Only allow active affiliates to authenticate
    if (affiliate.status !== "active") {
      return null;
    }

    return {
      _id: affiliate._id,
      tenantId: affiliate.tenantId,
      email: affiliate.email,
      name: affiliate.name,
      uniqueCode: affiliate.uniqueCode,
      status: affiliate.status,
    };
  },
});

/**
 * Update affiliate profile.
 * Affiliates can update their name and payout method.
 * @security Requires authentication. Validates tenant ownership.
 */
export const updateAffiliateProfile = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    name: v.optional(v.string()),
    payoutMethod: v.optional(v.object({
      type: v.string(),
      details: v.string(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }
    
    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    const updates: Record<string, any> = {};
    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.payoutMethod !== undefined) {
      updates.payoutMethod = args.payoutMethod;
    }

    await ctx.db.patch(args.affiliateId, updates);

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_profile_updated",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorType: "affiliate",
      previousValue: { name: affiliate.name, payoutMethod: affiliate.payoutMethod },
      newValue: updates,
    });

    return null;
  },
});

/**
 * Update affiliate password.
 * @security Requires authentication. Validates tenant ownership.
 */
export const updateAffiliatePassword = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    currentPasswordHash: v.string(),
    newPasswordHash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }
    
    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    if (!affiliate.passwordHash || affiliate.passwordHash !== args.currentPasswordHash) {
      throw new Error("Current password is incorrect");
    }

    await ctx.db.patch(args.affiliateId, { passwordHash: args.newPasswordHash });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_password_updated",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorType: "affiliate",
    });

    return null;
  },
});

/**
 * Set affiliate password (for new affiliates approved by owner).
 * Used when owner approves an affiliate and they set their password.
 * @security Requires authentication. Validates tenant ownership.
 */
export const setAffiliatePassword = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    newPasswordHash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }
    
    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    if (affiliate.passwordHash) {
      throw new Error("Password already set. Use updateAffiliatePassword instead.");
    }

    await ctx.db.patch(args.affiliateId, { passwordHash: args.newPasswordHash });

    // Audit log — affiliate password set (non-fatal, no password value logged)
    try {
      await ctx.runMutation(internal.audit.logAuditEventInternal, {
        tenantId,
        action: "AFFILIATE_PASSWORD_SET",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorType: "user",
        metadata: { affiliateId: args.affiliateId },
      });
    } catch (err) {
      console.error("[Audit] Failed to log AFFILIATE_PASSWORD_SET (non-fatal):", err);
    }

    return null;
  },
});

/**
 * Suspend or reactivate an affiliate.
 * Used by SaaS Owner/Manager to manage affiliate status.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission.
 */
export const setAffiliateStatus = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("rejected")
    ),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
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
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=setAffiliateStatus`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to manage affiliates");
    }
    
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }
    
    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    const previousStatus = affiliate.status;
    await ctx.db.patch(args.affiliateId, { status: args.status });

    await updateAffiliateCount(ctx, tenantId, previousStatus, args.status);

    // Add fraud signal if suspended with reason
    if (args.status === "suspended" && args.reason) {
      const fraudSignals = affiliate.fraudSignals || [];
      fraudSignals.push({
        type: "manual_suspension",
        severity: "high",
        timestamp: Date.now(),
        details: args.reason,
        signalId: generateSignalId(),
      });
      await ctx.db.patch(args.affiliateId, { fraudSignals });
    }

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: `affiliate_${args.status}`,
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { status: previousStatus },
      newValue: { status: args.status, reason: args.reason },
    });

    return null;
  },
});

/**
 * Suspend an active affiliate.
 * Changes status from "active" to "suspended", invalidates sessions, and sends suspension email.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission (Owner/Manager only).
 */
export const suspendAffiliate = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=suspendAffiliate`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to suspend affiliates");
    }

    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate affiliate is in "active" status
    if (affiliate.status !== "active") {
      throw new Error(`Cannot suspend affiliate with status "${affiliate.status}". Only active affiliates can be suspended.`);
    }

    // Update status to suspended
    await ctx.db.patch(args.affiliateId, { status: "suspended" });

    await updateAffiliateCount(ctx, tenantId, "active", "suspended");

    // Add fraud signal if reason provided
    if (args.reason) {
      const fraudSignals = affiliate.fraudSignals || [];
      fraudSignals.push({
        type: "manual_suspension",
        severity: "high",
        timestamp: Date.now(),
        details: args.reason,
        signalId: generateSignalId(),
      });
      await ctx.db.patch(args.affiliateId, { fraudSignals });
    }

    // Notify owner and affiliate
    try {
      const affiliateUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", affiliate.email))
        .first();
      if (affiliateUser) {
        await ctx.runMutation(internal.notifications.createNotification, {
          tenantId,
          userId: affiliateUser._id,
          type: "affiliate.suspended",
          title: "Affiliate Suspended",
          message: `Your affiliate account has been suspended.${args.reason ? ` Reason: ${args.reason}` : ""}`,
          severity: "warning",
        });
      }
    } catch (notifErr) {
      console.error("[Notification] Failed to notify affiliate on suspension:", notifErr);
    }
    try {
      await ctx.runMutation(internal.notifications.createNotification, {
        tenantId,
        userId: authUser.userId,
        type: "affiliate.suspended",
        title: "Affiliate Suspended",
        message: `You suspended affiliate ${affiliate.name} (${affiliate.email}).${args.reason ? ` Reason: ${args.reason}` : ""}`,
        severity: "warning",
      });
    } catch (notifErr) {
      console.error("[Notification] Failed to notify owner on suspension:", notifErr);
    }

    // Invalidate all affiliate sessions
    await ctx.runMutation(internal.affiliates.invalidateAffiliateSessions, {
      affiliateId: args.affiliateId,
      tenantId,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_suspended",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { status: "active" },
      newValue: { status: "suspended", reason: args.reason },
    });

    // Schedule suspension email to be sent (non-blocking)
    try {
      const tenant = await ctx.db.get(tenantId);
      const contactEmail = process.env.SUPPORT_EMAIL || "support@saligaffiliate.com";
      
      await ctx.scheduler.runAfter(0, api.email.sendSuspensionEmail, {
        tenantId,
        affiliateId: args.affiliateId,
        affiliateEmail: affiliate.email,
        affiliateName: affiliate.name,
        reason: args.reason,
        portalName: tenant?.branding?.portalName || tenant?.name || "Affiliate Portal",
        brandLogoUrl: tenant?.branding?.logoUrl,
        brandPrimaryColor: tenant?.branding?.primaryColor,
        contactEmail,
      });
    } catch (error) {
      // Log email scheduling failure but don't fail the suspension
      console.error("Failed to schedule suspension email:", error);
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "email_schedule_failed",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorType: "system",
        metadata: {
          additionalInfo: `Failed to schedule suspension email to ${affiliate.email}`,
        },
      });
    }

    return null;
  },
});

/**
 * Reactivate a suspended affiliate.
 * Changes status from "suspended" to "active" and sends reactivation email.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission (Owner/Manager only).
 */
export const reactivateAffiliate = mutation({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=reactivateAffiliate`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to reactivate affiliates");
    }

    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate affiliate is in "suspended" status
    if (affiliate.status !== "suspended") {
      throw new Error(`Cannot reactivate affiliate with status "${affiliate.status}". Only suspended affiliates can be reactivated.`);
    }

    // Update status to active
    await ctx.db.patch(args.affiliateId, { status: "active" });

    await updateAffiliateCount(ctx, tenantId, "suspended", "active");

    // Notify owner and affiliate
    try {
      const affiliateUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", affiliate.email))
        .first();
      if (affiliateUser) {
        await ctx.runMutation(internal.notifications.createNotification, {
          tenantId,
          userId: affiliateUser._id,
          type: "affiliate.reactivated",
          title: "Affiliate Reactivated",
          message: `Your affiliate account has been reactivated. You can now access the portal again.`,
          severity: "success",
        });
      }
    } catch (notifErr) {
      console.error("[Notification] Failed to notify affiliate on reactivation:", notifErr);
    }
    try {
      await ctx.runMutation(internal.notifications.createNotification, {
        tenantId,
        userId: authUser.userId,
        type: "affiliate.reactivated",
        title: "Affiliate Reactivated",
        message: `You reactivated affiliate ${affiliate.name} (${affiliate.email}).`,
        severity: "success",
      });
    } catch (notifErr) {
      console.error("[Notification] Failed to notify owner on reactivation:", notifErr);
    }

    // Attribution Resilience: Generate coupon code on reactivation (preserves existing if present)
    ctx.runMutation(internal.couponCodes.onAffiliateActivated, {
      tenantId,
      affiliateId: args.affiliateId,
    }).catch((err) => {
      console.error("[CouponCode] Failed to generate coupon code on reactivation:", err);
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_reactivated",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { status: "suspended" },
      newValue: { status: "active" },
    });

    // Schedule reactivation email to be sent (non-blocking)
    try {
      const tenant = await ctx.db.get(tenantId);
      const portalLoginUrl = tenant?.slug 
        ? `${process.env.SITE_URL || 'https://app.saligaffiliate.com'}/portal/login?tenant=${tenant.slug}`
        : `${process.env.SITE_URL || 'https://app.saligaffiliate.com'}/portal/login`;
      const contactEmail = process.env.SUPPORT_EMAIL || "support@saligaffiliate.com";
      
      await ctx.scheduler.runAfter(0, api.email.sendReactivationEmail, {
        tenantId,
        affiliateId: args.affiliateId,
        affiliateEmail: affiliate.email,
        affiliateName: affiliate.name,
        portalName: tenant?.branding?.portalName || tenant?.name || "Affiliate Portal",
        brandLogoUrl: tenant?.branding?.logoUrl,
        brandPrimaryColor: tenant?.branding?.primaryColor,
        portalLoginUrl,
        contactEmail,
      });
    } catch (error) {
      // Log email scheduling failure but don't fail the reactivation
      console.error("Failed to schedule reactivation email:", error);
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "email_schedule_failed",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorType: "system",
        metadata: {
          additionalInfo: `Failed to schedule reactivation email to ${affiliate.email}`,
        },
      });
    }

    return null;
  },
});

/**
 * Invalidate all sessions for an affiliate.
 * Internal mutation used when suspending an affiliate.
 */
export const invalidateAffiliateSessions = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    tenantId: v.id("tenants"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find all active sessions for this affiliate
    const sessions = await ctx.db
      .query("affiliateSessions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .take(100);

    // Delete all sessions (immediate invalidation)
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    return null;
  },
});

/**
 * Approve a pending affiliate application.
 * Changes status from "pending" to "active" and sends approval email.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission (Owner/Manager only).
 */
export const approveAffiliate = mutation({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=approveAffiliate`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to approve affiliates");
    }

    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate affiliate is in "pending" status
    if (affiliate.status !== "pending") {
      throw new Error(`Cannot approve affiliate with status "${affiliate.status}". Only pending affiliates can be approved.`);
    }

    // Update status to active
    await ctx.db.patch(args.affiliateId, { status: "active" });

    await updateAffiliateCount(ctx, tenantId, "pending", "active");

    // Attribution Resilience: Generate coupon code on activation
    ctx.runMutation(internal.couponCodes.onAffiliateActivated, {
      tenantId,
      affiliateId: args.affiliateId,
    }).catch((err) => {
      console.error("[CouponCode] Failed to generate coupon code on approval:", err);
    });

    // Notify owner and affiliate
    try {
      const affiliateUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", affiliate.email))
        .first();
      if (affiliateUser) {
        await ctx.runMutation(internal.notifications.createNotification, {
          tenantId,
          userId: affiliateUser._id,
          type: "affiliate.approved",
          title: "Affiliate Approved",
          message: `Your affiliate application has been approved. Welcome to the program!`,
          severity: "info",
        });
      }
    } catch (notifErr) {
      console.error("[Notification] Failed to notify affiliate on approval:", notifErr);
    }
    try {
      await ctx.runMutation(internal.notifications.createNotification, {
        tenantId,
        userId: authUser.userId,
        type: "affiliate.approved",
        title: "Affiliate Approved",
        message: `You approved affiliate ${affiliate.name} (${affiliate.email}).`,
        severity: "info",
      });
    } catch (notifErr) {
      console.error("[Notification] Failed to notify owner on affiliate approval:", notifErr);
    }

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_approved",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { status: "pending" },
      newValue: { status: "active" },
    });

    // Schedule approval email to be sent (non-blocking)
    try {
      const tenant = await ctx.db.get(tenantId);
      // Construct portal login URL - in production, this should come from tenant config or custom domain
      const portalLoginUrl = tenant?.slug 
        ? `${process.env.SITE_URL || 'https://app.saligaffiliate.com'}/portal/login?tenant=${tenant.slug}`
        : `${process.env.SITE_URL || 'https://app.saligaffiliate.com'}/portal/login`;
      // Get contact email from tenant admin
      const contactEmail = process.env.SUPPORT_EMAIL || "support@saligaffiliate.com";
      
      await ctx.scheduler.runAfter(0, api.email.sendApprovalEmail, {
        tenantId,
        affiliateId: args.affiliateId,
        affiliateEmail: affiliate.email,
        affiliateName: affiliate.name,
        portalName: tenant?.branding?.portalName || tenant?.name || "Affiliate Portal",
        brandLogoUrl: tenant?.branding?.logoUrl,
        brandPrimaryColor: tenant?.branding?.primaryColor,
        portalLoginUrl,
        contactEmail,
      });
    } catch (error) {
      // Log email scheduling failure but don't fail the approval
      console.error("Failed to schedule approval email:", error);
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "email_schedule_failed",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorType: "system",
        metadata: {
          additionalInfo: `Failed to schedule approval email to ${affiliate.email}`,
        },
      });
    }

    return null;
  },
});

/**
 * Reject a pending affiliate application.
 * Changes status from "pending" to "rejected" and sends rejection email.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission (Owner/Manager only).
 */
export const rejectAffiliate = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=rejectAffiliate`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to reject affiliates");
    }

    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate affiliate is in "pending" status
    if (affiliate.status !== "pending") {
      throw new Error(`Cannot reject affiliate with status "${affiliate.status}". Only pending affiliates can be rejected.`);
    }

    // Update status to rejected
    await ctx.db.patch(args.affiliateId, { status: "rejected" });

    await updateAffiliateCount(ctx, tenantId, "pending", "rejected");

    // Notify owner
    try {
      await ctx.runMutation(internal.notifications.createNotification, {
        tenantId,
        userId: authUser.userId,
        type: "affiliate.rejected",
        title: "Affiliate Rejected",
        message: `You rejected affiliate ${affiliate.name} (${affiliate.email}).${args.reason ? ` Reason: ${args.reason}` : ""}`,
        severity: "warning",
      });
    } catch (notifErr) {
      console.error("[Notification] Failed to notify owner on affiliate rejection:", notifErr);
    }

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_rejected",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { status: "pending" },
      newValue: { status: "rejected", reason: args.reason },
    });

    // Schedule rejection email to be sent (non-blocking)
    try {
      const tenant = await ctx.db.get(tenantId);
      const contactEmail = process.env.SUPPORT_EMAIL || "support@saligaffiliate.com";
      
      await ctx.scheduler.runAfter(0, api.email.sendRejectionEmail, {
        tenantId,
        affiliateId: args.affiliateId,
        affiliateEmail: affiliate.email,
        affiliateName: affiliate.name,
        reason: args.reason,
        portalName: tenant?.branding?.portalName || tenant?.name || "Affiliate Portal",
        brandLogoUrl: tenant?.branding?.logoUrl,
        brandPrimaryColor: tenant?.branding?.primaryColor,
        contactEmail,
      });
    } catch (error) {
      // Log email scheduling failure but don't fail the rejection
      console.error("Failed to schedule rejection email:", error);
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "email_schedule_failed",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorType: "system",
        metadata: {
          additionalInfo: `Failed to schedule rejection email to ${affiliate.email}`,
        },
      });
    }

    return null;
  },
});

/**
 * Bulk approve multiple pending affiliates.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission (Owner/Manager only).
 * @security Max 50 affiliates per bulk operation to prevent abuse.
 */
export const bulkApproveAffiliates = mutation({
  args: {
    affiliateIds: v.array(v.id("affiliates")),
  },
  returns: v.object({
    success: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx, args) => {
    // Rate limiting: max 50 affiliates per bulk operation
    const MAX_BULK_SIZE = 50;
    if (args.affiliateIds.length > MAX_BULK_SIZE) {
      throw new Error(`Bulk operation limited to ${MAX_BULK_SIZE} affiliates at a time. You selected ${args.affiliateIds.length}.`);
    }
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: "bulk_operation",
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=bulkApproveAffiliates, count=${args.affiliateIds.length}`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to bulk approve affiliates");
    }

    let success = 0;
    let failed = 0;

    for (const affiliateId of args.affiliateIds) {
      try {
        const affiliate = await ctx.db.get(affiliateId);
        if (!affiliate || affiliate.tenantId !== tenantId) {
          failed++;
          continue;
        }

        if (affiliate.status !== "pending") {
          failed++;
          continue;
        }

        // Update status to active
        await ctx.db.patch(affiliateId, { status: "active" });

        await updateAffiliateCount(ctx, tenantId, "pending", "active");

        // Attribution Resilience: Generate coupon code on activation
        ctx.runMutation(internal.couponCodes.onAffiliateActivated, {
          tenantId,
          affiliateId: affiliateId,
        }).catch((err) => {
          console.error(`[CouponCode] Failed to generate coupon code for ${affiliateId}:`, err);
        });

        // Create audit log entry
        await ctx.db.insert("auditLogs", {
          tenantId,
          action: "affiliate_approved",
          entityType: "affiliate",
          entityId: affiliateId,
          actorId: authUser.userId,
          actorType: "user",
          previousValue: { status: "pending" },
          newValue: { status: "active" },
        });

        // Schedule approval email to be sent (non-blocking)
        try {
          const tenant = await ctx.db.get(tenantId);
          const portalLoginUrl = tenant?.slug 
            ? `${process.env.SITE_URL || 'https://app.saligaffiliate.com'}/portal/login?tenant=${tenant.slug}`
            : `${process.env.SITE_URL || 'https://app.saligaffiliate.com'}/portal/login`;
          const contactEmail = process.env.SUPPORT_EMAIL || "support@saligaffiliate.com";
          
          await ctx.scheduler.runAfter(0, api.email.sendApprovalEmail, {
            tenantId,
            affiliateId: affiliateId,
            affiliateEmail: affiliate.email,
            affiliateName: affiliate.name,
            portalName: tenant?.branding?.portalName || tenant?.name || "Affiliate Portal",
            brandLogoUrl: tenant?.branding?.logoUrl,
            brandPrimaryColor: tenant?.branding?.primaryColor,
            portalLoginUrl,
            contactEmail,
          });
        } catch (error) {
          console.error(`Failed to schedule approval email for ${affiliateId}:`, error);
        }

        success++;
      } catch (error) {
        console.error(`Failed to approve affiliate ${affiliateId}:`, error);
        failed++;
      }
    }

    // Create bulk operation audit log
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_bulk_approved",
      entityType: "affiliate",
      entityId: "bulk_operation",
      actorId: authUser.userId,
      actorType: "user",
      newValue: { success, failed, total: args.affiliateIds.length },
    });

    return { success, failed };
  },
});

/**
 * Bulk reject multiple pending affiliates.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission (Owner/Manager only).
 * @security Max 50 affiliates per bulk operation to prevent abuse.
 */
export const bulkRejectAffiliates = mutation({
  args: {
    affiliateIds: v.array(v.id("affiliates")),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx, args) => {
    // Rate limiting: max 50 affiliates per bulk operation
    const MAX_BULK_SIZE = 50;
    if (args.affiliateIds.length > MAX_BULK_SIZE) {
      throw new Error(`Bulk operation limited to ${MAX_BULK_SIZE} affiliates at a time. You selected ${args.affiliateIds.length}.`);
    }
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: "bulk_operation",
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=bulkRejectAffiliates, count=${args.affiliateIds.length}`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to bulk reject affiliates");
    }

    let success = 0;
    let failed = 0;

    for (const affiliateId of args.affiliateIds) {
      try {
        const affiliate = await ctx.db.get(affiliateId);
        if (!affiliate || affiliate.tenantId !== tenantId) {
          failed++;
          continue;
        }

        if (affiliate.status !== "pending") {
          failed++;
          continue;
        }

        // Update status to rejected
        await ctx.db.patch(affiliateId, { status: "rejected" });

        await updateAffiliateCount(ctx, tenantId, "pending", "rejected");

        // Create audit log entry
        await ctx.db.insert("auditLogs", {
          tenantId,
          action: "affiliate_rejected",
          entityType: "affiliate",
          entityId: affiliateId,
          actorId: authUser.userId,
          actorType: "user",
          previousValue: { status: "pending" },
          newValue: { status: "rejected", reason: args.reason },
        });

        // Schedule rejection email to be sent (non-blocking)
        try {
          const tenant = await ctx.db.get(tenantId);
          const contactEmail = process.env.SUPPORT_EMAIL || "support@saligaffiliate.com";
          
          await ctx.scheduler.runAfter(0, api.email.sendRejectionEmail, {
            tenantId,
            affiliateId: affiliateId,
            affiliateEmail: affiliate.email,
            affiliateName: affiliate.name,
            reason: args.reason,
            portalName: tenant?.branding?.portalName || tenant?.name || "Affiliate Portal",
            brandLogoUrl: tenant?.branding?.logoUrl,
            brandPrimaryColor: tenant?.branding?.primaryColor,
            contactEmail,
          });
        } catch (error) {
          console.error(`Failed to schedule rejection email for ${affiliateId}:`, error);
        }

        success++;
      } catch (error) {
        console.error(`Failed to reject affiliate ${affiliateId}:`, error);
        failed++;
      }
    }

    // Create bulk operation audit log
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_bulk_rejected",
      entityType: "affiliate",
      entityId: "bulk_operation",
      actorId: authUser.userId,
      actorType: "user",
      newValue: { success, failed, total: args.affiliateIds.length, reason: args.reason },
    });

    return { success, failed };
  },
});

/**
 * Get affiliate statistics.
 * Returns click count, conversion count, and commission total for an affiliate.
 * @security Requires authentication. Validates tenant ownership.
 */
export const getAffiliateStats = query({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.object({
    totalClicks: v.number(),
    totalConversions: v.number(),
    totalCommissions: v.number(),
    pendingCommissions: v.number(),
    confirmedCommissions: v.number(),
  }),
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx);
    if (!tenantId) {
      throw new Error("Authentication required");
    }
    
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }
    
    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Get clicks count
    const clicks = await ctx.db
      .query("clicks")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .take(500);
    const totalClicks = clicks.length;

    // Get conversions count
    const allConvs = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .take(500);
    const conversions = allConvs.filter(c => c.affiliateId === args.affiliateId);
    const totalConversions = conversions.length;

    // Get commissions
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .take(500);

    const totalCommissions = commissions
      .filter(c => c.status === "approved")
      .reduce((sum, c) => sum + c.amount, 0);
    const pendingCommissions = commissions
      .filter(c => c.status === "pending")
      .reduce((sum, c) => sum + c.amount, 0);
    const confirmedCommissions = commissions
      .filter(c => c.status === "approved")
      .reduce((sum, c) => sum + c.amount, 0);

    return {
      totalClicks,
      totalConversions,
      totalCommissions,
      pendingCommissions,
      confirmedCommissions,
    };
  },
});

/**
 * Get audit log entries for an affiliate.
 * Returns activity history including status changes, approvals, rejections.
 * @security Requires authentication. Validates tenant ownership.
 */
export const getAffiliateAuditLog = query({
  args: {
    affiliateId: v.id("affiliates"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("auditLogs"),
      _creationTime: v.number(),
      tenantId: v.optional(v.id("tenants")),
      action: v.string(),
      actorId: v.optional(v.string()),
      actorType: v.string(),
      entityId: v.string(),
      entityType: v.string(),
      previousValue: v.optional(v.any()),
      newValue: v.optional(v.any()),
    })
  ),
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx);
    if (!tenantId) {
      return [];
    }

    // Verify affiliate belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      return [];
    }

    // Query audit logs for this affiliate
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", "affiliate").eq("entityId", args.affiliateId)
      )
      .order("desc")
      .take(args.limit ?? 50);

    return logs;
  },
});

/**
 * Get recent affiliate activity across the tenant.
 * Returns activity history including status changes, approvals, rejections.
 * @security Requires authentication. Validates tenant ownership.
 */
/**
 * Get recent affiliate activity from audit logs.
 * @security Requires authentication. Results filtered by tenant.
 */
export const getRecentAffiliateActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("auditLogs"),
      _creationTime: v.number(),
      tenantId: v.optional(v.id("tenants")),
      action: v.string(),
      entityType: v.string(),
      entityId: v.string(),
      actorId: v.optional(v.string()),
      actorType: v.string(),
      previousValue: v.optional(v.any()),
      newValue: v.optional(v.any()),
    })
  ),
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx);
    if (!tenantId) {
      return [];
    }

    // Query audit logs for affiliates in this tenant
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .filter((q) =>
        q.or(
          q.eq(q.field("entityType"), "affiliate"),
          q.eq(q.field("action"), "affiliate_registered")
        )
      )
      .order("desc")
      .take(args.limit ?? 20);

    return logs;
  },
});

/**
 * Set or update a commission override for an affiliate on a specific campaign.
 * @security Requires authentication. Validates tenant ownership of both affiliate and campaign.
 * @security Requires 'affiliates:manage' or 'campaigns:manage' permission.
 */
export const setCommissionOverride = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    campaignId: v.id("campaigns"),
    rate: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage or campaigns:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && 
        !hasPermission(role, "campaigns:manage") && 
        !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=setCommissionOverride`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to set commission overrides");
    }

    // Validate affiliate belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate campaign belongs to tenant and is active
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign || campaign.tenantId !== tenantId) {
      throw new Error("Campaign not found or access denied");
    }

    if (campaign.status !== "active") {
      throw new Error(`Cannot set override for ${campaign.status} campaigns. Campaign must be active.`);
    }

    // Validate rate based on campaign commission type
    if (campaign.commissionType === "percentage") {
      if (args.rate < 0 || args.rate > 100) {
        throw new Error("Percentage commission rate must be between 0 and 100");
      }
    } else if (campaign.commissionType === "flatFee") {
      if (args.rate < 0) {
        throw new Error("Flat fee commission rate must be 0 or greater");
      }
    }

    // Initialize overrides array if needed
    const existingOverrides = affiliate.commissionOverrides || [];

    // Check if override already exists for this campaign
    const existingIndex = existingOverrides.findIndex(o => o.campaignId === args.campaignId);

    let previousValue: { campaignId: string; rate: number } | undefined;

    if (existingIndex >= 0) {
      // Update existing override
      previousValue = { 
        campaignId: existingOverrides[existingIndex].campaignId, 
        rate: existingOverrides[existingIndex].rate 
      };
      existingOverrides[existingIndex] = {
        campaignId: args.campaignId,
        rate: args.rate,
        status: "active",
      };
    } else {
      // Add new override
      existingOverrides.push({
        campaignId: args.campaignId,
        rate: args.rate,
        status: "active",
      });
    }

    await ctx.db.patch(args.affiliateId, {
      commissionOverrides: existingOverrides,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: previousValue ? "commission_override_updated" : "commission_override_created",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue,
      newValue: { campaignId: args.campaignId, rate: args.rate },
    });

    return null;
  },
});

/**
 * Remove a commission override for an affiliate on a specific campaign.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' or 'campaigns:manage' permission.
 */
export const removeCommissionOverride = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    campaignId: v.id("campaigns"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage or campaigns:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && 
        !hasPermission(role, "campaigns:manage") && 
        !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=removeCommissionOverride`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to remove commission overrides");
    }

    // Validate affiliate belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Check if override exists
    const existingOverrides = affiliate.commissionOverrides || [];
    const overrideToRemove = existingOverrides.find(o => o.campaignId === args.campaignId);

    if (!overrideToRemove) {
      throw new Error("No commission override found for this campaign");
    }

    const filteredOverrides = existingOverrides.filter(o => o.campaignId !== args.campaignId);

    await ctx.db.patch(args.affiliateId, {
      commissionOverrides: filteredOverrides,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "commission_override_removed",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { campaignId: args.campaignId, rate: overrideToRemove.rate },
    });

    return null;
  },
});

/**
 * Toggle the status of a commission override (active <-> paused).
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' or 'campaigns:manage' permission.
 */
export const toggleOverrideStatus = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    campaignId: v.id("campaigns"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage or campaigns:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && 
        !hasPermission(role, "campaigns:manage") && 
        !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=toggleOverrideStatus`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to toggle override status");
    }

    // Validate affiliate belongs to tenant
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    // Check if override exists
    const existingOverrides = affiliate.commissionOverrides || [];
    const overrideIndex = existingOverrides.findIndex(o => o.campaignId === args.campaignId);

    if (overrideIndex < 0) {
      throw new Error("No commission override found for this campaign");
    }

    const currentOverride = existingOverrides[overrideIndex];
    const newStatus = currentOverride.status === "active" ? "paused" : "active";

    // Update the override status
    existingOverrides[overrideIndex] = {
      ...currentOverride,
      status: newStatus,
    };

    await ctx.db.patch(args.affiliateId, {
      commissionOverrides: existingOverrides,
    });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "commission_override_toggled",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { campaignId: args.campaignId, status: currentOverride.status },
      newValue: { campaignId: args.campaignId, status: newStatus },
    });

    return null;
  },
});

/**
 * Get affiliate with all commission overrides populated with campaign details.
 * @security Requires authentication. Validates tenant ownership.
 */
export const getAffiliateWithOverrides = query({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      vanitySlug: v.optional(v.string()),
      promotionChannel: v.optional(v.string()),
      payoutMethod: v.optional(v.object({
        type: v.string(),
        details: v.string(),
      })),
      fraudSignals: v.optional(v.array(v.object({
        type: v.string(),
        severity: v.string(),
        timestamp: v.number(),
        details: v.optional(v.string()),
      }))),
      commissionOverrides: v.array(v.object({
        campaignId: v.id("campaigns"),
        campaignName: v.string(),
        campaignStatus: v.string(),
        commissionType: v.string(),
        defaultRate: v.number(),
        overrideRate: v.number(),
        status: v.string(),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenantId = await getTenantId(ctx);
    if (!tenantId) {
      return null;
    }

    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate || affiliate.tenantId !== tenantId) {
      return null;
    }

    // Populate overrides with campaign details
    const overrides = affiliate.commissionOverrides || [];
    const populatedOverrides = [];

    for (const override of overrides) {
      const campaign = await ctx.db.get(override.campaignId);
      if (campaign) {
        populatedOverrides.push({
          campaignId: override.campaignId,
          campaignName: campaign.name,
          campaignStatus: campaign.status,
          commissionType: campaign.commissionType,
          defaultRate: campaign.commissionValue,
          overrideRate: override.rate,
          status: override.status || "active",
        });
      }
    }

    return {
      _id: affiliate._id,
      _creationTime: affiliate._creationTime,
      tenantId: affiliate.tenantId,
      email: affiliate.email,
      name: affiliate.name,
      uniqueCode: affiliate.uniqueCode,
      status: affiliate.status,
      payoutMethod: affiliate.payoutMethod,
      fraudSignals: affiliate.fraudSignals,
      commissionOverrides: populatedOverrides,
    };
  },
});

/**
 * Update internal note for an affiliate.
 * Internal notes are only visible to Owner/Manager, not to affiliates.
 * @security Requires authentication. Validates tenant ownership.
 * @security Requires 'affiliates:manage' permission (Owner/Manager only).
 */
export const updateAffiliateNote = mutation({
  args: {
    affiliateId: v.id("affiliates"),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Check permission - require affiliates:manage permission
    const role = authUser.role as Role;
    if (!hasPermission(role, "affiliates:manage") && !hasPermission(role, "manage:*")) {
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "permission_denied",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `attemptedPermission=affiliates:manage, attemptedAction=updateAffiliateNote`,
        },
      });
      throw new Error("Access denied: You require 'affiliates:manage' permission to update affiliate notes");
    }

    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found or access denied");
    }

    // Validate tenant ownership
    if (affiliate.tenantId !== tenantId) {
      throw new Error("Affiliate not found or access denied");
    }

    const previousNote = affiliate.note;

    // Update note
    await ctx.db.patch(args.affiliateId, { note: args.note });

    // Create audit log entry
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "affiliate_note_updated",
      entityType: "affiliate",
      entityId: args.affiliateId,
      actorId: authUser.userId,
      actorType: "user",
      previousValue: { note: previousNote },
      newValue: { note: args.note },
    });

    return null;
  },
});

/**
 * Internal query to get an affiliate by ID.
 * Used by internal actions that need to fetch affiliate data without authentication.
 */
export const getAffiliateInternal = internalQuery({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      tenantId: v.id("tenants"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
      vanitySlug: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      return null;
    }
    return {
      _id: affiliate._id,
      tenantId: affiliate.tenantId,
      email: affiliate.email,
      name: affiliate.name,
      uniqueCode: affiliate.uniqueCode,
      status: affiliate.status,
      vanitySlug: affiliate.vanitySlug,
    };
  },
});

/**
 * Internal mutation to add a fraud signal to an affiliate.
 * Used for chargeback fraud detection (Story 7.4).
 */
export const addFraudSignalInternal = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    type: v.string(),
    severity: v.string(),
    details: v.optional(v.string()),
    commissionId: v.optional(v.id("commissions")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) {
      throw new Error(`Affiliate ${args.affiliateId} not found`);
    }
    
    // Check if a similar fraud signal already exists for this commission
    const existingSignals = affiliate.fraudSignals || [];
    const duplicateSignal = existingSignals.find(
      (signal: any) => 
        signal.type === args.type && 
        signal.commissionId === args.commissionId &&
        signal.severity === args.severity
    );
    
    if (duplicateSignal) {
      // Don't add duplicate fraud signal
      return null;
    }
    
    // Add the new fraud signal
    const newSignal = {
      type: args.type,
      severity: args.severity,
      timestamp: Date.now(),
      details: args.details,
      commissionId: args.commissionId,
      signalId: generateSignalId(),
    };
    
    await ctx.db.patch(args.affiliateId, {
      fraudSignals: [...existingSignals, newSignal],
    });

    // Audit log — fraud signal added (non-fatal)
    try {
      await ctx.runMutation(internal.audit.logAuditEventInternal, {
        tenantId: affiliate.tenantId,
        action: "FRAUD_SIGNAL_ADDED",
        entityType: "affiliate",
        entityId: args.affiliateId,
        actorType: "system",
        metadata: {
          signalType: args.type,
          severity: args.severity,
          commissionId: args.commissionId,
          details: args.details,
        },
      });
    } catch (err) {
      console.error("[Audit] Failed to log FRAUD_SIGNAL_ADDED (non-fatal):", err);
    }
    
    return null;
  },
});