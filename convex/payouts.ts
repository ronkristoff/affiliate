import { query, internalAction, internalQuery, internalMutation } from "./_generated/server";
import { mutation } from "./triggers";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthenticatedUser, requireTenantId, requireWriteAccess } from "./tenantContext";
import { commissionsAggregate, payoutsAggregate } from "./aggregates";
import { adjustPendingPayoutTotals } from "./tenantStats";

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Count pending payouts in a batch. Used by markPayoutAsPaid to determine
 * if the batch should auto-transition to "completed".
 */
async function countPendingPayouts(
  ctx: MutationCtx,
  batchId: Id<"payoutBatches">
): Promise<number> {
    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_batch", (q) => q.eq("batchId", batchId))
      .take(500);
  return payouts.filter((p) => p.status === "pending").length;
}

// =============================================================================
// Story 13.1: Payout Batch Generation
// =============================================================================

/**
 * Generate a payout batch for all affiliates with approved, unpaid commissions.
 * Creates a payoutBatch record with "pending" status, links commissions to the batch,
 * creates individual payout records, and returns a summary.
 *
 * AC#1: Generate Batch - list all affiliates with approved unpaid commissions
 * AC#4: Batch Metadata - generated date, total affiliate count, total amount, unique ID
 *
 * SECURITY: This mutation is idempotent - commissions are filtered to only include
 * those with status="approved" AND no batchId (not already paid).
 */
export const generatePayoutBatch = mutation({
  args: {
    affiliateIds: v.optional(v.array(v.id("affiliates"))),
  },
  returns: v.object({
    batchId: v.id("payoutBatches"),
    affiliateCount: v.number(),
    totalAmount: v.number(),
    affiliates: v.array(
      v.object({
        affiliateId: v.id("affiliates"),
        name: v.string(),
        email: v.string(),
        payoutMethod: v.optional(
          v.object({
            type: v.string(),
            details: v.string(),
          })
        ),
        pendingAmount: v.number(),
        commissionCount: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }
    await requireWriteAccess(ctx);

    // Query approved unpaid commissions for this tenant (not already in a batch)
    const approvedCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant_and_status", (q) =>
        q.eq("tenantId", tenantId).eq("status", "approved")
      )
      .take(700);

    let commissions = approvedCommissions.filter((c) => !c.batchId);

    // If specific affiliate IDs were provided, only include their commissions
    if (args.affiliateIds && args.affiliateIds.length > 0) {
      const allowedIds = new Set(args.affiliateIds);
      commissions = commissions.filter((c) => allowedIds.has(c.affiliateId));
    }

    // Aggregate by affiliate: sum amounts and count commissions
    const affiliateCommissions = new Map<
      Id<"affiliates">,
      { amount: number; count: number; commissionIds: Id<"commissions">[] }
    >();

    for (const commission of commissions) {
      const existing = affiliateCommissions.get(commission.affiliateId) ?? {
        amount: 0,
        count: 0,
        commissionIds: [],
      };
      existing.amount += commission.amount;
      existing.count += 1;
      existing.commissionIds.push(commission._id);
      affiliateCommissions.set(commission.affiliateId, existing);
    }

    // If no pending payouts, throw an error so the UI can show empty state
    if (affiliateCommissions.size === 0) {
      throw new Error("NO_PENDING_PAYOUTS");
    }

    // --- Tier limit enforcement: maxPayoutsPerMonth ---
    const tenant = await ctx.db.get(tenantId);
    if (tenant) {
      const tierName = (tenant.plan || "starter") as string;
      const tierConfig = await ctx.db
        .query("tierConfigs")
        .withIndex("by_tier", (q) => q.eq("tier", tierName))
        .unique();

      const maxPayouts = tierConfig?.maxPayoutsPerMonth ?? -1; // default to unlimited

      if (maxPayouts !== -1) {
        // Count existing payouts created this month
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const allPayouts = await paginateAggregateDocs(ctx, payoutsAggregate, tenantId);
        const thisMonthCount = allPayouts.filter((p: any) => p._creationTime >= monthStart).length;
        const newPayoutCount = affiliateCommissions.size;

        if (thisMonthCount + newPayoutCount > maxPayouts) {
          throw new Error(
            `Payout limit reached for this month (${thisMonthCount}/${maxPayouts}). Please upgrade your plan or wait until next month.`
          );
        }
      }
    }
    // --- End tier limit enforcement ---

    // Fetch affiliate details and build summary
    const affiliateIds = Array.from(affiliateCommissions.keys());
    const affiliateDetails = await Promise.all(
      affiliateIds.map(async (affiliateId) => {
        const affiliate = await ctx.db.get(affiliateId);
        if (!affiliate || affiliate.tenantId !== tenantId) {
          return null;
        }
        const data = affiliateCommissions.get(affiliateId)!;
        return {
          affiliateId: affiliate._id,
          name: affiliate.name,
          email: affiliate.email,
          payoutMethod: affiliate.payoutMethod,
          pendingAmount: data.amount,
          commissionCount: data.count,
          commissionIds: data.commissionIds,
        };
      })
    );

    // Filter out any nulls (shouldn't happen, but safety)
    const validAffiliates = affiliateDetails.filter(Boolean) as Array<{
      affiliateId: Id<"affiliates">;
      name: string;
      email: string;
      payoutMethod: Doc<"affiliates">["payoutMethod"];
      pendingAmount: number;
      commissionCount: number;
      commissionIds: Id<"commissions">[];
    }>;

    // Calculate grand total using integer-safe summation
    let grandTotal = 0;
    for (const affiliate of validAffiliates) {
      grandTotal += affiliate.pendingAmount;
    }

    // Create the payout batch record (atomic)
    const batchId = await ctx.db.insert("payoutBatches", {
      tenantId,
      totalAmount: grandTotal,
      affiliateCount: validAffiliates.length,
      status: "pending",
      generatedAt: Date.now(),
    });

    // Create individual payout records for each affiliate and update commissions
    for (const affiliate of validAffiliates) {
      // Create payout record
      await ctx.db.insert("payouts", {
        tenantId,
        affiliateId: affiliate.affiliateId,
        batchId,
        amount: affiliate.pendingAmount,
        status: "pending",
      });

      // Update all commissions for this affiliate: link to batch (status stays "approved" until markBatchAsPaid)
      for (const commissionId of affiliate.commissionIds) {
        await ctx.db.patch(commissionId, {
          batchId,
        });
      }
    }

    // Create audit log entry for batch generation (Story 13.6: Use centralized function)
    await ctx.runMutation(internal.audit.logPayoutAuditEvent, {
      tenantId,
      action: "payout_batch_generated",
      entityType: "payoutBatches",
      entityId: batchId,
      actorId: user.userId,
      actorType: "user",
      metadata: {
        affiliateCount: validAffiliates.length,
        totalAmount: grandTotal,
        batchStatus: "pending",
      },
    });

    return {
      batchId,
      affiliateCount: validAffiliates.length,
      totalAmount: grandTotal,
      affiliates: validAffiliates.map((a) => ({
        affiliateId: a.affiliateId,
        name: a.name,
        email: a.email,
        payoutMethod: a.payoutMethod,
        pendingAmount: a.pendingAmount,
        commissionCount: a.commissionCount,
      })),
    };
  },
});

/**
 * Get payout batches for the current tenant with pagination and optional status filter.
 * AC#4: Batch Metadata viewing
 * AC#3: Pagination support
 * AC#4: Status filtering (All / Processing / Completed)
 *
 * Uses by_tenant index for unfiltered queries and by_tenant_and_status when filtering.
 */
export const getPayoutBatches = query({
  args: {
    paginationOpts: paginationOptsValidator,
    statusFilter: v.optional(v.union(
      v.literal("all"),
      v.literal("processing"),
      v.literal("completed"),
    )),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("payoutBatches"),
        totalAmount: v.number(),
        affiliateCount: v.number(),
        status: v.string(),
        generatedAt: v.number(),
        completedAt: v.optional(v.number()),
        batchCode: v.string(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);

    // Use appropriate index based on whether we're filtering by status
    let queryBuilder;
    if (args.statusFilter) {
      const statusFilter = args.statusFilter as string;
      if (statusFilter === "processing" || statusFilter === "completed") {
        queryBuilder = ctx.db
          .query("payoutBatches")
          .withIndex("by_tenant_and_status", (q) =>
            q.eq("tenantId", tenantId).eq("status", statusFilter)
          );
      } else {
        queryBuilder = ctx.db
          .query("payoutBatches")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId));
      }
    } else {
      queryBuilder = ctx.db
        .query("payoutBatches")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId));
    }

    const paginated = await queryBuilder
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      page: paginated.page.map((batch) => ({
        _id: batch._id,
        totalAmount: batch.totalAmount,
        affiliateCount: batch.affiliateCount,
        status: batch.status,
        generatedAt: batch.generatedAt,
        completedAt: batch.completedAt,
        batchCode: `BATCH-${batch._id.slice(-8).toUpperCase()}`,
      })),
      isDone: paginated.isDone,
      continueCursor: paginated.continueCursor,
    };
  },
});

/**
 * Get a single payout batch by ID. Used by the batch detail page.
 */
export const getPayoutBatchById = query({
  args: {
    batchId: v.id("payoutBatches"),
  },
  returns: v.union(
    v.object({
      _id: v.id("payoutBatches"),
      totalAmount: v.number(),
      affiliateCount: v.number(),
      status: v.string(),
      generatedAt: v.number(),
      completedAt: v.optional(v.number()),
      batchCode: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.tenantId !== tenantId) {
      return null;
    }
    return {
      _id: batch._id,
      totalAmount: batch.totalAmount,
      affiliateCount: batch.affiliateCount,
      status: batch.status,
      generatedAt: batch.generatedAt,
      completedAt: batch.completedAt,
      batchCode: `BATCH-${batch._id.slice(-8).toUpperCase()}`,
    };
  },
});

/**
 * Get the total pending payout amount for the current tenant.
 * Used by the hero banner to show "Ready to Pay" amount.
 * Only includes approved commissions that are not already part of a batch.
 */
export const getPendingPayoutTotal = query({
  args: {},
  returns: v.object({
    totalAmount: v.number(),
    affiliateCount: v.number(),
    commissionCount: v.number(),
  }),
  handler: async (ctx) => {
    const tenantId = await requireTenantId(ctx);

    // Read from denormalized tenantStats — zero table scans, always accurate
    const stats = await ctx.db
      .query("tenantStats")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .first();

    return {
      totalAmount: stats?.pendingPayoutTotal ?? 0,
      affiliateCount: 0, // Per-affiliate count not available from tenantStats alone
      commissionCount: stats?.pendingPayoutCount ?? 0,
    };
  },
});

/**
 * Get the total amount paid out across all completed payout batches.
 * Single source of truth for "Total Paid Out" displayed on dashboard and payouts page.
 */
export const getTotalPaidOut = query({
  args: {},
  returns: v.object({
    totalAmount: v.number(),
    completedBatchCount: v.number(),
  }),
  handler: async (ctx) => {
    const tenantId = await requireTenantId(ctx);

    const completedBatches = await ctx.db
      .query("payoutBatches")
      .withIndex("by_tenant_and_status", (q) =>
        q.eq("tenantId", tenantId).eq("status", "completed")
      )
      .take(200);

    let totalAmount = 0;
    for (const batch of completedBatches) {
      totalAmount += batch.totalAmount;
    }

    return {
      totalAmount,
      completedBatchCount: completedBatches.length,
    };
  },
});

/**
 * Recalculate pending payout stats from actual commission data.
 * Fixes sync issues when tenantStats.pendingPayoutTotal/Count drift out of sync.
 * 
 * This scans all approved commissions without a batchId and updates tenantStats
 * to match the actual pending payout amount.
 */
export const recalcPendingPayoutStats = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    pendingPayoutTotal: v.number(),
    pendingPayoutCount: v.number(),
    commissionCount: v.number(),
  }),
  handler: async (ctx) => {
    const tenantId = await requireTenantId(ctx);
    await requireWriteAccess(ctx);

    const commissions = await paginateAggregateDocs(ctx, commissionsAggregate, tenantId);

    // Count only approved commissions without a batchId (truly pending payout)
    const pendingCommissions = commissions.filter(
      (c) => c.status === "approved" && !c.batchId,
    );
    
    const pendingPayoutTotal = pendingCommissions.reduce(
      (sum, c) => sum + c.amount,
      0
    );
    const pendingPayoutCount = pendingCommissions.length;

    // Update tenantStats
    const stats = await ctx.db
      .query("tenantStats")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .first();

    if (stats) {
      await ctx.db.patch(stats._id, {
        pendingPayoutTotal,
        pendingPayoutCount,
      });
    }

    return {
      success: true,
      pendingPayoutTotal,
      pendingPayoutCount,
      commissionCount: pendingCommissions.length,
    };
  },
});

/**
 * Diagnostic query: Get all approved commissions without a batchId.
 * Use this to debug why pending payouts appear empty.
 */
export const getPendingCommissionsDiagnostic = query({
  args: {},
  returns: v.array(
    v.object({
      commissionId: v.id("commissions"),
      affiliateId: v.id("affiliates"),
      amount: v.number(),
      status: v.string(),
      hasBatchId: v.boolean(),
      batchId: v.optional(v.id("payoutBatches")),
      affiliateExists: v.boolean(),
      affiliateTenantId: v.optional(v.id("tenants")),
    })
  ),
  handler: async (ctx) => {
    const tenantId = await requireTenantId(ctx);

    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant_and_status", (q) =>
        q.eq("tenantId", tenantId).eq("status", "approved")
      )
      .take(100);

    const results = [];
    for (const c of commissions) {
      if (c.batchId) continue; // Skip already paid
      
      const affiliate = await ctx.db.get(c.affiliateId);
      results.push({
        commissionId: c._id,
        affiliateId: c.affiliateId,
        amount: c.amount,
        status: c.status,
        hasBatchId: !!c.batchId,
        batchId: c.batchId,
        affiliateExists: !!affiliate,
        affiliateTenantId: affiliate?.tenantId,
      });
    }

    return results;
  },
});

// =============================================================================
// Story 13.2: Payout Batch CSV Download
// =============================================================================

/**
 * Get all payout records for a specific batch, enriched with affiliate data.
 * Used by CSV download to generate the payout batch spreadsheet.
 *
 * AC#1: CSV Download Button on Batch
 * AC#2: CSV Download from Batch History
 *
 * SECURITY: Verifies the batch belongs to the current tenant before returning data.
 * Uses by_batch index on payouts table and commissions table for efficient lookups.
 */
export const getBatchPayouts = query({
  args: { batchId: v.id("payoutBatches") },
  returns: v.array(
    v.object({
      payoutId: v.id("payouts"),
      affiliateId: v.id("affiliates"),
      name: v.string(),
      email: v.string(),
      amount: v.number(),
      payoutMethod: v.optional(
        v.object({
          type: v.string(),
          details: v.string(),
        })
      ),
      payoutProviderStatus: v.optional(v.string()),
      payoutProviderAccountId: v.optional(v.string()),
      status: v.string(),
      commissionCount: v.number(),
      paymentReference: v.optional(v.string()),
      paidAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);

    // 1. Verify batch belongs to current tenant
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.tenantId !== tenantId) {
      throw new Error("Batch not found or access denied");
    }

    // 2. Fetch all payout records for this batch using index
    const payoutRecords = await ctx.db
      .query("payouts")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .take(5000);

    // 3. Fetch all commissions for this batch using index (for counting)
    const batchCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .take(5000);

    // 4. Count commissions per affiliate
    const commissionCounts = new Map<Id<"affiliates">, number>();
    for (const commission of batchCommissions) {
      const current = commissionCounts.get(commission.affiliateId) ?? 0;
      commissionCounts.set(commission.affiliateId, current + 1);
    }

    // 5. Enrich with affiliate data
    const results = await Promise.all(
      payoutRecords.map(async (payout) => {
        const affiliate = await ctx.db.get(payout.affiliateId);
        if (!affiliate || affiliate.tenantId !== tenantId) {
          return null;
        }
        return {
          payoutId: payout._id,
          affiliateId: affiliate._id,
          name: affiliate.name,
          email: affiliate.email,
          amount: payout.amount,
          payoutMethod: affiliate.payoutMethod
            ? {
                type: affiliate.payoutMethod.type,
                details: affiliate.payoutMethod.details,
              }
            : undefined,
          payoutProviderStatus: affiliate.payoutProviderStatus,
          payoutProviderAccountId: affiliate.payoutProviderAccountId,
          status: payout.status,
          commissionCount: commissionCounts.get(payout.affiliateId) ?? 0,
          paymentReference: payout.paymentReference ?? undefined,
          paidAt: payout.paidAt ?? undefined,
        };
      })
    );

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

/**
 * Get commission details for a specific affiliate within a payout batch.
 * Used by the batch detail sheet to show the breakdown of commissions
 * that make up an affiliate's payout.
 */
export const getBatchCommissionsForAffiliate = query({
  args: {
    batchId: v.id("payoutBatches"),
    affiliateId: v.id("affiliates"),
  },
  returns: v.array(
    v.object({
      _id: v.id("commissions"),
      _creationTime: v.number(),
      amount: v.number(),
      status: v.string(),
      campaignName: v.string(),
      customerEmail: v.optional(v.string()),
      eventSource: v.optional(v.string()),
      isSelfReferral: v.optional(v.boolean()),
      reversalReason: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);

    // 1. Verify batch belongs to current tenant
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.tenantId !== tenantId) {
      throw new Error("Batch not found or access denied");
    }

    // 2. Fetch all commissions for this batch (by_batch index)
    const allBatchCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .take(5000);

    // 3. Filter to this affiliate
    const affiliateCommissions = allBatchCommissions.filter(
      (c) => c.affiliateId === args.affiliateId
    );

    if (affiliateCommissions.length === 0) {
      return [];
    }

    // 4. Batch-fetch campaign names and conversion customer emails
    const uniqueCampaignIds = [...new Set(affiliateCommissions.map((c) => c.campaignId.toString()))];
    const uniqueConversionIds = [
      ...new Set(
        affiliateCommissions
          .filter((c) => c.conversionId)
          .map((c) => c.conversionId!.toString())
      ),
    ];

    const [campaignDocs, conversionDocs] = await Promise.all([
      Promise.all(uniqueCampaignIds.map((id) => ctx.db.get(id as Id<"campaigns">))),
      Promise.all(uniqueConversionIds.map((id) => ctx.db.get(id as Id<"conversions">))),
    ]);

    const campaignMap = new Map<string, string>();
    for (const doc of campaignDocs) {
      if (doc) campaignMap.set(doc._id.toString(), doc.name);
    }

    const conversionEmailMap = new Map<string, string | undefined>();
    for (const doc of conversionDocs) {
      if (doc) conversionEmailMap.set(doc._id.toString(), (doc as any).customerEmail);
    }

    // 5. Map to enriched result (sorted newest first)
    return affiliateCommissions
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((c) => ({
        _id: c._id,
        _creationTime: c._creationTime,
        amount: c.amount,
        status: c.status,
        campaignName: campaignMap.get(c.campaignId.toString()) ?? "Unknown",
        customerEmail: c.conversionId
          ? conversionEmailMap.get(c.conversionId.toString())
          : undefined,
        eventSource: c.eventMetadata?.source,
        isSelfReferral: c.isSelfReferral,
        reversalReason: c.reversalReason,
      }));
  },
});

/**
 * Get affiliates with pending (approved, unpaid) payout summaries.
 * AC#1: Each affiliate shows name, email, payout method, pending amount, commission count
 * AC#3: Payout method display with "Not configured" for missing methods
 * Only includes approved commissions not already part of a payout batch.
 */
export const getAffiliatesWithPendingPayouts = query({
  args: {},
  returns: v.array(
    v.object({
      affiliateId: v.id("affiliates"),
      name: v.string(),
      email: v.string(),
      payoutMethod: v.optional(
        v.object({
          type: v.string(),
          details: v.string(),
        })
      ),
      payoutProviderStatus: v.optional(v.string()),
      payoutProviderAccountId: v.optional(v.string()),
      pendingAmount: v.number(),
      commissionCount: v.number(),
    })
  ),
  handler: async (ctx) => {
    const tenantId = await requireTenantId(ctx);

    // Query approved unpaid commissions for this tenant (not already paid)
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant_and_status", (q) =>
        q.eq("tenantId", tenantId).eq("status", "approved")
      )
      .take(700);

    // Filter out commissions already paid (have batchId)
    const unpaidCommissions = commissions.filter((c) => !c.batchId);

    // Aggregate by affiliate
    const affiliateTotals = new Map<
      Id<"affiliates">,
      { amount: number; count: number }
    >();

    for (const commission of unpaidCommissions) {
      const existing = affiliateTotals.get(commission.affiliateId) ?? {
        amount: 0,
        count: 0,
      };
      existing.amount += commission.amount;
      existing.count += 1;
      affiliateTotals.set(commission.affiliateId, existing);
    }

    // If no pending payouts, return empty array (not an error - UI shows empty state)
    if (affiliateTotals.size === 0) {
      return [];
    }

    // Fetch affiliate details
    const affiliateIds = Array.from(affiliateTotals.keys());
    const affiliateDetails = await Promise.all(
      affiliateIds.map(async (affiliateId) => {
        const affiliate = await ctx.db.get(affiliateId);
        // If affiliate doesn't exist or belongs to wrong tenant, still include with placeholder data
        // This can happen if affiliate was deleted but commission wasn't cleaned up
        if (!affiliate) {
          const totals = affiliateTotals.get(affiliateId)!;
          return {
            affiliateId,
            name: "[Deleted Affiliate]",
            email: "unknown@example.com",
            payoutMethod: undefined,
            pendingAmount: totals.amount,
            commissionCount: totals.count,
          };
        }
        if (affiliate.tenantId !== tenantId) {
          // Skip affiliates from other tenants - cross-tenant data leak prevention
          return null;
        }
        const totals = affiliateTotals.get(affiliateId)!;
        return {
          affiliateId: affiliate._id,
          name: affiliate.name,
          email: affiliate.email,
          payoutMethod: affiliate.payoutMethod
            ? {
                type: affiliate.payoutMethod.type,
                details: affiliate.payoutMethod.details,
              }
            : undefined,
          payoutProviderStatus: affiliate.payoutProviderStatus,
          payoutProviderAccountId: affiliate.payoutProviderAccountId,
          pendingAmount: totals.amount,
          commissionCount: totals.count,
        };
      })
    );

    // Filter out nulls and return
    return affiliateDetails.filter(
      (a): a is NonNullable<typeof a> => a !== null
    );
  },
});

// =============================================================================
// Story 13.3: Mark Payouts as Paid
// =============================================================================

/**
 * Mark a single payout as paid.
 * Updates payout status to "paid", sets paidAt timestamp, optionally stores payment reference,
 * auto-transitions batch to "completed" if all payouts are now paid, and creates audit log.
 *
 * AC#1: Mark Single Payout as Paid
 * AC#3: Batch Status Auto-Transition (when last payout is marked)
 *
 * SECURITY: Verifies payout belongs to current tenant. Idempotent — already-paid payouts return current state.
 */
export const markPayoutAsPaid = mutation({
  args: {
    payoutId: v.id("payouts"),
    paymentReference: v.optional(v.string()),
  },
  returns: v.object({
    payoutId: v.id("payouts"),
    batchStatus: v.string(),
    remainingPending: v.number(),
  }),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }
    await requireWriteAccess(ctx);

    // 1. Verify payout belongs to current tenant
    const payout = await ctx.db.get(args.payoutId);
    if (!payout || payout.tenantId !== tenantId) {
      throw new Error("Payout not found or access denied");
    }

    // 2. Idempotency: if already paid, return current state without error
    if (payout.status === "paid") {
      const batch = await ctx.db.get(payout.batchId);
      const pendingCount = batch
        ? await countPendingPayouts(ctx, payout.batchId)
        : 0;
      return {
        payoutId: payout._id,
        batchStatus: batch?.status ?? "unknown",
        remainingPending: pendingCount,
      };
    }

    // 3. Update payout record
    const paidAtTimestamp = Date.now();
    await ctx.db.patch(args.payoutId, {
      status: "paid",
      paidAt: paidAtTimestamp,
      ...(args.paymentReference ? { paymentReference: args.paymentReference } : {}),
    });

    // Note: Affiliate in-app notifications require a userId from the users table.
    // Affiliates live in the affiliates table and may not have a users record.

    // --- Schedule payout notification email (Story 13.4) ---
    let emailScheduled = false;
    try {
      const affiliate = await ctx.db.get(payout.affiliateId);
      const tenant = await ctx.db.get(tenantId);

      if (affiliate) {
        // Build portal earnings URL from custom domain (if configured)
        const portalEarningsUrl = tenant?.branding?.customDomain
          ? `https://${tenant.branding.customDomain}/earnings`
          : undefined;

        // Fetch batch for batchGeneratedAt prop
        const payoutBatch = await ctx.db.get(payout.batchId);

        ctx.scheduler.runAfter(0, internal.emails.sendPayoutSentEmail, {
          tenantId,
          payoutId: payout._id,
          affiliateId: affiliate._id,
          affiliateEmail: affiliate.email,
          affiliateName: affiliate.name,
          payoutAmount: payout.amount,
          paymentReference: args.paymentReference,
          paidAt: paidAtTimestamp,
          portalName: tenant?.branding?.portalName || tenant?.name || "Portal",
          brandLogoUrl: tenant?.branding?.logoUrl,
          brandPrimaryColor: tenant?.branding?.primaryColor,
          portalEarningsUrl,
          batchGeneratedAt: payoutBatch?.generatedAt,
          currency: "PHP", // Default currency for PH/SEA market (AC#4)
        });
        emailScheduled = true;
      }
    } catch (schedulerError) {
      // Email scheduling failure must NOT block the payout marking
      // The internal action handles its own retry logic
      console.error("Failed to schedule payout notification email:", schedulerError);
    }
    // --- End email scheduling ---

    // 4. Check if all payouts in batch are now paid → auto-transition batch
    const batch = await ctx.db.get(payout.batchId);
    let batchStatus = batch?.status ?? "unknown";
    const remainingPending = await countPendingPayouts(ctx, payout.batchId);

    if (batch && remainingPending === 0 && batch.status !== "completed") {
      await ctx.db.patch(payout.batchId, {
        status: "completed",
        completedAt: Date.now(),
      });
      batchStatus = "completed";
    }

    // 5. Create audit log entry (Story 13.6: Use centralized function)
    await ctx.runMutation(internal.audit.logPayoutAuditEvent, {
      tenantId,
      action: "payout_marked_paid",
      entityType: "payouts",
      entityId: payout._id,
      actorId: user.userId,
      actorType: "user",
      targetId: payout.batchId,
      metadata: {
        affiliateId: payout.affiliateId,
        amount: payout.amount,
        paymentReference: args.paymentReference ?? null,
        batchStatus,
        emailScheduled,
      },
    });

    return {
      payoutId: payout._id,
      batchStatus,
      remainingPending,
    };
  },
});

/**
 * Mark all pending payouts in a batch as paid.
 * Updates all pending payouts to "paid", sets batch status to "completed", and creates audit log.
 *
 * AC#2: Mark All Payouts in Batch as Paid
 * AC#3: Batch Status Auto-Transition (batch-wide action)
 *
 * SECURITY: Verifies batch belongs to current tenant. Atomic — all updates in single mutation.
 */
export const markBatchAsPaid = mutation({
  args: {
    batchId: v.id("payoutBatches"),
    paymentReference: v.optional(v.string()),
  },
  returns: v.object({
    batchId: v.id("payoutBatches"),
    payoutsMarked: v.number(),
  }),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }
    await requireWriteAccess(ctx);

    // 1. Verify batch belongs to current tenant
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.tenantId !== tenantId) {
      throw new Error("Batch not found or access denied");
    }

    // 2. Fetch all payouts for this batch using index
    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .take(5000);

    const pendingPayouts = payouts.filter((p) => p.status === "pending");

    if (pendingPayouts.length === 0) {
      throw new Error("NO_PENDING_PAYOUTS");
    }

    // 3. Update all pending payouts to paid
    const completedAtTimestamp = Date.now();
    for (const payout of pendingPayouts) {
      await ctx.db.patch(payout._id, {
        status: "paid",
        paidAt: completedAtTimestamp,
        ...(args.paymentReference ? { paymentReference: args.paymentReference } : {}),
      });
    }

    // 4. Update corresponding commissions to "paid" status
    //    Commissions are linked to the batch via batchId field
    const batchCommissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .filter((q) => q.eq(q.field("batchId") as any, args.batchId))
      .take(500);
    for (const commission of batchCommissions) {
      if (commission.status === "approved") {
        await ctx.db.patch(commission._id, {
          status: "paid",
        });
        await adjustPendingPayoutTotals(ctx, tenantId, -1, commission.amount);
      }
    }

    // --- Affiliate in-app notifications for payout sent ---
    // Look up user by email (affiliates may not have a users record)
    const notifiedAffiliateIds = new Set<string>();
    for (const payout of pendingPayouts) {
      if (notifiedAffiliateIds.has(payout.affiliateId)) continue;
      notifiedAffiliateIds.add(payout.affiliateId);
      try {
        const affiliate = await ctx.db.get(payout.affiliateId);
        if (affiliate) {
          const affiliateUser = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", affiliate.email))
            .first();
          if (affiliateUser) {
            await ctx.runMutation(internal.notifications.createNotification, {
              tenantId,
              userId: affiliateUser._id,
              type: "payout.sent",
              title: "Payout Sent",
              message: `A payout of ₱${payout.amount.toFixed(2)} has been sent to you.`,
              severity: "success",
            });
          }
        }
      } catch (notifErr) {
        console.error("[Notification] Failed to send payout notification:", notifErr);
      }
    }

    // --- Schedule payout notification emails for all affiliates (Story 13.4) ---
    let emailsScheduled = 0;
    let emailScheduleFailures = 0;

    try {
      // Fetch tenant data once for all emails
      const tenant = await ctx.db.get(tenantId);
      const portalEarningsUrl = tenant?.branding?.customDomain
        ? `https://${tenant.branding.customDomain}/earnings`
        : undefined;

      for (const payout of pendingPayouts) {
        try {
          const affiliate = await ctx.db.get(payout.affiliateId);
          if (affiliate) {
            ctx.scheduler.runAfter(0, internal.emails.sendPayoutSentEmail, {
              tenantId,
              payoutId: payout._id,
              affiliateId: affiliate._id,
              affiliateEmail: affiliate.email,
              affiliateName: affiliate.name,
              payoutAmount: payout.amount,
              paymentReference: args.paymentReference,
              paidAt: completedAtTimestamp,
              portalName: tenant?.branding?.portalName || tenant?.name || "Portal",
              brandLogoUrl: tenant?.branding?.logoUrl,
              brandPrimaryColor: tenant?.branding?.primaryColor,
              portalEarningsUrl,
              batchGeneratedAt: batch.generatedAt,
              currency: "PHP", // Default currency for PH/SEA market (AC#4)
            });
            emailsScheduled++;
          }
        } catch (individualEmailError) {
          emailScheduleFailures++;
          console.error(
            `Failed to schedule email for payout ${payout._id}:`,
            individualEmailError
          );
        }
      }
    } catch (bulkEmailError) {
      console.error("Failed during batch email scheduling:", bulkEmailError);
    }
    // --- End email scheduling ---

    // 4. Update batch to completed
    await ctx.db.patch(args.batchId, {
      status: "completed",
      completedAt: Date.now(),
    });

    // 5. Create audit log entry (Story 13.6: Use centralized function)
    await ctx.runMutation(internal.audit.logPayoutAuditEvent, {
      tenantId,
      action: "batch_marked_paid",
      entityType: "payoutBatches",
      entityId: args.batchId,
      actorId: user.userId,
      actorType: "user",
      metadata: {
        payoutsMarked: pendingPayouts.length,
        totalAmount: batch.totalAmount,
        paymentReference: args.paymentReference ?? null,
        payoutIds: pendingPayouts.map((p) => p._id),
        emailsScheduled,
        emailScheduleFailures,
      },
    });

    return {
      batchId: args.batchId,
      payoutsMarked: pendingPayouts.length,
    };
  },
});

/**
 * Get batch payout status summary with paid/pending counts.
 * Used by BatchDetailDialog to show progress indicator.
 *
 * AC#5: View Batch Payout Details — supporting count data
 */
export const getBatchPayoutStatus = query({
  args: { batchId: v.id("payoutBatches") },
  returns: v.object({
    total: v.number(),
    paid: v.number(),
    pending: v.number(),
    batchStatus: v.string(),
  }),
  handler: async (ctx, args) => {
    const tenantId = await requireTenantId(ctx);

    // Verify batch belongs to current tenant
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.tenantId !== tenantId) {
      throw new Error("Batch not found or access denied");
    }

    // Fetch all payouts for the batch
    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .take(5000);

    // If the batch is completed, treat all payouts as paid regardless of
    // individual record state (guards against stale data inconsistency where
    // the batch was completed but individual payout records weren't updated).
    const paid = batch.status === "completed"
      ? payouts.length
      : payouts.filter((p) => p.status === "paid").length;
    const pending = batch.status === "completed"
      ? 0
      : payouts.filter((p) => p.status === "pending").length;

    return {
      total: payouts.length,
      paid,
      pending,
      batchStatus: batch.status,
    };
  },
});

// =============================================================================
// DATA MIGRATION: Backfill Payout Audit Logs
// =============================================================================

/**
 * One-time backfill action to create audit log entries for payout batches
 * and individual payouts that were created without audit trails (e.g. via seed data).
 *
 * Creates the correct audit entries based on batch status:
 *   - All batches: "payout_batch_generated"
 *   - Completed batches: "batch_marked_paid" + "payout_marked_paid" for each payout
 *   - Processing batches: "payout_batch_generated" only
 *   - Pending batches: "payout_batch_generated" only
 *
 * Uses the first user found for each tenant as the actor.
 * Skips entities that already have audit entries. Safe to run multiple times.
 */
export const backfillPayoutAuditLogs = internalAction({
  args: {},
  returns: v.object({
    batchesProcessed: v.number(),
    batchGeneratedCreated: v.number(),
    batchCompletedCreated: v.number(),
    payoutsCreated: v.number(),
  }),
  handler: async (ctx) => {
    let batchesProcessed = 0;
    let batchGeneratedCreated = 0;
    let batchCompletedCreated = 0;
    let payoutsCreated = 0;

    // 1. Collect all batches
    const allBatches = await ctx.runQuery(
      internal.payouts._backfillListAllBatches
    );

    // 2. Build a cache of tenantId → actorId (first user per tenant)
    const tenantActorCache = new Map<string, string>();
    const seenTenants = new Set<string>();

    for (const batch of allBatches) {
      batchesProcessed++;

      // Resolve actor for this tenant (lazy, cached)
      if (!seenTenants.has(batch.tenantId)) {
        seenTenants.add(batch.tenantId);
        const owner = await ctx.runQuery(
          internal.payouts._backfillGetFirstUserForTenant,
          { tenantId: batch.tenantId }
        );
        if (owner) {
          tenantActorCache.set(batch.tenantId, owner._id);
        }
      }
      const actorId = tenantActorCache.get(batch.tenantId);

      // 3. Create "payout_batch_generated" if missing
      const hasBatchGenerated = await ctx.runQuery(
        internal.payouts._backfillCheckAuditExistsByAction,
        { entityType: "payoutBatches", entityId: batch._id, action: "payout_batch_generated" }
      );
      if (!hasBatchGenerated) {
        await ctx.runMutation(internal.audit.logPayoutAuditEvent, {
          tenantId: batch.tenantId,
          action: "payout_batch_generated",
          entityType: "payoutBatches",
          entityId: batch._id,
          actorId: actorId,
          actorType: actorId ? "user" : "system",
          metadata: {
            affiliateCount: batch.affiliateCount,
            totalAmount: batch.totalAmount,
            batchStatus: batch.status,
          },
        });
        batchGeneratedCreated++;
      }

      // 4. For completed batches, create "batch_marked_paid" + individual payout entries
      if (batch.status === "completed") {
        const hasBatchCompleted = await ctx.runQuery(
          internal.payouts._backfillCheckAuditExistsByAction,
          { entityType: "payoutBatches", entityId: batch._id, action: "batch_marked_paid" }
        );
        if (!hasBatchCompleted) {
          // Get payouts for this batch
          const batchPayouts = await ctx.runQuery(
            internal.payouts._backfillListPayoutsByBatch,
            { batchId: batch._id }
          );

          await ctx.runMutation(internal.audit.logPayoutAuditEvent, {
            tenantId: batch.tenantId,
            action: "batch_marked_paid",
            entityType: "payoutBatches",
            entityId: batch._id,
            actorId: actorId,
            actorType: actorId ? "user" : "system",
            metadata: {
              payoutsMarked: batchPayouts.length,
              totalAmount: batch.totalAmount,
              payoutIds: batchPayouts.map((p: any) => p._id),
            },
          });
          batchCompletedCreated++;

          // Create individual payout_marked_paid entries
          for (const payout of batchPayouts) {
            const hasPayoutPaid = await ctx.runQuery(
              internal.payouts._backfillCheckAuditExistsByAction,
              { entityType: "payouts", entityId: payout._id, action: "payout_marked_paid" }
            );
            if (!hasPayoutPaid) {
              await ctx.runMutation(internal.audit.logPayoutAuditEvent, {
                tenantId: batch.tenantId,
                action: "payout_marked_paid",
                entityType: "payouts",
                entityId: payout._id,
                actorId: actorId,
                actorType: actorId ? "user" : "system",
                targetId: batch._id,
                metadata: {
                  affiliateId: payout.affiliateId,
                  amount: payout.amount,
                  paymentReference: payout.paymentReference ?? null,
                },
              });
              payoutsCreated++;
            }
          }
        }
      }
    }

    console.log(
      `[backfill] Batches: ${batchesProcessed} processed | ` +
      `Batch Generated: ${batchGeneratedCreated} | ` +
      `Batch Completed: ${batchCompletedCreated} | ` +
      `Payouts Paid: ${payoutsCreated}`
    );

    return {
      batchesProcessed,
      batchGeneratedCreated,
      batchCompletedCreated,
      payoutsCreated,
    };
  },
});

// ── Internal helpers for the backfill action ──────────────────────────────────

export const _backfillListAllBatches = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("payoutBatches"),
      tenantId: v.id("tenants"),
      affiliateCount: v.number(),
      totalAmount: v.number(),
      status: v.string(),
    })
  ),
  handler: async (ctx) => {
    const batches = await ctx.db.query("payoutBatches").take(500);
    return batches.map((b) => ({
      _id: b._id,
      tenantId: b.tenantId,
      affiliateCount: b.affiliateCount,
      totalAmount: b.totalAmount,
      status: b.status,
    }));
  },
});

export const _backfillListPayoutsByBatch = internalQuery({
  args: { batchId: v.id("payoutBatches") },
  returns: v.array(
    v.object({
      _id: v.id("payouts"),
      tenantId: v.id("tenants"),
      affiliateId: v.id("affiliates"),
      batchId: v.id("payoutBatches"),
      amount: v.number(),
      paymentReference: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .take(200);
    return payouts.map((p) => ({
      _id: p._id,
      tenantId: p.tenantId,
      affiliateId: p.affiliateId,
      batchId: p.batchId,
      amount: p.amount,
      paymentReference: p.paymentReference,
    }));
  },
});

export const _backfillGetFirstUserForTenant = internalQuery({
  args: { tenantId: v.id("tenants") },
  returns: v.union(
    v.object({ _id: v.id("users") }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .first();
    if (!user) return null;
    return { _id: user._id };
  },
});

export const _backfillCheckAuditExistsByAction = internalQuery({
  args: {
    entityType: v.string(),
    entityId: v.string(),
    action: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId)
      )
      .filter((q) => q.eq(q.field("action"), args.action))
      .first();
    return !!existing;
  },
});

export const _backfillCheckAuditExists = internalQuery({
  args: {
    entityType: v.string(),
    entityId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId)
      )
      .first();
    return !!existing;
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const _getPayoutByIdInternal = internalQuery({
  args: { payoutId: v.id("payouts") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.payoutId);
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const _getEligibleProviderPayoutsInternal = internalQuery({
  args: { batchId: v.id("payoutBatches") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .take(500);
    const pending = payouts.filter((p) => p.status === "pending");
    const enriched: any[] = [];
    for (const p of pending) {
      const affiliate = await ctx.db.get(p.affiliateId);
      enriched.push({ ...p, affiliateEmail: affiliate?.email ?? "" });
    }
    return enriched;
  },
});

export const _markPayoutProcessing = internalMutation({
  args: {
    payoutId: v.id("payouts"),
    paymentSource: v.string(),
    paymentReference: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.payoutId, {
      status: "processing",
      paymentSource: args.paymentSource,
      paymentReference: args.paymentReference,
    });
    return null;
  },
});

export const _markPayoutPaidByProvider = internalMutation({
  args: {
    payoutId: v.id("payouts"),
    providerPayoutId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payout = await ctx.db.get(args.payoutId);
    if (!payout || payout.status !== "processing") return null;

    const now = Date.now();
    await ctx.db.patch(args.payoutId, {
      status: "paid",
      paidAt: now,
      ...(args.providerPayoutId ? { paymentReference: args.providerPayoutId } : {}),
    });

    if (payout.tenantId) {
      const batchCommissions = await ctx.db
        .query("commissions")
        .withIndex("by_tenant", (q) => q.eq("tenantId", payout.tenantId))
        .filter((q) => q.eq(q.field("batchId") as any, payout.batchId))
        .take(500);
      for (const commission of batchCommissions) {
        if (commission.affiliateId === payout.affiliateId && commission.status === "approved") {
          await ctx.db.patch(commission._id, { status: "paid" });
          await adjustPendingPayoutTotals(ctx, payout.tenantId, -1, commission.amount);
        }
      }
    }

    await ctx.runMutation(internal.payouts._checkAndCloseBatch as any, {
      batchId: payout.batchId,
    });

    return null;
  },
});

export const _markPayoutFailed = internalMutation({
  args: {
    payoutId: v.id("payouts"),
    failureReason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.payoutId, {
      status: "failed",
      paymentSource: "stripe",
    });
    return null;
  },
});

export const _checkAndCloseBatch = internalMutation({
  args: { batchId: v.id("payoutBatches") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.status === "completed") return null;

    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .take(5000);

    const hasPending = payouts.some((p) => p.status === "pending" || p.status === "processing");
    if (!hasPending) {
      await ctx.db.patch(args.batchId, {
        status: "completed",
        completedAt: Date.now(),
      });
    }
    return null;
  },
});

export const _incrementProviderCount = internalMutation({
  args: {
    batchId: v.id("payoutBatches"),
    providerType: v.string(),
    count: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);
    if (!batch) return null;

    const field = args.providerType === "stripe" ? "saligPayCount" : "manualCount";
    const current = (batch as any)[field] ?? 0;
    const increment = args.count ?? 1;
    await ctx.db.patch(args.batchId, {
      [field]: current + increment,
    });
    return null;
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginateAggregateDocs(
  ctx: any,
  aggregate: any,
  namespace: string,
  pageSize = 500,
): Promise<any[]> {
  const docs: any[] = [];
  let cursor: string | undefined;
  let done = false;

  while (!done) {
    const result = await aggregate.paginate(ctx, {
      namespace,
      pageSize,
      cursor,
      order: "desc",
    });
    const fetched = await Promise.all(
      result.page.map((item: any) => ctx.db.get(item.id))
    );
    for (const doc of fetched) {
      if (doc) docs.push(doc);
    }
    cursor = result.isDone ? undefined : result.cursor;
    done = !cursor;
  }

  return docs;
}
