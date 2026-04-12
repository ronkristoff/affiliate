/**
 * Graceful Degradation — Wrappers for external service calls and heavy queries.
 *
 * Two components:
 * 1. `withDegradation<T>()` — For use in `action` and `httpAction` context.
 *    Wraps external calls with try/catch + safe fallbacks based on error classification.
 *
 * 2. `useDegradedQuery<T>()` — React hook for frontend-side query degradation.
 *    Convex queries cannot call mutations or fallback queries, so degradation
 *    must happen on the frontend. This hook catches query errors and switches
 *    to a simpler fallback query (e.g., tenantStats).
 *
 * Error classification (from errorClassification.ts):
 * - Infrastructure errors → degrade (return fallback)
 * - Auth/validation/integrity errors → throw (never hide security issues)
 */

import { isInfrastructureError, type ErrorCategory } from "./errorClassification";

// --- Types ---

/** Shape of a degraded response returned to the UI */
export interface DegradedResponse<T> {
  data: T;
  _degraded: true;
  _degradedAt: number;
  _fallbackReason: string;
}

/** Union type for frontend: normal data OR degraded response */
export type PossiblyDegraded<T> = T | DegradedResponse<T>;

/** Type guard to check if a response is degraded */
export function isDegraded<T>(response: T | DegradedResponse<T>): response is DegradedResponse<T> {
  return (
    response !== null &&
    typeof response === "object" &&
    "_degraded" in response &&
    (response as DegradedResponse<T>)._degraded === true
  );
}

// --- Server-side (action/httpAction context) ---

// Re-export for convenience (used by withDegradation and consumers)
export { isInfrastructureError } from "./errorClassification";

type LogDegradationRef = {
  __functionType: never;
};

/**
 * Wrap an external service call with graceful degradation.
 *
 * - On infrastructure error: returns DegradedResponse with fallback data
 * - On auth/validation/integrity error: re-throws (never hides security issues)
 * - On success: returns data directly (not wrapped)
 *
 * For use in `action` and `httpAction` context only.
 */
export async function withDegradation<T>(
  fn: () => Promise<T>,
  fallback: T,
  fallbackReason?: string,
): Promise<T | DegradedResponse<T>> {
  try {
    return await fn();
  } catch (error) {
    if (isInfrastructureError(error)) {
      return {
        data: fallback,
        _degraded: true,
        _degradedAt: Date.now(),
        _fallbackReason: fallbackReason ?? "Service temporarily unavailable",
      };
    }
    // Auth, validation, or integrity error — always throw
    throw error;
  }
}

// --- Client-side (React) ---

/**
 * IMPORTANT: Convex's `useQuery` from `convex/react` does NOT return an `{ error }`
 * property. It returns `T | undefined` and throws on server errors (caught by
 * React error boundaries). Therefore, frontend degradation must use a different
 * pattern than the server-side `withDegradation`.
 *
 * Recommended pattern for dashboard degradation:
 * 1. Call both the enhanced query AND a lightweight fallback query (tenantStats)
 * 2. Wrap the enhanced query call in a React error boundary
 * 3. The error boundary catches Convex query throws and shows fallback UI
 * 4. Use `isDegraded()` type guard to check `DegradedResponse` from server-side
 *
 * The `useDegradedQuery` and `createDegradedQueryHook` functions below are
 * conceptual reference implementations for frameworks that DO provide error
 * objects in query hooks (e.g., React Query, SWR). They are NOT compatible
 * with Convex's `useQuery` and should not be imported in client components.
 */
