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

// =============================================================================
// CLICK AUDIT ACTIONS (Activity Log Feature)
// =============================================================================

export const CLICK_AUDIT_ACTIONS = {
  RECORDED: "click_recorded",
  DEDUPLICATED: "click_deduplicated",
} as const;

// =============================================================================
// CONVERSION AUDIT ACTIONS (Activity Log Feature)
// =============================================================================

export const CONVERSION_AUDIT_ACTIONS = {
  RECORDED: "conversion_recorded",
  RECORDED_SELF_REFERRAL: "conversion_recorded_self_referral",
  ORGANIC: "organic_conversion_recorded",
  STATUS_CHANGED: "conversion_status_changed",
  SUBSCRIPTION_STATUS_CHANGED: "conversion_subscription_status_changed",
  CREATED_LEGACY: "conversion_created_legacy",
} as const;

// =============================================================================
// ATTRIBUTION AUDIT ACTIONS (Activity Log Feature)
// =============================================================================

export const ATTRIBUTION_AUDIT_ACTIONS = {
  NO_DATA: "attribution_no_data",
  AFFILIATE_INVALID: "attribution_affiliate_invalid",
  REFERRAL_LINK_NOT_FOUND: "attribution_referral_link_not_found",
  NO_CAMPAIGN: "attribution_no_campaign",
  CLICK_MATCHED: "attribution_click_matched",
  NO_MATCHING_CLICK: "attribution_no_matching_click",
} as const;

// =============================================================================
// COMMISSION ENGINE ACTIONS (Activity Log Feature)
// =============================================================================

export const COMMISSION_ENGINE_ACTIONS = {
  CREATION_SKIPPED: "commission_creation_skipped",
} as const;

// =============================================================================
// AUDIT ACTION LABELS — Human-readable labels for all known actions
// =============================================================================

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // Commission
  COMMISSION_CREATED: "Commission Created",
  COMMISSION_APPROVED: "Commission Approved",
  COMMISSION_DECLINED: "Commission Declined",
  COMMISSION_REVERSED: "Commission Reversed",
  COMMISSION_STATUS_CHANGE: "Status Changed",
  commission_creation_skipped: "Commission Skipped",
  commission_adjusted: "Commission Adjusted",
  commission_adjusted_upgrade: "Commission Adjusted (Upgrade)",
  commission_adjusted_downgrade: "Commission Adjusted (Downgrade)",

  // Payout
  payout_batch_generated: "Payout Batch Generated",
  payout_marked_paid: "Payout Marked Paid",
  batch_marked_paid: "Batch Marked Paid",
  payout_processing: "Payout Processing",
  payout_failed: "Payout Failed",
  payout_paid_saligpay: "Payout Paid via SaligPay",

  // Affiliate
  affiliate_approved: "Application Approved",
  affiliate_rejected: "Application Rejected",
  affiliate_suspended: "Affiliate Suspended",
  affiliate_reactivated: "Affiliate Reactivated",
  affiliate_registered: "New Affiliate Registered",
  affiliate_bulk_approved: "Bulk Approved",
  affiliate_bulk_rejected: "Bulk Rejected",

  // Click
  click_recorded: "Click Recorded",
  click_deduplicated: "Click Deduplicated",

  // Conversion
  conversion_recorded: "Conversion Recorded",
  conversion_recorded_self_referral: "Conversion (Self-Referral)",
  organic_conversion_recorded: "Organic Conversion",
  conversion_status_changed: "Conversion Status Changed",
  conversion_subscription_status_changed: "Subscription Status Changed",
  conversion_created_legacy: "Conversion Created (Legacy)",

  // Attribution
  attribution_no_data: "No Attribution Data",
  attribution_affiliate_invalid: "Affiliate Invalid/Inactive",
  attribution_referral_link_not_found: "Referral Link Not Found",
  attribution_no_campaign: "No Campaign Linked",
  attribution_click_matched: "Click Matched to Conversion",
  attribution_no_matching_click: "No Matching Click Found",

  // Security
  security_unauthorized_access_attempt: "Unauthorized Access Attempt",
  security_cross_tenant_query: "Cross-Tenant Query Blocked",
  security_cross_tenant_mutation: "Cross-Tenant Mutation Blocked",
  security_authentication_failure: "Authentication Failure",

  // Email
  email_scheduling_failed: "Email Scheduling Failed",
  email_send_failed: "Email Delivery Failed",
  fraud_alert_email_failed: "Fraud Alert Email Failed",

  // Fraud
  self_referral_detected: "Self-Referral Detected",
  fraud_signal_dismissed: "Fraud Signal Dismissed",

  // Payment rejection
  commission_rejected_payment_failed: "Payment Failed",
  commission_rejected_payment_pending: "Payment Pending",
  commission_rejected_payment_unknown: "Payment Status Unknown",
};

/**
 * Get a human-readable label for an audit action.
 * Falls back to formatting the raw action string.
 */
export function getAuditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
