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
export function getErrorMessage(error: unknown, fallback: string, depth = 0): string {
  const MAX_DEPTH = 5;
  if (depth > MAX_DEPTH) return fallback;

  if (error == null) return fallback;

  if (typeof error === "string") return error;

  if (error instanceof Error) {
    const msg = error.message;
    if (msg && msg.length > 0) {
      return msg;
    }
    if (error.cause !== undefined) {
      return getErrorMessage(error.cause, fallback, depth + 1);
    }
    return fallback;
  }

  const err = error as Record<string, unknown>;
  if (typeof err.message === "string" && err.message.length > 0) {
    return err.message;
  }

  if (err.data && typeof err.data === "object") {
    const data = err.data as Record<string, unknown>;
    if (typeof data.message === "string" && data.message.length > 0) {
      return data.message;
    }
    if (data.cause !== undefined) {
      return getErrorMessage(data.cause, fallback, depth + 1);
    }
  }

  if (err.cause !== undefined) {
    return getErrorMessage(err.cause, fallback, depth + 1);
  }

  return fallback;
}

const CONVEX_INTERNAL_PREFIXES = [
  "ReturnsValidationError",
  "ArgumentValidationError",
  "FunctionError",
  "INVALID_ARGUMENT",
  "Cannot read properties of undefined",
  "Cannot read property",
  "is not a function",
];

function isConvexInternalError(message: string): boolean {
  return CONVEX_INTERNAL_PREFIXES.some((prefix) => message.startsWith(prefix));
}

export function getSanitizedErrorMessage(error: unknown, fallback: string): string {
  const raw = getErrorMessage(error, fallback);
  if (isConvexInternalError(raw)) {
    return fallback;
  }
  return raw;
}

const errorDedupeMap = new Map<string, number>();
const DEDUPE_WINDOW_MS = 10_000;
const MAX_SAME_SOURCE_PER_WINDOW = 3;

export function reportClientError(opts: {
  severity?: "error" | "warning" | "info";
  source: string;
  message: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const now = Date.now();
    const key = `${opts.source}:${opts.message.slice(0, 200)}`;
    const lastSent = errorDedupeMap.get(key);
    if (lastSent && now - lastSent < DEDUPE_WINDOW_MS) {
      return;
    }
    errorDedupeMap.set(key, now);

    let sourceCount = 0;
    for (const [k, t] of errorDedupeMap.entries()) {
      if (k.startsWith(`${opts.source}:`) && now - t < DEDUPE_WINDOW_MS) {
        sourceCount++;
      }
    }
    if (sourceCount > MAX_SAME_SOURCE_PER_WINDOW) {
      return;
    }

    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        severity: opts.severity ?? "error",
        source: opts.source,
        message: opts.message,
        stackTrace: opts.stackTrace,
        metadata: opts.metadata,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Silently fail
  }
}
