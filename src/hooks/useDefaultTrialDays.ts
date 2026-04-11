"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/** Fallback when the query hasn't loaded yet. */
const FALLBACK_TRIAL_DAYS = 14;

/**
 * Returns the platform-configured default trial days for new tenants.
 * Falls back to 14 while loading or if no settings exist.
 *
 * Usage in any client component:
 *   const trialDays = useDefaultTrialDays();
 *   // trialDays is number (14 while loading, then the actual value)
 */
export function useDefaultTrialDays(): number {
  const days = useQuery(api.platformSettings.getPublicDefaultTrialDays);
  return days ?? FALLBACK_TRIAL_DAYS;
}
