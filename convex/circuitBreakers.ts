/**
 * Circuit Breaker — Convex mutations and queries for circuit breaker state management.
 *
 * All mutations are idempotent — no read-then-act across action/mutation boundary.
 * Each state change writes to auditLogs with action "CIRCUIT_BREAKER_STATE_CHANGE".
 *
 * Default config: failureThreshold=5, resetTimeoutMs=60000, maxOpenDurationMs=1800000
 */

import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_RESET_TIMEOUT_MS = 60_000; // 1 minute
const DEFAULT_MAX_OPEN_DURATION_MS = 1_800_000; // 30 minutes

type CircuitBreakerState = "closed" | "open" | "half-open" | "probing";

/**
 * Get the current circuit breaker state for a service.
 * Returns null for unknown services (no state doc yet).
 */
export const getServiceState = internalQuery({
  args: { serviceId: v.string() },
  returns: v.union(
    v.object({
      _id: v.string(),
      _creationTime: v.number(),
      serviceId: v.string(),
      state: v.union(
        v.literal("closed"),
        v.literal("open"),
        v.literal("half-open"),
        v.literal("probing"),
      ),
      failureCount: v.number(),
      lastFailureAt: v.optional(v.number()),
      lastSuccessAt: v.optional(v.number()),
      openedAt: v.optional(v.number()),
      lastProbeAt: v.optional(v.number()),
      config: v.object({
        failureThreshold: v.optional(v.number()),
        resetTimeoutMs: v.optional(v.number()),
        maxOpenDurationMs: v.optional(v.number()),
      }),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("circuitBreakers")
      .withIndex("by_serviceId", (q) => q.eq("serviceId", args.serviceId))
      .first();
    return doc ?? null;
  },
});

/**
 * Record a failure for a service.
 * Atomically increments failure count and checks threshold.
 * Transitions to "open" if threshold is exceeded.
 * Writes auditLog on state change.
 */
export const recordFailure = internalMutation({
  args: {
    serviceId: v.string(),
    config: v.optional(v.object({
      failureThreshold: v.optional(v.number()),
      resetTimeoutMs: v.optional(v.number()),
      maxOpenDurationMs: v.optional(v.number()),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const threshold = args.config?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;

    const existing = await ctx.db
      .query("circuitBreakers")
      .withIndex("by_serviceId", (q) => q.eq("serviceId", args.serviceId))
      .first();

    const now = Date.now();

    if (existing) {
      const newCount = existing.failureCount + 1;
      const oldState: CircuitBreakerState = existing.state;

      if (oldState === "open") {
        // Already open — just update timestamp, don't change state
        await ctx.db.patch(existing._id, {
          failureCount: newCount,
          lastFailureAt: now,
        });
        return null;
      }

      if (newCount >= threshold) {
        // Trip the breaker
        await ctx.db.patch(existing._id, {
          failureCount: newCount,
          lastFailureAt: now,
          state: "open",
          openedAt: now,
        });

        // Write audit log for state change
        await ctx.db.insert("auditLogs", {
          tenantId: undefined as any, // Circuit breakers are per-service, not per-tenant
          action: "CIRCUIT_BREAKER_STATE_CHANGE",
          entityType: "circuitBreaker",
          entityId: existing._id,
          actorType: "system",
          newValue: {
            serviceId: args.serviceId,
            oldState,
            newState: "open",
            failureCount: newCount,
            threshold,
            reason: `Failure threshold reached (${newCount}/${threshold})`,
          },
        });
      } else {
        await ctx.db.patch(existing._id, {
          failureCount: newCount,
          lastFailureAt: now,
        });
      }
    } else {
      // First failure — create state doc
      await ctx.db.insert("circuitBreakers", {
        serviceId: args.serviceId,
        state: "closed",
        failureCount: 1,
        lastFailureAt: now,
        config: {
          failureThreshold: args.config?.failureThreshold,
          resetTimeoutMs: args.config?.resetTimeoutMs,
          maxOpenDurationMs: args.config?.maxOpenDurationMs,
        },
      });
    }

    return null;
  },
});

/**
 * Record a success for a service.
 * Resets failure count and transitions to "closed".
 * Writes auditLog on state change.
 */
export const recordSuccess = internalMutation({
  args: { serviceId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("circuitBreakers")
      .withIndex("by_serviceId", (q) => q.eq("serviceId", args.serviceId))
      .first();

    const now = Date.now();

    if (existing) {
      const oldState: CircuitBreakerState = existing.state;

      if (oldState !== "closed") {
        // State change — write audit log
        await ctx.db.insert("auditLogs", {
          tenantId: undefined as any,
          action: "CIRCUIT_BREAKER_STATE_CHANGE",
          entityType: "circuitBreaker",
          entityId: existing._id,
          actorType: "system",
          newValue: {
            serviceId: args.serviceId,
            oldState,
            newState: "closed",
            reason: "Service call succeeded",
          },
        });
      }

      await ctx.db.patch(existing._id, {
        state: "closed",
        failureCount: 0,
        lastSuccessAt: now,
        openedAt: undefined, // Clear open timestamp
        lastProbeAt: undefined, // Clear probe timestamp
      });
    } else {
      // No state doc yet — create with closed state
      await ctx.db.insert("circuitBreakers", {
        serviceId: args.serviceId,
        state: "closed",
        failureCount: 0,
        lastSuccessAt: now,
        config: {},
      });
    }

    return null;
  },
});

/**
 * Try to acquire a probe slot for half-open state.
 * Atomically transitions "half-open" → "probing" for the first caller.
 * Returns true if probe was acquired, false if another caller already has it.
 */
export const tryAcquireProbe = internalMutation({
  args: { serviceId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("circuitBreakers")
      .withIndex("by_serviceId", (q) => q.eq("serviceId", args.serviceId))
      .first();

    if (!existing) return false;

    // Only allow probe acquisition from half-open or probing state
    if (existing.state === "probing") {
      return false; // Another probe is already running
    }

    if (existing.state === "half-open") {
      await ctx.db.patch(existing._id, {
        state: "probing",
        lastProbeAt: Date.now(),
      });

      await ctx.db.insert("auditLogs", {
        tenantId: "" as any,
        action: "CIRCUIT_BREAKER_STATE_CHANGE",
        entityType: "circuitBreaker",
        entityId: existing._id,
        actorType: "system",
        newValue: {
          serviceId: args.serviceId,
          oldState: "half-open",
          newState: "probing",
          reason: "Probe slot acquired",
        },
      });

      return true;
    }

    return false;
  },
});

/**
 * Force transition to half-open if state is "open" and maxOpenDurationMs has elapsed.
 * This prevents permanent Open state when Half-Open probes repeatedly fail.
 */
export const forceHalfOpen = internalMutation({
  args: { serviceId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("circuitBreakers")
      .withIndex("by_serviceId", (q) => q.eq("serviceId", args.serviceId))
      .first();

    if (!existing) return null;

    if (existing.state !== "open") return null;

    const now = Date.now();
    const openedAt = existing.openedAt ?? existing.lastFailureAt ?? now;
    const maxOpenDuration = existing.config.maxOpenDurationMs ?? DEFAULT_MAX_OPEN_DURATION_MS;

    if (now - openedAt >= maxOpenDuration) {
      await ctx.db.patch(existing._id, {
        state: "half-open",
      });

      await ctx.db.insert("auditLogs", {
        tenantId: "" as any,
        action: "CIRCUIT_BREAKER_STATE_CHANGE",
        entityType: "circuitBreaker",
        entityId: existing._id,
        actorType: "system",
        newValue: {
          serviceId: args.serviceId,
          oldState: "open",
          newState: "half-open",
          reason: `Max open duration (${maxOpenDuration}ms) exceeded`,
        },
      });
    }

    return null;
  },
});

/**
 * Reset a circuit breaker to closed state.
 * Admin-only escape hatch for when automatic recovery isn't fast enough.
 * MUST be called from an admin action that verifies platform admin role.
 */
export const resetCircuitBreaker = internalMutation({
  args: { serviceId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("circuitBreakers")
      .withIndex("by_serviceId", (q) => q.eq("serviceId", args.serviceId))
      .first();

    if (!existing) return null;

    const oldState: CircuitBreakerState = existing.state;

    await ctx.db.patch(existing._id, {
      state: "closed",
      failureCount: 0,
      openedAt: undefined,
      lastProbeAt: undefined,
    });

    await ctx.db.insert("auditLogs", {
      tenantId: "" as any,
      action: "CIRCUIT_BREAKER_STATE_CHANGE",
      entityType: "circuitBreaker",
      entityId: existing._id,
      actorType: "admin",
      newValue: {
        serviceId: args.serviceId,
        oldState,
        newState: "closed",
        reason: "Manual reset by platform admin",
      },
    });

    return null;
  },
});
