import "./polyfills";
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { betterAuthComponent, createAuth } from "./auth";
import { internal, api, components } from "./_generated/api";
import { apiCallsDirect } from "./aggregates";
import { buildRateLimitKey, extractIp, ENDPOINT_CONFIGS } from "./lib/rateLimiter";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { normalizeToBillingEvent, normalizeStripeToBillingEvent } from "./webhooks";
import { registerRoutes } from "@convex-dev/stripe";

const http = httpRouter();

betterAuthComponent.registerRoutes(http, createAuth as any);

registerRoutes(http, components.stripe, {
  webhookPath: "/stripe/webhook",
  events: {
    "customer.subscription.updated": async (ctx, event) => {
      const sub = event.data.object as any;
      const userId = sub.metadata?.userId;
      const plan = sub.metadata?.plan;
      const tenantId = sub.metadata?.tenantId;

      if (!userId || !tenantId) return;

      await ctx.runMutation(internal.platformBillingInternal.syncStripeSubscriptionToTenant, {
        stripeSubscriptionId: sub.id,
        status: sub.status,
        priceId: typeof sub.items?.data?.[0]?.price?.id === "string" ? sub.items.data[0].price.id : undefined,
        currentPeriodEnd: sub.current_period_end ? sub.current_period_end * 1000 : undefined,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        userId,
        plan,
        tenantId,
      });

      if (sub.status === "canceled") {
        try {
          await ctx.runMutation(
            internal.billingLifecycle.pauseAllActiveCampaignsForTenant,
            { tenantId: tenantId as any }
          );
        } catch (err) {
          console.error(`[Stripe Webhook] Failed to pause campaigns for tenant ${tenantId}:`, err);
        }
      }
    },
    "customer.subscription.deleted": async (ctx, event) => {
      const sub = event.data.object as any;
      const userId = sub.metadata?.userId;
      const plan = sub.metadata?.plan;
      const tenantId = sub.metadata?.tenantId;

      if (!userId || !tenantId) return;

      await ctx.runMutation(internal.platformBillingInternal.syncStripeSubscriptionToTenant, {
        stripeSubscriptionId: sub.id,
        status: "canceled",
        userId,
        plan,
        tenantId,
      });

      await ctx.runMutation(
        internal.billingLifecycle.pauseAllActiveCampaignsForTenant,
        { tenantId: tenantId as any }
      );
    },
    "checkout.session.completed": async (ctx, event) => {
      const session = event.data.object as any;
      const metadata = session.metadata;
      const tenantId = metadata?.tenantId;
      const plan = metadata?.plan;
      const isPlatformBilling = metadata?.isPlatformBilling === "true";

      if (!isPlatformBilling || !tenantId || !plan) return;

      const userId = metadata?.userId;
      if (!userId) return;

      const subId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;

      if (!subId) return;

      await ctx.runMutation(internal.platformBillingInternal.syncStripeSubscriptionToTenant, {
        stripeSubscriptionId: subId,
        status: "active",
        plan,
        userId,
        tenantId,
      });
    },
    "invoice.paid": async (ctx, event) => {
      const invoice = event.data.object as any;
      const subId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;

      if (!subId) return;

      const subIdStr = subId as string;

      const tenant = await ctx.runQuery(
        internal.platformBillingInternal.getTenantByStripeSubscriptionId,
        { stripeSubscriptionId: subIdStr }
      );

      if (!tenant) return;

      await ctx.runMutation(internal.platformBillingInternal.syncStripeSubscriptionToTenant, {
        stripeSubscriptionId: subIdStr,
        status: "active",
        currentPeriodEnd: invoice.period_end ? invoice.period_end * 1000 : undefined,
        userId: tenant._id,
        tenantId: tenant._id,
        plan: tenant.plan,
      });
    },
  },
});

// CORS headers for webhook endpoints
const webhookCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Saligpay-Signature, Stripe-Signature",
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

      const { amount, orderId, customerEmail, products, metadata, affiliateCode: bodyAffiliateCode, clickId: bodyClickId, couponCode: bodyCouponCode } = body;

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

      // Rate limiting: Per-tenant + global IP cap (Tasks 11 & 12)
      const tenantIdStr = tenant._id as string;
      const convRateLimitKey = buildRateLimitKey("conversion", tenantIdStr);
      const convStatus = await ctx.runQuery(internal.rateLimits.getRateLimitStatus, {
        key: convRateLimitKey, limit: ENDPOINT_CONFIGS.conversion.limit,
      });
      if (convStatus.remaining <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Too many requests", resetsAt: convStatus.resetsAt }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if (clientIp) {
        const globalConvKey = buildRateLimitKey("conversion:global", clientIp);
        const globalConvStatus = await ctx.runQuery(internal.rateLimits.getRateLimitStatus, {
          key: globalConvKey, limit: ENDPOINT_CONFIGS["conversion:global"].limit,
        });
        if (globalConvStatus.remaining <= 0) {
          return new Response(
            JSON.stringify({ success: false, error: "Too many requests", resetsAt: globalConvStatus.resetsAt }),
            { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      // Increment rate limit counters (fire-and-forget, after rate check passed)
      ctx.runMutation(internal.rateLimits.incrementRateLimit, {
        key: convRateLimitKey, windowDurationMs: ENDPOINT_CONFIGS.conversion.windowDurationMs,
      }).catch(() => {});
      if (clientIp) {
        ctx.runMutation(internal.rateLimits.incrementRateLimit, {
          key: buildRateLimitKey("conversion:global", clientIp),
          windowDurationMs: ENDPOINT_CONFIGS["conversion:global"].windowDurationMs,
        }).catch(() => {});
      }

      // AC1.2: Parse attribution from POST body (new track.js) or cookie (legacy)
      // Coupon code takes precedence over cookie/body attribution (ADR-4)
      let effectiveAffiliateCode: string | null = bodyAffiliateCode || null;
      let effectiveClickId: string | null = bodyClickId || null;
      let attributionSource: "body" | "cookie" | "coupon" | null = bodyAffiliateCode ? "body" : null;
      let couponValidationResult: any = null;

      // Coupon code validation (highest priority attribution source)
      if (bodyCouponCode) {
        try {
          couponValidationResult = await ctx.runQuery(api.couponCodes.validateCouponCode, {
            tenantId: tenant._id,
            couponCode: bodyCouponCode,
          });

          if (couponValidationResult) {
            // Coupon wins over cookie/body attribution (ADR-4)
            effectiveAffiliateCode = null; // Will use coupon's affiliate directly
            attributionSource = "coupon";
          } else {
            console.warn(`[Track] Invalid coupon code: ${bodyCouponCode}, falling back to cookie/body attribution`);
          }
        } catch (err) {
          console.error("[Track] Coupon validation error:", err);
          // Fall back to cookie/body attribution
        }
      }
      let cookieTimestamp: number | undefined;

      // If no body attribution, fall back to cookie (backwards compatibility)
      if (!effectiveAffiliateCode) {
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

        if (cookieData.affiliateCode) {
          effectiveAffiliateCode = cookieData.affiliateCode;
          cookieTimestamp = cookieData.timestamp;
          attributionSource = "cookie";
        }
      }

      // AC1.5: If no attribution, create organic conversion (AC #2)
      if (!effectiveAffiliateCode && attributionSource !== "coupon") {
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

      // Attribution Resilience: Coupon code path (bypasses cookie/body affiliate validation)
      if (attributionSource === "coupon" && couponValidationResult) {
        const conversionId = await ctx.runMutation(internal.conversions.createConversionWithAttribution, {
          tenantId: tenant._id,
          affiliateId: couponValidationResult.affiliateId,
          referralLinkId: couponValidationResult.referralLinkId,
          clickId: undefined, // Coupon-only: no click
          campaignId: couponValidationResult.campaignId,
          customerEmail,
          amount,
          status: "pending",
          ipAddress: clientIp,
          attributionSource: "coupon",
          couponCode: bodyCouponCode,
          metadata: {
            orderId,
            products,
            ...metadata,
          },
        });

        apiCallsDirect.insert(ctx, { key: Date.now(), id: `api-${Date.now()}-${Math.random().toString(36).slice(2)}`, namespace: tenant._id }).catch(() => {});

        return new Response(
          JSON.stringify({ 
            success: true, 
            conversionId,
            attributed: true,
            organic: false,
            couponAttributed: true,
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
        code: effectiveAffiliateCode!,
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
            originalAffiliateCode: effectiveAffiliateCode,
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

      // AC3: Validate attribution window (Story 6.4)
      // For body attribution, validate clickId exists and is within window
      // For cookie attribution, validate timestamp is within window
      let windowValidation: { isExpired: boolean; elapsedDays: number; campaignCookieDuration: number } | undefined;
      
      if (attributionSource === "cookie" && cookieTimestamp) {
        windowValidation = await ctx.runQuery(internal.conversions.validateCookieAttributionWindow, {
          tenantId: tenant._id,
          affiliateCode: effectiveAffiliateCode!,
          campaignId: undefined, // Will be resolved from referral link
          cookieTimestamp: cookieTimestamp,
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
              originalAffiliateCode: effectiveAffiliateCode,
              expirationReason: "attribution_expired",
              attributionSource: "cookie",
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
              message: "Conversion recorded as organic (attribution expired)",
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

      // For body attribution with clickId, validate the click exists and is within window
      if (attributionSource === "body" && effectiveClickId) {
        const clickValidation = await ctx.runQuery(internal.conversions.validateClickAttributionWindow, {
          tenantId: tenant._id,
          clickId: effectiveClickId as Id<"clicks">,
        });

        if (!clickValidation.valid) {
          // Click expired or not found - create organic conversion
          const conversionId = await ctx.runMutation(internal.conversions.createOrganicConversion, {
            tenantId: tenant._id,
            customerEmail,
            amount,
            status: "pending",
            ipAddress: clientIp,
            metadata: {
              orderId,
              products,
              originalAffiliateCode: effectiveAffiliateCode,
              originalClickId: effectiveClickId,
              expirationReason: clickValidation.reason || "click_invalid",
              attributionSource: "body",
              ...metadata,
            },
          });

          return new Response(
            JSON.stringify({
              success: true,
              conversionId,
              organic: true,
              attributed: false,
              message: `Conversion recorded as organic (${clickValidation.reason || "click invalid"})`,
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
        code: effectiveAffiliateCode!,
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
            originalAffiliateCode: effectiveAffiliateCode,
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
      // Use body clickId if provided, otherwise fall back to recent click lookup
      const finalClickId = effectiveClickId 
        ? effectiveClickId as Id<"clicks"> 
        : recentClick?._id;
      
      const conversionId = await ctx.runMutation(internal.conversions.createConversionWithAttribution, {
        tenantId: tenant._id,
        affiliateId: referralLink.affiliateId,
        referralLinkId: referralLink._id,
        clickId: finalClickId,
        campaignId: referralLink.campaignId,
        customerEmail,
        amount,
        status: "pending",
        ipAddress: clientIp,
        attributionSource: attributionSource || "cookie",
        metadata: {
          orderId,
          products,
          ...metadata,
        },
      });

      // Track API call (fire-and-forget)
      apiCallsDirect.insert(ctx, { key: Date.now(), id: `api-${Date.now()}-${Math.random().toString(36).slice(2)}`, namespace: tenant._id }).catch(() => {});

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
          return apiCallsDirect.insert(ctx, { key: Date.now(), id: `api-${Date.now()}-${Math.random().toString(36).slice(2)}`, namespace: tenant._id });
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

// Coupon Code Validation Endpoint
// Attribution Resilience: Public endpoint for track.js coupon validation
http.route({
  path: "/track/validate-coupon",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    try {
      const url = new URL(req.url);
      const code = url.searchParams.get("code");
      const tenantId = url.searchParams.get("t");

      if (!code || !tenantId) {
        return new Response(
          JSON.stringify({ valid: false, error: "Missing code or tenant ID" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
         );
       }

      // Rate limiting: Per-tenant coupon validation (Task 12)
      const couponRateLimitKey = buildRateLimitKey("coupon", tenantId);
      const couponStatus = await ctx.runQuery(internal.rateLimits.getRateLimitStatus, {
        key: couponRateLimitKey, limit: ENDPOINT_CONFIGS.coupon.limit,
      });
      if (couponStatus.remaining <= 0) {
        return new Response(
          JSON.stringify({ valid: false, error: "Too many requests", resetsAt: couponStatus.resetsAt }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Increment rate limit counter (fire-and-forget, after rate check passed)
      ctx.runMutation(internal.rateLimits.incrementRateLimit, {
        key: couponRateLimitKey, windowDurationMs: ENDPOINT_CONFIGS.coupon.windowDurationMs,
      }).catch(() => {});

      const result = await ctx.runQuery(api.couponCodes.validateCouponCode, {
        tenantId: tenantId as any,
        couponCode: code,
      });

      if (!result) {
        return new Response(
          JSON.stringify({ valid: false, error: "Invalid coupon code" }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      return new Response(
        JSON.stringify({
          valid: true,
          affiliateName: result.affiliateName,
          campaignId: result.campaignId,
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
      console.error("Coupon validation error:", error);
      return new Response(
        JSON.stringify({ valid: false, error: "Internal error" }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
  }),
});

// Options handler for coupon validation CORS preflight
http.route({
  path: "/track/validate-coupon",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _req) => {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
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

      // Step 5.5: Store raw webhook for audit trail (parity with Postmark webhook)
      try {
        await ctx.runMutation(internal.emails.storeRawWebhook, {
          source: "resend",
          eventId: emailId,
          eventType,
          rawPayload: rawBody,
          signatureValid: !!signature,
        });
      } catch (storeError) {
        console.error("Failed to store raw Resend webhook:", storeError);
      }

      // Step 6: Update email record and broadcast aggregates
      await ctx.runMutation(internal.emails.updateEmailDeliveryStatus, {
        provider: "resend",
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

// Postmark Webhook Handler
// Multi-provider email support: receive Postmark delivery webhooks
http.route({
  path: "/webhooks/postmark",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      // Step 1: Verify webhook auth via custom header
      const webhookSecret = req.headers.get("x-webhook-secret") || "";
      const postmarkWebhookSecret = process.env.POSTMARK_WEBHOOK_SECRET || "";

      if (postmarkWebhookSecret && webhookSecret !== postmarkWebhookSecret) {
        console.error("Postmark webhook auth failed: invalid X-Webhook-Secret");
        return new Response("Unauthorized", { status: 401 });
      }

      if (!postmarkWebhookSecret) {
        console.warn(
          "POSTMARK_WEBHOOK_SECRET not configured - skipping auth verification"
        );
      }

      // Step 2: Read raw body
      const rawBody = await req.text();

      // Step 3: Parse payload
      let payload;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        console.error("Failed to parse Postmark webhook payload");
        return new Response("Invalid JSON", { status: 400 });
      }

      const recordType = payload.RecordType;
      const messageId = payload.MessageID;

      if (!messageId || !recordType) {
        console.error("Postmark webhook missing MessageID or RecordType");
        return new Response("Missing required fields", { status: 400 });
      }

      // Step 4: Map Postmark RecordType to internal event types
      const eventTypeMap: Record<
        string,
        "delivered" | "opened" | "clicked" | "bounced" | "complained"
      > = {
        Delivery: "delivered",
        Open: "opened",
        Click: "clicked",
        Bounce: "bounced",
        SpamComplaint: "complained",
      };

      const eventType = eventTypeMap[recordType];
      if (!eventType) {
        // Unknown event type - acknowledge but don't process
        console.log(`Unknown Postmark RecordType: ${recordType}`);
        return new Response("OK", { status: 200 });
      }

      // Step 5: Store raw webhook for audit/debugging
      const signatureValid = !postmarkWebhookSecret || webhookSecret === postmarkWebhookSecret;
      const eventId = `${messageId}_${recordType}`;
      try {
        await ctx.runMutation(internal.emails.storeRawWebhook, {
          source: "postmark",
          eventId,
          eventType: recordType,
          rawPayload: rawBody,
          signatureValid,
        });
      } catch (storeError) {
        // Non-blocking: log but continue processing
        console.error("Failed to store raw Postmark webhook:", storeError);
      }

      // Step 6: Extract timestamp per event type
      let timestamp: number;
      switch (recordType) {
        case "Delivery":
          timestamp = payload.DeliveredAt
            ? new Date(payload.DeliveredAt).getTime()
            : Date.now();
          break;
        case "Bounce":
        case "SpamComplaint":
          // Postmark uses BouncedAt for both Bounce and SpamComplaint events
          timestamp = payload.BouncedAt
            ? new Date(payload.BouncedAt).getTime()
            : Date.now();
          break;
        case "Open":
        case "Click":
          timestamp = payload.ReceivedAt
            ? new Date(payload.ReceivedAt).getTime()
            : Date.now();
          break;
        default:
          timestamp = Date.now();
      }

      // Step 7: Extract reason for bounces/complaints
      const reason =
        payload.Details || payload.Description || undefined;

      // Step 8: Update email delivery status
      await ctx.runMutation(internal.emails.updateEmailDeliveryStatus, {
        provider: "postmark",
        postmarkMessageId: messageId,
        eventType,
        timestamp,
        reason,
      });

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Postmark webhook processing error:", error);
      // Always return 200 to prevent Postmark from retrying
      return new Response("OK", { status: 200 });
    }
  }),
});

// Options handler for Postmark webhook CORS preflight
http.route({
  path: "/webhooks/postmark",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _req) => {
    return new Response(null, {
      status: 200,
      headers: webhookCorsHeaders,
    });
  }),
});

// Billing Provider Webhook Handler (SaligPay)
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
        apiCallsDirect.insert(ctx, { key: Date.now(), id: `api-${Date.now()}-${Math.random().toString(36).slice(2)}`, namespace: tenantIdStr as Id<"tenants"> }).catch(() => {});
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

// =============================================================================
// Stripe Webhook Handler — POST /api/webhooks/stripe
// Processes Stripe Connect webhooks with signature verification
// Tenant resolved via stored stripeAccountId (Stripe events have no Affilio metadata)
// Attribution via email-based lead matching (referralLeads table)
// =============================================================================
http.route({
  path: "/api/webhooks/stripe",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      // 1. Read raw body first (needed for signature verification)
      const rawBody = await req.text();

      // 2. Extract Stripe-Signature header
      const signature = req.headers.get("Stripe-Signature");

      // 3. Parse payload as JSON
      let payload: any;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        console.error("[Stripe Webhook] Invalid JSON payload");
        return new Response(JSON.stringify({ received: true, error: "Invalid JSON" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...webhookCorsHeaders },
        });
      }

      // 4. Resolve tenant - check metadata first (platform billing), then payload.account (Connect)
      const dataObject = payload.data?.object;
      const metadata = dataObject?.metadata || dataObject?.subscription?.metadata || {};
      const isPlatformBilling = metadata?.isPlatformBilling === "true";
      const tenantIdFromMetadata = metadata?.tenantId;

      let tenant: any = null;

      // Platform billing: resolve tenant from metadata.tenantId
      if (isPlatformBilling && tenantIdFromMetadata) {
        console.log(`[Stripe Webhook] Looking for tenant: ${tenantIdFromMetadata}`);
        tenant = await ctx.runQuery(internal.clicks.getTenantByIdInternal, {
          tenantId: tenantIdFromMetadata,
        });
        if (tenant) {
          console.log(`[Stripe Webhook] Platform billing: resolved tenant ${tenant._id} from metadata`);
        } else {
          console.log(`[Stripe Webhook] Tenant not found for ID: ${tenantIdFromMetadata}`);
        }
      }

      // If not platform billing or no tenant found, try Stripe Connect (payload.account)
      if (!tenant) {
        const stripeAccountId = payload.account;
        if (stripeAccountId) {
          tenant = await ctx.runQuery(internal.tenants.getTenantByStripeAccountId, {
            stripeAccountId,
          });
        }
      }

      if (!tenant) {
        // For test mode events, don't fail - just acknowledge receipt
        const isTestMode = rawBody.includes("test_") || payload.id?.startsWith("evt_test");
        if (isTestMode) {
          console.log(`[Stripe Webhook] Test mode event, skipping: ${payload.type}`);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...webhookCorsHeaders },
          });
        }
        console.warn(`[Stripe Webhook] No tenant found for Stripe webhook`);
        return new Response(JSON.stringify({ received: true, error: "Tenant not found" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...webhookCorsHeaders },
        });
      }

      // 5. Signature verification
      // For OAuth connections: use platform webhook secret (STRIPE_WEBHOOK_SECRET env var)
      // For manual connections: use per-tenant signing secret (backwards compat)
      if (signature) {
        const stripe = (await import("stripe")).default;
        const platformSecret = process.env.STRIPE_WEBHOOK_SECRET;

        // Try platform secret first (OAuth / Connect webhook endpoint)
        if (platformSecret && tenant.stripeCredentials?.connectedVia === "oauth") {
          try {
            stripe.webhooks.constructEvent(rawBody, signature, platformSecret);
          } catch (err: any) {
            console.error(`[Stripe Webhook] Platform signature verification failed for tenant ${tenant._id}:`, err.message);
            return new Response(JSON.stringify({ received: true, error: "Invalid signature" }), {
              status: 200,
              headers: { "Content-Type": "application/json", ...webhookCorsHeaders },
            });
          }
        } else if (tenant.stripeCredentials?.signingSecret) {
          // Manual fallback: verify with per-tenant secret
          try {
            const webhookSecret = tenant.stripeCredentials.signingSecret;
            stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
          } catch (err: any) {
            console.error(`[Stripe Webhook] Signature verification failed for tenant ${tenant._id}:`, err.message);
            return new Response(JSON.stringify({ received: true, error: "Invalid signature" }), {
              status: 200,
              headers: { "Content-Type": "application/json", ...webhookCorsHeaders },
            });
          }
        } else {
          console.warn(`[Stripe Webhook] No signing secret configured for tenant ${tenant._id}`);
        }
      }

      // 7. Test mode check - allow platform billing events even in test mode
      const isPlatformEvent = metadata?.isPlatformBilling === "true";
      if (payload.livemode === false && !isPlatformEvent) {
        console.log(`[Stripe Webhook] Test mode event (non-platform), skipping: ${payload.type}`);
        return new Response(JSON.stringify({ received: true, testMode: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...webhookCorsHeaders },
        });
      }

      // 8. Deduplication
      const dedupResult = await ctx.runMutation(internal.webhooks.ensureEventNotProcessed, {
        source: "stripe",
        eventId: payload.id,
        eventType: payload.type,
        rawPayload: rawBody,
        signatureValid: true,
        tenantId: tenant._id,
      });

      if (dedupResult.isDuplicate) {
        console.log(`[Stripe Webhook] Duplicate event: ${payload.id}`);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...webhookCorsHeaders },
        });
      }

      // 9. Normalize to BillingEvent
      const billingEvent = normalizeStripeToBillingEvent(payload);
      if (!billingEvent) {
        console.warn(`[Stripe Webhook] Unhandled event type: ${payload.type}`);
        await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
          webhookId: dedupResult.webhookId!,
          status: "failed",
          errorMessage: `Unhandled Stripe event type: ${payload.type}`,
        });
        return new Response(JSON.stringify({ received: true, error: "Unhandled event type" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...webhookCorsHeaders },
        });
      }

      // 10. Stripe-specific dedup: check for existing commission with same transactionId
      if (billingEvent.eventType === "payment.updated" && billingEvent.payment.id) {
        const existingCommission = await ctx.runQuery(internal.commissionEngine.findCommissionByTransactionId, {
          tenantId: tenant._id,
          transactionId: billingEvent.payment.id,
        });
        if (existingCommission) {
          console.log(`[Stripe Webhook] Duplicate payment_intent: ${billingEvent.payment.id}`);
          await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
            webhookId: dedupResult.webhookId!,
            status: "processed",
            errorMessage: `Duplicate payment_intent_id: ${billingEvent.payment.id}`,
          });
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...webhookCorsHeaders },
          });
        }
      }

      // 11. Email-based lead matching (attribution fallback)
      if (!billingEvent.attribution?.affiliateCode && billingEvent.payment.customerEmail) {
        const attribution = await ctx.runQuery(internal.referralLeads.resolveLeadAttribution, {
          tenantId: tenant._id,
          email: billingEvent.payment.customerEmail,
        });
        if (attribution) {
          billingEvent.attribution = {
            affiliateCode: attribution.affiliateCode,
            clickId: attribution.clickId ?? undefined,
          };
        }
      }

      // Set tenantId on the billing event
      billingEvent.tenantId = tenant._id;

      // 12. Route to commission engine
      await ctx.runAction(internal.commissionEngine.routeBillingEvent, {
        webhookId: dedupResult.webhookId!,
        billingEvent,
        tenantId: tenant._id,
      });

      return new Response(JSON.stringify({ received: true, processed: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...webhookCorsHeaders },
      });
    } catch (error) {
      console.error("[Stripe Webhook] Error:", error);
      return new Response(JSON.stringify({ received: true, error: "Internal error" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...webhookCorsHeaders },
      });
    }
  }),
});

// OPTIONS handler for Stripe webhook CORS
http.route({
  path: "/api/webhooks/stripe",
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
        _affilio_tenant: user.tenantId,
      };

      if (affiliateCode) {
        metadata._affilio_ref = affiliateCode;
        // Optionally add a click ID for testing
        metadata._affilio_click_id = `click_mock_${Date.now()}`;
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
      apiCallsDirect.insert(ctx, { key: Date.now(), id: `api-${Date.now()}-${Math.random().toString(36).slice(2)}`, namespace: user.tenantId }).catch(() => {});

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

// =============================================================================
// Mock Stripe Webhook Trigger — POST /api/mock/stripe-webhook
// Local development endpoint for testing the Stripe webhook pipeline
// Mirrors existing POST /api/mock/trigger-payment pattern (billing provider agnostic)
// =============================================================================
http.route({
  path: "/api/mock/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      // Auth check
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return new Response(JSON.stringify({ received: true, success: false, error: "Authentication required" }), {
          status: 200, headers: { "Content-Type": "application/json", ...mockCorsHeaders },
        });
      }

      const body = await req.json();
      const { tenantId, eventType, amount, customerEmail, currency, paymentIntentId } = body;

      if (!tenantId || !eventType) {
        return new Response(JSON.stringify({ received: true, success: false, error: "tenantId and eventType required" }), {
          status: 200, headers: { "Content-Type": "application/json", ...mockCorsHeaders },
        });
      }

      // Validate tenant exists
      const tenant = await ctx.runQuery(internal.webhooks.validateTenantIdInternal, { tenantId });
      if (!tenant) {
        return new Response(JSON.stringify({ received: true, success: false, error: "Invalid tenant" }), {
          status: 200, headers: { "Content-Type": "application/json", ...mockCorsHeaders },
        });
      }

      // Construct mock Stripe event payload
      const mockStripeEvent: any = {
        id: `evt_mock_stripe_${Date.now()}`,
        object: "event",
        type: eventType,
        livemode: true,
        created: Math.floor(Date.now() / 1000),
        account: "acct_mock",
        data: {
          object: {
            id: paymentIntentId || `pi_mock_${Date.now()}`,
            amount: amount || 10000, // Default $100 in cents
            currency: currency || "usd",
            customer_details: {
              email: customerEmail || null,
            },
            customer_email: customerEmail || null,
            status: "succeeded",
          },
        },
      };

      // Add subscription fields for subscription events
      if (eventType.startsWith("customer.subscription")) {
        mockStripeEvent.data.object.subscription = {
          id: `sub_mock_${Date.now()}`,
          status: eventType === "customer.subscription.deleted" ? "canceled" : "active",
        };
      }

      // Normalize to BillingEvent
      const billingEvent = normalizeStripeToBillingEvent(mockStripeEvent);
      if (!billingEvent) {
        return new Response(JSON.stringify({ received: true, success: false, error: `Unhandled event type: ${eventType}` }), {
          status: 200, headers: { "Content-Type": "application/json", ...mockCorsHeaders },
        });
      }

      // Dedup
      const dedupResult = await ctx.runMutation(internal.webhooks.ensureEventNotProcessed, {
        source: "stripe_mock",
        eventId: mockStripeEvent.id,
        eventType: billingEvent.eventType,
        rawPayload: JSON.stringify(mockStripeEvent),
        signatureValid: true,
        tenantId: tenant._id,
      });

      if (dedupResult.isDuplicate) {
        return new Response(JSON.stringify({ received: true, success: true, duplicate: true }), {
          status: 200, headers: { "Content-Type": "application/json", ...mockCorsHeaders },
        });
      }

      // Email-based lead matching
      if (!billingEvent.attribution?.affiliateCode && billingEvent.payment.customerEmail) {
        const attribution = await ctx.runQuery(internal.referralLeads.resolveLeadAttribution, {
          tenantId: tenant._id,
          email: billingEvent.payment.customerEmail,
        });
        if (attribution) {
          billingEvent.attribution = {
            affiliateCode: attribution.affiliateCode,
            clickId: attribution.clickId ?? undefined,
          };
        }
      }

      billingEvent.tenantId = tenant._id;

      // Route to commission engine
      await ctx.runAction(internal.commissionEngine.routeBillingEvent, {
        webhookId: dedupResult.webhookId!,
        billingEvent,
        tenantId: tenant._id,
      });

      return new Response(JSON.stringify({
        received: true,
        success: true,
        eventId: mockStripeEvent.id,
        eventType: billingEvent.eventType,
        attributed: !!billingEvent.attribution?.affiliateCode,
        customerEmail: billingEvent.payment.customerEmail,
      }), {
        status: 200, headers: { "Content-Type": "application/json", ...mockCorsHeaders },
      });
    } catch (error) {
      console.error("[Mock Stripe Webhook] Error:", error);
      return new Response(JSON.stringify({ received: true, success: false, error: "Internal error" }), {
        status: 200, headers: { "Content-Type": "application/json", ...mockCorsHeaders },
      });
    }
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
        apiCallsDirect.insert(ctx, { key: Date.now(), id: `api-${Date.now()}-${Math.random().toString(36).slice(2)}`, namespace: result.tenantId }).catch(() => {});
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

      // Rate limiting: Per-referral-code + per-IP global cap (Task 10)
      // F12: Validate referral code format to prevent table pollution from arbitrary codes
      const isValidCode = /^[a-zA-Z0-9_-]{1,50}$/.test(code);
      const codeRateLimitKey = isValidCode
        ? buildRateLimitKey("click", code)
        : buildRateLimitKey("click", "invalid");
      const codeStatus = await ctx.runQuery(internal.rateLimits.getRateLimitStatus, {
        key: codeRateLimitKey, limit: ENDPOINT_CONFIGS.click.limit,
      });
      if (codeStatus.remaining <= 0) {
        // Silently return tracking pixel — don't reveal rate limit
        return new Response("ok", {
          status: 200,
          headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
        });
      }
      const globalIpKey = buildRateLimitKey("click:global", clientIp);
      const globalIpStatus = await ctx.runQuery(internal.rateLimits.getRateLimitStatus, {
        key: globalIpKey, limit: ENDPOINT_CONFIGS["click:global"].limit,
      });
      if (globalIpStatus.remaining <= 0) {
        return new Response("ok", {
          status: 200,
          headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
        });
      }

      // Increment rate limit counters (fire-and-forget, after rate check passed)
      ctx.runMutation(internal.rateLimits.incrementRateLimit, {
        key: codeRateLimitKey, windowDurationMs: ENDPOINT_CONFIGS.click.windowDurationMs,
      }).catch(() => {});
      ctx.runMutation(internal.rateLimits.incrementRateLimit, {
        key: globalIpKey, windowDurationMs: ENDPOINT_CONFIGS["click:global"].windowDurationMs,
      }).catch(() => {});

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

      // Get tenant for destination URL and domain
      const tenant = await ctx.runQuery(internal.clicks.getTenantByIdInternal, {
        tenantId,
      });

      // Default redirect URL using tenant.domain
      const redirectUrl = tenant?.domain
        ? `https://${tenant.domain}`
        : "https://app.saligaffiliate.com";

      // AC1, AC2: Generate dedupeKey for click deduplication
      // Format: SHA-256 hash of IP + code + hourly time window
      const timeWindow = Math.floor(Date.now() / (1000 * 60 * 60)); // Hourly bucket
      const dedupeKey = `${clientIp}:${effectiveCode}:${timeWindow}`;

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

      // AWAIT click recording to ensure clickId exists for response
      // This is required for track.js to get the clickId in the JSON response
      let clickId: Id<"clicks"> | null = null;
      try {
        const result: { clickId: Id<"clicks">; isNew: boolean } = await ctx.runMutation(internal.clicks.trackClickInternal, {
          tenantId,
          referralLinkId: referralLink._id,
          affiliateId: referralLink.affiliateId,
          campaignId: referralLink.campaignId,
          ipAddress: clientIp,
          userAgent,
          referrer,
          dedupeKey,
        });
        clickId = result.clickId;
      } catch (error) {
        // Log error but continue - click might be a duplicate
        console.error("Click tracking error:", error);
      }

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
      apiCallsDirect.insert(ctx, { key: Date.now(), id: `api-${Date.now()}-${Math.random().toString(36).slice(2)}`, namespace: tenantId }).catch(() => {});

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

      // Determine response type based on Accept header
      // track.js sends Accept: application/json
      // Browsers send Accept: text/html
      const acceptHeader = req.headers.get("Accept") || "";
      const wantsJson = acceptHeader.includes("application/json");

      // Build attribution data for JSON response
      const attributionData = {
        affiliateCode: effectiveCode,
        clickId: clickId,
        tenantId: tenantId,
        campaignId: referralLink.campaignId,
        cookieDuration: cookieDurationDays,
      };

      if (wantsJson) {
        // Return JSON response for track.js
        return new Response(
          JSON.stringify({
            success: true,
            attributionData,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              "Access-Control-Allow-Origin": "*", // CORS for cross-origin track.js calls
              "Access-Control-Allow-Methods": "GET, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Accept",
              "X-Click-Tracked": "true",
              "X-Attribution-Source": attributionSource,
              "X-Response-Time": `${duration}ms`,
            },
          }
        );
      } else {
        // Return 302 redirect for browser navigation (backwards compatibility)
        return new Response(null, {
          status: 302,
          headers: {
            "Location": redirectUrl,
            "Cache-Control": "no-store",
            "X-Click-Tracked": "true",
            "X-Attribution-Source": attributionSource,
            "X-Response-Time": `${duration}ms`,
          },
        });
      }

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

// =============================================================================
// Referral Tracking Endpoint — POST /track/referral
// Called by Affilio.referral({email}) from merchant's signup form
// Creates/updates a referralLeads record linking customer email to affiliate
// =============================================================================
http.route({
  path: "/track/referral",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      // Parse body
      let body: {
        tenantId?: string;
        email?: string;
        uid?: string;
        affiliateCode?: string;
        publicKey?: string;
      };
      try {
        body = await req.json();
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid JSON body" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { email, uid, affiliateCode, publicKey } = body;

      // Validate email — always return 200 to not break merchant's signup
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid or missing email" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Resolve tenant — by publicKey (from X-Tracking-Key header or body) or tenantId
      let tenantId: Id<"tenants"> | null = null;
      const trackingKey = req.headers.get("X-Tracking-Key") || publicKey;

      if (trackingKey) {
        const tenant = await ctx.runQuery(internal.conversions.getTenantByTrackingKeyInternal, {
          trackingKey,
        });
        if (tenant) {
          tenantId = tenant._id;
        }
      }

      if (!tenantId && body.tenantId) {
        tenantId = body.tenantId as Id<"tenants">;
      }

      if (!tenantId) {
        return new Response(
          JSON.stringify({ success: false, error: "Could not resolve tenant" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Resolve affiliate code — from body, or from _affilio cookie
      let effectiveCode = affiliateCode || null;

      if (!effectiveCode) {
        // Try to read _affilio cookie (Base64-encoded JSON with {code, clickId, tenantId, timestamp})
        const cookieHeader = req.headers.get("Cookie") || "";
        const affilioCookie = cookieHeader
          .split(";")
          .map(c => c.trim())
          .find(c => c.startsWith("_affilio="));

        if (affilioCookie) {
          try {
            const cookieValue = affilioCookie.split("=")[1];
            const decoded = JSON.parse(atob(decodeURIComponent(cookieValue)));
            effectiveCode = decoded.code || null;
          } catch {
            // Invalid cookie, ignore
          }
        }
      }

      if (!effectiveCode) {
        // No affiliate attribution — could still be useful for future uid matching
        // but without affiliateId we can't create a lead. Return success to not break signup.
        return new Response(
          JSON.stringify({ success: true, leadId: null, message: "No affiliate attribution found" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Validate affiliate is active
      const affiliateValidation = await ctx.runQuery(internal.clicks.validateAffiliateCodeInternal, {
        tenantId,
        code: effectiveCode,
      });

      if (!affiliateValidation.valid || !affiliateValidation.affiliateId) {
        return new Response(
          JSON.stringify({ success: true, leadId: null, message: "Affiliate not active" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Get referral link to extract referralLinkId and campaignId
      const referralLink = await ctx.runQuery(internal.clicks.getReferralLinkByCodeInternal, {
        tenantId,
        code: effectiveCode,
      });

      if (!referralLink) {
        return new Response(
          JSON.stringify({ success: true, leadId: null, message: "Referral link not found" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Create or update lead (upsert semantics)
      const result = await ctx.runMutation(internal.referralLeads.createOrUpdateLead, {
        tenantId,
        email: email.toLowerCase().trim(),
        uid,
        affiliateId: affiliateValidation.affiliateId,
        referralLinkId: referralLink._id,
        campaignId: referralLink.campaignId ?? undefined,
      });

      return new Response(
        JSON.stringify({ success: true, leadId: result.leadId, isNew: result.isNew }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (error) {
      console.error("[/track/referral] Error:", error);
      // Always return 200 to not break merchant's signup flow
      return new Response(
        JSON.stringify({ success: false, error: "Internal error" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// OPTIONS handler for referral tracking
http.route({
  path: "/track/referral",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _req) => {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }),
});

// =============================================================================
// Referral Health Ping — POST /api/tracking/referral-ping
// Called by track.js when Affilio.referral() is invoked
// Mirrors existing tracking ping but distinguished by pingType: "referral"
// =============================================================================
http.route({
  path: "/api/tracking/referral-ping",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const body = await req.json();
      const { publicKey, domain, userAgent, email } = body;

      if (!publicKey || !domain) {
        return new Response(
          JSON.stringify({ success: false, message: "Missing required fields" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Sanitize domain
      const sanitizedDomain = domain
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
        .replace(/[^a-z0-9.-]/g, '');

      // Record referral ping in referralPings table
      const tenant = await ctx.runQuery(internal.conversions.getTenantByTrackingKeyInternal, {
        trackingKey: publicKey,
      });

      if (tenant) {
        // Get client IP
        const forwardedFor = req.headers.get("X-Forwarded-For");
        const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : undefined;

        await ctx.runMutation(internal.tracking.recordReferralPingInternal, {
          tenantId: tenant._id,
          trackingKey: publicKey,
          domain: sanitizedDomain,
          userAgent,
          ipAddress: clientIp,
          email: email || undefined,
        });

        // Track API call
        apiCallsDirect.insert(ctx, { key: Date.now(), id: `api-${Date.now()}-${Math.random().toString(36).slice(2)}`, namespace: tenant._id }).catch(() => {});
      }

      return new Response(
        JSON.stringify({ success: true, message: "Referral ping recorded" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (error) {
      console.error("[/api/tracking/referral-ping] Error:", error);
      return new Response(
        JSON.stringify({ success: false, message: "Internal error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

// =============================================================================
// Stripe Connect OAuth Routes
// =============================================================================

/**
 * Generate a signed state parameter for CSRF protection.
 * Format: base64url(HMAC-SHA256(tenantId, secret) + "." + tenantId)
 * Uses Web Crypto API (globalThis.crypto.subtle) — no Node.js require needed.
 */
async function generateOAuthState(tenantId: string): Promise<string> {
  const secret = process.env.BETTER_AUTH_SECRET || "fallback-secret";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(tenantId));
  const hmac = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
  return Buffer.from(`${hmac}.${tenantId}`).toString("base64url");
}

/**
 * Verify and extract tenant ID from OAuth state parameter.
 * Returns null if state is invalid or tampered.
 */
async function verifyOAuthState(state: string): Promise<string | null> {
  try {
    const secret = process.env.BETTER_AUTH_SECRET || "fallback-secret";
    const encoder = new TextEncoder();
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    const [hmac, tenantId] = decoded.split(".", 2);
    if (!hmac || !tenantId) return null;

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(tenantId));
    const expectedHmac = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);
    if (hmac !== expectedHmac) return null;

    return tenantId;
  } catch {
    return null;
  }
}

// GET /api/stripe/connect — Initiate Stripe Connect OAuth
http.route({
  path: "/api/stripe/connect",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenantId");
    const redirectTo = url.searchParams.get("redirect") || "/onboarding";

    if (!tenantId) {
      return new Response("Missing tenantId parameter", { status: 400 });
    }

    const clientId = process.env.STRIPE_CLIENT_ID;
    if (!clientId) {
      console.error("[Stripe Connect] STRIPE_CLIENT_ID not configured");
      return new Response(
        JSON.stringify({ error: "Stripe Connect is not configured. Set STRIPE_CLIENT_ID environment variable." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify the tenant exists
    const tenant = await ctx.runQuery(internal.tenants.getTenantInternal, {
      tenantId: tenantId as any,
    });
    if (!tenant) {
      return new Response("Tenant not found", { status: 404 });
    }

    // Generate CSRF-protected state
    const state = await generateOAuthState(tenantId);

    // Build Stripe OAuth URL
    const siteUrl = process.env.SITE_URL || "http://localhost:3000";
    const stripeAuthUrl = new URL("https://connect.stripe.com/oauth/authorize");
    stripeAuthUrl.searchParams.set("response_type", "code");
    stripeAuthUrl.searchParams.set("client_id", clientId);
    stripeAuthUrl.searchParams.set("scope", "read_write");
    stripeAuthUrl.searchParams.set("state", state);

    // Redirect to Stripe
    return Response.redirect(stripeAuthUrl.toString(), 302);
  }),
});

// GET /api/stripe/callback — Handle Stripe OAuth callback
http.route({
  path: "/api/stripe/callback",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Handle Stripe error (e.g., user denied access)
    if (error) {
      const errorDesc = url.searchParams.get("error_description") || error;
      console.error("[Stripe Connect] OAuth error:", error, errorDesc);
      const siteUrl = process.env.SITE_URL || "http://localhost:3000";
      return Response.redirect(`${siteUrl}/settings/integrations?stripe_error=${encodeURIComponent(errorDesc)}`, 302);
    }

    if (!code || !state) {
      return new Response("Missing code or state parameter", { status: 400 });
    }

    // Verify state and extract tenant ID
    const tenantId = await verifyOAuthState(state);
    if (!tenantId) {
      console.error("[Stripe Connect] Invalid or tampered state parameter");
      const siteUrl = process.env.SITE_URL || "http://localhost:3000";
      return Response.redirect(`${siteUrl}/settings/integrations?stripe_error=${encodeURIComponent("Invalid OAuth state. Please try again.")}`, 302);
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      console.error("[Stripe Connect] STRIPE_SECRET_KEY not configured");
      const siteUrl = process.env.SITE_URL || "http://localhost:3000";
      return Response.redirect(`${siteUrl}/settings/integrations?stripe_error=${encodeURIComponent("Stripe Connect is not configured. Set STRIPE_SECRET_KEY environment variable.")}`, 302);
    }

    try {
      // Exchange authorization code for access token
      const tokenResponse = await fetch("https://connect.stripe.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: process.env.STRIPE_CLIENT_ID || "",
          code,
        }),
      });

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        console.error("[Stripe Connect] Token exchange failed:", tokenResponse.status, errorBody);
        const siteUrl = process.env.SITE_URL || "http://localhost:3000";
        return Response.redirect(`${siteUrl}/settings/integrations?stripe_error=${encodeURIComponent("Failed to connect Stripe. Please try again.")}`, 302);
      }

      const tokenData = await tokenResponse.json();

      if (!tokenData.stripe_user_id || !tokenData.access_token) {
        console.error("[Stripe Connect] Invalid token response:", tokenData);
        const siteUrl = process.env.SITE_URL || "http://localhost:3000";
        return Response.redirect(`${siteUrl}/settings/integrations?stripe_error=${encodeURIComponent("Invalid response from Stripe. Please try again.")}`, 302);
      }

      // Store OAuth credentials
      await ctx.runMutation(internal.tenants.completeStripeOAuth, {
        tenantId: tenantId as any,
        stripeAccountId: tokenData.stripe_user_id,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || "",
        livemode: tokenData.livemode === true,
      });

      console.log(`[Stripe Connect] Successfully connected account ${tokenData.stripe_user_id} for tenant ${tenantId} (livemode: ${tokenData.livemode})`);

      // Redirect to settings with success flag
      const siteUrl = process.env.SITE_URL || "http://localhost:3000";
      return Response.redirect(`${siteUrl}/settings/integrations?stripe_connected=true`, 302);
    } catch (err: any) {
      console.error("[Stripe Connect] Unexpected error during callback:", err);
      const siteUrl = process.env.SITE_URL || "http://localhost:3000";
      return Response.redirect(`${siteUrl}/settings/integrations?stripe_error=${encodeURIComponent("An unexpected error occurred. Please try again.")}`, 302);
    }
  }),
});

// POST /api/stripe/deauthorize — Deauthorize a Stripe Connect account
http.route({
  path: "/api/stripe/deauthorize",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const { tenantId } = await req.json();

      if (!tenantId) {
        return new Response(JSON.stringify({ error: "Missing tenantId" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get tenant's Stripe credentials
      const tenant = await ctx.runQuery(internal.tenants.getTenantInternal, {
        tenantId: tenantId as any,
      });

      if (!tenant?.stripeCredentials?.accessToken) {
        return new Response(JSON.stringify({ error: "No Stripe connection found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const secretKey = process.env.STRIPE_SECRET_KEY;
      const clientId = process.env.STRIPE_CLIENT_ID;

      if (!secretKey || !clientId) {
        console.error("[Stripe Connect] STRIPE_SECRET_KEY or STRIPE_CLIENT_ID not configured");
        return new Response(JSON.stringify({ error: "Stripe Connect not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Deauthorize via Stripe API
      const deauthResponse = await fetch("https://connect.stripe.com/oauth/deauthorize", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          stripe_user_id: tenant.stripeAccountId || "",
        }),
      });

      if (!deauthResponse.ok) {
        const errorBody = await deauthResponse.text();
        console.error("[Stripe Connect] Deauthorize failed:", deauthResponse.status, errorBody);
        // Still clear local credentials even if deauthorize API call fails
      }

      // Clear local credentials
      await ctx.runMutation(internal.tenants.clearStripeCredentialsInternal, {
        tenantId: tenantId as any,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("[Stripe Connect] Deauthorize error:", err);
      return new Response(JSON.stringify({ error: "Failed to disconnect Stripe" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// POST /api/client-error — Log client-side errors from the frontend app
http.route({
  path: "/api/client-error",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const body = await req.json();
      const { severity, source, message, stackTrace, metadata } = body;

      if (!severity || !source || !message) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const errorLogId = await ctx.runMutation(internal.errorLogs.logError, {
        severity,
        source,
        message,
        stackTrace,
        metadata,
      });

      return new Response(JSON.stringify({ success: true, errorLogId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("[Client Error] Failed to log error:", err);
      return new Response(JSON.stringify({ error: "Failed to log error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

export default http;
