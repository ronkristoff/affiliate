import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "./_generated/api";
import {
  affiliateAggregate,
  referralLinksAggregate,
  clicksAggregate,
  referralLeadsAggregate,
  conversionsAggregate,
  commissionsAggregate,
  payoutsAggregate,
  affiliateByStatusAggregate,
  commissionByStatusAggregate,
  leadByStatusAggregate,
  payoutByStatusAggregate,
  notificationsByReadAggregate,
  commissionByFlagAggregate,
} from "./aggregates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const legacySharedAggregate = new TableAggregate(components.aggregate, {
  sortKey: (d: any) => d._creationTime,
  namespace: (d: any) => d.tenantId,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_AGGREGATES: Array<{ name: string; agg: any }> = [
  { name: "affiliateAggregate", agg: affiliateAggregate },
  { name: "referralLinksAggregate", agg: referralLinksAggregate },
  { name: "clicksAggregate", agg: clicksAggregate },
  { name: "referralLeadsAggregate", agg: referralLeadsAggregate },
  { name: "conversionsAggregate", agg: conversionsAggregate },
  { name: "commissionsAggregate", agg: commissionsAggregate },
  { name: "payoutsAggregate", agg: payoutsAggregate },
  { name: "affiliateByStatusAggregate", agg: affiliateByStatusAggregate },
  { name: "commissionByStatusAggregate", agg: commissionByStatusAggregate },
  { name: "leadByStatusAggregate", agg: leadByStatusAggregate },
  { name: "payoutByStatusAggregate", agg: payoutByStatusAggregate },
  { name: "notificationsByReadAggregate", agg: notificationsByReadAggregate },
  { name: "commissionByFlagAggregate", agg: commissionByFlagAggregate },
];

export const clearAllAggregates = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for (const { agg } of ALL_AGGREGATES) {
      await agg.clear(ctx);
    }
    await legacySharedAggregate.clear(ctx);
    return null;
  },
});

export const backfillReindex = internalMutation({
  args: {
    tableName: v.string(),
    docId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.docId as any);
    if (!doc) return null;

    const tableName = args.tableName;

    if (tableName === "affiliates") {
      await affiliateAggregate.insertIfDoesNotExist(ctx, doc);
      await affiliateByStatusAggregate.insertIfDoesNotExist(ctx, doc);
    } else if (tableName === "referralLinks") {
      await referralLinksAggregate.insertIfDoesNotExist(ctx, doc);
    } else if (tableName === "clicks") {
      await clicksAggregate.insertIfDoesNotExist(ctx, doc);
    } else if (tableName === "conversions") {
      await conversionsAggregate.insertIfDoesNotExist(ctx, doc);
    } else if (tableName === "commissions") {
      await commissionsAggregate.insertIfDoesNotExist(ctx, doc);
      await commissionByStatusAggregate.insertIfDoesNotExist(ctx, doc);
      await commissionByFlagAggregate.insertIfDoesNotExist(ctx, doc);
    } else if (tableName === "payouts") {
      await payoutsAggregate.insertIfDoesNotExist(ctx, doc);
      await payoutByStatusAggregate.insertIfDoesNotExist(ctx, doc);
    } else if (tableName === "referralLeads") {
      await referralLeadsAggregate.insertIfDoesNotExist(ctx, doc);
      await leadByStatusAggregate.insertIfDoesNotExist(ctx, doc);
    } else if (tableName === "notifications") {
      await notificationsByReadAggregate.insertIfDoesNotExist(ctx, doc);
    }

    return null;
  },
});
