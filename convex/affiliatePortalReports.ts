import { query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { betterAuthComponent } from "./auth";

function formatDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeysBetween(startDate: number, endDate: number): string[] {
  const keys: string[] = [];
  const current = new Date(startDate);
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);
  while (current.getTime() <= end.getTime()) {
    keys.push(formatDateKey(current.getTime()));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return keys;
}

async function requireAffiliateAuth(
  ctx: any,
  requestedAffiliateId: string
): Promise<any> {
  let betterAuthUser;
  try {
    betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
  } catch {
    throw new Error("Not authenticated");
  }

  if (!betterAuthUser) {
    throw new Error("Not authenticated");
  }

  const cleanEmail = betterAuthUser.email.trim().toLowerCase();
  const affiliate = await ctx.db
    .query("affiliates")
    .withIndex("by_email", (q: any) => q.eq("email", cleanEmail))
    .first();

  if (!affiliate) {
    throw new Error("Affiliate not found");
  }

  if (affiliate._id !== requestedAffiliateId) {
    throw new Error("Unauthorized: affiliate ID mismatch");
  }

  return affiliate;
}

export const getEarningsChartData = query({
  args: {
    affiliateId: v.id("affiliates"),
    startDate: v.number(),
    endDate: v.number(),
  },
  returns: v.array(
    v.object({
      date: v.string(),
      amount: v.number(),
      count: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Auth: verify caller owns this affiliate
    await requireAffiliateAuth(ctx, args.affiliateId);

    const grouped = new Map<string, { amount: number; count: number }>();
    let cursor: string | null = null;

    while (true) {
      const page = await ctx.db
        .query("commissions")
        .withIndex("by_affiliate", (q) =>
          q.eq("affiliateId", args.affiliateId).gte("_creationTime", args.startDate)
        )
        .order("asc")
        .paginate({ numItems: 500, cursor });

      let pastEnd = false;
      for (const doc of page.page) {
        if (doc._creationTime > args.endDate) {
          pastEnd = true;
          break;
        }
        const key = formatDateKey(doc._creationTime);
        const existing = grouped.get(key) ?? { amount: 0, count: 0 };
        existing.amount += doc.amount;
        existing.count += 1;
        grouped.set(key, existing);
      }

      if (page.isDone || pastEnd) break;
      cursor = page.continueCursor;
    }

    return dateKeysBetween(args.startDate, args.endDate).map((date) => {
      const existing = grouped.get(date);
      return {
        date,
        amount: existing?.amount ?? 0,
        count: existing?.count ?? 0,
      };
    });
  },
});

export const getClicksTrendData = query({
  args: {
    affiliateId: v.id("affiliates"),
    startDate: v.number(),
    endDate: v.number(),
  },
  returns: v.array(
    v.object({
      date: v.string(),
      count: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Auth: verify caller owns this affiliate
    await requireAffiliateAuth(ctx, args.affiliateId);

    const grouped = new Map<string, number>();
    let cursor: string | null = null;

    while (true) {
      const page = await ctx.db
        .query("clicks")
        .withIndex("by_affiliate", (q) =>
          q.eq("affiliateId", args.affiliateId).gte("_creationTime", args.startDate)
        )
        .order("asc")
        .paginate({ numItems: 500, cursor });

      let pastEnd = false;
      for (const doc of page.page) {
        if (doc._creationTime > args.endDate) {
          pastEnd = true;
          break;
        }
        const key = formatDateKey(doc._creationTime);
        grouped.set(key, (grouped.get(key) ?? 0) + 1);
      }

      if (page.isDone || pastEnd) break;
      cursor = page.continueCursor;
    }

    return dateKeysBetween(args.startDate, args.endDate).map((date) => ({
      date,
      count: grouped.get(date) ?? 0,
    }));
  },
});

export const getConversionFunnelData = query({
  args: {
    affiliateId: v.id("affiliates"),
    startDate: v.number(),
    endDate: v.number(),
  },
  returns: v.object({
    clicks: v.number(),
    conversions: v.number(),
  }),
  handler: async (ctx, args) => {
    // Auth: verify caller owns this affiliate
    await requireAffiliateAuth(ctx, args.affiliateId);

    // Use .take() instead of .paginate() — Convex allows only ONE paginated
    // query per function, and this function needs two table scans.
    // 10 000 cap is safe: Reports are bounded by date range (max 90 days).
    const MAX_SCAN = 10000;

    const clicks = await ctx.db
      .query("clicks")
      .withIndex("by_affiliate", (q) =>
        q.eq("affiliateId", args.affiliateId).gte("_creationTime", args.startDate)
      )
      .order("asc")
      .take(MAX_SCAN);

    let clicksCount = 0;
    for (const doc of clicks) {
      if (doc._creationTime > args.endDate) break;
      clicksCount += 1;
    }

    const conversions = await ctx.db
      .query("conversions")
      .withIndex("by_affiliate_created", (q) =>
        q.eq("affiliateId", args.affiliateId).gte("_creationTime", args.startDate)
      )
      .order("asc")
      .take(MAX_SCAN);

    let conversionsCount = 0;
    for (const doc of conversions) {
      if (doc._creationTime > args.endDate) break;
      conversionsCount += 1;
    }

    return { clicks: clicksCount, conversions: conversionsCount };
  },
});

export const getTopLinks = query({
  args: {
    affiliateId: v.id("affiliates"),
    startDate: v.number(),
    endDate: v.number(),
  },
  returns: v.array(
    v.object({
      referralLinkId: v.id("referralLinks"),
      code: v.string(),
      clicks: v.number(),
      conversions: v.number(),
      earnings: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Auth: verify caller owns this affiliate
    await requireAffiliateAuth(ctx, args.affiliateId);

    const links = await ctx.db
      .query("referralLinks")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId))
      .take(50);

    const linkIdSet = new Set(links.map((l) => l._id));

    // Use .take() instead of .paginate() — Convex allows only ONE paginated
    // query per function. 10 000 cap is safe for date-bounded scans.
    const MAX_SCAN = 10000;

    const clicks = await ctx.db
      .query("clicks")
      .withIndex("by_affiliate", (q) =>
        q.eq("affiliateId", args.affiliateId).gte("_creationTime", args.startDate)
      )
      .order("asc")
      .take(MAX_SCAN);

    const clicksByLink = new Map<Id<"referralLinks">, number>();
    for (const doc of clicks) {
      if (doc._creationTime > args.endDate) break;
      if (linkIdSet.has(doc.referralLinkId)) {
        clicksByLink.set(
          doc.referralLinkId,
          (clicksByLink.get(doc.referralLinkId) ?? 0) + 1
        );
      }
    }

    const conversions = await ctx.db
      .query("conversions")
      .withIndex("by_affiliate_created", (q) =>
        q.eq("affiliateId", args.affiliateId).gte("_creationTime", args.startDate)
      )
      .order("asc")
      .take(MAX_SCAN);

    const convIdToLinkId = new Map<Id<"conversions">, Id<"referralLinks">>();
    for (const doc of conversions) {
      if (doc._creationTime > args.endDate) break;
      if (doc.referralLinkId && linkIdSet.has(doc.referralLinkId)) {
        convIdToLinkId.set(doc._id, doc.referralLinkId);
      }
    }

    const conversionIdsSet = new Set(convIdToLinkId.keys());
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_affiliate", (q) =>
        q.eq("affiliateId", args.affiliateId).gte("_creationTime", args.startDate)
      )
      .order("asc")
      .take(MAX_SCAN);

    const commissionByConv = new Map<Id<"conversions">, number>();
    for (const doc of commissions) {
      if (doc._creationTime > args.endDate) break;
      if (doc.conversionId && conversionIdsSet.has(doc.conversionId)) {
        commissionByConv.set(
          doc.conversionId,
          (commissionByConv.get(doc.conversionId) ?? 0) + doc.amount
        );
      }
    }

    const conversionsByLink = new Map<Id<"referralLinks">, number>();
    const earningsByLink = new Map<Id<"referralLinks">, number>();
    convIdToLinkId.forEach((linkId, convId) => {
      conversionsByLink.set(linkId, (conversionsByLink.get(linkId) ?? 0) + 1);
      earningsByLink.set(
        linkId,
        (earningsByLink.get(linkId) ?? 0) + (commissionByConv.get(convId) ?? 0)
      );
    });

    const results = links.map((link) => ({
      referralLinkId: link._id,
      code: link.code,
      clicks: clicksByLink.get(link._id) ?? 0,
      conversions: conversionsByLink.get(link._id) ?? 0,
      earnings: earningsByLink.get(link._id) ?? 0,
    }));

    results.sort((a, b) => {
      if (b.conversions !== a.conversions) return b.conversions - a.conversions;
      return b.clicks - a.clicks;
    });

    return results.slice(0, 10);
  },
});
