"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import crypto from "crypto";

function extractPeriodEnd(sub: any): number | undefined {
  const direct = sub.current_period_end;
  if (direct) return direct * 1000;
  const itemPeriodEnd = sub.items?.data?.[0]?.current_period_end;
  if (itemPeriodEnd) return itemPeriodEnd * 1000;
  return undefined;
}

export const handlePlatformBillingWebhook = action({
  args: {
    rawPayload: v.any(),
    sigHeader: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { rawPayload, sigHeader } = args;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      return { error: "STRIPE_WEBHOOK_SECRET is not set", status: 500 };
    }

    let event: any;
    try {
      const elements = sigHeader.split(",");
      let timestamp = "";
      let signature = "";
      for (const el of elements) {
        const [k, v] = el.split("=");
        if (k === "t") timestamp = v;
        if (k === "v1") signature = v;
      }
      if (!timestamp || !signature) {
        return { error: "Missing signature", status: 400 };
      }
      const signedPayload = `${timestamp}.${rawPayload}`;
      const expectedSig = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
      const sigBuf = Buffer.from(signature);
      const expectedBuf = Buffer.from(expectedSig);
      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return { error: "Invalid signature", status: 400 };
      }
      event = JSON.parse(rawPayload);
    } catch (err: any) {
      console.error("[PlatformBilling Webhook] Verification failed:", err.message);
      return { error: "Verification failed", status: 400 };
    }

    console.log("[PlatformBilling Webhook] Received:", event.type, "id:", event.id);

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        const plan = sub.metadata?.plan;
        const tenantId = sub.metadata?.tenantId;
        if (!userId || !tenantId) break;

        const currentPeriodEnd = extractPeriodEnd(sub);

        await ctx.runMutation(internal.platformBillingInternal.syncStripeSubscriptionToTenant, {
          stripeSubscriptionId: sub.id,
          status: sub.status,
          priceId: sub.items?.data?.[0]?.price?.id || undefined,
          currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          userId,
          plan,
          tenantId,
        });
        if (sub.status === "canceled") {
          try {
            await ctx.runMutation(internal.billingLifecycle.pauseAllActiveCampaignsForTenant, { tenantId });
          } catch (err) {
            console.error(`[PlatformBilling] Failed to pause campaigns:`, err);
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        const plan = sub.metadata?.plan;
        const tenantId = sub.metadata?.tenantId;
        if (!userId || !tenantId) break;
        await ctx.runMutation(internal.platformBillingInternal.syncStripeSubscriptionToTenant, {
          stripeSubscriptionId: sub.id,
          status: "canceled",
          userId,
          plan,
          tenantId,
        });
        await ctx.runMutation(internal.billingLifecycle.pauseAllActiveCampaignsForTenant, { tenantId });
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object;
        const metadata = session.metadata;
        const tenantId = metadata?.tenantId;
        const plan = metadata?.plan;
        const isPlatformBilling = metadata?.isPlatformBilling === "true";
        if (!isPlatformBilling || !tenantId || !plan) break;
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (!subId) {
          console.log("[PlatformBilling Webhook] checkout.session.completed: no subscription ID found");
          break;
        }
        const userId = metadata?.userId || session.subscription_details?.metadata?.userId;
        const subLineItems = session.line_items?.data;
        const priceId = subLineItems?.[0]?.price?.id || undefined;

        let currentPeriodEnd: number | undefined;
        try {
          const Stripe = (await import("stripe")).default;
          const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
            apiVersion: "2025-04-30.basil" as any,
          });
          const retrievedSub: any = await stripeClient.subscriptions.retrieve(subId);
          currentPeriodEnd = extractPeriodEnd(retrievedSub);
        } catch (err: any) {
          console.error("[PlatformBilling Webhook] Failed to fetch subscription for period end:", err?.message || err);
        }

        await ctx.runMutation(internal.platformBillingInternal.syncStripeSubscriptionToTenant, {
          stripeSubscriptionId: subId,
          status: session.subscription_details?.subscription?.status || "active",
          plan,
          userId,
          tenantId,
          priceId,
          currentPeriodEnd,
          amount: typeof session.amount_total === "number" ? session.amount_total : undefined,
          transactionId: typeof session.id === "string" ? session.id : undefined,
        });
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object;
        const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        if (!subId) break;
        const tenant = await ctx.runQuery(internal.platformBillingInternal.getTenantByStripeSubscriptionId, { stripeSubscriptionId: subId });
        if (!tenant) {
          console.log("[PlatformBilling Webhook] invoice.paid: no tenant found for subscription", subId);
          break;
        }

        let currentPeriodEnd: number | undefined;
        const lineItem = invoice.lines?.data?.[0];
        const linePeriodEnd = lineItem?.period?.end;
        if (linePeriodEnd) {
          currentPeriodEnd = linePeriodEnd * 1000;
        }

        if (!currentPeriodEnd) {
          try {
            const Stripe = (await import("stripe")).default;
            const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
              apiVersion: "2025-04-30.basil" as any,
            });
            const retrievedSub: any = await stripeClient.subscriptions.retrieve(subId);
            currentPeriodEnd = extractPeriodEnd(retrievedSub);
          } catch (err: any) {
            console.error("[PlatformBilling Webhook] invoice.paid: failed to fetch subscription:", err?.message || err);
          }
        }

        await ctx.runMutation(internal.platformBillingInternal.syncStripeSubscriptionToTenant, {
          stripeSubscriptionId: subId,
          status: "active",
          currentPeriodEnd,
          userId: tenant._id,
          tenantId: tenant._id,
          plan: tenant.plan,
          amount: typeof invoice.amount_paid === "number" ? invoice.amount_paid : undefined,
          transactionId: typeof invoice.id === "string" ? invoice.id : undefined,
        });
        break;
      }
    }

    return { received: true, status: 200 };
  },
});
