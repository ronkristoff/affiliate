import "./polyfills";
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { betterAuthComponent } from "./auth";
import { createAuth } from "../src/lib/auth";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { normalizeToBillingEvent } from "./webhooks";

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
  "Access-Control-Allow-Headers": "Content-Type, X-Tracking-Key",
};

// Conversion Tracking Endpoint
// Story 6.3: Conversion Attribution
// AC1, AC2, AC6 - Track conversions with cookie-based attribution
http.route({
  path: "/track/conversion",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const startTime = Date.now();
    
    try {
      // AC1.4: Validate tenant exists via tracking public key
      const trackingKey = req.headers.get("X-Tracking-Key");
      if (!trackingKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing X-Tracking-Key header" }),
          {
            status: 400,
            headers: { 
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      // Validate tenant by tracking key
      const tenant = await ctx.runQuery(internal.conversions.getTenantByTrackingKeyInternal, {
        trackingKey,
      });

      if (!tenant) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid tracking key" }),
          {
            status: 401,
            headers: { 
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      // AC1.3: Extract conversion data from request body
      let body;
      try {
        body = await req.json();
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid JSON body" }),
          {
            status: 400,
            headers: { 
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      const { amount, orderId, customerEmail, products, metadata } = body;

      // Validate required fields
      if (amount === undefined || typeof amount !== "number") {
        return new Response(
          JSON.stringify({ success: false, error: "Missing or invalid amount" }),
          {
            status: 400,
            headers: { 
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      // Extract client IP for fraud detection
      const forwardedFor = req.headers.get("X-Forwarded-For");
      const realIp = req.headers.get("X-Real-IP");
      const clientIp = forwardedFor 
        ? forwardedFor.split(",")[0].trim() 
        : realIp || undefined;

      // AC1.2: Parse attribution cookie (sa_aff)
      const cookieHeader = req.headers.get("Cookie") || "";
      const existingCookie = cookieHeader
        .split(";")
        .find(c => c.trim().startsWith("sa_aff="));
      
      let cookieData: { affiliateCode?: string; campaignId?: string; timestamp?: number } = {};
      if (existingCookie) {
        try {
          const cookieValue = existingCookie.split("=")[1];
          const decodedValue = decodeURIComponent(cookieValue);
          cookieData = JSON.parse(atob(decodedValue));
        } catch {
          // Invalid cookie format, treat as no cookie
          cookieData = {};
        }
      }

      // AC1.5: If no cookie, create organic conversion (AC #2)
      if (!cookieData.affiliateCode) {
        // Create organic conversion without affiliate attribution
        const conversionId = await ctx.runMutation(internal.conversions.createOrganicConversion, {
          tenantId: tenant._id,
          customerEmail,
          amount,
          status: "pending",
          ipAddress: clientIp,
          metadata: {
            orderId,
            products,
            ...metadata,
          },
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            conversionId,
            organic: true,
            attributed: false,
            message: "Conversion recorded as organic (no affiliate attribution)",
          }),
          {
            status: 200,
            headers: { 
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      // AC1.6: Validate affiliate is still active
      const affiliateValidation = await ctx.runQuery(internal.clicks.validateAffiliateCodeInternal, {
        tenantId: tenant._id,
        code: cookieData.affiliateCode,
      });

      if (!affiliateValidation.valid) {
        // Invalid/expired affiliate - create organic conversion instead
        const conversionId = await ctx.runMutation(internal.conversions.createOrganicConversion, {
          tenantId: tenant._id,
          customerEmail,
          amount,
          status: "pending",
          ipAddress: clientIp,
          metadata: {
            orderId,
            products,
            originalAffiliateCode: cookieData.affiliateCode,
            invalidReason: affiliateValidation.reason,
            ...metadata,
          },
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            conversionId,
            organic: true,
            attributed: false,
            message: "Conversion recorded as organic (affiliate inactive)",
          }),
          {
            status: 200,
            headers: { 
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      // AC3: Validate cookie attribution window (Story 6.4)
      // Check if cookie timestamp is within the campaign's attribution window
      let windowValidation: { isExpired: boolean; elapsedDays: number; campaignCookieDuration: number } | undefined;
      
      if (cookieData.timestamp) {
        windowValidation = await ctx.runQuery(internal.conversions.validateCookieAttributionWindow, {
          tenantId: tenant._id,
          affiliateCode: cookieData.affiliateCode,
          campaignId: cookieData.campaignId ? cookieData.campaignId as Id<"campaigns"> : undefined,
          cookieTimestamp: cookieData.timestamp,
        });

        if (windowValidation && windowValidation.isExpired) {
          // Cookie expired - create organic conversion
          const conversionId = await ctx.runMutation(internal.conversions.createOrganicConversion, {
            tenantId: tenant._id,
            customerEmail,
            amount,
            status: "pending",
            ipAddress: clientIp,
            metadata: {
              orderId,
              products,
              originalAffiliateCode: cookieData.affiliateCode,
              expirationReason: "cookie_expired",
              cookieElapsedDays: windowValidation.elapsedDays,
              cookieWindowDays: windowValidation.campaignCookieDuration / (24 * 60 * 60 * 1000),
              ...metadata,
            },
          });

          return new Response(
            JSON.stringify({
              success: true,
              conversionId,
              organic: true,
              attributed: false,
              message: "Conversion recorded as organic (cookie expired)",
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            }
          );
        }
      }

      // AC1.7: Get referral link for attribution chain
      const referralLink = await ctx.runQuery(internal.conversions.getReferralLinkByCodeInternal, {
        tenantId: tenant._id,
        code: cookieData.affiliateCode,
      });

      if (!referralLink) {
        // Referral link not found - create organic conversion
        const conversionId = await ctx.runMutation(internal.conversions.createOrganicConversion, {
          tenantId: tenant._id,
          customerEmail,
          amount,
          status: "pending",
          ipAddress: clientIp,
          metadata: {
            orderId,
            products,
            originalAffiliateCode: cookieData.affiliateCode,
            invalidReason: "referral_link_not_found",
            ...metadata,
          },
        });

        return new Response(
          JSON.stringify({
            success: true,
            conversionId,
            organic: true,
            attributed: false,
            message: "Conversion recorded as organic (referral link not found)",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      // AC2.3: Find recent click for attribution chain
      // Use campaign-specific attribution window if available from validation
      const attributionWindowDays = windowValidation?.campaignCookieDuration
        ? Math.round(windowValidation.campaignCookieDuration / (24 * 60 * 60 * 1000))
        : undefined;

      const recentClick = await ctx.runQuery(internal.conversions.findRecentClickInternal, {
        tenantId: tenant._id,
        affiliateId: referralLink.affiliateId,
        campaignId: referralLink.campaignId,
        attributionWindowDays,
      });

      // AC1.8: Create attributed conversion
      // AC2.1-2.6: Create conversion with full attribution chain
      const conversionId = await ctx.runMutation(internal.conversions.createConversionWithAttribution, {
        tenantId: tenant._id,
        affiliateId: referralLink.affiliateId,
        referralLinkId: referralLink._id,
        clickId: recentClick?._id,
        campaignId: referralLink.campaignId,
        customerEmail,
        amount,
        status: "pending",
        ipAddress: clientIp,
        attributionSource: "cookie",
        metadata: {
          orderId,
          products,
          ...metadata,
        },
      });

      // Track API call (fire-and-forget)
      ctx.runMutation(internal.tenantStats.incrementApiCalls, {
        tenantId: tenant._id,
        count: 1,
      }).catch(() => {});

      // AC5: Performance monitoring
      const duration = Date.now() - startTime;
      if (duration > 3000) {
        console.warn(`Conversion tracking took ${duration}ms, exceeding 3s target`);
      }

      // AC1.8: Return success response with conversion ID
      return new Response(
        JSON.stringify({ 
          success: true, 
          conversionId,
          attributed: true,
          organic: false,
        }),
        {
          status: 200,
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );

    } catch (error) {
      console.error("Conversion tracking error:", error);
      
      // AC6.6: Return graceful response even on error (don't break tracking)
      // Fire-and-forget: log error but don't expose to end user
      return new Response(
        JSON.stringify({ 
          success: true, 
          attributed: false,
          message: "Conversion recorded",
        }),
        {
          status: 200, // Always return 200 to prevent breaking client experience
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
  }),
});

// Options handler for conversion tracking
http.route({
  path: "/track/conversion",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _req) => {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }),
});

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

      // Track API call (fire-and-forget) — resolve tenantId from publicKey
      ctx.runQuery(internal.conversions.getTenantByTrackingKeyInternal, {
        trackingKey: publicKey,
      }).then((tenant) => {
        if (tenant) {
          return ctx.runMutation(internal.tenantStats.incrementApiCalls, {
            tenantId: tenant._id,
            count: 1,
          });
        }
      }).catch(() => {});

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

// Resend Webhook Handler
// Story 10.6: Broadcast Email Log
// AC6: Receive Resend delivery webhooks and update email records
http.route({
  path: "/webhooks/resend",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      // Step 1: Read raw body for signature verification
      const rawBody = await req.text();

      // Step 2: Verify webhook signature
      const signature = req.headers.get("x-resend-signature") || "";
      const resendWebhookSecret = process.env.RESEND_WEBHOOK_SECRET || "";

      if (resendWebhookSecret) {
        // In production, verify HMAC signature
        // Note: Node.js crypto is available in httpAction
        const crypto = await import("crypto");
        const expectedSignature = crypto
          .createHmac("sha256", resendWebhookSecret)
          .update(rawBody)
          .digest("hex");
        const expectedSigHeader = `hmac_sha256=${expectedSignature}`;

        if (signature !== expectedSigHeader) {
          console.error("Resend webhook signature verification failed");
          return new Response("Invalid signature", { status: 401 });
        }
      } else {
        // No secret configured - log warning but allow in development
        console.warn("RESEND_WEBHOOK_SECRET not configured - skipping signature verification");
      }

      // Step 3: Parse event payload
      let event;
      try {
        event = JSON.parse(rawBody);
      } catch {
        console.error("Failed to parse Resend webhook payload");
        return new Response("Invalid JSON", { status: 400 });
      }

      const eventType = event.type || "";
      const emailId = event.data?.email_id || "";

      if (!emailId) {
        console.error("Resend webhook missing email_id");
        return new Response("Missing email_id", { status: 400 });
      }

      // Step 4: Map Resend event types to internal event types
      const eventMap: Record<string, "delivered" | "opened" | "clicked" | "bounced" | "complained"> = {
        "email.delivered": "delivered",
        "email.opened": "opened",
        "email.clicked": "clicked",
        "email.bounced": "bounced",
        "email.complained": "complained",
      };

      const internalEventType = eventMap[eventType];
      if (!internalEventType) {
        // Unknown event type - acknowledge but don't process
        console.log(`Unknown Resend event type: ${eventType}`);
        return new Response("OK", { status: 200 });
      }

      // Step 5: Extract timestamp and reason
      const timestamp = event.data?.created_at
        ? new Date(event.data.created_at).getTime()
        : Date.now();

      const reason = event.data?.reason || event.data?.description || undefined;

      // Step 6: Update email record and broadcast aggregates
      await ctx.runMutation(internal.emails.updateEmailDeliveryStatus, {
        resendMessageId: emailId,
        eventType: internalEventType,
        timestamp,
        reason,
      });

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Resend webhook processing error:", error);
      // Always return 200 to prevent Resend from retrying
      return new Response("OK", { status: 200 });
    }
  }),
});

// Options handler for Resend webhook CORS preflight
http.route({
  path: "/webhooks/resend",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _req) => {
    return new Response(null, {
      status: 200,
      headers: webhookCorsHeaders,
    });
  }),
});

// SaligPay Webhook Handler
// Story 6.5: Mock Payment Webhook Processing
// AC1: Process webhook events to create conversions
// AC3: Store raw webhook for audit
// AC4: Implement event deduplication
http.route({
  path: "/api/webhooks/saligpay",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      // Story 7.6: Raw Event Storage - Data Loss Prevention
      // Read raw body text first to ensure we can store it even if JSON parsing fails
      // This fixes AC8: No Data Loss Guarantee
      const rawBodyText = await req.text();
      let payload;
      try {
        // Try to parse JSON from the raw text
        payload = JSON.parse(rawBodyText);
      } catch {
        // AC8: Even if JSON parsing fails, we have the raw body text
        // Store it as a failed webhook for debugging
        const eventId = `evt_parse_error_${Date.now()}`;
        try {
          await ctx.runMutation(internal.webhooks.storeRawWebhook, {
            source: "saligpay",
            eventId,
            eventType: "unknown",
            rawPayload: rawBodyText,
            signatureValid: false,
            status: "failed",
            errorMessage: "Invalid JSON payload",
          });
        } catch (storeError) {
          // Even storage failed - log error but return 200
          console.error("Failed to store malformed webhook:", storeError);
        }

        // Return 200 even on parse error to prevent retries (AC #6)
        return new Response(
          JSON.stringify({ received: true, error: "Invalid JSON", webhookId: eventId }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...webhookCorsHeaders,
            },
          }
        );
      }

      // Step 2: Extract event ID and tenant ID first
      const eventId = payload.id || `evt_${Date.now()}`;
      const metadata = payload.data?.object?.metadata || {};
      const tenantIdStr = metadata._salig_aff_tenant;
      
      // Step 3: Perform ATOMIC deduplication (Story 7.5)
      // This replaces the previous check-then-store pattern which had race condition vulnerability
      // Use atomic deduplication mutation - checks and stores in single transaction
      const dedupResult = await ctx.runMutation(internal.webhooks.ensureEventNotProcessed, {
        source: "saligpay",
        eventId,
        eventType: payload.event || "unknown",
        rawPayload: rawBodyText, // Story 7.6: Use raw body text we read earlier
        signatureValid: true, // Mock mode - signature validation would be added in Story 14.3
        tenantId: tenantIdStr ? (tenantIdStr as Id<"tenants">) : undefined,
      });

      if (dedupResult.isDuplicate) {
        // AC #5: Reject duplicate gracefully - return 200 with duplicate flag
        console.log(`Duplicate webhook event detected: ${eventId}`);
        return new Response(
          JSON.stringify({ received: true, duplicate: true, webhookId: dedupResult.existingWebhookId }),
          {
            status: 200,
            headers: { 
              "Content-Type": "application/json",
              ...webhookCorsHeaders,
            },
          }
        );
      }

      // Track API call (fire-and-forget) — only if tenantId is available
      if (tenantIdStr) {
        ctx.runMutation(internal.tenantStats.incrementApiCalls, {
          tenantId: tenantIdStr as Id<"tenants">,
          count: 1,
        }).catch(() => {});
      }

      // Use the webhookId returned from the atomic mutation
      const rawWebhookId = dedupResult.webhookId!; // Non-null after isDuplicate check

      // Step 4: Normalize to BillingEvent format
      const billingEvent = normalizeToBillingEvent(payload);

      // Step 5: If normalization failed, update status and return 200
      if (!billingEvent) {
        await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
          webhookId: rawWebhookId,
          status: "failed",
          errorMessage: "Invalid webhook payload structure",
        });
        
        return new Response(
          JSON.stringify({ received: true, webhookId: rawWebhookId, processed: false }),
          {
            status: 200,
            headers: { 
              "Content-Type": "application/json",
              ...webhookCorsHeaders,
            },
          }
        );
      }

      // Step 7: Process webhook to create conversion and commission (Story 7.1 & 7.2)
      // Route events to appropriate processors
      if (billingEvent.eventType === "payment.updated") {
        await ctx.runAction(internal.commissionEngine.processPaymentUpdatedToCommission, {
          webhookId: rawWebhookId,
          billingEvent,
        });
      } else if (billingEvent.eventType === "subscription.created") {
        await ctx.runAction(internal.commissionEngine.processSubscriptionCreatedEvent, {
          webhookId: rawWebhookId,
          billingEvent,
        });
      } else if (billingEvent.eventType === "subscription.updated") {
        await ctx.runAction(internal.commissionEngine.processSubscriptionUpdatedEvent, {
          webhookId: rawWebhookId,
          billingEvent,
        });
      } else if (billingEvent.eventType === "subscription.cancelled") {
        await ctx.runAction(internal.commissionEngine.processSubscriptionCancelledEvent, {
          webhookId: rawWebhookId,
          billingEvent,
        });
      } else if (billingEvent.eventType === "refund.created") {
        await ctx.runAction(internal.commissionEngine.processRefundCreatedEvent, {
          webhookId: rawWebhookId,
          billingEvent,
        });
      } else if (billingEvent.eventType === "chargeback.created") {
        await ctx.runAction(internal.commissionEngine.processChargebackCreatedEvent, {
          webhookId: rawWebhookId,
          billingEvent,
        });
      } else {
        await ctx.runMutation(internal.webhooks.processWebhookToConversion, {
          webhookId: rawWebhookId,
          billingEvent,
        });
      }

      // Step 8: Return 200 (AC #6 - always return 200)
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
      // AC #6: Always return 200, log error internally
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

// Mock Payment Webhook Trigger Endpoint
// Story 6.5: Mock Payment Webhook Processing
// AC #1: Create mock webhook trigger endpoint for testing
// AC #5: Accept payment simulation parameters
// Task 5: Create mock webhook trigger endpoint
// AC #6: Always return 200 status (even on error) - Consistent with real webhook handler
http.route({
  path: "/api/mock/trigger-payment",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      // AC #5.4: Validate tenant ownership before triggering
      // First check authentication
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        // AC #6: Always return 200, indicate auth error in body
        console.error("Mock trigger: Authentication required");
        return new Response(
          JSON.stringify({ received: true, success: false, error: "Authentication required" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Get user's tenant from users table using internal query
      const user = await ctx.runQuery(internal.webhooks.getUserByAuthIdInternal, {
        authId: identity.subject,
      });

      if (!user) {
        // AC #6: Always return 200, indicate user error in body
        console.error("Mock trigger: User not found");
        return new Response(
          JSON.stringify({ received: true, success: false, error: "User not found" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // AC #5.2: Accept payment simulation parameters
      let body;
      try {
        body = await req.json();
      } catch {
        // AC #6: Always return 200, indicate parse error in body
        console.error("Mock trigger: Invalid JSON body");
        return new Response(
          JSON.stringify({ received: true, success: false, error: "Invalid JSON body" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const {
        amount = 9900, // Default amount in cents (PHP 99.00)
        status = "paid", // Default to paid
        currency = "PHP",
        customerEmail = "test@example.com",
        affiliateCode,
        eventType = "payment.updated",
        subscriptionId,
        subscriptionStatus = "active",
        planId,
      } = body;

      // AC #5.3: Generate realistic mock webhook payload
      const eventId = `evt_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const paymentId = `pay_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const subId = subscriptionId || `sub_mock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Build metadata with attribution data
      const metadata: Record<string, string> = {
        _salig_aff_tenant: user.tenantId,
      };

      if (affiliateCode) {
        metadata._salig_aff_ref = affiliateCode;
        // Optionally add a click ID for testing
        metadata._salig_aff_click_id = `click_mock_${Date.now()}`;
      }

      // Build mock payload - use any type for flexibility with subscription events
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockPayload: any = {
        id: eventId,
        event: eventType,
        created: Date.now(),
        data: {
          object: {
            id: paymentId,
            amount,
            currency,
            status,
            customer: {
              email: customerEmail,
            },
            payment_method: {
              id: `pm_mock_${Math.random().toString(36).substring(2, 9)}`,
              last4: "4242",
            },
            metadata,
          },
        },
      };

      // Add subscription data for subscription events
      if (eventType.startsWith("subscription.")) {
        mockPayload.data.object.subscription = {
          id: subId,
          status: subscriptionStatus,
          plan_id: planId || "plan_basic",
        };
      }

      // AC #5.1: Process the mock webhook through the same pipeline as real webhooks
      // This uses the existing webhook handler logic

      // Use atomic deduplication mutation (Story 7.5) - replaces check-then-store pattern
      const dedupResult = await ctx.runMutation(internal.webhooks.ensureEventNotProcessed, {
        source: "mock",
        eventId,
        eventType,
        rawPayload: JSON.stringify(mockPayload),
        signatureValid: true,
        tenantId: user.tenantId,
      });

      if (dedupResult.isDuplicate) {
        // AC #6: Always return 200, indicate duplicate in body
        console.error(`Mock trigger: Duplicate event ID ${eventId}`);
        return new Response(
          JSON.stringify({ received: true, success: false, error: "Duplicate event ID", duplicate: true, webhookId: dedupResult.existingWebhookId }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Track API call (fire-and-forget)
      ctx.runMutation(internal.tenantStats.incrementApiCalls, {
        tenantId: user.tenantId,
        count: 1,
      }).catch(() => {});

      // Use the webhookId returned from the atomic mutation
      const rawWebhookId = dedupResult.webhookId!; // Non-null after isDuplicate check

      // Normalize to BillingEvent
      const billingEvent = normalizeToBillingEvent(mockPayload);

      if (!billingEvent) {
        await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
          webhookId: rawWebhookId,
          status: "failed",
          errorMessage: "Failed to normalize mock webhook",
        });

        // AC #6: Always return 200, indicate normalization error in body
        console.error("Mock trigger: Failed to normalize mock webhook");
        return new Response(
          JSON.stringify({
            received: true,
            success: false,
            error: "Failed to process mock webhook",
            webhookId: rawWebhookId,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Story 7.1 & 7.2: For payment.updated and subscription events, create commission after conversion
      // For other event types, just create conversion (existing behavior)
      if (billingEvent.eventType === "payment.updated") {
        const result = await ctx.runAction(internal.commissionEngine.processPaymentUpdatedToCommission, {
          webhookId: rawWebhookId,
          billingEvent,
        });

        // AC #5.5: Return generated webhook ID for verification
        return new Response(
          JSON.stringify({
            received: true,
            success: true,
            webhookId: eventId,
            rawWebhookId,
            conversionId: result.conversionId,
            commissionId: result.commissionId,
            organic: result.organic,
            payload: mockPayload,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else if (billingEvent.eventType === "subscription.created") {
        // Story 7.2: Handle subscription.created events
        const result = await ctx.runAction(internal.commissionEngine.processSubscriptionCreatedEvent, {
          webhookId: rawWebhookId,
          billingEvent,
        });

        return new Response(
          JSON.stringify({
            received: true,
            success: true,
            webhookId: eventId,
            rawWebhookId,
            conversionId: result.conversionId,
            commissionId: result.commissionId,
            organic: result.organic,
            payload: mockPayload,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else if (billingEvent.eventType === "subscription.updated") {
        // Story 7.2: Handle subscription.updated events (renewals, upgrades, downgrades)
        const result = await ctx.runAction(internal.commissionEngine.processSubscriptionUpdatedEvent, {
          webhookId: rawWebhookId,
          billingEvent,
        });

        return new Response(
          JSON.stringify({
            received: true,
            success: true,
            webhookId: eventId,
            rawWebhookId,
            conversionId: result.conversionId,
            commissionId: result.commissionId,
            organic: result.organic,
            adjustmentType: result.adjustmentType,
            payload: mockPayload,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else if (billingEvent.eventType === "subscription.cancelled") {
        // Story 7.2: Handle subscription.cancelled events
        const result = await ctx.runAction(internal.commissionEngine.processSubscriptionCancelledEvent, {
          webhookId: rawWebhookId,
          billingEvent,
        });

        return new Response(
          JSON.stringify({
            received: true,
            success: true,
            webhookId: eventId,
            rawWebhookId,
            conversionId: result.conversionId,
            commissionId: result.commissionId,
            organic: result.organic,
            payload: mockPayload,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else if (billingEvent.eventType === "refund.created") {
        // Story 7.4: Handle refund.created events for commission reversal
        const result = await ctx.runAction(internal.commissionEngine.processRefundCreatedEvent, {
          webhookId: rawWebhookId,
          billingEvent,
        });

        return new Response(
          JSON.stringify({
            received: true,
            success: true,
            webhookId: eventId,
            rawWebhookId,
            commissionId: result.commissionId,
            processed: result.processed,
            reversed: result.reversed,
            payload: mockPayload,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else if (billingEvent.eventType === "chargeback.created") {
        // Story 7.4: Handle chargeback.created events for commission reversal with fraud signal
        const result = await ctx.runAction(internal.commissionEngine.processChargebackCreatedEvent, {
          webhookId: rawWebhookId,
          billingEvent,
        });

        return new Response(
          JSON.stringify({
            received: true,
            success: true,
            webhookId: eventId,
            rawWebhookId,
            commissionId: result.commissionId,
            processed: result.processed,
            reversed: result.reversed,
            fraudSignalAdded: result.fraudSignalAdded,
            payload: mockPayload,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else {
        // For non-payment/subscription events, use existing conversion-only flow
        const conversionId = await ctx.runMutation(internal.webhooks.processWebhookToConversion, {
          webhookId: rawWebhookId,
          billingEvent,
        });

        // AC #5.5: Return generated webhook ID for verification
        return new Response(
          JSON.stringify({
            received: true,
            success: true,
            webhookId: eventId,
            rawWebhookId,
            conversionId: conversionId || null,
            payload: mockPayload,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    } catch (error) {
      // MEDIUM #11: Standardized error logging
      console.error("Mock trigger error:", error);
      // AC #6: Always return 200, even on unexpected errors
      return new Response(
        JSON.stringify({ received: true, success: false, error: "Internal server error" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

// CORS headers for mock endpoints
const mockCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Options handler for mock trigger endpoint
http.route({
  path: "/api/mock/trigger-payment",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _req) => {
    return new Response(null, {
      status: 200,
      headers: mockCorsHeaders,
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
      // Track API call (fire-and-forget)
      if (result.tenantId) {
        ctx.runMutation(internal.tenantStats.incrementApiCalls, {
          tenantId: result.tenantId,
          count: 1,
        }).catch(() => {
          // Silently fail - don't break user experience
        });
      }

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

// Click Tracking Endpoint
// Story 6.2: Click Tracking with Deduplication
// AC1, AC2, AC3, AC4, AC5, AC6 - Track clicks with IP-based deduplication and cookie attribution
http.route({
  path: "/track/click",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const startTime = Date.now();
    
    try {
      // Parse query parameters
      const url = new URL(req.url);
      const code = url.searchParams.get("code");
      const tenantId = url.searchParams.get("t") as Id<"tenants"> | null;
      
      // AC6: Validate required parameters
      if (!code || !tenantId) {
        return new Response(
          JSON.stringify({ error: "Missing required parameters: code and t (tenantId)" }),
          {
            status: 400,
            headers: { 
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          }
        );
      }

      // Extract client IP from headers (X-Forwarded-For, X-Real-IP)
      // Handle multiple IPs in X-Forwarded-For (take the first one = client)
      const forwardedFor = req.headers.get("X-Forwarded-For");
      const realIp = req.headers.get("X-Real-IP");
      const clientIp = forwardedFor 
        ? forwardedFor.split(",")[0].trim() 
        : realIp || "unknown";

      // Extract User-Agent and Referrer
      const userAgent = req.headers.get("User-Agent") || undefined;
      const referrer = req.headers.get("Referer") || undefined;

      // Read existing attribution cookie
      const cookieHeader = req.headers.get("Cookie") || "";
      const existingCookie = cookieHeader
        .split(";")
        .find(c => c.trim().startsWith("sa_aff="));
      
      let cookieData: { affiliateCode?: string; timestamp?: number } = {};
      if (existingCookie) {
        try {
          const cookieValue = existingCookie.split("=")[1];
          const decodedValue = decodeURIComponent(cookieValue);
          cookieData = JSON.parse(atob(decodedValue));
        } catch {
          // Invalid cookie format, ignore
          cookieData = {};
        }
      }

      // AC3: Cookie takes precedence over URL parameter if valid
      // AC5: Validate cookie's affiliate is still active
      let effectiveCode = code;
      let attributionSource: "url" | "cookie" = "url";
      
      if (cookieData.affiliateCode) {
        // Validate the cookie affiliate is still active
        const cookieValidation = await ctx.runQuery(internal.clicks.validateAffiliateCodeInternal, {
          tenantId,
          code: cookieData.affiliateCode,
        });
        
        if (cookieValidation.valid) {
          effectiveCode = cookieData.affiliateCode;
          attributionSource = "cookie";
        }
        // AC3: If cookie affiliate invalid, fall back to URL param affiliate (effectiveCode already = code)
      }

      // AC1, AC5: Validate referral link and affiliate status
      const referralLink = await ctx.runQuery(internal.clicks.getReferralLinkByCodeInternal, {
        tenantId,
        code: effectiveCode,
      });

      // AC6: Handle suspended/pending affiliates - return 404
      if (!referralLink) {
        return new Response(
          JSON.stringify({ 
            error: "Referral link not found",
            message: "This referral link is no longer active or the affiliate is not approved."
          }),
          {
            status: 404,
            headers: { 
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          }
        );
      }

      // Get tenant for destination URL
      const tenant = await ctx.runQuery(internal.clicks.getTenantByIdInternal, {
        tenantId,
      });

      // Default redirect URL (can be overridden by campaign settings in future stories)
      const redirectUrl = tenant?.branding?.portalName 
        ? `https://${tenant.slug}.saligaffiliate.com`
        : "https://app.saligaffiliate.com";

      // AC1, AC2: Generate dedupeKey for click deduplication
      // Format: SHA-256 hash of IP + code + hourly time window
      const timeWindow = Math.floor(Date.now() / (1000 * 60 * 60)); // Hourly bucket
      const dedupeKey = `${clientIp}:${effectiveCode}:${timeWindow}`;

      // AC4: Fire-and-forget click tracking (don't block redirect on DB write)
      // This ensures < 3 second response time (NFR3)
      // We don't await to maintain fast redirect performance
      ctx.runMutation(internal.clicks.trackClickInternal, {
        tenantId,
        referralLinkId: referralLink._id,
        affiliateId: referralLink.affiliateId,
        campaignId: referralLink.campaignId,
        ipAddress: clientIp,
        userAgent,
        referrer,
        dedupeKey,
      }).catch(error => {
        // Log error but don't break user experience
        console.error("Click tracking error:", error);
      });

      // AC1, AC4: Build attribution cookie
      // Cookie format: Base64-encoded JSON with affiliate code and timestamp
      const cookiePayload = {
        affiliateCode: effectiveCode,
        campaignId: referralLink.campaignId,
        timestamp: Date.now(),
      };
      const cookieValue = btoa(JSON.stringify(cookiePayload));
      
      // AC4: Configurable cookie TTL - default 30 days
      // Get cookie duration from campaign if available, otherwise default 30 days
      let cookieDurationDays = 30;
      if (referralLink.campaignId) {
        const campaign = await ctx.runQuery(internal.clicks.getCampaignByIdInternal, {
          campaignId: referralLink.campaignId,
        });
        if (campaign?.cookieDuration) {
          cookieDurationDays = campaign.cookieDuration;
        }
      }
      
      const expires = new Date();
      expires.setDate(expires.getDate() + cookieDurationDays);

      // Set cookie on tenant's domain for cross-subdomain tracking
      const domain = tenant?.slug ? `.${tenant.slug}.saligaffiliate.com` : ".saligaffiliate.com";
      const setCookieHeader = `sa_aff=${encodeURIComponent(cookieValue)}; Expires=${expires.toUTCString()}; Path=/; Domain=${domain}; HttpOnly; Secure; SameSite=Lax`;

      // AC5: Performance monitoring
      const duration = Date.now() - startTime;
      const exceedsThreshold = duration > 3000;
      
      if (exceedsThreshold) {
        console.warn(`Click tracking took ${duration}ms, exceeding 3s target`);
      }

      // Record performance metric (fire-and-forget, don't await)
      ctx.runMutation(internal.performance.recordPerformanceMetric, {
        tenantId,
        metricType: "click_response_time",
        value: duration,
        metadata: {
          endpoint: "/track/click",
        },
      }).catch(() => {
        // Silently fail - don't break user experience for metrics
      });

      // Track API call (fire-and-forget, don't await)
      ctx.runMutation(internal.tenantStats.incrementApiCalls, {
        tenantId,
        count: 1,
      }).catch(() => {
        // Silently fail - don't break user experience
      });

      // AC5: Track timeout metrics when response time exceeds 3 seconds
      if (exceedsThreshold) {
        ctx.runMutation(internal.performance.recordPerformanceMetric, {
          tenantId,
          metricType: "click_timeout",
          value: 1,
          metadata: {
            endpoint: "/track/click",
            responseTime: duration,
          },
        }).catch(() => {
          // Silently fail - don't break user experience for metrics
        });
      }

      // AC1, AC4: Return 302 redirect with Set-Cookie header
      // Note: We don't await trackClickPromise to ensure fast redirect
      return new Response(null, {
        status: 302,
        headers: {
          "Location": redirectUrl,
          "Set-Cookie": setCookieHeader,
          "Cache-Control": "no-store",
          "X-Click-Tracked": "true",
          "X-Attribution-Source": attributionSource,
          "X-Response-Time": `${duration}ms`,
        },
      });

    } catch (error) {
      console.error("Click tracking error:", error);
      
      // Record error metric (fire-and-forget, don't await)
      // Note: tenantId may not be available if error occurred before parsing
      const url = new URL(req.url);
      const errorTenantId = url.searchParams.get("t") as Id<"tenants"> | null;
      ctx.runMutation(internal.performance.recordPerformanceMetric, {
        tenantId: errorTenantId || undefined,
        metricType: "click_error",
        value: 1,
        metadata: {
          endpoint: "/track/click",
          errorType: error instanceof Error ? error.message : "unknown",
        },
      }).catch(() => {
        // Silently fail - don't break user experience for metrics
      });
      
      // AC7: Graceful error handling - return redirect even on error
      // Don't break user experience due to tracking errors
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "https://app.saligaffiliate.com",
          "Cache-Control": "no-store",
          "X-Click-Tracked": "false",
          "X-Error": "tracking_failed",
        },
      });
    }
  }),
});

export default http;
