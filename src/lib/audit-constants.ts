/**
 * Audit log action constants shared between Convex backend and frontend.
 *
 * These are plain string constants with no Convex imports, so they are safe
 * to import in client (browser) components.
 */

// =============================================================================
// COMMISSION AUDIT ACTIONS (Story 7.8)
// =============================================================================

export const COMMISSION_AUDIT_ACTIONS = {
  CREATED: "COMMISSION_CREATED",
  APPROVED: "COMMISSION_APPROVED",
  DECLINED: "COMMISSION_DECLINED",
  REVERSED: "COMMISSION_REVERSED",
  STATUS_CHANGE: "COMMISSION_STATUS_CHANGE",
} as const;

export type CommissionAuditAction = typeof COMMISSION_AUDIT_ACTIONS[keyof typeof COMMISSION_AUDIT_ACTIONS];

// =============================================================================
// PAYOUT AUDIT ACTIONS (Story 13.6)
// =============================================================================

export const PAYOUT_AUDIT_ACTIONS = {
  BATCH_GENERATED: "payout_batch_generated",
  PAYOUT_MARKED_PAID: "payout_marked_paid",
  BATCH_MARKED_PAID: "batch_marked_paid",
  PAYOUT_PROCESSING: "payout_processing",
  PAYOUT_FAILED: "payout_failed",
  PAYOUT_PAID_SALIGPAY: "payout_paid_saligpay",
} as const;

export type PayoutAuditAction = typeof PAYOUT_AUDIT_ACTIONS[keyof typeof PAYOUT_AUDIT_ACTIONS];
