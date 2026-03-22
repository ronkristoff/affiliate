/**
 * Shared constants used by both Convex backend and frontend.
 *
 * IMPORTANT: This file must not import anything from "convex/*" or
 * "better-auth" — it is imported from client components in the browser.
 */

// =============================================================================
// Payout Audit Actions
// =============================================================================

/**
 * Payout audit action types used for logging and filtering.
 * Must stay in sync with convex/audit.ts usage.
 */
export const PAYOUT_AUDIT_ACTIONS = {
  BATCH_GENERATED: "payout_batch_generated",
  PAYOUT_MARKED_PAID: "payout_marked_paid",
  BATCH_MARKED_PAID: "batch_marked_paid",
} as const;

export type PayoutAuditAction =
  (typeof PAYOUT_AUDIT_ACTIONS)[keyof typeof PAYOUT_AUDIT_ACTIONS];
