/**
 * DNS Domain Verification Action
 *
 * Extracted from tenants.ts because actions require "use node" (Node.js runtime)
 * while tenants.ts contains mutations/queries (V8 runtime).
 *
 * NOTE: This action is non-transactional. If it fails midway (e.g., writes audit log
 * then fails on fetch), the audit log persists but no verification result is recorded.
 * This is acceptable because audit logs are append-only.
 */

"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { betterAuthComponent } from "./auth";
import { hasPermission } from "./permissions";
import type { Role } from "./permissions";
import { buildRateLimitKey, ENDPOINT_CONFIGS, RateLimitError } from "./lib/rateLimiter";
import { SERVICE_IDS, DEFAULT_CIRCUIT_BREAKER_CONFIG } from "./lib/circuitBreaker";
import { withCircuitBreaker } from "./lib/circuitBreaker";

const PLATFORM_DOMAIN = "app.saligaffiliate.com";

export const verifyDomainDns = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    verified: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    // Auth via Better Auth component (action context — no direct ctx.db)
    const betterAuthUser = await betterAuthComponent.getAuthUser(ctx);
    if (!betterAuthUser) {
      throw new Error("Unauthorized: Authentication required");
    }

    // Look up app user for tenant/role info
    type AppUser = { _id: Id<"users">; email: string; role: string; tenantId: Id<"tenants"> };
    const appUser: AppUser | null = await ctx.runQuery(internal.users._getUserByEmailInternal, {
      email: betterAuthUser.email,
    });

    if (!appUser) {
      throw new Error("Unauthorized: User not found");
    }

    // Check permission - require settings:* or manage:* permission
    const role = appUser.role as Role;
    if (!hasPermission(role, "settings:*") && !hasPermission(role, "settings:manage") && !hasPermission(role, "manage:*")) {
      throw new Error("Access denied: You require 'settings:manage' permission to verify domain DNS");
    }

    const tenant = await ctx.runQuery(internal.tenants._getTenantById, { tenantId: appUser.tenantId });
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    const customDomain = tenant.branding?.customDomain;
    if (!customDomain) {
      throw new Error("No custom domain configured");
    }

    // Rate limiting: Check using new rate limiter module (Task 13)
    const dnsRateLimitKey = buildRateLimitKey("dns", appUser.tenantId as string);
    const dnsStatus = await ctx.runQuery(internal.rateLimits.getRateLimitStatus, {
      key: dnsRateLimitKey,
      limit: ENDPOINT_CONFIGS.dns.limit,
    });
    if (dnsStatus.remaining <= 0) {
      throw new Error("Rate limit exceeded. Please wait before trying again.");
    }

    // Log the verification attempt for rate limiting
    await ctx.runMutation(internal.tenants._logDnsVerificationAttempt, {
      tenantId: appUser.tenantId,
      userId: appUser._id,
      customDomain,
    });

    // Increment rate limit counter (F16 fix)
    await ctx.runMutation(internal.rateLimits.incrementRateLimit, {
      key: dnsRateLimitKey,
      windowDurationMs: ENDPOINT_CONFIGS.dns.windowDurationMs,
    });

    const platformDomain = PLATFORM_DOMAIN;

    // Circuit breaker wrapper for DNS API call (Task 13)
    const fallback = { success: false, verified: false, message: "DNS verification temporarily unavailable" } as const;

    // withCircuitBreaker handles its own errors — in closed state it re-throws
    const dnsResult = await withCircuitBreaker(
      ctx,
      {
        getServiceState: internal.circuitBreakers.getServiceState as any,
        recordFailure: internal.circuitBreakers.recordFailure as any,
        recordSuccess: internal.circuitBreakers.recordSuccess as any,
        tryAcquireProbe: internal.circuitBreakers.tryAcquireProbe as any,
        forceHalfOpen: internal.circuitBreakers.forceHalfOpen as any,
      },
      SERVICE_IDS.DNS_GOOGLE,
      async () => {
        // Use DNS over HTTPS (Google DNS API) to check CNAME record
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(
          `https://dns.google/resolve?name=${encodeURIComponent(customDomain)}&type=CNAME`,
          {
            method: "GET",
            headers: {
              "Accept": "application/dns-json",
            },
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`DNS lookup failed with status: ${response.status}`);
        }

        const data = await response.json();
        return data;
      },
      fallback,
      DEFAULT_CIRCUIT_BREAKER_CONFIG,
    );

    // Check if circuit breaker returned fallback (DNS service unavailable)
    if (!dnsResult.ok) {
      return { success: false, verified: false, message: "DNS verification temporarily unavailable" };
    }

    // dnsResult.data is the Google DNS API response
    const dnsData: any = dnsResult.data;

    // Check if CNAME record exists and points to the correct domain
    const cnameRecord = dnsData.Answer?.find((record: { type: number; data: string }) => record.type === 5); // Type 5 = CNAME

    if (cnameRecord && cnameRecord.data.endsWith(platformDomain + ".")) {
      // DNS verified - update status via mutation
      await ctx.runMutation(internal.tenants._updateDnsVerificationStatus, {
        tenantId: appUser.tenantId,
        userId: appUser._id,
        customDomain,
      });

      return {
        success: true,
        verified: true,
        message: "DNS configuration verified successfully. Your domain is pointing to the correct location.",
      };
    } else {
      return {
        success: true,
        verified: false,
        message: `DNS verification failed. Expected CNAME record pointing to '${platformDomain}'. Please check your DNS configuration.`,
      };
    }
  },
});
