import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

/**
 * Tenant context utilities for client-side usage.
 * Provides hooks and helpers for accessing tenant information.
 */

/**
 * Hook to get the current tenant context.
 * Returns tenant information including branding and subscription details.
 */
export function useTenantContext(tenantId: Id<"tenants"> | null) {
  return useQuery(
    api.tenants.getTenantContext,
    tenantId ? { tenantId } : "skip"
  );
}

/**
 * Hook to check if a tenant slug is available.
 */
export function useIsSlugAvailable(slug: string) {
  return useQuery(
    api.tenants.isSlugAvailable,
    slug ? { slug } : "skip"
  );
}

/**
 * Hook to generate a unique slug from a company name.
 */
export function useGenerateSlug(companyName: string) {
  return useQuery(
    api.tenants.generateSlug,
    companyName ? { companyName } : "skip"
  );
}

/**
 * Tenant context type for TypeScript.
 */
export interface TenantContext {
  tenantId: Id<"tenants">;
  name: string;
  slug: string;
  plan: string;
  status: string;
  isTrial: boolean;
  trialDaysRemaining?: number;
  branding: {
    logoUrl?: string;
    primaryColor?: string;
    portalName?: string;
  };
}

/**
 * Check if tenant is on trial.
 */
export function isTrialActive(context: TenantContext | null | undefined): boolean {
  return context?.isTrial ?? false;
}

/**
 * Check if tenant has a specific plan.
 */
export function hasPlan(context: TenantContext | null | undefined, plan: string): boolean {
  return context?.plan === plan;
}

/**
 * Check if tenant is active.
 */
export function isTenantActive(context: TenantContext | null | undefined): boolean {
  return context?.status === "active";
}

/**
 * Get tenant display name.
 * Uses portal name from branding if available, otherwise uses tenant name.
 */
export function getTenantDisplayName(context: TenantContext | null | undefined): string {
  return context?.branding?.portalName || context?.name || "Unknown";
}

/**
 * Format trial days remaining for display.
 */
export function formatTrialDays(days: number | undefined): string {
  if (days === undefined) return "";
  if (days <= 0) return "Trial expired";
  if (days === 1) return "1 day remaining";
  return `${days} days remaining`;
}
