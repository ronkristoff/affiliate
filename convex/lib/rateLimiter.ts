/**
 * Rate Limiter Helper — Utilities for rate limit key construction and checking.
 *
 * Two paths:
 * - `checkRateLimit(ctx, key, config)` — single mutation call (simpler, for low-volume endpoints)
 * - `checkRateLimitQuery(ctx, key, config)` — query-only check (no write, for high-volume endpoints)
 *
 * For high-volume endpoints (clicks, conversions), use checkRateLimitQuery first,
 * then call incrementRateLimit separately after processing.
 */

import type { FunctionReference } from "convex/server";

export interface RateLimitConfig {
  limit: number;
  windowDurationMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingCount: number;
  resetsAt: number;
}

/** Predefined rate limit configs per endpoint */
export const ENDPOINT_CONFIGS: Record<string, RateLimitConfig> = {
  click: { limit: 100, windowDurationMs: 60_000 },          // 100/min per referral code
  "click:global": { limit: 200, windowDurationMs: 60_000 }, // 200/min per IP (global)
  conversion: { limit: 60, windowDurationMs: 60_000 },       // 60/min per tenant
  "conversion:global": { limit: 100, windowDurationMs: 60_000 }, // 100/min per IP
  coupon: { limit: 120, windowDurationMs: 60_000 },         // 120/min per tenant
  broadcast: { limit: 1, windowDurationMs: 300_000 },       // 1 per 5 min per tenant
  bulk: { limit: 50, windowDurationMs: 60_000 },            // 50/min per tenant
  export: { limit: 3, windowDurationMs: 60_000 },           // 3/min per tenant
  dns: { limit: 5, windowDurationMs: 60_000 },              // 5/min per tenant
  tracking: { limit: 120, windowDurationMs: 60_000 },       // 120/min per tenant (ping endpoint)
  "tracking:global": { limit: 300, windowDurationMs: 60_000 }, // 300/min per IP
  referral: { limit: 120, windowDurationMs: 60_000 },       // 120/min per tenant (referral tracking)
  "referral:global": { limit: 300, windowDurationMs: 60_000 }, // 300/min per IP
};

/**
 * Build a rate limit key from server-side values.
 * NEVER construct keys from client-provided values.
 */
export function buildRateLimitKey(endpoint: string, identifier: string): string {
  return `${endpoint}:${identifier}`;
}

/**
 * Extract client IP from a Convex HTTP Request object.
 * Uses x-forwarded-for header (set by Convex's deployment infrastructure).
 *
 * F10: This is the canonical IP extraction method for all rate limiting.
 */
export function extractIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (!forwarded || forwarded.trim() === "") return "unknown";
  return forwarded.split(",")[0]?.trim() ?? "unknown";
}

type CheckAndIncrementRef = FunctionReference<
  "mutation",
  "internal",
  { key: string; limit: number; windowDurationMs: number },
  { allowed: boolean; remainingCount: number; resetsAt: number }
>;

type GetRateLimitStatusRef = FunctionReference<
  "query",
  "internal",
  { key: string; limit: number },
  { count: number; windowStart: number; remaining: number; resetsAt: number }
>;

type IncrementRateLimitRef = FunctionReference<
  "mutation",
  "internal",
  { key: string; windowDurationMs: number; limit?: number },
  number
>;

/**
 * Check rate limit using a single mutation call (check + increment atomically).
 * For low-volume endpoints (broadcast, export, DNS).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkRateLimit(
  ctx: { runMutation: (ref: any, args: any) => Promise<any> },
  ref: CheckAndIncrementRef,
  key: string,
  config?: RateLimitConfig,
): Promise<RateLimitResult> {
  const effectiveConfig = config ?? { limit: 100, windowDurationMs: 60_000 };
  const result = await ctx.runMutation(ref, {
    key,
    limit: effectiveConfig.limit,
    windowDurationMs: effectiveConfig.windowDurationMs,
  });
  return result;
}

/**
 * Check rate limit using query only (no write).
 * For high-volume endpoints — caller must call incrementRateLimit separately.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkRateLimitQuery(
  ctx: { runQuery: (ref: any, args: any) => Promise<any> },
  ref: GetRateLimitStatusRef,
  key: string,
  config?: RateLimitConfig,
): Promise<RateLimitResult> {
  const effectiveConfig = config ?? { limit: 100, windowDurationMs: 60_000 };
  const result = await ctx.runQuery(ref, {
    key,
    limit: effectiveConfig.limit,
  });
  return {
    allowed: result.remaining > 0,
    remainingCount: result.remaining,
    resetsAt: result.resetsAt,
  };
}

/**
 * Rate limit exceeded error with HTTP 429 status.
 */
export class RateLimitError extends Error {
  public readonly statusCode = 429;
  public readonly key: string;
  public readonly resetsAt: number;

  constructor(key: string, resetsAt: number) {
    super(`Rate limit exceeded for key: ${key}`);
    this.name = "RateLimitError";
    this.key = key;
    this.resetsAt = resetsAt;
  }
}
