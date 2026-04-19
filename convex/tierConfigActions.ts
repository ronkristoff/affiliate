"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

function getInternalApi(): any {
  return require("./_generated/api") as any;
}

const featuresValidator = v.object({
  customDomain: v.boolean(),
  advancedAnalytics: v.boolean(),
  prioritySupport: v.boolean(),
});

const tierConfigUpdateArgs = v.object({
  tier: v.string(),
  price: v.number(),
  maxAffiliates: v.number(),
  maxCampaigns: v.number(),
  maxTeamMembers: v.number(),
  maxPayoutsPerMonth: v.number(),
  maxApiCalls: v.number(),
  features: featuresValidator,
  forceApply: v.boolean(),
});

async function requireAdminAuth(ctx: any): Promise<void> {
  const { internal } = getInternalApi();
  let authUser;
  try {
    authUser = await ctx.runQuery(internal.platformBillingInternal.getUserBasic, {
      userId: ctx.auth.getUserIdentity()?.subject as any,
    });
  } catch {
    throw new Error("Unauthorized: Not authenticated");
  }
  if (!authUser) {
    throw new Error("Unauthorized: Not authenticated");
  }
  const appUser: { role: string } | null = await ctx.runQuery(internal.admin.tier_configs.getUserRoleByEmail, {
    email: authUser.email as string,
  });
  if (!appUser || appUser.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }
}

export const createTierConfigWithStripe = action({
  args: {
    tier: v.string(),
    price: v.number(),
    maxAffiliates: v.number(),
    maxCampaigns: v.number(),
    maxTeamMembers: v.number(),
    maxPayoutsPerMonth: v.number(),
    maxApiCalls: v.number(),
    features: featuresValidator,
  },
  returns: v.object({
    success: v.boolean(),
    tierConfigId: v.id("tierConfigs"),
  }),
  // @ts-expect-error Convex type inference issue with require("./_generated/api")
  handler: async (ctx, args) => {
    await requireAdminAuth(ctx);

    const { internal } = getInternalApi();
    const settings = await ctx.runQuery(internal.platformSettings.getPlatformSettingsInternal);
    const isStripeEnabled = settings.enabledPlatformProviders.includes("stripe");

    let stripeProductId: string | undefined;
    let stripePriceId: string | undefined;

    if (isStripeEnabled) {
      let result: { productId: string; priceId: string };
      try {
        result = await ctx.runAction(internal.stripeTierSync.createStripeProductAndPrice, {
          tier: args.tier,
          price: args.price,
        });
      } catch (stripeError) {
        throw new Error(`Failed to create Stripe product/price: ${(stripeError as Error).message}`);
      }
      stripeProductId = result.productId;
      stripePriceId = result.priceId;
    }

    let tierConfigId: string;
    try {
      const createResult: { success: boolean; tierConfigId: string } = await ctx.runMutation(
        internal.admin.tier_configs.createTierConfigInternal,
        { ...args, stripeProductId, stripePriceId }
      );
      tierConfigId = createResult.tierConfigId;
    } catch (dbError) {
      if (isStripeEnabled && stripeProductId) {
        await ctx.runAction(internal.stripeTierSync.archiveStripeProduct, {
          productId: stripeProductId,
        }).catch(() => {});
      }
      throw dbError;
    }

    if (isStripeEnabled && stripePriceId) {
      await ctx.runMutation(internal.platformSettings.updateStripePriceId, {
        tier: args.tier,
        priceId: stripePriceId,
        operation: "set",
      });
    }

    return { success: true, tierConfigId };
  },
});

export const updateTierConfigWithStripe = action({
  args: tierConfigUpdateArgs,
  returns: v.object({
    success: v.boolean(),
    impactReport: v.optional(
      v.object({
        affectedTenants: v.number(),
        severity: v.union(v.literal("none"), v.literal("warning"), v.literal("critical")),
      })
    ),
  }),
  // @ts-expect-error Convex type inference issue with require("./_generated/api")
  handler: async (ctx, args) => {
    await requireAdminAuth(ctx);

    const { internal } = getInternalApi();
    const settings = await ctx.runQuery(internal.platformSettings.getPlatformSettingsInternal);
    const isStripeEnabled = settings.enabledPlatformProviders.includes("stripe");

    const existing: { _id: string; tier: string; price: number; stripeProductId?: string; stripePriceId?: string } | null =
      await ctx.runQuery(internal.admin.tier_configs.getTierConfigByTierInternal, { tier: args.tier });

    if (isStripeEnabled && existing && existing.price !== args.price) {
      const productId = existing.stripeProductId;

      if (!productId) {
        let result: { productId: string; priceId: string };
        try {
          result = await ctx.runAction(internal.stripeTierSync.createStripeProductAndPrice, {
            tier: args.tier,
            price: args.price,
          });
        } catch (stripeError) {
          throw new Error(`Failed to create Stripe product/price: ${(stripeError as Error).message}`);
        }
        const mutationResult: { success: boolean; impactReport?: { affectedTenants: number; severity: string } } =
          await ctx.runMutation(internal.admin.tier_configs.updateTierConfigInternal, {
            ...args,
            stripePriceId: result.priceId,
          });
        if (mutationResult.success) {
          await ctx.runMutation(internal.admin.tier_configs.updateStripeProductIdInternal, {
            tier: args.tier,
            stripeProductId: result.productId,
          }).catch(() => {});
          await ctx.runMutation(internal.platformSettings.updateStripePriceId, {
            tier: args.tier,
            priceId: result.priceId,
            operation: "set",
          });
        }
        return mutationResult;
      }

      let newPriceId: string;
      try {
        const priceResult: { priceId: string } = await ctx.runAction(
          internal.stripeTierSync.createStripePriceForExistingProduct,
          {
            productId,
            tier: args.tier,
            price: args.price,
            oldPriceId: existing.stripePriceId,
          }
        );
        newPriceId = priceResult.priceId;
      } catch (stripeError) {
        throw new Error(`Failed to create Stripe price: ${(stripeError as Error).message}`);
      }

      const mutationResult: { success: boolean; impactReport?: { affectedTenants: number; severity: string } } =
        await ctx.runMutation(internal.admin.tier_configs.updateTierConfigInternal, {
          ...args,
          stripePriceId: newPriceId,
        });

      if (!mutationResult.success) {
        await ctx.runAction(internal.stripeTierSync.archiveStripePrice, {
          priceId: newPriceId,
        }).catch(() => {});
      } else {
        await ctx.runMutation(internal.platformSettings.updateStripePriceId, {
          tier: args.tier,
          priceId: newPriceId,
          operation: "set",
        });
      }

      return mutationResult;
    }

    const result: { success: boolean; impactReport?: { affectedTenants: number; severity: string } } =
      await ctx.runMutation(internal.admin.tier_configs.updateTierConfigInternal, args);
    return result;
  },
});

export const deleteTierConfigWithStripe = action({
  args: {
    tierConfigId: v.id("tierConfigs"),
  },
  returns: v.object({
    success: v.boolean(),
    affectedTenants: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdminAuth(ctx);

    const { internal } = getInternalApi();
    const settings = await ctx.runQuery(internal.platformSettings.getPlatformSettingsInternal);
    const isStripeEnabled = settings.enabledPlatformProviders.includes("stripe");

    const result: { success: boolean; affectedTenants: number } = await ctx.runMutation(
      internal.admin.tier_configs.deleteTierConfigInternal,
      args
    );

    if (!result.success) {
      return result;
    }

    if (isStripeEnabled) {
      const config: { _id: string; tier: string; price: number; stripeProductId?: string; stripePriceId?: string } | null =
        await ctx.runQuery(internal.admin.tier_configs.getTierConfigByIdInternal, {
          tierConfigId: args.tierConfigId,
        });

      if (config?.stripeProductId) {
        await ctx.runAction(internal.stripeTierSync.archiveStripeProduct, {
          productId: config.stripeProductId,
        }).catch(() => {});
      }

      if (config) {
        await ctx.runMutation(internal.platformSettings.updateStripePriceId, {
          tier: config.tier,
          priceId: "",
          operation: "remove",
        });
      }
    }

    return result;
  },
});
