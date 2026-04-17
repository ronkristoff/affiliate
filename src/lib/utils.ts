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

// ============================================
// CSV Export Utilities
// ============================================

/**
 * Download a CSV file from base64 encoded data
 * Used by report export functionality across the application
 * 
 * @param base64Data - Base64 encoded CSV content
 * @param filename - Name of the file to download (without extension)
 */
export function downloadCsv(base64Data: string, filename: string): void {
  // Decode base64 to string
  const csvContent = atob(base64Data);
  
  // Create blob from CSV content
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  
  // Create object URL
  const url = URL.createObjectURL(blob);
  
  // Create download link
  const link = document.createElement("a");
  const date = new Date().toISOString().split("T")[0];
  link.href = url;
  link.download = `${filename}-${date}.csv`;
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  URL.revokeObjectURL(url);
}

/**
 * Decode base64 CSV content without triggering download
 * Useful when you need to preview CSV content or process it further
 * 
 * @param base64Data - Base64 encoded CSV content
 * @returns Decoded CSV string
 */
export function decodeCsvContent(base64Data: string): string {
  return atob(base64Data);
}

// ============================================
// Error Handling Utilities
// ============================================

/**
 * Extract a safe, user-facing message from any error thrown by mutations.
 * Traverses error.cause chains and Convex error wrappers to find the root message.
 * Returns fallback if no usable message is found.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  // Handle null/undefined
  if (error == null) return fallback;

  // Handle strings
  if (typeof error === "string") return error;

  // Handle Error-like objects (covers native Error, cross-realm Error, Convex RPC errors)
  if (error instanceof Error) {
    const msg = error.message;
    // Only use fallback if message is truly empty
    if (msg && msg.length > 0) {
      return msg;
    }
    // Try .cause if message is empty
    if (error.cause !== undefined) {
      return getErrorMessage(error.cause, fallback);
    }
    return fallback;
  }

  // Handle plain objects with a message property
  const err = error as Record<string, unknown>;
  if (typeof err.message === "string" && err.message.length > 0) {
    return err.message;
  }

  // Handle Convex error wrapper: { data: { message: string } }
  if (err.data && typeof err.data === "object") {
    const data = err.data as Record<string, unknown>;
    if (typeof data.message === "string" && data.message.length > 0) {
      return data.message;
    }
    // Try nested cause inside data
    if (data.cause !== undefined) {
      return getErrorMessage(data.cause, fallback);
    }
  }

  // Last resort: try .cause
  if (err.cause !== undefined) {
    return getErrorMessage(err.cause, fallback);
  }

  return fallback;
}
