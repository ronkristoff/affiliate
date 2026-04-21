import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export const _getTenantForEmail = internalQuery({
  args: { tenantId: v.id("tenants") },
  returns: v.union(
    v.object({
      _id: v.id("tenants"),
      name: v.string(),
      ownerEmail: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("role"), "owner"))
      .first();
    return {
      _id: tenant._id,
      name: tenant.name,
      ownerEmail: user?.email ?? undefined,
    };
  },
});

export const _getStripeEnabledTenants = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db
      .query("tenants")
      .filter((q) => q.neq(q.field("stripeAccountId"), undefined))
      .take(1000);
  },
});

export const _getEligibleCommissions = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    processingCutoff: v.number(),
  },
  returns: v.array(
    v.object({
      affiliateId: v.id("affiliates"),
      amount: v.number(),
      commissionId: v.id("commissions"),
    }),
  ),
  handler: async (ctx, args) => {
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_tenant_and_status", (q) =>
        q.eq("tenantId", args.tenantId).eq("status", "approved")
      )
      .take(5000);

    const eligible: Array<{
      affiliateId: Id<"affiliates">;
      amount: number;
      commissionId: Id<"commissions">;
    }> = [];

    for (const c of commissions) {
      if (!c.batchId && c._creationTime <= args.processingCutoff) {
        eligible.push({
          affiliateId: c.affiliateId,
          amount: c.amount,
          commissionId: c._id,
        });
      }
    }

    return eligible;
  },
});

export const _generateBatch = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    eligible: v.array(
      v.object({
        affiliateId: v.id("affiliates"),
        amount: v.number(),
        commissionId: v.id("commissions"),
      }),
    ),
    minimumPayoutAmount: v.number(),
  },
  returns: v.object({
    batchCreated: v.boolean(),
    batchId: v.optional(v.id("payoutBatches")),
    payouts: v.array(
      v.object({
        payoutId: v.id("payouts"),
        affiliateId: v.id("affiliates"),
        amount: v.number(),
        providerAccountId: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const affiliateMap = new Map<
      string,
      { amount: number; commissionIds: Id<"commissions">[] }
    >();

    for (const e of args.eligible) {
      const existing = affiliateMap.get(e.affiliateId) ?? {
        amount: 0,
        commissionIds: [],
      };
      existing.amount += e.amount;
      existing.commissionIds.push(e.commissionId);
      affiliateMap.set(e.affiliateId, existing);
    }

    const entries = Array.from(affiliateMap.entries());
    const affiliateDocs = await Promise.all(
      entries.map(([id]) => ctx.db.get(id as Id<"affiliates">)),
    );

    const validAffiliates: Array<{
      affiliateId: Id<"affiliates">;
      amount: number;
      commissionIds: Id<"commissions">[];
      providerAccountId: string;
    }> = [];

    for (let i = 0; i < entries.length; i++) {
      const affiliate = affiliateDocs[i];
      if (!affiliate) continue;
      if (!affiliate.payoutProviderEnabled) continue;
      if (!affiliate.payoutProviderAccountId) continue;

      const [affiliateId, data] = entries[i];
      if (data.amount < args.minimumPayoutAmount) continue;

      validAffiliates.push({
        affiliateId: affiliateId as Id<"affiliates">,
        amount: data.amount,
        commissionIds: data.commissionIds,
        providerAccountId: affiliate.payoutProviderAccountId,
      });
    }

    if (validAffiliates.length === 0) {
      return { batchCreated: false, payouts: [] };
    }

    let grandTotal = 0;
    for (const a of validAffiliates) {
      grandTotal += a.amount;
    }

    const batchId = await ctx.db.insert("payoutBatches", {
      tenantId: args.tenantId,
      totalAmount: grandTotal,
      affiliateCount: validAffiliates.length,
      status: "pending",
      generatedAt: Date.now(),
    });

    const payouts: Array<{
      payoutId: Id<"payouts">;
      affiliateId: Id<"affiliates">;
      amount: number;
      providerAccountId: string;
    }> = [];

    for (const a of validAffiliates) {
      const payoutId = await ctx.db.insert("payouts", {
        tenantId: args.tenantId,
        affiliateId: a.affiliateId,
        batchId,
        amount: a.amount,
        status: "pending",
      });

      payouts.push({
        payoutId,
        affiliateId: a.affiliateId,
        amount: a.amount,
        providerAccountId: a.providerAccountId,
      });

      for (const commissionId of a.commissionIds) {
        await ctx.db.patch(commissionId, { batchId });
      }
    }

    await ctx.runMutation(internal.audit.logPayoutAuditEvent, {
      tenantId: args.tenantId,
      action: "auto_payout_batch_generated",
      entityType: "payoutBatches",
      entityId: batchId,
      actorId: args.tenantId,
      actorType: "system",
      targetId: batchId,
      metadata: {
        affiliateCount: validAffiliates.length,
        totalAmount: grandTotal,
        trigger: "scheduled_cron",
      },
    });

    return { batchCreated: true, batchId, payouts };
  },
});
