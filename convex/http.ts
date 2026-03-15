import "./polyfills";
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { betterAuthComponent } from "./auth";
import { createAuth } from "../src/lib/auth";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const http = httpRouter();

betterAuthComponent.registerRoutes(http, createAuth as any);

// CORS headers for webhook endpoints
const webhookCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Saligpay-Signature",
};

// CORS headers for public tracking endpoints
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Public tracking ping endpoint
// AC7: Snippet Configuration API - Public endpoint for snippet to send pings
http.route({
  path: "/api/tracking/ping",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const body = await req.json();
      const { publicKey, domain, url, referrer, userAgent } = body;

      // Validate required fields
      if (!publicKey || !domain) {
        return new Response(
          JSON.stringify({ success: false, message: "Missing required fields" }),
          {
            status: 400,
            headers: { 
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      // Sanitize domain to prevent injection
      const sanitizedDomain = domain
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
        .replace(/[^a-z0-9.-]/g, '');

      // Strip PII from URL - keep only hostname and pathname
      let sanitizedUrl = url;
      if (url) {
        try {
          const urlObj = new URL(url);
          sanitizedUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
        } catch {
          sanitizedUrl = url.split('?')[0].split('#')[0];
        }
      }

      // Use internal mutation to record the ping and update tenant
      const result = await ctx.runMutation(internal.tracking.recordPingInternal, {
        publicKey,
        domain: sanitizedDomain,
        url: sanitizedUrl,
        referrer,
        userAgent,
      });

      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    } catch (error) {
      console.error("Tracking ping error:", error);
      return new Response(
        JSON.stringify({ success: false, message: "Internal server error" }),
        {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
  }),
});

// Public tracking config endpoint
// AC7: Snippet Configuration API - Public endpoint for snippet to get config
http.route({
  path: "/api/tracking/config",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    try {
      const url = new URL(req.url);
      const publicKey = url.searchParams.get("key");

      if (!publicKey) {
        return new Response(
          JSON.stringify({ exists: false, message: "Missing public key" }),
          {
            status: 400,
            headers: { 
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      // Validate public key format (should start with sk_ and be alphanumeric)
      const keyPattern = /^sk_[a-f0-9]{32}$/;
      if (!keyPattern.test(publicKey)) {
        return new Response(
          JSON.stringify({ exists: false, message: "Invalid public key format" }),
          {
            status: 400,
            headers: { 
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      // Use internal query to check if tenant exists
      const result = await ctx.runQuery(internal.tracking.getPublicTrackingConfigInternal, {
        publicKey,
      });

      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    } catch (error) {
      console.error("Tracking config error:", error);
      return new Response(
        JSON.stringify({ exists: false, message: "Internal server error" }),
        {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
  }),
});

// SaligPay Webhook Handler
// AC4: Webhook Attribution Parsing - Extract attribution metadata from webhooks
http.route({
  path: "/api/webhooks/saligpay",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const payload = await req.json();
      
      // Log raw webhook for debugging and idempotency
      const rawWebhookId = await ctx.runMutation(internal.webhooks.storeRawWebhook, {
        source: "saligpay",
        eventId: payload.id || `evt_${Date.now()}`,
        eventType: payload.event || "unknown",
        rawPayload: JSON.stringify(payload),
        signatureValid: true, // Mock mode - signature validation would be added in Story 14.3
      });

      // Extract attribution metadata from checkout session
      // AC4: Extract affiliate reference from checkout session metadata
      const metadata = payload.data?.object?.metadata || {};
      const attributionData = {
        affiliateCode: metadata._salig_aff_ref,
        clickId: metadata._salig_aff_click_id,
        tenantId: metadata._salig_aff_tenant,
      };

      // Only process if we have attribution data
      if (attributionData.affiliateCode && payload.event === "payment.updated") {
        const paymentData = payload.data?.object;
        
        if (paymentData) {
          // Find affiliate by code
          const affiliate = await ctx.runQuery(internal.conversions.findAffiliateByCodeInternal, {
            tenantId: attributionData.tenantId,
            code: attributionData.affiliateCode,
          });

          if (affiliate) {
            // AC4: Create conversion with attribution
            await ctx.runMutation(internal.conversions.createConversion, {
              tenantId: attributionData.tenantId,
              affiliateId: affiliate._id,
              clickId: attributionData.clickId,
              customerEmail: paymentData.customer?.email,
              amount: paymentData.amount / 100, // Convert from cents
              status: paymentData.status === "paid" ? "completed" : "pending",
              metadata: {
                orderId: paymentData.id,
              },
            });
          }
        }
      }

      return new Response(
        JSON.stringify({ received: true, webhookId: rawWebhookId }),
        {
          status: 200,
          headers: { 
            "Content-Type": "application/json",
            ...webhookCorsHeaders,
          },
        }
      );
    } catch (error) {
      console.error("Webhook processing error:", error);
      return new Response(
        JSON.stringify({ received: true, error: "Processing error logged" }),
        {
          status: 200, // Always return 200 to prevent retries
          headers: { 
            "Content-Type": "application/json",
            ...webhookCorsHeaders,
          },
        }
      );
    }
  }),
});

// Options handler for CORS preflight
http.route({
  path: "/api/webhooks/saligpay",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _req) => {
    return new Response(null, {
      status: 200,
      headers: webhookCorsHeaders,
    });
  }),
});

// Public Referral Link Resolution Endpoint
// Story 4.5 AC #3: Archived campaigns return 404 for referral links
http.route({
  path: "/r/:code",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    try {
      // Extract the referral code from the URL path
      const url = new URL(req.url);
      const pathParts = url.pathname.split("/");
      const code = pathParts[pathParts.length - 1];

      if (!code) {
        return new Response(
          JSON.stringify({ error: "Referral code required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Resolve the referral link with campaign status check
      const result = await ctx.runQuery(internal.tracking.resolveReferralLinkInternal, {
        code,
      });

      // If link not found or campaign is archived, return 404
      if (!result.found) {
        return new Response(
          JSON.stringify({ 
            error: "Referral link not found",
            message: result.reason || "This referral link is no longer active."
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // If campaign is paused, return special status with explanation
      if (result.campaignStatus === "paused") {
        return new Response(
          JSON.stringify({
            error: "Campaign paused",
            message: "This campaign is currently paused. Commissions are not being tracked at this time.",
            affiliateName: result.affiliateName,
            campaignName: result.campaignName,
          }),
          {
            status: 503, // Service Unavailable
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Valid active referral link - redirect to destination with tracking
      // In production, this would redirect to the actual destination URL
      return new Response(
        JSON.stringify({
          success: true,
          redirectUrl: result.destinationUrl,
          affiliateId: result.affiliateId,
          campaignId: result.campaignId,
          message: "Referral link resolved successfully",
        }),
        {
          status: 200,
          headers: { 
            "Content-Type": "application/json",
            // In production, this would be a 302 redirect
            // "Location": result.destinationUrl,
          },
        }
      );
    } catch (error) {
      console.error("Referral link resolution error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

export default http;
