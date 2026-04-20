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

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { betterAuthComponent } from "./auth";
import { render } from "@react-email/components";
import { sendEmail, getFromAddress } from "./emailService";
import { renderPlatformTemplate } from "./platformTemplates";

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
    const betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    if (!betterAuthUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    type AppUser = { _id: Id<"users">; tenantId: Id<"tenants">; email: string; name?: string; role: string };
    const authUser: AppUser | null = await ctx.runQuery(internal.users._getUserByEmailInternal, {
      email: betterAuthUser.email,
    });
    if (!authUser) {
      throw new Error("User not found. Please complete sign-up first.");
    }

    if (args.provider === "saligpay") {
      throw new Error("SaligPay platform billing is not yet implemented. Please use Stripe.");
    }

    const tenant = await ctx.runQuery(internal.platformBillingInternal.getTenantById, { tenantId: authUser.tenantId });
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Log upgrade attempt
    try {
      await ctx.runMutation(internal.audit.logAuditEventInternal, {
        tenantId: authUser.tenantId,
        action: "PLATFORM_SUBSCRIPTION_UPGRADE_ATTEMPT",
        entityType: "tenant",
        entityId: authUser.tenantId,
        actorId: authUser._id,
        actorType: "user",
        metadata: {
          requestedPlan: args.plan,
          currentPlan: tenant.plan,
          provider: args.provider,
        },
      });
    } catch (logErr) {
      console.error("[Audit] Failed to log upgrade attempt:", logErr);
    }

    // Check if user is already on an active/paid subscription for this plan
    const isActiveSubscription = tenant.subscriptionStatus === "active" || tenant.subscriptionStatus === "trialing";
    const isSamePlan = tenant.plan === args.plan;

    if (isSamePlan && isActiveSubscription) {
      // Allow trial users to convert to paid, but block if already on paid active
      if (tenant.subscriptionStatus === "active") {
        throw new Error(`You are already on the ${args.plan} plan`);
      }
      // Trial users can proceed to convert to paid subscription
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

    const user = await ctx.runQuery(internal.platformBillingInternal.getUserBasic, { userId: authUser._id });

    const client = getStripeClient();
    const customer = await client.getOrCreateCustomer(ctx, {
      userId: authUser._id,
      email: user?.email ?? betterAuthUser.email,
      name: user?.name ?? betterAuthUser.name,
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
        userId: authUser._id,
        plan: args.plan,
      },
      metadata: {
        tenantId: authUser.tenantId,
        plan: args.plan,
        isPlatformBilling: "true",
      },
    });

    // Log to billing history via mutation
    try {
      await ctx.runMutation(internal.platformBillingInternal.logBillingEventInternal, {
        tenantId: authUser.tenantId,
        event: "checkout_initiated",
        plan: args.plan,
        actorId: authUser._id,
      });
    } catch (logErr) {
      console.error("[Billing] Failed to log checkout initiation:", logErr);
    }

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
    const betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    if (!betterAuthUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    type AppUser = { _id: Id<"users">; tenantId: Id<"tenants">; email: string; name?: string; role: string };
    const authUser: AppUser | null = await ctx.runQuery(internal.users._getUserByEmailInternal, {
      email: betterAuthUser.email,
    });
    if (!authUser) {
      throw new Error("User not found. Please complete sign-up first.");
    }

    const tenant = await ctx.runQuery(internal.platformBillingInternal.getTenantById, { tenantId: authUser.tenantId });
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    if (!tenant.stripeSubscriptionId) {
      throw new Error("No active platform subscription to cancel");
    }

    const client = getStripeClient();
    await client.cancelSubscription(ctx, tenant.stripeSubscriptionId);

    await ctx.runMutation(internal.platformBillingInternal.markTenantCancelled, {
      tenantId: authUser.tenantId,
    });

    // Log cancellation to billing history
    try {
      await ctx.runMutation(internal.platformBillingInternal.logBillingEventInternal, {
        tenantId: authUser.tenantId,
        event: "subscription_cancel_requested",
        plan: tenant.plan,
        actorId: authUser._id,
      });
    } catch (logErr) {
      console.error("[Billing] Failed to log cancellation:", logErr);
    }

    return { success: true };
  },
});

export const sendPlatformBillingEmail = internalAction({
  args: {
    templateType: v.string(),
    to: v.string(),
    variables: v.record(v.string(), v.union(v.string(), v.number())),
    tenantId: v.id("tenants"),
  },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      const internal = (require("./_generated/api") as any).internal;

      const customTemplate = await ctx.runQuery(internal.platformTemplates.getPlatformTemplateForSending, {
        templateType: args.templateType,
      });

      const defaultTemplate = await ctx.runQuery(internal.platformTemplates.getPlatformTemplateDefault, {
        templateType: args.templateType,
      });

      const subjectTemplate = customTemplate?.customSubject ?? defaultTemplate?.defaultSubject ?? "";
      const bodyTemplate = customTemplate?.customBody ?? defaultTemplate?.defaultBody ?? "";

      const subject = renderPlatformTemplate(subjectTemplate, args.variables);
      const html = renderPlatformTemplate(bodyTemplate, args.variables);

      if (!subject || !html) {
        return { success: false, error: `No template found for type: ${args.templateType}` };
      }

      await ctx.runAction(internal.emailService.sendEmail, {
        from: getFromAddress("billing"),
        to: args.to,
        subject,
        html,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[PlatformEmail] Failed to send ${args.templateType}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  },
});
