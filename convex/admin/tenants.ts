import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { betterAuthComponent } from "../auth";
import { DEFAULT_TIER_CONFIGS } from "../tierConfig";
import { readTenantStats } from "./_helpers";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Verify that the caller is a platform admin.
 * Returns the admin user document or null.
 * @deprecated Prefer requireAdmin from _helpers.ts
 */
async function requireAdmin(ctx: QueryCtx) {
  let betterAuthUser;
  try {
    betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
  } catch {
    return null;
  }

  if (!betterAuthUser) {
    return null;
  }

  const appUser = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", betterAuthUser.email))
    .first();

  if (!appUser || appUser.role !== "admin") {
    return null;
  }

  return appUser;
}

/**
 * Determine if a tenant is flagged based on conditions:
 * - SaligPay credentials expired (expiresAt in the past)
 * - High fraud signals detected (affiliates with fraud signals)
 *
 * NOTE: Fraud signal check requires scanning affiliates (not in tenantStats).
 * Uses .take(500) cap per AGENTS.md scalability rules.
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

  // Check if any affiliate under this tenant has unreviewed high-severity fraud signals
  const affiliates = await ctx.db
    .query("affiliates")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
    .take(500);

  for (const affiliate of affiliates) {
    if (affiliate.fraudSignals) {
      const hasUnreviewedHigh = affiliate.fraudSignals.some(
        (signal: { severity: string; reviewedAt?: number }) =>
          signal.severity === "high" && !signal.reviewedAt
      );
      if (hasUnreviewedHigh) {
        return true;
      }
    }
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
 * Replaces the old unbounded .collect() scan.
 */
async function getAffiliateCount(ctx: QueryCtx, tenantId: Id<"tenants">): Promise<number> {
  const stats = await readTenantStats(ctx, tenantId);
  return stats.affiliatesPending
    + stats.affiliatesActive
    + stats.affiliatesSuspended
    + stats.affiliatesRejected;
}

/**
 * Get MRR influenced by affiliate commissions for a tenant.
 * Aligns with the SaaS owner dashboard: sum of conversion.amount
 * for approved commissions in the last 30 days.
 * Uses .take(500) cap per AGENTS.md scalability rules.
 */
async function getTenantMRR(ctx: QueryCtx, tenant: any): Promise<number> {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const commissions = await ctx.db
    .query("commissions")
    .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenant._id))
    .take(500);

  const approvedInRange = commissions.filter(
    (c: { status: string; _creationTime: number }) =>
      c.status === "approved" && c._creationTime >= thirtyDaysAgo
  );

  // Sum conversion amounts (full subscription price), matching owner dashboard logic
  let mrr = 0;
  for (const commission of approvedInRange) {
    if (commission.conversionId) {
      const conversion = await ctx.db.get(commission.conversionId);
      if (conversion) {
        mrr += conversion.amount;
        continue;
      }
    }
    mrr += commission.amount;
  }
  return mrr;
}

export interface TenantRow {
  _id: Id<"tenants">;
  _creationTime: number;
  name: string;
  slug: string;
  domain: string | undefined;
  plan: string;
  status: string;
  ownerEmail: string;
  affiliateCount: number;
  mrr: number;
  isFlagged: boolean;
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
        v.literal("flagged")
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
        ownerEmail: v.string(),
        affiliateCount: v.number(),
        mrr: v.number(),
        isFlagged: v.boolean(),
      })
    ),
    nextCursor: v.optional(v.string()),
    hasMore: v.boolean(),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    // Verify admin access
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Fetch all tenants (needed for search + flagged computation)
    const allTenants = await ctx.db.query("tenants").order("desc").collect();

    // Enrich each tenant with computed fields
    // affiliateCount now reads from tenantStats (O(1)) instead of .collect()
    let enriched: TenantRow[] = [];
    for (const tenant of allTenants) {
      const [ownerEmail, affiliateCount, isFlagged, mrr] = await Promise.all([
        getTenantOwnerEmail(ctx, tenant._id),
        getAffiliateCount(ctx, tenant._id),
        isTenantFlagged(ctx, tenant._id),
        getTenantMRR(ctx, tenant),
      ]);

      enriched.push({
        _id: tenant._id,
        _creationTime: tenant._creationTime,
        name: tenant.name,
        slug: tenant.slug,
        domain: tenant.branding?.customDomain,
        plan: tenant.plan,
        status: tenant.status,
        ownerEmail,
        affiliateCount,
        mrr,
        isFlagged,
      });
    }

    // Apply status filter
    if (args.statusFilter) {
      if (args.statusFilter === "flagged") {
        enriched = enriched.filter((t) => t.isFlagged);
      } else {
        enriched = enriched.filter((t) => t.status === args.statusFilter);
      }
    }

    // Apply search filter
    if (args.searchQuery && args.searchQuery.trim() !== "") {
      const query = args.searchQuery.toLowerCase().trim();
      enriched = enriched.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.slug.toLowerCase().includes(query) ||
          t.ownerEmail.toLowerCase().includes(query) ||
          (t.domain && t.domain.toLowerCase().includes(query))
      );
    }

    // Sort: by creation date descending (default)
    enriched.sort((a, b) => b._creationTime - a._creationTime);

    const total = enriched.length;

    // Pagination using cursor-based approach on the filtered results
    let startIndex = 0;
    if (args.cursor) {
      startIndex = parseInt(args.cursor, 10);
    }

    const pageItems = enriched.slice(startIndex, startIndex + args.numItems);
    const hasMore = startIndex + args.numItems < enriched.length;
    const nextCursor = hasMore ? String(startIndex + args.numItems) : undefined;

    return {
      tenants: pageItems,
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
    deltaThisWeek: v.number(),
  }),
  handler: async (ctx) => {
    // Verify admin access
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    const allTenants = await ctx.db.query("tenants").collect();

    // Count by status
    let active = 0;
    let trial = 0;
    let suspended = 0;
    let flagged = 0;
    const oneWeekAgo = Date.now() / 1000 - 7 * 24 * 60 * 60;

    for (const tenant of allTenants) {
      if (tenant.status === "active") active++;
      if (tenant.status === "trial") trial++;
      if (tenant.status === "suspended") suspended++;

      const tenantFlagged = await isTenantFlagged(ctx, tenant._id);
      if (tenantFlagged) flagged++;
    }

    // Count new tenants this week
    const deltaThisWeek = allTenants.filter((t: { _creationTime: number }) => t._creationTime > oneWeekAgo).length;

    return {
      total: allTenants.length,
      active,
      trial,
      suspended,
      flagged,
      deltaThisWeek,
    };
  },
});

// =============================================================================
// Story 11.4: Plan Limit Usage View - Backend Queries
// =============================================================================

type WarningLevel = "normal" | "warning" | "critical";

/**
 * Pure function: Calculate warning level from percentage.
 */
function getWarningLevel(percentage: number): WarningLevel {
  if (percentage >= 95) return "critical";
  if (percentage >= 80) return "warning";
  return "normal";
}

/**
 * Get effective tier limits for a tenant, considering active overrides.
 * Story 11.5: If an active override exists, override limits take precedence.
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
  // Check for active override (Story 11.5)
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
 * (Task 1: Backend - Get Tenant Plan Usage Query, AC: #1, #2)
 *
 * FIXED: Affiliate count now reads from tenantStats (O(1)) instead of .collect().
 * Campaigns, team members, and payouts still use capped .take() since those
 * tables are low-volume per-tenant.
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
    // Story 11.5: Override status
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

    // Get tenant
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Get tier config — fall back to defaults if no DB row exists
    const tierConfig = await ctx.db
      .query("tierConfigs")
      .withIndex("by_tier", (q: any) => q.eq("tier", tenant.plan))
      .first();

    const resolvedTierConfig = tierConfig ?? DEFAULT_TIER_CONFIGS[tenant.plan as keyof typeof DEFAULT_TIER_CONFIGS] ?? DEFAULT_TIER_CONFIGS.starter;

    // Story 11.5: Get effective limits (considering active overrides)
    const effectiveLimits = await getEffectiveLimits(ctx, args.tenantId, resolvedTierConfig);

    // Read affiliate count from denormalized tenantStats — O(1), no table scan
    const stats = await readTenantStats(ctx, args.tenantId);
    const activeAffiliates = stats.affiliatesActive;

    // Count campaigns — use active count for limit checking
    // Low-volume per tenant; .take(500) cap is safe
    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .take(500);
    const activeCampaigns = campaigns.filter(
      (c: { status: string }) => c.status === "active"
    ).length;

    // Count team members (non-removed users on tenant)
    // Low-volume per tenant; .take(50) cap is safe
    const teamMembers = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .take(50);
    const activeTeamMembers = teamMembers.filter(
      (u: { status?: string; removedAt?: number }) =>
        u.status !== "removed" && !u.removedAt
    ).length;

    // Count payouts this month (processing status)
    // Low-volume per tenant; .take(500) cap is safe
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthMs = startOfMonth.getTime();

    const payouts = await ctx.db
      .query("payoutBatches")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .take(500);
    const monthlyPayouts = payouts.filter(
      (p: { generatedAt: number; status: string }) =>
        p.generatedAt >= startOfMonthMs && p.status === "processing"
    ).length;

    // Calculate percentages and warning levels using effective limits
    const affiliatePercentage = effectiveLimits.maxAffiliates > 0
      ? Math.round((activeAffiliates / effectiveLimits.maxAffiliates) * 100)
      : 0;
    const campaignPercentage = effectiveLimits.maxCampaigns > 0
      ? Math.round((activeCampaigns / effectiveLimits.maxCampaigns) * 100)
      : 0;
    const teamMemberPercentage = effectiveLimits.maxTeamMembers > 0
      ? Math.round((activeTeamMembers / effectiveLimits.maxTeamMembers) * 100)
      : 0;
    const payoutPercentage = effectiveLimits.maxPayoutsPerMonth > 0
      ? Math.round((monthlyPayouts / effectiveLimits.maxPayoutsPerMonth) * 100)
      : 0;

    // Custom domain info (Scale tier feature)
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
          current: activeCampaigns,
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
 * (Task 2: Backend - Get Tier Limits Query, AC: #1)
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

    const WARNING_THRESHOLD = 80;
    const CRITICAL_THRESHOLD = 95;

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
          warning: WARNING_THRESHOLD,
          critical: CRITICAL_THRESHOLD,
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
 * (Task 1: Backend - Tenant Detail Query, AC: #1, #2, #4)
 *
 * FIXED: Affiliate counts and commission totals now read from tenantStats (O(1))
 * instead of unbounded .collect() on affiliates and commissions tables.
 * "flagged" affiliate count still needs a capped scan (not tracked in tenantStats).
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

    // Get owner user for email
    const users = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .take(50);
    const owner = users.find((u: { role: string }) => u.role === "owner");

    // Read aggregate counts from denormalized tenantStats — O(1)
    const stats = await readTenantStats(ctx, args.tenantId);

    // "flagged" count requires scanning affiliates for fraud signals (not in tenantStats)
    const affiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .take(500);
    const flaggedAffiliateCount = affiliates.filter((a: { fraudSignals?: any[] }) =>
      a.fraudSignals?.some(
        (s: { severity: string; reviewedAt?: number }) =>
          s.severity === "high" && !s.reviewedAt
      )
    ).length;

    const affiliateCount = {
      total: stats.affiliatesPending + stats.affiliatesActive + stats.affiliatesSuspended + stats.affiliatesRejected,
      active: stats.affiliatesActive,
      pending: stats.affiliatesPending,
      flagged: flaggedAffiliateCount,
    };

    // Total commissions = approved + pending payout value (from tenantStats)
    // pendingPayoutTotal tracks approved commissions not yet paid out
    // commissionsPendingValue tracks pending commissions
    const totalCommissions = (stats.pendingPayoutTotal ?? 0) + stats.commissionsPendingValue;

    // Calculate MRR influenced (last 30 days, using conversion amounts)
    // Still requires a commission scan — this is a time-range filter not tracked in tenantStats
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .take(500);
    const recentApproved = commissions.filter(
      (c: { status: string; _creationTime: number }) =>
        c.status === "approved" && c._creationTime >= thirtyDaysAgo
    );

    let mrrInfluenced = 0;
    for (const commission of recentApproved) {
      if (commission.conversionId) {
        const conversion = await ctx.db.get(commission.conversionId) as { amount: number } | null;
        if (conversion) {
          mrrInfluenced += conversion.amount;
          continue;
        }
      }
      mrrInfluenced += commission.amount;
    }

    // Determine SaligPay connection status
    let saligPayStatus: string | undefined;
    let saligPayExpiresAt: number | undefined;
    if (tenant.saligPayCredentials) {
      const now = Date.now() / 1000;
      if (tenant.saligPayCredentials.expiresAt && tenant.saligPayCredentials.expiresAt < now) {
        saligPayStatus = "error";
        saligPayExpiresAt = tenant.saligPayCredentials.expiresAt;
      } else if (tenant.saligPayCredentials.connectedAt) {
        saligPayStatus = "connected";
        saligPayExpiresAt = tenant.saligPayCredentials.expiresAt;
      } else {
        saligPayStatus = "disconnected";
      }
    }

    // Determine flag reasons
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
      affiliateCount,
      totalCommissions,
      mrrInfluenced,
      isFlagged,
      flagReasons,
    };
  },
});

/**
 * Get tenant statistics including MRR, active affiliates, pending commissions, open payouts.
 * (Task 2: Backend - Tenant Stats Query, AC: #4)
 *
 * FIXED: Affiliate counts, pending commissions, and total paid out now read
 * from tenantStats (O(1)) instead of unbounded .collect() scans.
 * MRR still requires a time-range scan (not pre-computed in tenantStats).
 * Open payouts use capped .take() on payoutBatches (low-volume per tenant).
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
    openPayouts: v.number(),
    openPayoutsTotal: v.number(),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Read aggregate counts from denormalized tenantStats — O(1)
    const stats = await readTenantStats(ctx, args.tenantId);

    // MRR influenced: sum of conversion amounts for approved commissions (last 30 days)
    // This requires a time-range scan — not pre-computed in tenantStats
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .take(500);

    // Get conversions for MRR calculation (use full subscription amount, not affiliate cut)
    const approvedInRange = commissions.filter(
      (c: { status: string; _creationTime: number }) =>
        c.status === "approved" && c._creationTime >= thirtyDaysAgo
    );
    const approvedPrevRange = commissions.filter(
      (c: { status: string; _creationTime: number }) =>
        c.status === "approved" && c._creationTime >= sixtyDaysAgo && c._creationTime < thirtyDaysAgo
    );

    // Helper: sum conversion amounts for a set of commissions
    const sumConversionAmounts = async (comms: Array<{ amount: number; conversionId?: any }>): Promise<number> => {
      let total = 0;
      for (const commission of comms) {
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
    };

    const currentMRR = await sumConversionAmounts(approvedInRange);
    const previousMRR = await sumConversionAmounts(approvedPrevRange);

    // MRR delta: percentage change
    const mrrDelta = previousMRR > 0
      ? Math.round(((currentMRR - previousMRR) / previousMRR) * 100)
      : currentMRR > 0 ? 100 : 0;

    // Open payouts (payout batches in processing or pending status)
    // Low-volume per tenant; .take(500) cap is safe
    const payoutBatches = await ctx.db
      .query("payoutBatches")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .take(500);
    const openBatches = payoutBatches.filter((b: { status: string }) =>
      b.status === "processing" || b.status === "pending"
    );
    const openPayouts = openBatches.length;
    const openPayoutsTotal = openBatches.reduce((sum: number, b: { totalAmount: number }) => sum + b.totalAmount, 0);

    return {
      mrrInfluenced: currentMRR,
      mrrDelta,
      activeAffiliates: stats.affiliatesActive,
      pendingAffiliates: stats.affiliatesPending,
      pendingCommissions: stats.commissionsPendingValue,
      pendingCommissionsCount: stats.commissionsPendingCount,
      openPayouts,
      openPayoutsTotal,
    };
  },
});

/**
 * Get recent commissions for a tenant with affiliate and campaign name lookups.
 * (Task 3: Backend - Tenant Commissions Query, AC: #6)
 *
 * FIXED: Uses .take(500) instead of unbounded .collect().
 */
export const getTenantCommissions = query({
  args: {
    tenantId: v.id("tenants"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
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
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    const limit = Math.min(args.limit ?? 10, 100);

    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(500);

    // Cursor-based pagination
    let startIndex = 0;
    if (args.cursor) {
      startIndex = parseInt(args.cursor, 10);
    }

    const pageCommissions = commissions.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < commissions.length;
    const nextCursor = hasMore ? String(startIndex + limit) : undefined;

    // Enrich with affiliate and campaign names
    const enrichedCommissions = await Promise.all(
      pageCommissions.map(async (commission: any) => {
        const affiliate = await ctx.db.get(commission.affiliateId);
        const campaign = await ctx.db.get(commission.campaignId);
        const affiliateName = (affiliate as any)?.name ?? "Unknown";
        const campaignName = (campaign as any)?.name ?? "Unknown";

        return {
          _id: commission._id,
          affiliateName,
          campaignName,
          amount: commission.amount,
          status: commission.status,
          createdAt: commission._creationTime,
        };
      })
    );

    return {
      commissions: enrichedCommissions,
      nextCursor,
    };
  },
});

/**
 * Get all affiliates for a tenant with search filtering.
 * (Task 4: Backend - Tenant Affiliates Query, AC: #9)
 *
 * FIXED: Uses .take(500) instead of unbounded .collect() for affiliate list.
 * Uses .take(500) instead of unbounded .collect() for per-affiliate lookups.
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

    let affiliates = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .take(500);

    // Search filter by name or email
    if (args.searchQuery && args.searchQuery.trim() !== "") {
      const query = args.searchQuery.toLowerCase().trim();
      affiliates = affiliates.filter(
        (a: { name: string; email: string }) =>
          a.name.toLowerCase().includes(query) ||
          a.email.toLowerCase().includes(query)
      );
    }

    // Enrich each affiliate with referral count, total earned, and flagged status
    const enrichedAffiliates = await Promise.all(
      affiliates.map(async (affiliate: any) => {
        // Count referrals (clicks) — capped per affiliate
        const referrals = await ctx.db
          .query("clicks")
          .withIndex("by_affiliate", (q: any) => q.eq("affiliateId", affiliate._id))
          .take(500);

        // Calculate total earned from approved commissions — capped per affiliate
        const commissions = await ctx.db
          .query("commissions")
          .withIndex("by_affiliate", (q: any) => q.eq("affiliateId", affiliate._id))
          .take(500);
        const totalEarned = commissions
          .filter((c: { status: string }) => c.status === "approved")
          .reduce((sum: number, c: { amount: number }) => sum + c.amount, 0);

        // Check if flagged
        const isFlagged = affiliate.fraudSignals?.some(
          (s: { severity: string; reviewedAt?: number }) =>
            s.severity === "high" && !s.reviewedAt
        ) ?? false;

        return {
          _id: affiliate._id,
          name: affiliate.name,
          email: affiliate.email,
          referralCount: referrals.length,
          totalEarned,
          status: affiliate.status,
          createdAt: affiliate._creationTime,
          isFlagged,
        };
      })
    );

    return enrichedAffiliates;
  },
});

/**
 * Get payout batches for a tenant with stall duration calculation.
 * (Task 5: Backend - Tenant Payout Batches Query, AC: #10)
 *
 * FIXED: Uses .take(500) instead of unbounded .collect().
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

    const batches = await ctx.db
      .query("payoutBatches")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(500);

    const now = Date.now() / 1000;
    const STALL_THRESHOLD_HOURS = 48;

    return batches.map((batch: any) => {
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
 * (Task 6: Backend - Tenant Integrations Query, AC: #11)
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

    // Get last ping from trackingPings
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
 * (Task 7: Backend - Admin Notes Query, AC: #12)
 *
 * FIXED: Uses .take(100) instead of unbounded .collect().
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

    const notes = await ctx.db
      .query("adminNotes")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(100);

    // Enrich with author name
    const enrichedNotes = await Promise.all(
      notes.map(async (note: any) => {
        const author = await ctx.db.get(note.authorId);
        return {
          _id: note._id,
          authorName: (author as any)?.name ?? "Unknown Admin",
          content: note.content,
          createdAt: note._creationTime,
        };
      })
    );

    return enrichedNotes;
  },
});

/**
 * Add a new admin note for a tenant.
 * (Task 7: Backend - Admin Notes Mutation, AC: #12)
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
 * Get audit log entries for a tenant with pagination.
 * (Task 8: Backend - Tenant Audit Log Query, AC: #13)
 *
 * FIXED: Uses .take(500) instead of unbounded .collect().
 */
export const getTenantAuditLog = query({
  args: {
    tenantId: v.id("tenants"),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
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
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    const limit = Math.min(args.limit ?? 20, 100);

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_tenant", (q: any) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(500);

    // Cursor-based pagination
    let startIndex = 0;
    if (args.cursor) {
      startIndex = parseInt(args.cursor, 10);
    }

    const pageLogs = logs.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < logs.length;
    const nextCursor = hasMore ? String(startIndex + limit) : undefined;

    // Enrich with actor name
    const entries = await Promise.all(
      pageLogs.map(async (log: any) => {
        let actorName = "System";
        if (log.actorId) {
          const actor = await ctx.db
            .query("users")
            .withIndex("by_auth_id", (q: any) => q.eq("authId", log.actorId))
            .first();
          if (actor) {
            actorName = actor.name ?? actor.email;
          }
        }

        // Build details string from metadata
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
      })
    );

    return {
      entries,
      nextCursor,
    };
  },
});
