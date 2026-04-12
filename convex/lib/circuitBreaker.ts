/**
 * Circuit Breaker Helper — Action-level wrapper for external service calls.
 *
 * Designed for use in `action` and `httpAction` context only (not queries/mutations).
 * Uses the circuitBreakers table (per-service docs) for state persistence.
 *
 * F8 TOCTOU caveat: Between the query (read state) and the external call, another action
 * may have changed state. The worst case is extra failures being recorded — acceptable
 * because the threshold has margin and no data corruption occurs.
 */

import type { FunctionReference } from "convex/server";
import type { ActionCtx } from "../_generated/server";

export interface CircuitBreakerConfig {
  failureThreshold?: number; // Default: 5
  resetTimeoutMs?: number;   // Default: 60000 (1 min)
  maxOpenDurationMs?: number; // Default: 1800000 (30 min)
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  maxOpenDurationMs: 1800000,
};

/** Max time a probe can run before being considered stuck (2 minutes) */
const PROBING_TIMEOUT_MS = 120_000;

/** Known external service IDs */
export const SERVICE_IDS = {
  POSTMARK: "postmark",
  RESEND: "resend",
  DNS_GOOGLE: "dns-google",
  STRIPE: "stripe",
} as const;

export type ServiceId = (typeof SERVICE_IDS)[keyof typeof SERVICE_IDS] | string;

type CircuitBreakerState = "closed" | "open" | "half-open" | "probing";

interface CircuitBreakerDoc {
  _id: string;
  _creationTime: number;
  serviceId: string;
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureAt?: number;
  lastSuccessAt?: number;
  openedAt?: number;
  lastProbeAt?: number;
  config: {
    failureThreshold?: number;
    resetTimeoutMs?: number;
    maxOpenDurationMs?: number;
  };
}

type GetServiceStateRef = FunctionReference<"query", "internal", { serviceId: string }, CircuitBreakerDoc | null>;
type RecordFailureRef = FunctionReference<"mutation", "internal", { serviceId: string; config?: CircuitBreakerConfig }, void>;
type RecordSuccessRef = FunctionReference<"mutation", "internal", { serviceId: string }, void>;
type TryAcquireProbeRef = FunctionReference<"mutation", "internal", { serviceId: string }, boolean>;
type ForceHalfOpenRef = FunctionReference<"mutation", "internal", { serviceId: string }, void>;

interface CircuitBreakerInternalRefs {
  getServiceState: GetServiceStateRef;
  recordFailure: RecordFailureRef;
  recordSuccess: RecordSuccessRef;
  tryAcquireProbe: TryAcquireProbeRef;
  forceHalfOpen: ForceHalfOpenRef;
}

/**
 * Wrap an external service call with circuit breaker logic.
 *
 * @param ctx - Action execution context
 * @param serviceId - Service identifier (e.g., "postmark", "dns-google")
 * @param fn - The function to call (external service)
 * @param fallback - Value to return when circuit is open or call fails
 * @param config - Optional per-call overrides for circuit breaker thresholds
 * @returns Discriminated union: `{ ok: true, data: T }` on success, `{ ok: false, fallback: T }` when circuit is open
 */
export async function withCircuitBreaker<T>(
  ctx: ActionCtx,
  internalRefs: CircuitBreakerInternalRefs,
  serviceId: string,
  fn: () => Promise<T>,
  fallback: T,
  config?: CircuitBreakerConfig,
): Promise<{ ok: true; data: T } | { ok: false; fallback: T }> {
  const mergedConfig = {
    ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
    ...config,
  };

  // Read current state
  const state = await ctx.runQuery(internalRefs.getServiceState, { serviceId });

  if (state) {
    const now = Date.now();

    if (state.state === "open") {
      // Check if reset timeout has elapsed → transition to half-open
      const openedAt = state.openedAt ?? state.lastFailureAt ?? now;
      const timeSinceOpen = now - openedAt;

      if (timeSinceOpen >= mergedConfig.resetTimeoutMs) {
        await ctx.runMutation(internalRefs.forceHalfOpen, { serviceId });
        // Re-read state after transition
        const updated = await ctx.runQuery(internalRefs.getServiceState, { serviceId });
        if (!updated || updated.state === "open") {
          // Max open duration check — force half-open if stuck
          const maxElapsed = now - openedAt;
          if (maxElapsed >= mergedConfig.maxOpenDurationMs) {
            await ctx.runMutation(internalRefs.forceHalfOpen, { serviceId });
          } else {
            return { ok: false, fallback };
          }
        }
        // Fall through to half-open handling below
      } else {
        // Still within reset timeout — check max-open-duration override
        const openedAtTime = state.openedAt ?? state.lastFailureAt ?? now;
        if (now - openedAtTime >= mergedConfig.maxOpenDurationMs) {
          await ctx.runMutation(internalRefs.forceHalfOpen, { serviceId });
        } else {
          return { ok: false, fallback };
        }
      }
    }

    if (state.state === "probing") {
      // F9 fix: If probe has been running too long, force back to half-open
      const probeElapsed = state.lastProbeAt ? (now - state.lastProbeAt) : 0;
      if (probeElapsed > PROBING_TIMEOUT_MS) {
        await ctx.runMutation(internalRefs.forceHalfOpen, { serviceId });
        // Fall through to half-open handling
      } else {
        return { ok: false, fallback }; // Another probe is running (recently acquired)
      }
    }

    if (state.state === "half-open" || state.state === "probing") {
      // Try to acquire the probe slot (only one concurrent probe allowed)
      const acquired = await ctx.runMutation(internalRefs.tryAcquireProbe, { serviceId });
      if (!acquired) {
        return { ok: false, fallback }; // Another probe is already running
      }

      // This caller acquired the probe — run fn
      try {
        const result = await fn();
        await ctx.runMutation(internalRefs.recordSuccess, { serviceId });
        return { ok: true, data: result };
      } catch (error) {
        await ctx.runMutation(internalRefs.recordFailure, { serviceId, config });
        return { ok: false, fallback };
      }
    }
  }

  // State is "closed" (or no state doc yet — first call)
  try {
    const result = await fn();
    await ctx.runMutation(internalRefs.recordSuccess, { serviceId });
    return { ok: true, data: result };
  } catch (error) {
    await ctx.runMutation(internalRefs.recordFailure, { serviceId, config });
    // F5 fix: In closed state, re-throw so caller can handle the error.
    // Only return fallback when circuit is explicitly open/half-open.
    throw error;
  }
}
