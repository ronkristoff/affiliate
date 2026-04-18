import { TableAggregate, DirectAggregate } from "@convex-dev/aggregate";
import { components, internal } from "./_generated/api";
import { DataModel, Id, Doc } from "./_generated/dataModel";
import { action, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Aggregate definitions for high-volume tables.
 *
 * These provide O(log n) counts and offset pagination,
 * replacing O(n) .collect() scans on high-volume tables.
 *
 * Sort key: _creationTime (matches default document order).
 * Namespace: tenantId (for multi-tenant isolation).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const affiliateAggregate = new TableAggregate(components.aggregate, {
  sortKey: (d: any) => d._creationTime,
  namespace: (d: any) => d.tenantId,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const referralLinksAggregate = new TableAggregate(components.aggregate, {
  sortKey: (d: any) => d._creationTime,
  namespace: (d: any) => d.tenantId,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clicksAggregate = new TableAggregate(components.aggregate, {
  sortKey: (d: any) => d._creationTime,
  namespace: (d: any) => d.tenantId,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const conversionsAggregate = new TableAggregate(components.aggregate, {
  sortKey: (d: any) => d._creationTime,
  namespace: (d: any) => d.tenantId,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const commissionsAggregate = new TableAggregate(components.aggregate, {
  sortKey: (d: any) => d._creationTime,
  namespace: (d: any) => d.tenantId,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const payoutsAggregate = new TableAggregate(components.aggregate, {
  sortKey: (d: any) => d._creationTime,
  namespace: (d: any) => d.tenantId,
} as any);

// =============================================================================
// Status-partitioned aggregates (replaces tenantStats mutation hooks)
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const affiliateByStatusAggregate = new TableAggregate(components.affiliateByStatus, {
  sortKey: (d: any) => [d.status, d._creationTime] as [string, number],
  namespace: (d: any) => d.tenantId,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const commissionByStatusAggregate = new TableAggregate(components.commissionByStatus, {
  sortKey: (d: any) => [d.status, d._creationTime] as [string, number],
  namespace: (d: any) => d.tenantId,
  sumValue: (d: any) => d.amount as number,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const leadByStatusAggregate = new TableAggregate(components.leadByStatus, {
  sortKey: (d: any) => [d.status, d._creationTime] as [string, number],
  namespace: (d: any) => d.tenantId,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const payoutByStatusAggregate = new TableAggregate(components.payoutByStatus, {
  sortKey: (d: any) => [d.status, d._creationTime] as [string, number],
  namespace: (d: any) => d.tenantId,
  sumValue: (d: any) => d.amount as number,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const apiCallsDirect = new DirectAggregate<{
  Key: number;
  Id: string;
  Namespace: Id<"tenants">;
}>(components.apiCalls);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const degradationDirect = new DirectAggregate<{
  Key: string;
  Id: string;
  Namespace: Id<"tenants">;
}>(components.degradation);

export {
  affiliateAggregate,
  referralLinksAggregate,
  clicksAggregate,
  conversionsAggregate,
  commissionsAggregate,
  payoutsAggregate,
  affiliateByStatusAggregate,
  commissionByStatusAggregate,
  leadByStatusAggregate,
  payoutByStatusAggregate,
  apiCallsDirect,
  degradationDirect,
};

export const affiliatesTrigger = affiliateAggregate.trigger();
export const referralLinksTrigger = referralLinksAggregate.trigger();
export const clicksTrigger = clicksAggregate.trigger();
export const conversionsTrigger = conversionsAggregate.trigger();
export const commissionsTrigger = commissionsAggregate.trigger();
export const payoutsTrigger = payoutsAggregate.trigger();
export const affiliateByStatusTrigger = affiliateByStatusAggregate.trigger();
export const commissionByStatusTrigger = commissionByStatusAggregate.trigger();
export const leadByStatusTrigger = leadByStatusAggregate.trigger();
export const payoutByStatusTrigger = payoutByStatusAggregate.trigger();

const TABLES_TO_BACKFILL = [
  "affiliates",
  "referralLinks",
  "clicks",
  "conversions",
  "commissions",
  "payouts",
  "referralLeads",
] as const;

const AGGREGATE_MAP: Record<string, TableAggregate<any>> = {
  affiliates: affiliateAggregate,
  referralLinks: referralLinksAggregate,
  clicks: clicksAggregate,
  conversions: conversionsAggregate,
  commissions: commissionsAggregate,
  payouts: payoutsAggregate,
  referralLeads: leadByStatusAggregate,
};

/**
 * Internal mutation that performs a no-op patch on a document.
 * This triggers the Triggers wrapper which re-indexes the document in the aggregate.
 */
export const backfillReindex = internalMutation({
  args: {
    tableName: v.string(),
    docId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.docId as any);
    if (!doc) return null;
    await ctx.db.patch(args.docId as any, {});
    return null;
  },
});

/**
 * Query to list all document IDs for a table (paginated).
 * Used by backfillAll to iterate documents in batches.
 */
export const listTableDocIds = internalQuery({
  args: {
    tableName: v.string(),
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.optional(v.string()),
    }),
  },
  returns: v.object({
    docIds: v.array(v.string()),
    continuationCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query(args.tableName as any)
      .order("asc")
      .paginate({
        numItems: args.paginationOpts.numItems,
        cursor: args.paginationOpts.cursor ?? null,
      });
    return {
      docIds: results.page.map((doc: any) => doc._id),
      continuationCursor: results.continueCursor,
      isDone: results.isDone,
    };
  },
});

/**
 * Backfill all aggregate indexes for existing data.
 *
 * This action iterates all documents in each tracked table and re-saves them
 * through the triggers wrapper, which re-indexes them into the aggregate.
 *
 * Usage: pnpm convex run aggregates:backfillAll --typecheck=disable -- '{}'
 */
export const backfillAll = action({
  args: { batchSize: v.optional(v.number()) },
  returns: v.object({
    tables: v.array(v.object({
      table: v.string(),
      processed: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    const results: Array<{ table: string; processed: number }> = [];

    for (const tableName of TABLES_TO_BACKFILL) {
      let processed = 0;
      let cursor: string | undefined;

      while (true) {
        const page = await ctx.runQuery(internal.aggregates.listTableDocIds, {
          tableName,
          paginationOpts: { numItems: batchSize, cursor },
        });

        for (const docId of page.docIds) {
          await ctx.runMutation(internal.aggregates.backfillReindex, {
            tableName,
            docId,
          });
          processed++;
        }

        if (page.isDone) break;
        cursor = page.continuationCursor;
      }

      results.push({ table: tableName, processed });
    }

    return { tables: results };
  },
});
