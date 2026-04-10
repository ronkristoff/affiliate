/**
 * Coupon Code Backfill Migration
 *
 * Moved to separate file to avoid circular TypeScript references
 * with couponCodes.ts (action calling internal queries in same file).
 *
 * Run via CLI in a loop until continueCursor is null:
 *   pnpm convex run couponCodesBackfill:backfillCouponCodes --typecheck=disable --push '{"cursor": null}'
 * Idempotent — skips affiliates that already have codes.
 *
 * NOTE: Has TS7022 errors from Convex's circular type reference.
 * These resolve at runtime. Always use --typecheck=disable.
 */

import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { generateVanityCode } from "./couponCodes";
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const internal = require("./_generated/api").internal;

// =============================================================================
// Internal helpers
// =============================================================================

export const _listAffiliatesForBackfill = internalQuery({
  args: {
    cursor: v.optional(v.string()),
    numItems: v.number(),
  },
  returns: v.object({
    page: v.array(
      v.object({
        tenantId: v.id("tenants"),
        affiliateId: v.id("affiliates"),
      })
    ),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const tenants = await ctx.db.query("tenants").take(500);
    const results: Array<{ tenantId: Id<"tenants">; affiliateId: Id<"affiliates"> }> = [];

    const skip = args.cursor ? parseInt(args.cursor, 10) : 0;
    let totalSeen = 0;

    for (const tenant of tenants) {
      const activeAffiliates = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant_and_status", (q) =>
          q.eq("tenantId", tenant._id).eq("status", "active")
        )
        .collect();

      for (const affiliate of activeAffiliates) {
        if (!affiliate.couponCode) {
          totalSeen++;
          if (totalSeen > skip && results.length < args.numItems) {
            results.push({
              tenantId: tenant._id,
              affiliateId: affiliate._id,
            });
          }
        }
      }

      if (results.length >= args.numItems) break;
    }

    const nextCursor = skip + results.length < totalSeen
      ? String(skip + results.length)
      : null;

    return {
      page: results,
      continueCursor: nextCursor,
      isDone: nextCursor === null,
    };
  },
});

export const _getAffiliateForBackfill = internalQuery({
  args: {
    affiliateId: v.id("affiliates"),
  },
  returns: v.nullable(
    v.object({
      couponCode: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) return null;
    return {
      couponCode: affiliate.couponCode,
    };
  },
});

export const _generateCouponCodeForAffiliate = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db.get(args.affiliateId);
    if (!affiliate) return null;

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) return null;

    let code = generateVanityCode(affiliate.name, tenant.slug);

    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 20;

    while (!isUnique && attempts < maxAttempts) {
      const existing = await ctx.db
        .query("affiliates")
        .withIndex("by_tenant_coupon_code", (q) =>
          q.eq("tenantId", args.tenantId).eq("couponCode", code)
        )
        .first();

      if (!existing) {
        isUnique = true;
      } else {
        attempts++;
        code = generateVanityCode(affiliate.name, tenant.slug) + String(attempts);
      }
    }

    if (!isUnique) {
      console.error(`[CouponCode] Failed to generate unique code for affiliate ${args.affiliateId} after ${maxAttempts} attempts`);
      return null;
    }

    await ctx.db.patch(args.affiliateId, {
      couponCode: code,
      couponAttributionEnabled: true,
    });

    return null;
  },
});

// =============================================================================
// Action: Backfill coupon codes for existing active affiliates
// =============================================================================

export const backfillCouponCodes = action({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    generated: v.number(),
    total: v.number(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const tenants = await ctx.runQuery(
      internal.couponCodesBackfill._listAffiliatesForBackfill,
      { cursor: args.cursor, numItems: 100 }
    );

    let generated = 0;

    for (const { tenantId, affiliateId } of tenants.page) {
      const affiliate = await ctx.runQuery(
        internal.couponCodesBackfill._getAffiliateForBackfill,
        { affiliateId }
      );

      if (!affiliate || affiliate.couponCode) {
        continue;
      }

      await ctx.runMutation(internal.couponCodesBackfill._generateCouponCodeForAffiliate, {
        tenantId,
        affiliateId,
      });

      generated++;
    }

    return {
      generated,
      total: tenants.page.length,
      continueCursor: tenants.continueCursor,
    };
  },
});
