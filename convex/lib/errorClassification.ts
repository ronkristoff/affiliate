/**
 * Error Classification — Single Source of Truth
 *
 * Used by circuitBreaker.ts and gracefulDegradation.ts.
 * Has ZERO imports from other project modules to prevent circular dependencies.
 *
 * Classification priority:
 * 1. HTTP status code (error.status or error.cause?.status)
 * 2. Error name (error.name or error.cause?.name)
 * 3. Error message string patterns (last resort, fragile)
 * 4. Convex error codes (error.code)
 */

export type ErrorCategory = "infrastructure" | "auth" | "validation" | "integrity";

/**
 * Classify an error into a category.
 *
 * Infrastructure errors trigger degradation (fallback).
 * Auth/validation/integrity errors always throw (never degrade).
 */
export function classifyError(error: unknown): ErrorCategory {
  const err = getErrorRoot(error);

  // 1. Check HTTP status code
  const status = (err as any).status ?? (err as any).cause?.status;
  if (typeof status === "number") {
    if (status >= 500) return "infrastructure";
    if (status === 401 || status === 403) return "auth";
    if (status === 400 || status === 422 || status === 409) return "validation";
  }

  // 2. Check error name
  const name = (err as any).name ?? (err as any).cause?.name ?? "";
  if (isInfrastructureName(name)) return "infrastructure";
  if (name === "ConvexError") {
    const code = (err as any).code ?? "";
    if (code === "RATE_LIMIT") return "validation";
    return "validation";
  }

  // 3. Check Convex error codes (ConvexError may not set name)
  const code = (err as any).code ?? (err as any).cause?.code;
  if (typeof code === "string") {
    if (code === "RATE_LIMIT") return "validation";
    return "validation"; // Most Convex codes are input/business logic errors
  }

  // 4. Check message string patterns (last resort)
  const message = getErrorMessage(error);
  if (isInfrastructureMessage(message)) return "infrastructure";
  if (isAuthMessage(message)) return "auth";

  // Default: treat unknown errors as infrastructure to be safe
  return "infrastructure";
}

/**
 * Convenience wrapper: is this an infrastructure error that should trigger degradation?
 */
export function isInfrastructureError(error: unknown): boolean {
  return classifyError(error) === "infrastructure";
}

// --- Internal helpers ---

function getErrorRoot(error: unknown): Error | Record<string, unknown> {
  if (error instanceof Error) return error;
  if (error !== null && typeof error === "object") {
    // Check for Convex FunctionError wrapping (cause property)
    const cause = (error as Record<string, unknown>).cause;
    if (cause instanceof Error) return cause;
    if (cause !== null && typeof cause === "object") return cause as Record<string, unknown>;
    return error as Record<string, unknown>;
  }
  return { message: String(error) };
}

function getErrorMessage(error: unknown): string {
  const err = getErrorRoot(error);
  return (err as any).message ?? (err as any).cause?.message ?? "";
}

const INFRASTRUCTURE_NAMES = new Set([
  "TimeoutError",
  "AbortError",
  "ConnectError",
  "ConnectionError",
  "NetworkError",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "FetchError",
]);

function isInfrastructureName(name: string): boolean {
  return INFRASTRUCTURE_NAMES.has(name);
}

const INFRASTRUCTURE_PATTERNS = [
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "network request failed",
  "fetch failed",
  "dns lookup failed",
  "dns resolution",
  "dns server",
  "socket hang up",
  "service unavailable",
  "gateway timeout",
  "bad gateway",
  "abort",
];

function isInfrastructureMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return INFRASTRUCTURE_PATTERNS.some((p) => lower.includes(p));
}

const AUTH_PATTERNS = [
  "unauthorized",
  "forbidden",
  "invalid token",
  "authentication required",
  "not authenticated",
  "csrf",
];

function isAuthMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return AUTH_PATTERNS.some((p) => lower.includes(p));
}
