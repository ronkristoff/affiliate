import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Default percentage for "reduced" recurring rate type
 * Used across the application for consistent rate calculations
 */
export const DEFAULT_REDUCED_RATE_PERCENTAGE = 50;

/**
 * Calculate the effective recurring commission rate based on rate type
 * 
 * @param commissionRate - The initial commission rate
 * @param recurringRateType - Type of recurring rate: "same", "reduced", or "custom"
 * @param recurringRate - Custom recurring rate (only used when recurringRateType is "custom")
 * @returns The effective recurring commission rate as a percentage
 */
export function getEffectiveRecurringRate(
  commissionRate: number,
  recurringRateType?: "same" | "reduced" | "custom",
  recurringRate?: number
): number {
  if (!recurringRateType || recurringRateType === "same") {
    return commissionRate;
  }
  
  if (recurringRateType === "reduced") {
    return commissionRate * (DEFAULT_REDUCED_RATE_PERCENTAGE / 100);
  }
  
  // custom - use the provided recurring rate or fall back to commission rate
  return recurringRate ?? commissionRate;
}

/**
 * Get a human-readable description of the recurring rate type
 */
export function getRecurringRateDescription(
  recurringRateType?: "same" | "reduced" | "custom",
  recurringRate?: number,
  commissionRate?: number
): string {
  if (!recurringRateType || recurringRateType === "same") {
    return `Same as initial (${commissionRate || 0}%)`;
  }
  
  if (recurringRateType === "reduced") {
    const reducedRate = (commissionRate || 0) * (DEFAULT_REDUCED_RATE_PERCENTAGE / 100);
    return `Reduced (${reducedRate.toFixed(1)}%)`;
  }
  
  // custom
  return `Custom (${recurringRate || 0}%)`;
}
