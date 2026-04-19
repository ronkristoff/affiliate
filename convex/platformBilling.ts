"use node";

/**
 * Platform Billing Module — Actions only (Node.js context).
 *
 * Provider-agnostic layer for platform subscription payments.
 * Routes checkout/cancel operations to the correct payment provider
 * based on platformSettings.enabledPlatformProviders.
 *
 * This sprint implements Stripe only. SaligPay will be added later.
 *
 * NOTE: All imports from _generated/api use require() to avoid circular
 * type inference, since _generated/api references exports from this file.
 */

import { action } from "./_generated/server";
import { v } from "convex/values";

function getStripeClient(): any {
  const { StripeSubscriptions } = require("@convex-dev/stripe") as any;
  const api = require("./_generated/api") as any;
  return new StripeSubscriptions(api.components.stripe, {});
}

export const createPlatformCheckout = action({
  args: {
    plan: v.string(),
    provider: v.union(v.literal("stripe"), v.literal("saligpay")),
  },
  returns: v.object({
    url: v.union(v.string(), v.null()),
    sessionId: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const internal = (require("./_generated/api") as any).internal;
    const { getAuthenticatedUser } = require("./tenantContext") as any;
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    if (args.provider === "saligpay") {
      throw new Error("SaligPay platform billing is not yet implemented. Please use Stripe.");
    }

    const tenant = await ctx.runQuery(internal.platformBillingInternal.getTenantById, { tenantId: authUser.tenantId });
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    if (tenant.plan === args.plan) {
      throw new Error(`You are already on the ${args.plan} plan`);
    }

    const settings = await ctx.runQuery(internal.platformSettings.getPlatformSettingsInternal);

    if (!settings.enabledPlatformProviders.includes(args.provider)) {
      throw new Error(`Payment provider "${args.provider}" is not enabled. Please contact support.`);
    }

    const priceId = settings.stripePriceIds[args.plan];
    if (!priceId) {
      throw new Error(
        `No Stripe price configured for plan "${args.plan}". Ask the platform admin to configure it in Settings.`
      );
    }

    const user = await ctx.runQuery(internal.platformBillingInternal.getUserBasic, { userId: authUser.userId });

    const client = getStripeClient();
    const customer = await client.getOrCreateCustomer(ctx, {
      userId: authUser.userId,
      email: user?.email,
      name: user?.name,
    });

    const baseUrl = process.env.SITE_URL || "http://localhost:3000";

    const result = await client.createCheckoutSession(ctx, {
      priceId,
      customerId: customer.customerId,
      mode: "subscription",
      successUrl: `${baseUrl}/settings/billing?checkout=success`,
      cancelUrl: `${baseUrl}/settings/billing?checkout=cancelled`,
      quantity: 1,
      subscriptionMetadata: {
        tenantId: authUser.tenantId,
        userId: authUser.userId,
        plan: args.plan,
      },
      metadata: {
        tenantId: authUser.tenantId,
        plan: args.plan,
        isPlatformBilling: "true",
      },
    });

    return {
      url: result.url,
      sessionId: result.sessionId,
    };
  },
});

export const cancelPlatformSubscriptionAndSyncTenant = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, _args) => {
    const internal = (require("./_generated/api") as any).internal;
    const { getAuthenticatedUser } = require("./tenantContext") as any;
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    const tenant = await ctx.runQuery(internal.platformBillingInternal.getTenantById, { tenantId: authUser.tenantId });
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    if (!tenant.platformPaymentProvider || !tenant.stripeSubscriptionId) {
      throw new Error("No active platform subscription to cancel");
    }

    const client = getStripeClient();
    await client.cancelSubscription(ctx, tenant.stripeSubscriptionId);

    await ctx.runMutation(internal.platformBillingInternal.markTenantCancelled, {
      tenantId: authUser.tenantId,
    });

    return { success: true };
  },
});
