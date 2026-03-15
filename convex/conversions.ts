import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * List recent conversions with attribution data for a tenant
 * Used by the AttributionVerifier component
 */
export const listRecentWithAttribution = query({
  args: {
    count: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("conversions"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      affiliateId: v.id("affiliates"),
      referralLinkId: v.optional(v.id("referralLinks")),
      clickId: v.optional(v.id("clicks")),
      amount: v.number(),
      status: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const count = args.count ?? 10;
    
    // Get the current user's tenant
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get user's tenant from users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique();
    
    if (!user) {
      throw new Error("User not found");
    }

    // Query conversions for this tenant, ordered by creation time (descending)
    const conversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => 
        q.eq("tenantId", user.tenantId)
      )
      .order("desc")
      .take(count);

    return conversions;
  },
});

/**
 * Create a new conversion with attribution data
 * Called from webhook processing
 */
export const createConversion = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    affiliateId: v.id("affiliates"),
    referralLinkId: v.optional(v.id("referralLinks")),
    clickId: v.optional(v.id("clicks")),
    customerEmail: v.optional(v.string()),
    amount: v.number(),
    status: v.optional(v.string()),
    metadata: v.optional(v.object({
      orderId: v.optional(v.string()),
      products: v.optional(v.array(v.string())),
    })),
  },
  returns: v.id("conversions"),
  handler: async (ctx, args) => {
    const conversionId = await ctx.db.insert("conversions", {
      ...args,
    });

    return conversionId;
  },
});

/**
 * Find affiliate by unique code (for webhook attribution)
 * Public query for admin use
 */
export const findAffiliateByCode = query({
  args: {
    tenantId: v.id("tenants"),
    code: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_code", (q) => 
        q.eq("tenantId", args.tenantId).eq("uniqueCode", args.code)
      )
      .unique();

    return affiliate ?? null;
  },
});

/**
 * Internal version for webhook processing
 */
export const findAffiliateByCodeInternal = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    code: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("affiliates"),
      email: v.string(),
      name: v.string(),
      uniqueCode: v.string(),
      status: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_tenant_and_code", (q) => 
        q.eq("tenantId", args.tenantId).eq("uniqueCode", args.code)
      )
      .unique();

    return affiliate ?? null;
  },
});

/**
 * Update conversion status (e.g., when payment completes or refunds)
 */
export const updateConversionStatus = mutation({
  args: {
    conversionId: v.id("conversions"),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("refunded")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Verify user has access to this conversion's tenant
    const conversion = await ctx.db.get(args.conversionId);
    if (!conversion) {
      throw new Error("Conversion not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique();

    if (!user || user.tenantId !== conversion.tenantId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.conversionId, { status: args.status });
    return null;
  },
});

/**
 * Get conversion statistics for a tenant
 */
export const getConversionStats = query({
  args: {},
  returns: v.object({
    totalConversions: v.number(),
    totalAmount: v.number(),
    attributedConversions: v.number(),
    organicConversions: v.number(),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    // Get conversions for this tenant with a reasonable limit to avoid memory issues
    // For accurate stats with large datasets, consider adding aggregation indices
    const conversions = await ctx.db
      .query("conversions")
      .withIndex("by_tenant", (q) => q.eq("tenantId", user.tenantId))
      .take(1000); // Limit to 1000 most recent for performance

    const totalConversions = conversions.length;
    const totalAmount = conversions.reduce((sum, c) => sum + c.amount, 0);
    const attributedConversions = conversions.filter(c => c.affiliateId !== undefined).length;
    const organicConversions = totalConversions - attributedConversions;

    return {
      totalConversions,
      totalAmount,
      attributedConversions,
      organicConversions,
    };
  },
});
