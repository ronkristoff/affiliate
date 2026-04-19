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
// CAMPAIGN AUDIT ACTIONS (Story 15.3)
// =============================================================================

export const CAMPAIGN_AUDIT_ACTIONS = {
  CREATED: "CAMPAIGN_CREATED",
  UPDATED: "CAMPAIGN_UPDATED",
  ARCHIVED: "CAMPAIGN_ARCHIVED",
  PAUSED: "CAMPAIGN_PAUSED",
  RESUMED: "CAMPAIGN_RESUMED",
} as const;

// =============================================================================
// USER MANAGEMENT AUDIT ACTIONS
// =============================================================================

export const USER_AUDIT_ACTIONS = {
  TENANT_CREATED: "tenant_created",
  USER_CREATED: "user_created",
  USER_UPDATED: "user_updated",
  USER_DELETED: "user_deleted",
  TEAM_MEMBER_REMOVED: "TEAM_MEMBER_REMOVED",
  USER_PROFILE_UPDATED: "USER_PROFILE_UPDATED",
} as const;

// =============================================================================
// AFFILIATE MANAGEMENT AUDIT ACTIONS (Extended)
// =============================================================================

export const AFFILIATE_MANAGEMENT_ACTIONS = {
  INVITED: "affiliate_invited",
  STATUS_UPDATED: "affiliate_status_updated",
  PROFILE_UPDATED: "affiliate_profile_updated",
  PASSWORD_UPDATED: "affiliate_password_updated",
  PASSWORD_SET: "AFFILIATE_PASSWORD_SET",
  LOGIN: "affiliate_login",
  PASSWORD_CHANGED: "affiliate_password_changed",
  REFERRAL_LINK_AUTO_CREATED: "referral_link_auto_created",
} as const;

// =============================================================================
// ADMIN AUDIT ACTIONS
// =============================================================================

export const ADMIN_AUDIT_ACTIONS = {
  IMPERSONATION_START: "impersonation_start",
  IMPERSONATION_END: "impersonation_end",
  IMPERSONATED_MUTATION: "impersonated_mutation",
  IMPERSONATION_UNAUTHORIZED: "impersonation_unauthorized",
  PERMISSION_DENIED: "permission_denied",
  NOTE_ADDED: "ADMIN_NOTE_ADDED",
} as const;

// =============================================================================
// INFRASTRUCTURE AUDIT ACTIONS
// =============================================================================

export const INFRASTRUCTURE_ACTIONS = {
  LOGIN_ATTEMPT_FAILED: "LOGIN_ATTEMPT_FAILED",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  CIRCUIT_BREAKER_STATE_CHANGE: "CIRCUIT_BREAKER_STATE_CHANGE",
} as const;

// =============================================================================
// TIER CONFIG AUDIT ACTIONS
// =============================================================================

export const TIER_CONFIG_ACTIONS = {
  CREATED: "tier_config_created",
  UPDATED: "tier_config_updated",
  DELETED: "tier_config_deleted",
} as const;

// =============================================================================
// AUTH AUDIT ACTIONS (Story 15.2)
// =============================================================================

export const AUTH_AUDIT_ACTIONS = {
  SIGNUP_COMPLETED: "AUTH_SIGNUP_COMPLETED",
  SIGNIN_SUCCESS: "AUTH_SIGNIN_SUCCESS",
  SIGNIN_FAILURE: "AUTH_SIGNIN_FAILURE",
  ACCOUNT_LOCKED: "AUTH_ACCOUNT_LOCKED",
  ACCOUNT_DELETED: "AUTH_ACCOUNT_DELETED",
  SESSION_REVOKED: "AUTH_SESSION_REVOKED",
  PASSWORD_RESET_REQUESTED: "AUTH_PASSWORD_RESET_REQUESTED",
  PASSWORD_RESET_COMPLETED: "AUTH_PASSWORD_RESET_COMPLETED",
  PASSWORD_CHANGED: "AUTH_PASSWORD_CHANGED",
  PASSWORD_REUSE_BLOCKED: "AUTH_PASSWORD_REUSE_BLOCKED",
  EMAIL_VERIFICATION_SENT: "AUTH_EMAIL_VERIFICATION_SENT",
  OTP_SENT: "AUTH_OTP_SENT",
  MAGIC_LINK_SENT: "AUTH_MAGIC_LINK_SENT",
  TWO_FACTOR_ENABLED: "AUTH_2FA_ENABLED",
  TWO_FACTOR_TOTP_VERIFIED: "AUTH_2FA_TOTP_VERIFIED",
  TWO_FACTOR_OTP_SENT: "AUTH_2FA_OTP_SENT",
  TWO_FACTOR_OTP_VERIFIED: "AUTH_2FA_OTP_VERIFIED",
} as const;

// =============================================================================
// EMAIL DELIVERY AUDIT ACTIONS
// =============================================================================

export const EMAIL_DELIVERY_ACTIONS = {
  BOUNCED: "email_bounced",
  COMPLAINED: "email_complained",
  SEND_FAILED: "email_send_failed",
  TEMPLATE_SAVED: "EMAIL_TEMPLATE_SAVED",
  TEMPLATE_DELETED: "EMAIL_TEMPLATE_DELETED",
} as const;

// =============================================================================
// FRAUD AUDIT ACTIONS (Extended)
// =============================================================================

export const FRAUD_AUDIT_ACTIONS = {
  SIGNAL_ADDED: "FRAUD_SIGNAL_ADDED",
  SELF_REFERRAL_DETECTED: "self_referral_detected",
  SIGNAL_DISMISSED: "fraud_signal_dismissed",
} as const;

// =============================================================================
// CONVERSION AUDIT ACTIONS (Extended)
// =============================================================================

export const CONVERSION_AUDIT_ACTIONS_EXTENDED = {
  ORGANIC_CREATED: "ORGANIC_CONVERSION_CREATED",
} as const;

// =============================================================================
// AUDIT ACTION LABELS — Human-readable labels for all known actions
// =============================================================================

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // ── Commission ──────────────────────────────────────────────────────
  COMMISSION_CREATED: "Commission Created",
  COMMISSION_APPROVED: "Commission Approved",
  COMMISSION_DECLINED: "Commission Declined",
  COMMISSION_REVERSED: "Commission Reversed",
  COMMISSION_STATUS_CHANGE: "Status Changed",
  commission_creation_skipped: "Commission Skipped",
  commission_adjusted: "Commission Adjusted",
  commission_adjusted_upgrade: "Commission Adjusted (Upgrade)",
  commission_adjusted_downgrade: "Commission Adjusted (Downgrade)",

  // ── Payout ──────────────────────────────────────────────────────────
  payout_batch_generated: "Payout Batch Generated",
  payout_marked_paid: "Payout Marked Paid",
  batch_marked_paid: "Batch Marked Paid",
  payout_processing: "Payout Processing",
  payout_failed: "Payout Failed",
  payout_paid_saligpay: "Payout Paid via SaligPay",

  // ── Campaign ────────────────────────────────────────────────────────
  CAMPAIGN_CREATED: "Campaign Created",
  CAMPAIGN_UPDATED: "Campaign Updated",
  CAMPAIGN_ARCHIVED: "Campaign Archived",
  CAMPAIGN_PAUSED: "Campaign Paused",
  CAMPAIGN_RESUMED: "Campaign Resumed",

  // ── User Management ─────────────────────────────────────────────────
  tenant_created: "Tenant Created",
  user_created: "User Created",
  user_updated: "User Updated",
  user_deleted: "User Deleted",
  TEAM_MEMBER_REMOVED: "Team Member Removed",
  USER_PROFILE_UPDATED: "Profile Updated",

  // ── Affiliate Management ────────────────────────────────────────────
  affiliate_approved: "Application Approved",
  affiliate_rejected: "Application Rejected",
  affiliate_suspended: "Affiliate Suspended",
  affiliate_reactivated: "Affiliate Reactivated",
  affiliate_registered: "New Affiliate Registered",
  affiliate_bulk_approved: "Bulk Approved",
  affiliate_bulk_rejected: "Bulk Rejected",
  affiliate_invited: "Affiliate Invited",
  affiliate_status_updated: "Affiliate Status Updated",
  affiliate_profile_updated: "Affiliate Profile Updated",
  affiliate_password_updated: "Affiliate Password Changed",
  affiliate_login: "Affiliate Logged In",
  affiliate_password_changed: "Affiliate Password Changed (Legacy)",
  AFFILIATE_PASSWORD_SET: "Affiliate Password Set",
  referral_link_auto_created: "Referral Link Auto-Created",

  // ── Click ───────────────────────────────────────────────────────────
  click_recorded: "Click Recorded",
  click_deduplicated: "Click Deduplicated",

  // ── Conversion ──────────────────────────────────────────────────────
  conversion_recorded: "Conversion Recorded",
  conversion_recorded_self_referral: "Conversion (Self-Referral)",
  organic_conversion_recorded: "Organic Conversion",
  conversion_status_changed: "Conversion Status Changed",
  conversion_subscription_status_changed: "Subscription Status Changed",
  conversion_created_legacy: "Conversion Created (Legacy)",
  ORGANIC_CONVERSION_CREATED: "Organic Conversion Created",

  // ── Attribution ─────────────────────────────────────────────────────
  attribution_no_data: "No Attribution Data",
  attribution_affiliate_invalid: "Affiliate Invalid/Inactive",
  attribution_referral_link_not_found: "Referral Link Not Found",
  attribution_no_campaign: "No Campaign Linked",
  attribution_click_matched: "Click Matched to Conversion",
  attribution_no_matching_click: "No Matching Click Found",

  // ── Admin / Platform ───────────────────────────────────────────────
  impersonation_start: "Impersonation Started",
  impersonation_end: "Impersonation Ended",
  impersonated_mutation: "Impersonated Action",
  impersonation_unauthorized: "Impersonation Unauthorized",
  permission_denied: "Permission Denied",
  ADMIN_NOTE_ADDED: "Admin Note Added",

  // ── Auth ─────────────────────────────────────────────────────────
  AUTH_SIGNUP_COMPLETED: "Sign-Up Completed",
  AUTH_SIGNIN_SUCCESS: "Sign-In Successful",
  AUTH_SIGNIN_FAILURE: "Sign-In Failed",
  AUTH_ACCOUNT_LOCKED: "Account Locked",
  AUTH_ACCOUNT_DELETED: "Account Deleted",
  AUTH_SESSION_REVOKED: "Session Revoked",
  AUTH_PASSWORD_RESET_REQUESTED: "Password Reset Requested",
  AUTH_PASSWORD_RESET_COMPLETED: "Password Reset Completed",
  AUTH_PASSWORD_CHANGED: "Password Changed",
  AUTH_PASSWORD_REUSE_BLOCKED: "Password Reuse Blocked",
  AUTH_EMAIL_VERIFICATION_SENT: "Verification Email Sent",
  AUTH_OTP_SENT: "OTP Sent",
  AUTH_MAGIC_LINK_SENT: "Magic Link Sent",
  AUTH_2FA_ENABLED: "Two-Factor Auth Enabled",
  AUTH_2FA_TOTP_VERIFIED: "2FA TOTP Verified",
  AUTH_2FA_OTP_SENT: "2FA OTP Sent",
  AUTH_2FA_OTP_VERIFIED: "2FA OTP Verified",

  // ── Infrastructure ──────────────────────────────────────────────────
  LOGIN_ATTEMPT_FAILED: "Login Attempt Failed",
  ACCOUNT_LOCKED: "Account Locked",
  LOGIN_SUCCESS: "Login Successful",
  CIRCUIT_BREAKER_STATE_CHANGE: "Circuit Breaker State Changed",

  // ── Email Delivery ──────────────────────────────────────────────────
  email_bounced: "Email Bounced",
  email_complained: "Email Complaint (Spam)",
  email_send_failed: "Email Delivery Failed",
  email_scheduling_failed: "Email Scheduling Failed",
  fraud_alert_email_failed: "Fraud Alert Email Failed",
  EMAIL_TEMPLATE_SAVED: "Email Template Saved",
  EMAIL_TEMPLATE_DELETED: "Email Template Deleted",

  // ── Fraud ───────────────────────────────────────────────────────────
  self_referral_detected: "Self-Referral Detected",
  fraud_signal_dismissed: "Fraud Signal Dismissed",
  FRAUD_SIGNAL_ADDED: "Fraud Signal Added",

  // ── Security ────────────────────────────────────────────────────────
  security_unauthorized_access_attempt: "Unauthorized Access Attempt",

  // ── Payment rejection ──────────────────────────────────────────────
  commission_rejected_payment_failed: "Payment Failed",
  commission_rejected_payment_pending: "Payment Pending",
  commission_rejected_payment_unknown: "Payment Status Unknown",

  // ── Tier Config (Platform Admin) ──────────────────────────────────
  tier_config_created: "Tier Config Created",
  tier_config_updated: "Tier Config Updated",
  tier_config_deleted: "Tier Config Deleted",
};

// =============================================================================
// AUDIT ACTION CATEGORIES — Groups actions into filterable categories (Story 15.5)
// =============================================================================

export const AUDIT_ACTION_CATEGORIES: Record<string, string[]> = {
  auth: [
    "AUTH_SIGNUP_COMPLETED", "AUTH_SIGNIN_SUCCESS", "AUTH_SIGNIN_FAILURE",
    "AUTH_ACCOUNT_LOCKED", "AUTH_PASSWORD_RESET_REQUESTED", "AUTH_PASSWORD_RESET_COMPLETED",
    "AUTH_PASSWORD_CHANGED", "AUTH_PASSWORD_REUSE_BLOCKED", "AUTH_EMAIL_VERIFICATION_SENT",
    "AUTH_OTP_SENT", "AUTH_MAGIC_LINK_SENT", "AUTH_2FA_ENABLED",
    "AUTH_2FA_TOTP_VERIFIED", "AUTH_2FA_OTP_SENT", "AUTH_2FA_OTP_VERIFIED",
    "AUTH_ACCOUNT_DELETED", "AUTH_SESSION_REVOKED",
    "LOGIN_ATTEMPT_FAILED", "ACCOUNT_LOCKED", "LOGIN_SUCCESS",
  ],
  email: [
    "email_bounced", "email_complained", "email_send_failed",
    "email_scheduling_failed", "fraud_alert_email_failed",
    "EMAIL_TEMPLATE_SAVED", "EMAIL_TEMPLATE_DELETED",
  ],
  money: [
    "COMMISSION_CREATED", "COMMISSION_APPROVED", "COMMISSION_DECLINED",
    "COMMISSION_REVERSED", "COMMISSION_STATUS_CHANGE",
    "payout_batch_generated", "payout_marked_paid", "batch_marked_paid",
    "payout_processing", "payout_failed", "payout_paid_saligpay",
  ],
  affiliates: [
    "affiliate_approved", "affiliate_rejected", "affiliate_suspended",
    "affiliate_reactivated", "affiliate_registered", "affiliate_bulk_approved",
    "affiliate_bulk_rejected", "affiliate_invited", "affiliate_status_updated",
    "affiliate_profile_updated", "affiliate_password_updated",
    "AFFILIATE_PASSWORD_SET", "referral_link_auto_created",
  ],
  security: [
    "security_unauthorized_access_attempt", "impersonation_start",
    "impersonation_end", "impersonated_mutation", "impersonation_unauthorized",
    "FRAUD_SIGNAL_ADDED", "self_referral_detected", "fraud_signal_dismissed",
    "permission_denied", "CIRCUIT_BREAKER_STATE_CHANGE",
  ],
};

/** Reverse lookup: action → category. Built lazily on first call. */
let _actionToCategoryCache: Record<string, string> | null = null;

export function getActionCategory(action: string): string | undefined {
  if (!_actionToCategoryCache) {
    _actionToCategoryCache = {};
    for (const [category, actions] of Object.entries(AUDIT_ACTION_CATEGORIES)) {
      for (const a of actions) {
        _actionToCategoryCache[a] = category;
      }
    }
  }
  return _actionToCategoryCache[action];
}

// =============================================================================
// AUDIT SEVERITY COLORS — Color-coded indicators for timeline events (Story 15.5)
// =============================================================================

export type AuditSeverity = "red" | "green" | "amber" | "blue" | "purple";

export const AUDIT_SEVERITY_COLORS: Record<string, AuditSeverity> = {
  // Red — failures, locks, rejections
  AUTH_SIGNIN_FAILURE: "red",
  AUTH_ACCOUNT_LOCKED: "red",
  email_bounced: "red",
  COMMISSION_DECLINED: "red",
  payout_failed: "red",
  security_unauthorized_access_attempt: "red",
  AUTH_PASSWORD_REUSE_BLOCKED: "red",
  permission_denied: "red",
  impersonation_unauthorized: "red",
  email_complained: "red",

  // Green — successes, deliveries, approvals
  AUTH_SIGNIN_SUCCESS: "green",
  AUTH_PASSWORD_RESET_COMPLETED: "green",
  COMMISSION_APPROVED: "green",
  payout_marked_paid: "green",
  batch_marked_paid: "green",
  AUTH_2FA_ENABLED: "green",
  AUTH_2FA_TOTP_VERIFIED: "green",
  AUTH_2FA_OTP_VERIFIED: "green",
  affiliate_approved: "green",
  affiliate_reactivated: "green",
  payout_paid_saligpay: "green",
  LOGIN_SUCCESS: "green",

  // Amber — warnings, pending, informational alerts
  AUTH_OTP_SENT: "amber",
  AUTH_2FA_OTP_SENT: "amber",
  AUTH_EMAIL_VERIFICATION_SENT: "amber",
  AUTH_MAGIC_LINK_SENT: "amber",
  AUTH_PASSWORD_RESET_REQUESTED: "amber",
  payout_processing: "amber",
  email_scheduling_failed: "amber",
  email_send_failed: "amber",
  fraud_alert_email_failed: "amber",
  FRAUD_SIGNAL_ADDED: "amber",

  // Blue — informational, system events
  CAMPAIGN_CREATED: "blue",
  tenant_created: "blue",
  user_created: "blue",
  CAMPAIGN_UPDATED: "blue",
  CAMPAIGN_ARCHIVED: "blue",
  CAMPAIGN_PAUSED: "blue",
  CAMPAIGN_RESUMED: "blue",
  EMAIL_TEMPLATE_SAVED: "blue",
  EMAIL_TEMPLATE_DELETED: "blue",
  ADMIN_NOTE_ADDED: "blue",
  commission_creation_skipped: "blue",
  referral_link_auto_created: "blue",

  // Purple — admin/security events
  impersonation_start: "purple",
  impersonation_end: "purple",
  impersonated_mutation: "purple",
  self_referral_detected: "purple",
  CIRCUIT_BREAKER_STATE_CHANGE: "purple",

  // Blue — platform admin config changes
  tier_config_created: "blue",
  tier_config_updated: "blue",
  tier_config_deleted: "red",
};

export function getActionSeverity(action: string): AuditSeverity {
  return AUDIT_SEVERITY_COLORS[action] ?? "blue";
}

/**
 * Get a human-readable label for an audit action.
 * Falls back to formatting the raw action string.
 */
export function getAuditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// =============================================================================
// EXCEPTION-ONLY ACTIONS — Actions that represent issues requiring attention
// =============================================================================

/**
 * Actions that indicate problems, failures, or items needing review.
 * Used for the "Exceptions Only" default view in Activity Log.
 * 
 * IMPORTANT: Keep in sync with EXCEPTION_ACTION_SET in convex/audit.ts
 */
export const EXCEPTION_ACTIONS = new Set([
  // Commission issues
  "COMMISSION_DECLINED",
  "COMMISSION_REVERSED",
  "commission_rejected_payment_failed",
  "commission_rejected_payment_pending",
  "commission_rejected_payment_unknown",
  "commission_creation_skipped",
  
  // Payout issues
  "payout_failed",
  
  // Affiliate issues
  "affiliate_rejected",
  "affiliate_suspended",
  "affiliate_bulk_rejected",
  
  // Attribution issues (potential lost commissions)
  "attribution_no_data",
  "attribution_affiliate_invalid",
  "attribution_referral_link_not_found",
  "attribution_no_campaign",
  "attribution_no_matching_click",
  
  // Fraud
  "self_referral_detected",
  "FRAUD_SIGNAL_ADDED",
  "conversion_recorded_self_referral",
  
  // Email failures
  "email_send_failed",
  "email_scheduling_failed",
  "fraud_alert_email_failed",
  "email_bounced",
  "email_complained",
  
  // Security
  "security_unauthorized_access_attempt",
  "AUTH_SIGNIN_FAILURE",
  "AUTH_ACCOUNT_LOCKED",
  "permission_denied",
  
  // Commission adjustments (downgrades need review)
  "commission_adjusted_downgrade",
]);

/**
 * Check if an action is an exception (requires attention).
 */
export function isExceptionAction(action: string): boolean {
  return EXCEPTION_ACTIONS.has(action);
}

/**
 * Actions to hide by default (noise events).
 * These are shown only when "Show All Activity" is enabled.
 */
export const NOISE_ACTIONS = new Set([
  "click_recorded",
  "click_deduplicated",
  "attribution_click_matched",
]);
