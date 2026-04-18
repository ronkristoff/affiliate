import { TableAggregate, DirectAggregate } from "@convex-dev/aggregate";
import { components, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { action, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Type-safe bounds for aggregate count/sum calls.
 * Used for documentation and IDE autocompletion.
 * Note: `as AggregateBounds` is still needed at call sites because the
 * @convex-dev/aggregate library has strict generic types that don't
 * align with this broader union type.
 *
 * Usage:
 *   aggregate.count(ctx, { namespace: tenantId, bounds: { prefix: ["active"] } } as AggregateBounds);
 */
export type AggregateBounds = {
  namespace: string;
  bounds:
    | { prefix: Array<string | boolean | number> }
    | {
        lower?: { key: string | number | Array<string | number>; inclusive: boolean };
        upper?: { key: string | number | Array<string | number>; inclusive: boolean };
      };
};

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
const affiliateAggregate = new TableAggregate(components.affiliates, {
  sortKey: (d: any) => d._creationTime,
  namespace: (d: any) => d.tenantId,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const referralLinksAggregate = new TableAggregate(components.referralLinks, {
  sortKey: (d: any) => d._creationTime,
  namespace: (d: any) => d.tenantId,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clicksAggregate = new TableAggregate(components.clicks, {
  sortKey: (d: any) => d._creationTime,
  namespace: (d: any) => d.tenantId,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const conversionsAggregate = new TableAggregate(components.conversions, {
  sortKey: (d: any) => d._creationTime,
  namespace: (d: any) => d.tenantId,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const commissionsAggregate = new TableAggregate(components.commissions, {
  sortKey: (d: any) => d._creationTime,
  namespace: (d: any) => d.tenantId,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const payoutsAggregate = new TableAggregate(components.payouts, {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const notificationsByReadAggregate = new TableAggregate(components.aggregate, {
  sortKey: (d: any) => [d.isRead, d._creationTime] as [boolean, number],
  namespace: (d: any) => d.userId,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const commissionByFlagAggregate = new TableAggregate(components.aggregate, {
  sortKey: (d: any) => {
    const isFlagged = !!(d.fraudIndicators?.length || d.isSelfReferral === true);
    return [isFlagged, d._creationTime] as [boolean, number];
  },
  namespace: (d: any) => d.tenantId,
} as any);

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
  notificationsByReadAggregate,
  commissionByFlagAggregate,
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
export const notificationsByReadTrigger = notificationsByReadAggregate.trigger();
export const commissionByFlagTrigger = commissionByFlagAggregate.trigger();

const TABLES_TO_BACKFILL = [
  "affiliates",
  "referralLinks",
  "clicks",
  "conversions",
  "commissions",
  "payouts",
  "referralLeads",
  "notifications",
] as const;



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
 * Clears all aggregate trees first, then iterates all documents in each
 * tracked table and inserts them into the aggregate using insertIfDoesNotExist.
 *
 * Usage: pnpm convex run aggregates:backfillAll --typecheck=disable --push -- '{}'
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

    await ctx.runMutation(internal.backfillIndex.clearAllAggregates, {});

    for (const tableName of TABLES_TO_BACKFILL) {
      let processed = 0;
      let cursor: string | undefined;

      while (true) {
        const page = await ctx.runQuery(internal.aggregates.listTableDocIds, {
          tableName,
          paginationOpts: { numItems: batchSize, cursor },
        });

        for (const docId of page.docIds) {
          await ctx.runMutation(internal.backfillIndex.backfillReindex, {
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
