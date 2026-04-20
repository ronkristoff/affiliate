"use node";

import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { withCircuitBreaker, SERVICE_IDS } from "./lib/circuitBreaker";
import type { CircuitBreakerInternalRefs } from "./lib/circuitBreaker";
import Stripe from "stripe";

const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "invoice.paid",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "charge.refunded",
  "charge.dispute.created",
] as const;

const circuitBreakerRefs: CircuitBreakerInternalRefs = {
  getServiceState: internal.circuitBreakers.getServiceState as any,
  recordFailure: internal.circuitBreakers.recordFailure as any,
  recordSuccess: internal.circuitBreakers.recordSuccess as any,
  tryAcquireProbe: internal.circuitBreakers.tryAcquireProbe as any,
  forceHalfOpen: internal.circuitBreakers.forceHalfOpen as any,
};

export const ensureConnectWebhookEndpoint = internalAction({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.object({
    webhookEndpointId: v.optional(v.string()),
    success: v.boolean(),
  }),
  handler: async (ctx: ActionCtx, args) => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      console.error("[Stripe Webhook] STRIPE_SECRET_KEY not configured");
      return { webhookEndpointId: undefined, success: false };
    }

    const siteUrl = process.env.SITE_URL || "http://localhost:3000";
    const isLocalhost = siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1");
    const webhookUrl = `${siteUrl}/api/webhooks/stripe`;

    if (isLocalhost) {
      console.log(`[Stripe Webhook] SITE_URL is localhost — skipping webhook creation. Use 'stripe listen --forward-to ${siteUrl}/api/webhooks/stripe' for local testing.`);
      return { webhookEndpointId: undefined, success: true };
    }

    try {
      const result = await withCircuitBreaker(
        ctx,
        circuitBreakerRefs,
        SERVICE_IDS.STRIPE,
        async () => {
          const stripe = new Stripe(secretKey, {
            apiVersion: "2026-02-25.clover",
          });

          const existing = await stripe.webhookEndpoints.list({
            limit: 100,
          });

          const match = existing.data.find(
            (ep: any) => ep.url === webhookUrl && ep.connect === true
          );

          if (match) {
            console.log(`[Stripe Webhook] Connect endpoint already exists: ${match.id}`);
            return match.id;
          }

          const endpoint = await stripe.webhookEndpoints.create({
            url: webhookUrl,
            enabled_events: [...STRIPE_WEBHOOK_EVENTS],
            connect: true as any,
            metadata: {
              source: "salig-affiliate-connect",
            },
            description: "Salig Affiliate — Connect webhook (receives events from all connected accounts)",
          });

          console.log(`[Stripe Webhook] Created Connect endpoint: ${endpoint.id}`);
          return endpoint.id;
        },
        null,
      );

      if (result.ok && result.data) {
        return { webhookEndpointId: result.data, success: true };
      }

      console.warn(`[Stripe Webhook] Circuit breaker open, skipping for tenant ${args.tenantId}`);
      return { webhookEndpointId: undefined, success: false };
    } catch (err: any) {
      console.error(`[Stripe Webhook] Failed to ensure Connect endpoint:`, err.message);
      return { webhookEndpointId: undefined, success: false };
    }
  },
});

export const deleteConnectWebhookEndpoint = internalAction({
  args: {
    webhookEndpointId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx: ActionCtx, args) => {
    if (!args.webhookEndpointId) {
      return true;
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return true;
    }

    try {
      const result = await withCircuitBreaker(
        ctx,
        circuitBreakerRefs,
        SERVICE_IDS.STRIPE,
        async () => {
          const stripe = new Stripe(secretKey, {
            apiVersion: "2026-02-25.clover",
          });

          await stripe.webhookEndpoints.del(args.webhookEndpointId);
          return true;
        },
        true,
      );

      if (result.ok) {
        console.log(`[Stripe Webhook] Deleted Connect endpoint ${args.webhookEndpointId}`);
        return true;
      }

      console.warn(`[Stripe Webhook] Circuit breaker open, skipping deletion`);
      return true;
    } catch (err: any) {
      console.error(`[Stripe Webhook] Failed to delete endpoint ${args.webhookEndpointId}:`, err.message);
      return true;
    }
  },
});
