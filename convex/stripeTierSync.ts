"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import Stripe from "stripe";

const CURRENCY = "php";
const RECURRING_INTERVAL = "month";

let _stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (_stripeClient) return _stripeClient;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }
  _stripeClient = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
  return _stripeClient;
}

export const createStripeProductAndPrice = internalAction({
  args: {
    tier: v.string(),
    price: v.number(),
  },
  returns: v.object({
    productId: v.string(),
    priceId: v.string(),
  }),
  handler: async (ctx, args) => {
    const stripe = getStripeClient();

    const product = await stripe.products.create({
      name: `${capitalize(args.tier)} Plan`,
      metadata: {
        tier: args.tier,
        managedBy: "salig-affiliate",
      },
    });

    let price: Stripe.Price;
    try {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: args.price,
        currency: CURRENCY,
        recurring: { interval: RECURRING_INTERVAL as Stripe.PriceCreateParams.Recurring.Interval },
        metadata: {
          tier: args.tier,
        },
      });
    } catch (priceError) {
      await stripe.products.update(product.id, { active: false }).catch(() => {});
      throw priceError;
    }

    return { productId: product.id, priceId: price.id };
  },
});

export const archiveStripeProduct = internalAction({
  args: {
    productId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const stripe = getStripeClient();
    await stripe.products.update(args.productId, { active: false });
    return null;
  },
});

export const createStripePriceForExistingProduct = internalAction({
  args: {
    productId: v.string(),
    tier: v.string(),
    price: v.number(),
    oldPriceId: v.optional(v.string()),
  },
  returns: v.object({
    priceId: v.string(),
  }),
  handler: async (ctx, args) => {
    const stripe = getStripeClient();

    const price = await stripe.prices.create({
      product: args.productId,
      unit_amount: args.price,
      currency: CURRENCY,
      recurring: { interval: RECURRING_INTERVAL as Stripe.PriceCreateParams.Recurring.Interval },
      metadata: {
        tier: args.tier,
      },
    });

    await stripe.products.update(args.productId, {
      default_price: price.id,
    });

    if (args.oldPriceId) {
      await stripe.prices.update(args.oldPriceId, { active: false }).catch(() => {});
    }

    return { priceId: price.id };
  },
});

export const archiveStripePrice = internalAction({
  args: {
    priceId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const stripe = getStripeClient();
    await stripe.prices.update(args.priceId, { active: false });
    return null;
  },
});

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
