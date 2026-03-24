"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

/**
 * Tier configuration hooks for client-side usage.
 * Provides hooks for fetching tier limits and checking resource limits.
 */

/** Result type for tier config hooks */
export type TierConfigResult = {
  tier: string;
  price: number;
  maxAffiliates: number;
  maxCampaigns: number;
  maxTeamMembers: number;
  maxPayoutsPerMonth: number;
  maxApiCalls: number;
  features: {
    advancedAnalytics: boolean;
    prioritySupport: boolean;
  };
} | null;

/** Loading state type for hooks */
export type LoadingState = "loading" | "loaded" | "error";

/**
 * Hook to get tier configuration for a specific tenant.
 * Returns loading state and data for better UI handling.
 */
export function useTierConfig(tenantId: Id<"tenants"> | null): {
  data: TierConfigResult;
  state: LoadingState;
} {
  const result = useQuery(
    api.tierConfig.getTierConfig,
    tenantId ? { tenantId } : "skip"
  );

  if (result === undefined) {
    return { data: null, state: "loading" };
  }

  return { data: result ?? null, state: "loaded" };
}

/**
 * Hook to get tier configuration for the current authenticated user's tenant.
 */
export function useMyTierConfig(): {
  data: TierConfigResult;
  state: LoadingState;
} {
  const result = useQuery(api.tierConfig.getMyTierConfig, {});

  if (result === undefined) {
    return { data: null, state: "loading" };
  }

  return { data: result ?? null, state: "loaded" };
}

/**
 * Hook to check a specific resource limit for a tenant.
 */
export function useCheckLimit(
  tenantId: Id<"tenants"> | null,
  resourceType: "affiliates" | "campaigns" | "teamMembers" | "payouts" | "apiCalls"
) {
  const result = useQuery(
    api.tierConfig.checkLimit,
    tenantId && resourceType ? { tenantId, resourceType } : "skip"
  );

  if (!result) {
    return {
      status: "ok" as const,
      percentage: 0,
      current: 0,
      limit: 0,
      resourceType,
      upgradePrompt: false,
    };
  }

  return result;
}

/**
 * Hook to get all limits for a tenant.
 */
export function useAllLimits(tenantId: Id<"tenants"> | null) {
  const result = useQuery(
    api.tierConfig.getAllLimits,
    tenantId ? { tenantId } : "skip"
  );

  return result ?? null;
}

/**
 * Hook to check if a resource can be created.
 */
export function useCanCreateResource(
  tenantId: Id<"tenants"> | null,
  resourceType: "affiliates" | "campaigns" | "teamMembers" | "payouts" | "apiCalls"
) {
  const result = useQuery(
    api.tierConfig.canCreateResource,
    tenantId && resourceType ? { tenantId, resourceType } : "skip"
  );

  if (!result) {
    return { allowed: true, current: 0, limit: 0 };
  }

  return result;
}

/**
 * Hook to get the enforce limit mutation.
 * Call this before creating a resource to check and enforce tier limits.
 */
export function useEnforceLimit() {
  const enforceLimit = useMutation(api.tierConfig.enforceLimit);

  return async (
    tenantId: Id<"tenants">,
    resourceType: "affiliates" | "campaigns" | "teamMembers" | "payouts" | "apiCalls"
  ) => {
    return enforceLimit({ tenantId, resourceType });
  };
}

/**
 * Hook to get all available tier configurations (for pricing pages, etc).
 */
export function useAllTierConfigs() {
  const result = useQuery(api.tierConfig.getAllTierConfigs, {});

  return result ?? [];
}

/**
 * Check if approaching limit (80%+).
 */
export function isApproachingLimit(
  status: "ok" | "warning" | "critical" | "blocked"
): boolean {
  return status === "warning" || status === "critical" || status === "blocked";
}

/**
 * Check if at critical limit (95%+).
 */
export function isAtCriticalLimit(
  status: "ok" | "warning" | "critical" | "blocked"
): boolean {
  return status === "critical" || status === "blocked";
}

/**
 * Check if blocked at limit (100%).
 */
export function isBlocked(
  status: "ok" | "warning" | "critical" | "blocked"
): boolean {
  return status === "blocked";
}

/**
 * Get the limit status text for display.
 */
export function getLimitStatusText(
  status: "ok" | "warning" | "critical" | "blocked"
): string {
  switch (status) {
    case "ok":
      return "";
    case "warning":
      return "Approaching limit";
    case "critical":
      return "Near limit - consider upgrading";
    case "blocked":
      return "Limit reached - upgrade required";
    default:
      return "";
  }
}

/**
 * Get the limit status color for display.
 */
export function getLimitStatusColor(
  status: "ok" | "warning" | "critical" | "blocked"
): "default" | "warning" | "destructive" {
  switch (status) {
    case "ok":
      return "default";
    case "warning":
      return "warning";
    case "critical":
    case "blocked":
      return "destructive";
    default:
      return "default";
  }
}

/**
 * Format limit value for display.
 * Returns "Unlimited" for -1, otherwise returns the number.
 */
export function formatLimitValue(limit: number): string {
  return limit === -1 ? "Unlimited" : limit.toString();
}
