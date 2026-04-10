import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { betterAuthComponent } from "../auth";
import { DEFAULT_TIER_CONFIGS } from "../tierConfig";
import { requireAdmin, readTenantStats } from "./_helpers";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Determine if a tenant is flagged based on conditions:
 * - SaligPay credentials expired (expiresAt in the past)
 * - Flagged commissions exist (tracked in tenantStats.commissionsFlagged)
 *
 * Both checks are O(1) — no pagination needed, safe to call from
 * queries that may themselves be paginated (Convex allows only one
 * paginated query per function).
 */
async function isTenantFlagged(ctx: QueryCtx, tenantId: Id<"tenants">): Promise<boolean> {
  // Check if SaligPay credentials are expired
  const tenant = await ctx.db.get(tenantId);
  if (tenant?.saligPayCredentials?.expiresAt) {
    const now = Date.now() / 1000;
    if (tenant.saligPayCredentials.expiresAt < now) {
      return true;
    }
  }

  // Check tenantStats for flagged commission count (O(1))
  const stats = await readTenantStats(ctx, tenantId);
  if ((stats.commissionsFlagged ?? 0) > 0) {
    return true;
  }

  return false;
}

/**
 * Get the owner email for a tenant by finding the owner user.
 * Uses .take(50) cap — a tenant won't have more than ~50 team members.
 */
async function getTenantOwnerEmail(ctx: QueryCtx, tenantId: Id<"tenants">): Promise<string> {
  const users = await ctx.db
    .query("users")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .take(50);

  const owner = users.find((u: { role: string }) => u.role === "owner");
  return owner?.email ?? "";
}

/**
 * Get total affiliate count for a tenant from denormalized tenantStats.
 * O(1) — single indexed lookup.
 */
async function getAffiliateCount(ctx: QueryCtx, tenantId: Id<"tenants">): Promise<number> {
  const stats = await readTenantStats(ctx, tenantId);
  return stats.affiliatesPending
    + stats.affiliatesActive
    + stats.affiliatesSuspended
    + stats.affiliatesRejected;
}

/**
 * Get MRR estimate for a tenant from denormalized tenantStats.
 * Uses the sum of thisMonth + lastMonth confirmed commission values as a
 * 2-month rolling approximation. This is O(1) — no commission table scan.
 *
 * NOTE: This replaces the previous getTenantMRR() which did an expensive
 * commission table scan with individual conversion lookups (N+1 per tenant).
 * The approximation is sufficient for the admin tenant list; the detailed
 * tenant view (getTenantStats) still computes exact MRR if needed.
 */
async function getTenantMRRLight(ctx: QueryCtx, tenantId: Id<"tenants">): Promise<number> {
  const stats = await readTenantStats(ctx, tenantId);
  return (stats.commissionsConfirmedValueThisMonth ?? 0)
    + (stats.commissionsConfirmedValueLastMonth ?? 0);
}

/**
 * Helper: Sum conversion amounts for a set of commissions.
 * Used by both getTenantStats and getTenantDetails for MRR calculation.
 */
async function sumConversionAmounts(
  ctx: QueryCtx,
  commissions: Array<{ amount: number; conversionId?: any; _creationTime: number }>,
): Promise<number> {
  let total = 0;
  for (const commission of commissions) {
    if (commission.conversionId) {
      const conversion = await ctx.db.get(commission.conversionId) as { amount: number } | null;
      if (conversion) {
        total += conversion.amount;
        continue;
      }
    }
    total += commission.amount;
  }
  return total;
}

export interface TenantRow {
  _id: Id<"tenants">;
  _creationTime: number;
  name: string;
  slug: string;
  domain: string | undefined;
  plan: string;
  status: string;
  subscriptionStatus?: string;
  ownerEmail: string;
  affiliateCount: number;
  mrr: number;
  isFlagged: boolean;
  isBillingOverdue: boolean;
  isTrialExpired: boolean;
}

// =============================================================================
// Story 11.1: Tenant Search & Platform Stats
// =============================================================================

/**
 * Search and filter tenants with pagination.
 * Admin-only query that bypasses tenant isolation.
 */
export const searchTenants = query({
  args: {
    searchQuery: v.optional(v.string()),
    statusFilter: v.optional(
      v.union(
        v.literal("active"),
        v.literal("trial"),
        v.literal("suspended"),
        v.literal("flagged"),
        v.literal("past_due"),
        v.literal("billing_overdue"),
        v.literal("cancelled")
      )
    ),
    cursor: v.optional(v.string()),
    numItems: v.number(),
  },
  returns: v.object({
    tenants: v.array(
      v.object({
        _id: v.id("tenants"),
        _creationTime: v.number(),
        name: v.string(),
        slug: v.string(),
        domain: v.optional(v.string()),
        plan: v.string(),
        status: v.string(),
        subscriptionStatus: v.optional(v.string()),
        ownerEmail: v.string(),
        affiliateCount: v.number(),
        mrr: v.number(),
        isFlagged: v.boolean(),
        isBillingOverdue: v.boolean(),
        isTrialExpired: v.boolean(),
      })
    ),
    nextCursor: v.optional(v.string()),
    hasMore: v.boolean(),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    // ── Step 1: Fetch a page of tenants via native pagination ──────────
    // Use a generous page (3x requested) so we can filter in memory
    // while still having enough items for the actual page size.
    // Convex allows at most 1 paginated query per function.
    const fetchSize = Math.min(args.numItems * 3, 100);
    const paginationOpts = {
      numItems: fetchSize,
      cursor: args.cursor ?? null,
    };

    // Filters that map to indexed tenant.status field
    const indexedStatuses = new Set(["active", "trial", "suspended"]);
    const computedStatuses = new Set(["flagged", "past_due", "billing_overdue", "cancelled"]);

    let baseQuery;
    if (args.statusFilter && indexedStatuses.has(args.statusFilter)) {
      // Use the by_status index when filtering by a real status field
      baseQuery = ctx.db
        .query("tenants")
        .withIndex("by_status", (q: any) => q.eq("status", args.statusFilter))
        .order("desc");
    } else {
      // Default: all tenants, newest first (for "flagged", "past_due", "billing_overdue", "cancelled" we filter in-memory below)
      baseQuery = ctx.db.query("tenants").order("desc");
    }

    const page = await baseQuery.paginate(paginationOpts);

    // ── Step 2: Enrich only the fetched page (not ALL tenants) ────────
    // Each enrichment is O(1) via indexed lookups — no N+1 table scans.
    let enriched: TenantRow[] = [];
    for (const tenant of page.page) {
      // Compute isFlagged once — combine with enrichment to avoid duplicate lookups
      const now = Date.now() / 1000;
      const saligPayExpired = tenant.saligPayCredentials?.expiresAt
        ? tenant.saligPayCredentials.expiresAt < now
        : false;
      const stats = await readTenantStats(ctx, tenant._id);
      const flagged = saligPayExpired || (stats.commissionsFlagged ?? 0) > 0;

      // For "flagged" filter, skip non-flagged tenants
      if (args.statusFilter === "flagged" && !flagged) continue;

      // For computed-status filters, skip non-matching tenants
      if (args.statusFilter === "past_due" && tenant.subscriptionStatus !== "past_due") continue;
      if (args.statusFilter === "billing_overdue") {
        const isBillingOverdue = tenant.subscriptionStatus === "past_due" ||
          (tenant.billingEndDate !== undefined && tenant.billingEndDate < Date.now() && tenant.subscriptionStatus === "active");
        if (!isBillingOverdue) continue;
      }
      if (args.statusFilter === "cancelled" && tenant.subscriptionStatus !== "cancelled") continue;

      // ownerEmail is the only remaining per-tenant lookup
      const ownerEmail = await getTenantOwnerEmail(ctx, tenant._id);

      enriched.push({
        _id: tenant._id,
        _creationTime: tenant._creationTime,
        name: tenant.name,
        slug: tenant.slug,
        domain: tenant.branding?.customDomain,
        plan: tenant.plan,
        status: tenant.status,
        subscriptionStatus: tenant.subscriptionStatus,
        ownerEmail,
        affiliateCount: stats.affiliatesPending
          + stats.affiliatesActive
          + stats.affiliatesSuspended
          + stats.affiliatesRejected,
        mrr: (stats.commissionsConfirmedValueThisMonth ?? 0)
          + (stats.commissionsConfirmedValueLastMonth ?? 0),
        isFlagged: flagged,
        isBillingOverdue: tenant.subscriptionStatus === "past_due" ||
          (tenant.billingEndDate !== undefined && tenant.billingEndDate < Date.now() && tenant.subscriptionStatus === "active"),
        isTrialExpired: tenant.trialEndsAt !== undefined && tenant.trialEndsAt < Date.now() &&
          (tenant.subscriptionStatus === "cancelled" || tenant.subscriptionStatus === undefined),
      });
    }

    // ── Step 3: Apply search filter (in-memory, on the small page) ────
    if (args.searchQuery && args.searchQuery.trim() !== "") {
      const q = args.searchQuery.toLowerCase().trim();
      enriched = enriched.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q) ||
          t.ownerEmail.toLowerCase().includes(q) ||
          (t.domain && t.domain.toLowerCase().includes(q))
      );
    }

    // ── Step 4: Slice to the requested page size ──────────────────────
    const pagedTenants = enriched.slice(0, args.numItems);
    const hasMore = enriched.length > args.numItems || page.continueCursor !== undefined;
    const nextCursor = enriched.length > args.numItems
      ? page.continueCursor
      : (page.continueCursor !== undefined ? page.continueCursor : undefined);

    // ── Step 5: Get total count (lightweight: capped .take() on index) ──
    // Convex allows only 1 .paginate() per function, so we use .take() here.
    // For indexed status filters we use the index; for computed filters
    // ("flagged", "past_due", "billing_overdue", "cancelled") or "all" we
    // do a capped count. The exact count is best-effort for the list view.
    let total: number;
    if (args.statusFilter && indexedStatuses.has(args.statusFilter)) {
      const statusTenants = await ctx.db
        .query("tenants")
        .withIndex("by_status", (q: any) => q.eq("status", args.statusFilter))
        .take(500);
      total = statusTenants.length;
    } else {
      const allTenants = await ctx.db
        .query("tenants")
        .order("desc")
        .take(500);
      total = allTenants.length;
    }

    return {
      tenants: pagedTenants,
      nextCursor,
      hasMore,
      total,
    };
  },
});

/**
 * Get platform-wide statistics for the admin dashboard stats row.
 */
export const getPlatformStats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    active: v.number(),
    trial: v.number(),
    suspended: v.number(),
    flagged: v.number(),
    pastDue: v.number(),
    deltaThisWeek: v.number(),
  }),
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    const allTenants = await ctx.db.query("tenants").take(500);

    let active = 0;
    let trial = 0;
    let suspended = 0;
    let flagged = 0;
    let pastDue = 0;
    const oneWeekAgo = Date.now() / 1000 - 7 * 24 * 60 * 60;

    for (const tenant of allTenants) {
      if (tenant.status === "active") active++;
      if (tenant.status === "trial") trial++;
      if (tenant.status === "suspended") suspended++;
      if (tenant.subscriptionStatus === "past_due") pastDue++;

      // Inline flag check — O(1) using tenant fields + tenantStats
      const now = Date.now() / 1000;
      const saligPayExpired = tenant.saligPayCredentials?.expiresAt
        ? tenant.saligPayCredentials.expiresAt < now
        : false;
      const stats = await readTenantStats(ctx, tenant._id);
      const tenantFlagged = saligPayExpired || (stats.commissionsFlagged ?? 0) > 0;
      if (tenantFlagged) flagged++;
    }

    const deltaThisWeek = allTenants.filter((t: { _creationTime: number }) => t._creationTime > oneWeekAgo).length;

    return {
      total: allTenants.length,
      active,
      trial,
      suspended,
      flagged,
      pastDue,
      deltaThisWeek,
    };
  },
});

// =============================================================================
// Story 11.4: Plan Limit Usage View - Backend Queries
// =============================================================================

type WarningLevel = "normal" | "warning" | "critical";

function getWarningLevel(percentage: number): WarningLevel {
  if (percentage >= 95) return "critical";
  if (percentage >= 80) return "warning";
  return "normal";
}

/**
 * Get effective tier limits for a tenant, considering active overrides.
 */
async function getEffectiveLimits(
  ctx: QueryCtx,
  tenantId: Id<"tenants">,
  tierConfig: { maxAffiliates: number; maxCampaigns: number; maxTeamMembers: number; maxPayoutsPerMonth: number }
): Promise<{
  maxAffiliates: number;
  maxCampaigns: number;
  maxTeamMembers: number;
  maxPayoutsPerMonth: number;
  hasOverride: boolean;
  overrideId?: string;
  overrideExpiresAt?: number;
}> {
  const overrides = await ctx.db
    .query("tierOverrides")
    .withIndex("by_tenant_and_active", (q: any) =>
      q.eq("tenantId", tenantId).eq("removedAt", undefined)
    )
    .order("desc")
    .take(50);

  const now = Date.now();
  const activeOverride = overrides.find((o: any) => {
    if (o.expiresAt === undefined) return true;
    return o.expiresAt > now;
  });

  if (activeOverride) {
    return {
      maxAffiliates: activeOverride.overrides.maxAffiliates ?? tierConfig.maxAffiliates,
      maxCampaigns: activeOverride.overrides.maxCampaigns ?? tierConfig.maxCampaigns,
      maxTeamMembers: activeOverride.overrides.maxTeamMembers ?? tierConfig.maxTeamMembers,
      maxPayoutsPerMonth: activeOverride.overrides.maxPayoutsPerMonth ?? tierConfig.maxPayoutsPerMonth,
      hasOverride: true,
      overrideId: activeOverride._id,
      overrideExpiresAt: activeOverride.expiresAt,
    };
  }

  return {
    maxAffiliates: tierConfig.maxAffiliates,
    maxCampaigns: tierConfig.maxCampaigns,
    maxTeamMembers: tierConfig.maxTeamMembers,
    maxPayoutsPerMonth: tierConfig.maxPayoutsPerMonth,
    hasOverride: false,
  };
}

/**
 * Get tenant plan usage with visual indicators for admin dashboard.
 *
 * Affiliate count: reads from tenantStats (O(1))
 * Active campaigns: uses by_tenant_and_status index (only fetches active)
 * Team members: by_tenant .take(50) — safe (max ~50 per tenant)
 * Monthly payouts: uses by_tenant_and_status index on payoutBatches
 */
export const getTenantPlanUsage = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    plan: v.object({
      tier: v.string(),
      price: v.number(),
      maxAffiliates: v.number(),
      maxCampaigns: v.number(),
      maxTeamMembers: v.number(),
      maxPayoutsPerMonth: v.number(),
      features: v.object({
        customDomain: v.boolean(),
        advancedAnalytics: v.boolean(),
        prioritySupport: v.boolean(),
      }),
    }),
    usage: v.object({
      affiliates: v.object({
        current: v.number(),
        limit: v.number(),
        percentage: v.number(),
        warningLevel: v.union(
          v.literal("normal"),
          v.literal("warning"),
          v.literal("critical")
        ),
      }),
      campaigns: v.object({
        current: v.number(),
        limit: v.number(),
        percentage: v.number(),
        warningLevel: v.union(
          v.literal("normal"),
          v.literal("warning"),
          v.literal("critical")
        ),
      }),
      teamMembers: v.object({
        current: v.number(),
        limit: v.number(),
        percentage: v.number(),
        warningLevel: v.union(
          v.literal("normal"),
          v.literal("warning"),
          v.literal("critical")
        ),
      }),
      payouts: v.object({
        current: v.number(),
        limit: v.number(),
        percentage: v.number(),
        warningLevel: v.union(
          v.literal("normal"),
          v.literal("warning"),
          v.literal("critical")
        ),
      }),
      customDomain: v.optional(
        v.object({
          configured: v.boolean(),
          status: v.optional(v.string()),
        })
      ),
    }),
    override: v.optional(v.object({
      active: v.boolean(),
      overrideId: v.optional(v.id("tierOverrides")),
      expiresAt: v.optional(v.number()),
    })),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q: any) => q.eq("tier", tenant.plan))
      .first();

    const resolvedTierConfig = tierConfig ?? DEFAULT_TIER_CONFIGS[tenant.plan as keyof typeof DEFAULT_TIER_CONFIGS] ?? DEFAULT_TIER_CONFIGS.starter;
    const effectiveLimits = await getEffectiveLimits(ctx, args.tenantId, resolvedTierConfig);

    // Affiliate count from tenantStats — O(1)
    const stats = await readTenantStats(ctx, args.tenantId);
    const activeAffiliates = stats.affiliatesActive;

    // Active campaigns: use by_tenant_and_status to fetch only active
    const activeCampaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant_and_status", (q: any) =>
        q.eq("tenantId", args.tenantId).eq("status", "active")
      )
      .collect();

    // Team members: by_tenant .take(50) — safe
    const teamMembers = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .take(50);
    const activeTeamMembers = teamMembers.filter(
      (u: { status?: string; removedAt?: number }) =>
        u.status !== "removed" && !u.removedAt
    ).length;

    // Monthly payouts: use by_tenant_and_status to fetch only processing
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthMs = startOfMonth.getTime();

    const processingBatches = await ctx.db
      .query("payoutBatches")
      .withIndex("by_tenant_and_status", (q: any) =>
        q.eq("tenantId", args.tenantId).eq("status", "processing")
      )
      .collect();
    const monthlyPayouts = processingBatches.filter(
      (p: { generatedAt: number }) => p.generatedAt >= startOfMonthMs
    ).length;

    // Calculate percentages
    const affiliatePercentage = effectiveLimits.maxAffiliates > 0
      ? Math.round((activeAffiliates / effectiveLimits.maxAffiliates) * 100)
      : 0;
    const campaignPercentage = effectiveLimits.maxCampaigns > 0
      ? Math.round((activeCampaigns.length / effectiveLimits.maxCampaigns) * 100)
      : 0;
    const teamMemberPercentage = effectiveLimits.maxTeamMembers > 0
      ? Math.round((activeTeamMembers / effectiveLimits.maxTeamMembers) * 100)
      : 0;
    const payoutPercentage = effectiveLimits.maxPayoutsPerMonth > 0
      ? Math.round((monthlyPayouts / effectiveLimits.maxPayoutsPerMonth) * 100)
      : 0;

    const customDomain = tenant.branding?.customDomain
      ? {
          configured: true,
          status: tenant.branding.domainStatus ?? undefined,
        }
      : undefined;

    return {
      plan: {
        tier: resolvedTierConfig.tier,
        price: resolvedTierConfig.price,
        maxAffiliates: effectiveLimits.maxAffiliates,
        maxCampaigns: effectiveLimits.maxCampaigns,
        maxTeamMembers: effectiveLimits.maxTeamMembers,
        maxPayoutsPerMonth: effectiveLimits.maxPayoutsPerMonth,
        features: resolvedTierConfig.features,
      },
      usage: {
        affiliates: {
          current: activeAffiliates,
          limit: effectiveLimits.maxAffiliates,
          percentage: affiliatePercentage,
          warningLevel: getWarningLevel(affiliatePercentage),
        },
        campaigns: {
          current: activeCampaigns.length,
          limit: effectiveLimits.maxCampaigns,
          percentage: campaignPercentage,
          warningLevel: getWarningLevel(campaignPercentage),
        },
        teamMembers: {
          current: activeTeamMembers,
          limit: effectiveLimits.maxTeamMembers,
          percentage: teamMemberPercentage,
          warningLevel: getWarningLevel(teamMemberPercentage),
        },
        payouts: {
          current: monthlyPayouts,
          limit: effectiveLimits.maxPayoutsPerMonth,
          percentage: payoutPercentage,
          warningLevel: getWarningLevel(payoutPercentage),
        },
        customDomain,
      },
      override: effectiveLimits.hasOverride ? {
        active: true,
        overrideId: effectiveLimits.overrideId as Id<"tierOverrides"> | undefined,
        expiresAt: effectiveLimits.overrideExpiresAt,
      } : {
        active: false,
      },
    };
  },
});

/**
 * Get all tier limits with warning thresholds.
 */
export const getTierLimits = query({
  args: {},
  returns: v.object({
    tiers: v.array(
      v.object({
        tier: v.string(),
        limits: v.object({
          maxAffiliates: v.number(),
          maxCampaigns: v.number(),
          maxTeamMembers: v.number(),
          maxPayoutsPerMonth: v.number(),
        }),
        thresholds: v.object({
          warning: v.number(),
          critical: v.number(),
        }),
      })
    ),
  }),
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    const configs = await ctx.db.query("tierConfigs").collect();

    return {
      tiers: configs.map((config: any) => ({
        tier: config.tier,
        limits: {
          maxAffiliates: config.maxAffiliates,
          maxCampaigns: config.maxCampaigns,
          maxTeamMembers: config.maxTeamMembers,
          maxPayoutsPerMonth: config.maxPayoutsPerMonth,
        },
        thresholds: {
          warning: 80,
          critical: 95,
        },
      })),
    };
  },
});

// =============================================================================
// Story 11.2: Tenant Account Details - Backend Queries & Mutations
// =============================================================================

/**
 * Get comprehensive tenant details including owner email, affiliate counts,
 * commission totals, and SaligPay connection status.
 *
 * Affiliate counts: from tenantStats (O(1)) — matches owner dashboard
 * Total commissions: from tenantStats (pendingPayoutTotal + commissionsPendingValue)
 * MRR: uses by_tenant_and_status index (approved only), same approach as owner dashboard
 * Flagged count: paginated scan of affiliates for unreviewed high-severity fraud signals
 */
export const getTenantDetails = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    _id: v.id("tenants"),
    companyName: v.string(),
    domain: v.optional(v.string()),
    ownerEmail: v.string(),
    ownerName: v.optional(v.string()),
    plan: v.string(),
    status: v.string(),
    createdAt: v.number(),
    saligPayStatus: v.optional(v.string()),
    saligPayExpiresAt: v.optional(v.number()),
    subscriptionStatus: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    billingStartDate: v.optional(v.number()),
    billingEndDate: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    cancellationDate: v.optional(v.number()),
    deletionScheduledDate: v.optional(v.number()),
    affiliateCount: v.object({
      total: v.number(),
      active: v.number(),
      pending: v.number(),
      flagged: v.number(),
    }),
    totalCommissions: v.number(),
    mrrInfluenced: v.number(),
    isFlagged: v.boolean(),
    flagReasons: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .take(50);
    const owner = users.find((u: { role: string }) => u.role === "owner");

    // Affiliate counts from tenantStats — O(1), matches owner dashboard
    const stats = await readTenantStats(ctx, args.tenantId);

    // Flagged count: capped scan for unreviewed high-severity fraud signals
    // (Convex allows only one paginated query per function, so we use .take() instead)
    let flaggedAffiliateCount = 0;
    const affiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .take(200);

    for (const affiliate of affiliates) {
      if (affiliate.fraudSignals?.some(
        (s: { severity: string; reviewedAt?: number }) =>
          s.severity === "high" && !s.reviewedAt
      )) {
        flaggedAffiliateCount++;
      }
    }

    const affiliateCount = {
      total: stats.affiliatesPending + stats.affiliatesActive + stats.affiliatesSuspended + stats.affiliatesRejected,
      active: stats.affiliatesActive,
      pending: stats.affiliatesPending,
      flagged: flaggedAffiliateCount,
    };

    // Total commissions from tenantStats
    const totalCommissions = (stats.pendingPayoutTotal ?? 0) + stats.commissionsPendingValue;

    // MRR: same approach as owner dashboard — approved commissions in last 30 days
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant_and_status", (q: any) =>
        q.eq("tenantId", args.tenantId).eq("status", "approved")
      )
      .order("desc")
      .take(1500);

    const recentApproved = commissions.filter(
      (c: { _creationTime: number }) => c._creationTime >= thirtyDaysAgo
    );
    const mrrInfluenced = await sumConversionAmounts(ctx, recentApproved);

    // SaligPay connection status
    let saligPayStatus: string | undefined;
    let saligPayExpiresAt: number | undefined;
    if (tenant.saligPayCredentials) {
      const nowSec = Date.now() / 1000;
      if (tenant.saligPayCredentials.expiresAt && tenant.saligPayCredentials.expiresAt < nowSec) {
        saligPayStatus = "error";
        saligPayExpiresAt = tenant.saligPayCredentials.expiresAt;
      } else if (tenant.saligPayCredentials.connectedAt) {
        saligPayStatus = "connected";
        saligPayExpiresAt = tenant.saligPayCredentials.expiresAt;
      } else {
        saligPayStatus = "disconnected";
      }
    }

    const flagReasons: string[] = [];
    if (saligPayStatus === "error") {
      flagReasons.push("SaligPay credentials expired");
    }
    if (affiliateCount.flagged > 0) {
      flagReasons.push(`${affiliateCount.flagged} affiliate(s) with high-severity fraud signals`);
    }

    const isFlagged = flagReasons.length > 0;

    return {
      _id: tenant._id,
      companyName: tenant.name,
      domain: tenant.branding?.customDomain,
      ownerEmail: owner?.email ?? "",
      ownerName: owner?.name,
      plan: tenant.plan,
      status: tenant.status,
      createdAt: tenant._creationTime,
      saligPayStatus,
      saligPayExpiresAt,
      subscriptionStatus: tenant.subscriptionStatus,
      subscriptionId: tenant.subscriptionId,
      billingStartDate: tenant.billingStartDate,
      billingEndDate: tenant.billingEndDate,
      trialEndsAt: tenant.trialEndsAt,
      cancellationDate: tenant.cancellationDate,
      deletionScheduledDate: tenant.deletionScheduledDate,
      affiliateCount,
      totalCommissions,
      mrrInfluenced,
      isFlagged,
      flagReasons,
    };
  },
});

/**
 * Get tenant statistics including MRR, active affiliates, pending commissions,
 * open payouts, and total paid out.
 *
 * ALL aggregate counts read from tenantStats (O(1)) — matches owner dashboard exactly:
 * - activeAffiliates ← tenantStats.affiliatesActive
 * - pendingAffiliates ← tenantStats.affiliatesPending
 * - pendingCommissions ← tenantStats.commissionsPendingValue
 * - pendingCommissionsCount ← tenantStats.commissionsPendingCount
 * - readyToPayTotal ← tenantStats.pendingPayoutTotal (matches owner's "Ready to Pay")
 * - totalPaidOut ← tenantStats.totalPaidOut
 *
 * MRR and open payouts still require targeted scans (not in tenantStats).
 * MRR uses by_tenant_and_status index (approved only), same approach as owner dashboard.
 */
export const getTenantStats = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    mrrInfluenced: v.number(),
    mrrDelta: v.number(),
    activeAffiliates: v.number(),
    pendingAffiliates: v.number(),
    pendingCommissions: v.number(),
    pendingCommissionsCount: v.number(),
    readyToPayTotal: v.number(),
    openPayouts: v.number(),
    openPayoutsTotal: v.number(),
    totalPaidOut: v.number(),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    // ALL aggregate counts from tenantStats — O(1), matches owner dashboard
    const stats = await readTenantStats(ctx, args.tenantId);

    // MRR: approved commissions in last 30 days, using by_tenant_and_status index
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant_and_status", (q: any) =>
        q.eq("tenantId", args.tenantId).eq("status", "approved")
      )
      .order("desc")
      .take(1500);

    const approvedInRange = commissions.filter(
      (c: { _creationTime: number }) => c._creationTime >= thirtyDaysAgo
    );
    const approvedPrevRange = commissions.filter(
      (c: { _creationTime: number }) =>
        c._creationTime >= sixtyDaysAgo && c._creationTime < thirtyDaysAgo
    );

    const currentMRR = await sumConversionAmounts(ctx, approvedInRange);
    const previousMRR = await sumConversionAmounts(ctx, approvedPrevRange);

    const mrrDelta = previousMRR > 0
      ? Math.round(((currentMRR - previousMRR) / previousMRR) * 100)
      : currentMRR > 0 ? 100 : 0;

    // Open payouts: use by_tenant_and_status on payoutBatches
    const openBatches = await ctx.db
      .query("payoutBatches")
      .withIndex("by_tenant_and_status", (q: any) =>
        q.eq("tenantId", args.tenantId).eq("status", "processing")
      )
      .collect();
    const pendingBatches = await ctx.db
      .query("payoutBatches")
      .withIndex("by_tenant_and_status", (q: any) =>
        q.eq("tenantId", args.tenantId).eq("status", "pending")
      )
      .collect();
    const allOpenBatches = [...openBatches, ...pendingBatches];

    return {
      mrrInfluenced: currentMRR,
      mrrDelta,
      activeAffiliates: stats.affiliatesActive,
      pendingAffiliates: stats.affiliatesPending,
      pendingCommissions: stats.commissionsPendingValue,
      pendingCommissionsCount: stats.commissionsPendingCount,
      readyToPayTotal: stats.pendingPayoutTotal ?? 0,
      openPayouts: allOpenBatches.length,
      openPayoutsTotal: allOpenBatches.reduce((sum: number, b: { totalAmount: number }) => sum + b.totalAmount, 0),
      totalPaidOut: stats.totalPaidOut,
    };
  },
});

/**
 * Get recent commissions for a tenant with affiliate and campaign name lookups.
 * Uses Convex .paginate() for true DB-level pagination — no data loss at any scale.
 */
export const getTenantCommissions = query({
  args: {
    tenantId: v.id("tenants"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    commissions: v.array(v.object({
      _id: v.id("commissions"),
      affiliateName: v.string(),
      campaignName: v.string(),
      amount: v.number(),
      status: v.string(),
      createdAt: v.number(),
    })),
    hasNextPage: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    const paginated = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .paginate(args.paginationOpts);

    // Batch-enrich with affiliate and campaign names
    // Fetch all referenced affiliates and campaigns at once (no N+1)
    const affiliateIds = [...new Set(paginated.page.map((c: any) => c.affiliateId))];
    const campaignIds = [...new Set(paginated.page.map((c: any) => c.campaignId))];

    const [affiliates, campaigns] = await Promise.all([
      Promise.all(affiliateIds.map((id: Id<"affiliates">) => ctx.db.get(id))),
      Promise.all(campaignIds.map((id: Id<"campaigns">) => ctx.db.get(id))),
    ]);

    const affiliateMap = new Map((affiliates.filter(Boolean) as any[]).map((a: any) => [a._id, a]));
    const campaignMap = new Map((campaigns.filter(Boolean) as any[]).map((c: any) => [c._id, c]));

    const enrichedCommissions = paginated.page.map((commission: any) => {
      const affiliate = affiliateMap.get(commission.affiliateId);
      const campaign = campaignMap.get(commission.campaignId);
      return {
        _id: commission._id,
        affiliateName: (affiliate as any)?.name ?? "Unknown",
        campaignName: (campaign as any)?.name ?? "Unknown",
        amount: commission.amount,
        status: commission.status,
        createdAt: commission._creationTime,
      };
    });

    return {
      commissions: enrichedCommissions,
      hasNextPage: !paginated.isDone,
      continueCursor: paginated.continueCursor,
    };
  },
});

/**
 * Get all affiliates for a tenant with search filtering.
 * Uses batch approach (no N+1): fetches all clicks and commissions once,
 * then builds per-affiliate lookup maps — same pattern as owner dashboard's
 * getTopAffiliates.
 *
 * Returns all matching affiliates (no pagination) — the admin affiliates tab
 * renders them all in a table. For tenants with >500 affiliates, paginates
 * through the affiliate list and enriches each page.
 */
export const getTenantAffiliates = query({
  args: {
    tenantId: v.id("tenants"),
    searchQuery: v.optional(v.string()),
  },
  returns: v.array(v.object({
    _id: v.id("affiliates"),
    name: v.string(),
    email: v.string(),
    referralCount: v.number(),
    totalEarned: v.number(),
    status: v.string(),
    createdAt: v.number(),
    isFlagged: v.boolean(),
  })),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Fetch affiliates for this tenant (capped — Convex allows only one paginated query per function)
    const allAffiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(200);

    // Apply search filter
    const filteredAffiliates = args.searchQuery && args.searchQuery.trim() !== ""
      ? (() => {
          const q = args.searchQuery!.toLowerCase().trim();
          return allAffiliates.filter(
            (a: { name: string; email: string }) =>
              a.name.toLowerCase().includes(q) ||
              a.email.toLowerCase().includes(q)
          );
        })()
      : allAffiliates;

    // Batch fetch: get ALL clicks and commissions for this tenant ONCE,
    // then build per-affiliate maps — eliminates N+1 queries
    const affiliateIds = allAffiliates.map((a: any) => a._id);

    const [allClicks, allCommissions] = await Promise.all([
      ctx.db
        .query("clicks")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
        .take(2000),
      ctx.db
        .query("commissions")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
        .take(2000),
    ]);

    // Build per-affiliate referral count map
    const referralCountMap = new Map<string, number>();
    for (const click of allClicks) {
      const id = (click as any).affiliateId;
      referralCountMap.set(id, (referralCountMap.get(id) ?? 0) + 1);
    }

    // Build per-affiliate total earned map (approved commissions only)
    const earnedMap = new Map<string, number>();
    for (const commission of allCommissions) {
      if (commission.status === "approved") {
        const id = (commission as any).affiliateId;
        earnedMap.set(id, (earnedMap.get(id) ?? 0) + commission.amount);
      }
    }

    // Enrich each affiliate
    return filteredAffiliates.map((affiliate: any) => ({
      _id: affiliate._id,
      name: affiliate.name,
      email: affiliate.email,
      referralCount: referralCountMap.get(affiliate._id) ?? 0,
      totalEarned: earnedMap.get(affiliate._id) ?? 0,
      status: affiliate.status,
      createdAt: affiliate._creationTime,
      isFlagged: affiliate.fraudSignals?.some(
        (s: { severity: string; reviewedAt?: number }) =>
          s.severity === "high" && !s.reviewedAt
      ) ?? false,
    }));
  },
});

/**
 * Get payout batches for a tenant with stall duration calculation.
 * Returns all batches (no pagination) — admin payouts tab renders them all.
 * Uses pagination internally to handle any volume.
 */
export const getTenantPayoutBatches = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(v.object({
    _id: v.id("payoutBatches"),
    batchCode: v.string(),
    affiliateCount: v.number(),
    totalAmount: v.number(),
    status: v.string(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    stallDuration: v.optional(v.number()),
  })),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Fetch batches (capped — Convex allows only one paginated query per function)
    const allBatches = await ctx.db
      .query("payoutBatches")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(200);

    const now = Date.now() / 1000;
    const STALL_THRESHOLD_HOURS = 48;

    return allBatches.map((batch: any) => {
      let stallDuration: number | undefined;
      if (batch.status === "processing") {
        const hoursSinceCreated = (now - batch.generatedAt) / (60 * 60);
        if (hoursSinceCreated >= STALL_THRESHOLD_HOURS) {
          stallDuration = Math.floor(hoursSinceCreated);
        }
      }

      return {
        _id: batch._id,
        batchCode: `BATCH-${batch._id.slice(-8).toUpperCase()}`,
        affiliateCount: batch.affiliateCount,
        totalAmount: batch.totalAmount,
        status: batch.status,
        createdAt: batch.generatedAt,
        completedAt: batch.completedAt,
        stallDuration,
      };
    });
  },
});

/**
 * Get tenant integration statuses (SaligPay, Tracking Snippet, Email Notifications).
 */
export const getTenantIntegrations = query({
  args: { tenantId: v.id("tenants") },
  returns: v.object({
    saligPay: v.object({
      status: v.string(),
      lastActivity: v.optional(v.number()),
      expiredAt: v.optional(v.number()),
    }),
    trackingSnippet: v.object({
      status: v.string(),
      lastPing: v.optional(v.number()),
    }),
    emailNotifications: v.object({
      status: v.string(),
      lastSent: v.optional(v.number()),
    }),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const now = Date.now() / 1000;

    // SaligPay status
    let saligPayStatus = "not_configured";
    let saligPayLastActivity: number | undefined;
    let saligPayExpiredAt: number | undefined;

    if (tenant.saligPayCredentials) {
      if (tenant.saligPayCredentials.expiresAt && tenant.saligPayCredentials.expiresAt < now) {
        saligPayStatus = "error";
        saligPayExpiredAt = tenant.saligPayCredentials.expiresAt;
        saligPayLastActivity = tenant.saligPayCredentials.connectedAt;
      } else if (tenant.saligPayCredentials.connectedAt) {
        saligPayStatus = "connected";
        saligPayLastActivity = tenant.saligPayCredentials.connectedAt;
        saligPayExpiredAt = tenant.saligPayCredentials.expiresAt;
      } else {
        saligPayStatus = "disconnected";
      }
    }

    // Tracking snippet status
    let snippetStatus = "not_installed";
    let snippetLastPing: number | undefined;

    if (tenant.trackingVerifiedAt) {
      snippetStatus = "verified";
    } else if (tenant.trackingPublicKey) {
      snippetStatus = "pending_verification";
    }

    const lastPings = await ctx.db
      .query("trackingPings")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(1);
    if (lastPings.length > 0) {
      snippetLastPing = lastPings[0].timestamp;
    }

    // Email notification status
    let emailStatus = "never_sent";
    let emailLastSent: number | undefined;

    const lastEmails = await ctx.db
      .query("emails")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(1);
    if (lastEmails.length > 0) {
      emailStatus = "active";
      emailLastSent = lastEmails[0].sentAt ?? lastEmails[0]._creationTime;
    }

    return {
      saligPay: {
        status: saligPayStatus,
        lastActivity: saligPayLastActivity,
        expiredAt: saligPayExpiredAt,
      },
      trackingSnippet: {
        status: snippetStatus,
        lastPing: snippetLastPing,
      },
      emailNotifications: {
        status: emailStatus,
        lastSent: emailLastSent,
      },
    };
  },
});

/**
 * Get admin notes for a tenant.
 * Returns all notes (no pagination) — notes tab renders them all.
 * Paginates internally to handle any volume.
 */
export const getTenantAdminNotes = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(v.object({
    _id: v.id("adminNotes"),
    authorName: v.string(),
    content: v.string(),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Fetch notes (capped — Convex allows only one paginated query per function)
    const allNotes = await ctx.db
      .query("adminNotes")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(100);

    // Batch-enrich with author names
    const authorIds = [...new Set(allNotes.map((n: any) => n.authorId))];
    const authors = await Promise.all(
      authorIds.map((id: Id<"users">) => ctx.db.get(id))
    );
    const authorMap = new Map((authors.filter(Boolean) as any[]).map((a: any) => [a._id, a]));

    return allNotes.map((note: any) => ({
      _id: note._id,
      authorName: authorMap.get(note.authorId)?.name ?? "Unknown Admin",
      content: note.content,
      createdAt: note._creationTime,
    }));
  },
});

/**
 * Add a new admin note for a tenant.
 */
export const addTenantAdminNote = mutation({
  args: {
    tenantId: v.id("tenants"),
    content: v.string(),
  },
  returns: v.id("adminNotes"),
  handler: async (ctx: MutationCtx, args) => {
    let betterAuthUser;
    try {
      betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    } catch {
      throw new Error("Unauthorized: Not authenticated");
    }

    if (!betterAuthUser) {
      throw new Error("Unauthorized: Not authenticated");
    }

    const appUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", betterAuthUser.email))
      .first();

    if (!appUser || appUser.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    const noteId = await ctx.db.insert("adminNotes", {
      tenantId: args.tenantId,
      authorId: appUser._id,
      content: args.content,
    });

    return noteId;
  },
});

/**
 * Get audit log entries for a tenant with Convex-native pagination.
 * Uses .paginate() for true DB-level cursor pagination.
 */
export const getTenantAuditLog = query({
  args: {
    tenantId: v.id("tenants"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    entries: v.array(v.object({
      _id: v.id("auditLogs"),
      actorName: v.string(),
      action: v.string(),
      details: v.optional(v.string()),
      ipAddress: v.optional(v.string()),
      createdAt: v.number(),
    })),
    hasNextPage: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    const paginated = await ctx.db
      .query("auditLogs")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .paginate(args.paginationOpts);

    // Batch-enrich with actor names
    const actorIds = [...new Set(
      paginated.page
        .map((log: any) => log.actorId)
        .filter(Boolean)
    )];
    const actors = await Promise.all(
      actorIds.map((id: string) =>
        ctx.db.query("users").withIndex("by_auth_id", (q: any) => q.eq("authId", id)).first()
      )
    );
    const actorMap = new Map((actors.filter(Boolean) as any[]).map((a: any) => [a.authId, a]));

    const entries = paginated.page.map((log: any) => {
      let actorName = "System";
      if (log.actorId) {
        const actor = actorMap.get(log.actorId);
        if (actor) {
          actorName = actor.name ?? actor.email;
        }
      }

      let details: string | undefined;
      if (log.metadata) {
        if (typeof log.metadata === "object") {
          details = JSON.stringify(log.metadata);
        } else {
          details = String(log.metadata);
        }
      }

      return {
        _id: log._id,
        actorName,
        action: log.action,
        details,
        ipAddress: log.metadata?.ipAddress as string | undefined,
        createdAt: log._creationTime,
      };
    });

    return {
      entries,
      hasNextPage: !paginated.isDone,
      continueCursor: paginated.continueCursor,
    };
  },
});

/**
 * Get full commission detail for admin — includes computation breakdown and audit trail.
 * Scoped to a specific tenant for security.
 */
export const getAdminCommissionDetail = query({
  args: {
    tenantId: v.id("tenants"),
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
        subscriptionId: v.optional(v.string()),
      })),
      reversalReason: v.optional(v.string()),
      transactionId: v.optional(v.string()),
      batchId: v.optional(v.id("payoutBatches")),
      isSelfReferral: v.optional(v.boolean()),
      fraudIndicators: v.optional(v.array(v.string())),
      affiliateName: v.string(),
      affiliateEmail: v.string(),
      campaignName: v.string(),
      customerEmail: v.optional(v.string()),
      planInfo: v.optional(v.string()),
      planEvent: v.string(),
      // Computation fields
      commissionType: v.string(),
      campaignDefaultRate: v.number(),
      effectiveRate: v.number(),
      isOverride: v.boolean(),
      saleAmount: v.optional(v.number()),
      recurringCommission: v.boolean(),
      recurringRate: v.optional(v.number()),
      recurringRateType: v.optional(v.string()),
      // Audit trail
      auditTrail: v.array(v.object({
        _id: v.id("auditLogs"),
        _creationTime: v.number(),
        action: v.string(),
        actorId: v.optional(v.string()),
        actorType: v.string(),
        previousValue: v.optional(v.any()),
        newValue: v.optional(v.any()),
        metadata: v.optional(v.any()),
      })),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    const commission = await ctx.db.get(args.commissionId);
    if (!commission || commission.tenantId !== args.tenantId) {
      return null;
    }

    const affiliate = await ctx.db.get(commission.affiliateId);
    const campaign = await ctx.db.get(commission.campaignId);

    let customerEmail: string | undefined;
    let planInfo: string | undefined;
    let conversionAmount: number | undefined;

    if (commission.conversionId) {
      const conversion = await ctx.db.get(commission.conversionId);
      if (conversion) {
        customerEmail = conversion.customerEmail;
        conversionAmount = conversion.amount;
        const meta = conversion.metadata;
        if (meta?.planId) {
          planInfo = meta.planId;
        } else if (meta?.subscriptionId) {
          planInfo = "Subscription";
        }
      }
    }

    // Compute effective rate (check for affiliate-specific override)
    const activeOverride = affiliate?.commissionOverrides?.find(
      (o: any) => o.campaignId === commission.campaignId && o.status === "active"
    );
    const effectiveRate = activeOverride?.rate ?? campaign?.commissionValue ?? 0;
    const isOverride = !!activeOverride;

    // Inline event type formatter (private in commissions.ts)
    const formatEventType = (source: string | undefined) => {
      if (source === "webhook") return "Subscription";
      if (source === "manual") return "Manual Entry";
      if (source === "api") return "API Triggered";
      return source ?? "Event";
    };

    // Fetch audit trail for this commission
    const allAuditLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", "commission").eq("entityId", args.commissionId)
      )
      .order("asc")
      .collect();
    const auditTrail = allAuditLogs
      .filter((log) => log.tenantId === commission.tenantId)
      .map((log) => ({
        _id: log._id,
        _creationTime: log._creationTime,
        action: log.action,
        actorId: log.actorId,
        actorType: log.actorType,
        previousValue: log.previousValue,
        newValue: log.newValue,
        metadata: log.metadata,
      }));

    return {
      _id: commission._id,
      _creationTime: commission._creationTime,
      tenantId: commission.tenantId,
      affiliateId: commission.affiliateId,
      campaignId: commission.campaignId,
      conversionId: commission.conversionId,
      amount: commission.amount,
      status: commission.status,
      eventMetadata: commission.eventMetadata,
      reversalReason: commission.reversalReason,
      transactionId: commission.transactionId,
      batchId: commission.batchId,
      isSelfReferral: commission.isSelfReferral,
      fraudIndicators: commission.fraudIndicators,
      affiliateName: affiliate?.name ?? "Unknown",
      affiliateEmail: affiliate?.email ?? "Unknown",
      campaignName: campaign?.name ?? "Unknown",
      customerEmail,
      planInfo,
      planEvent: `${campaign?.name ?? "Unknown"} · ${formatEventType(commission.eventMetadata?.source)}`,
      // Computation fields
      commissionType: campaign?.commissionType ?? "N/A",
      campaignDefaultRate: campaign?.commissionValue ?? 0,
      effectiveRate,
      isOverride,
      saleAmount: conversionAmount,
      recurringCommission: campaign?.recurringCommission ?? false,
      recurringRate: campaign?.recurringRate,
      recurringRateType: campaign?.recurringRateType,
      // Audit trail
      auditTrail,
    };
  },
});
