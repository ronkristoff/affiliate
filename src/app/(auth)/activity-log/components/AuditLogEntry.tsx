"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { getAuditActionLabel } from "@/lib/audit-constants";
import { formatCurrency } from "@/lib/format";
import { ChevronDown, ChevronUp, Clock, ExternalLink, User, MousePointerClick, ShoppingCart, DollarSign, Users, Package } from "lucide-react";

interface AuditLogEntryProps {
  log: any;
  onEntityClick?: (entityType: string, entityId: string) => void;
}

/**
 * Get a user-friendly display label for an entity based on its type and metadata.
 * Falls back to a shortened ID if no meaningful label can be extracted.
 */
function getEntityDisplayLabel(entityType: string, entityId: string, metadata?: Record<string, any>): { label: string; icon: React.ReactNode } {
  const meta = metadata ?? {};

  switch (entityType) {
    case "affiliate":
      return {
        label: meta.affiliateName ?? meta.name ?? meta.email ?? "Affiliate",
        icon: <User className="h-3 w-3" />,
      };

    case "commission": {
      const amount = meta.amount ?? meta.commissionAmount ?? meta.newAmount;
      const affiliateName = meta.affiliateName;
      if (amount) {
        return {
          label: `${formatCurrency(amount)}${affiliateName ? ` for ${affiliateName}` : ""}`,
          icon: <DollarSign className="h-3 w-3" />,
        };
      }
      return {
        label: affiliateName ? `Commission for ${affiliateName}` : "Commission",
        icon: <DollarSign className="h-3 w-3" />,
      };
    }

    case "conversion": {
      const amount = meta.amount ?? meta.conversionAmount;
      const customerEmail = meta.customerEmail ?? meta.email;
      if (amount && customerEmail) {
        return {
          label: `${formatCurrency(amount)} from ${customerEmail}`,
          icon: <ShoppingCart className="h-3 w-3" />,
        };
      }
      if (amount) {
        return {
          label: `${formatCurrency(amount)} conversion`,
          icon: <ShoppingCart className="h-3 w-3" />,
        };
      }
      if (customerEmail) {
        return {
          label: `Conversion from ${customerEmail}`,
          icon: <ShoppingCart className="h-3 w-3" />,
        };
      }
      return {
        label: "Conversion",
        icon: <ShoppingCart className="h-3 w-3" />,
      };
    }

    case "click": {
      let referrerHost = "";
      if (meta.referrer) {
        try {
          referrerHost = new URL(meta.referrer).hostname;
        } catch {
          // Invalid URL - use empty string
        }
      }
      return {
        label: referrerHost ? `Click via ${referrerHost}` : "Click event",
        icon: <MousePointerClick className="h-3 w-3" />,
      };
    }

    case "payouts":
    case "payoutBatches": {
      const amount = meta.amount ?? meta.totalAmount;
      const affiliateCount = meta.affiliateCount;
      if (amount) {
        return {
          label: `Payout ${formatCurrency(amount)}${affiliateCount ? ` (${affiliateCount} affiliates)` : ""}`,
          icon: <DollarSign className="h-3 w-3" />,
        };
      }
      return {
        label: entityType === "payoutBatches" ? "Payout Batch" : "Payout",
        icon: <DollarSign className="h-3 w-3" />,
      };
    }

    case "campaign":
      return {
        label: meta.campaignName ?? meta.name ?? "Campaign",
        icon: <Package className="h-3 w-3" />,
      };

    case "user":
      return {
        label: meta.userName ?? meta.name ?? meta.email ?? "User",
        icon: <User className="h-3 w-3" />,
      };

    case "tenant":
      return {
        label: meta.tenantName ?? meta.name ?? "Account",
        icon: <Users className="h-3 w-3" />,
      };

    default:
      // Fallback: show shortened ID for unknown entity types
      return {
        label: `${entityType} #${entityId.slice(0, 8)}`,
        icon: <ExternalLink className="h-3 w-3" />,
      };
  }
}

const ACTION_COLOR_MAP: Record<string, string> = {
  success: "text-green-600 bg-green-50",
  warning: "text-amber-600 bg-amber-50",
  danger: "text-red-600 bg-red-50",
  info: "text-blue-600 bg-blue-50",
};

const ACTION_SEVERITY_MAP: Record<string, string> = {
  COMMISSION_APPROVED: "success",
  payout_marked_paid: "success",
  batch_marked_paid: "success",
  affiliate_approved: "success",
  affiliate_bulk_approved: "success",
  affiliate_reactivated: "success",
  attribution_click_matched: "success",
  click_recorded: "success",
  conversion_recorded: "success",
  payout_batch_generated: "info",
  COMMISSION_CREATED: "info",
  affiliate_registered: "info",
  organic_conversion_recorded: "info",
  conversion_status_changed: "info",
  conversion_subscription_status_changed: "info",
  COMMISSION_STATUS_CHANGE: "info",
  commission_adjusted_upgrade: "info",
  COMMISSION_DECLINED: "danger",
  COMMISSION_REVERSED: "danger",
  affiliate_rejected: "danger",
  affiliate_suspended: "danger",
  affiliate_bulk_rejected: "danger",
  payout_failed: "danger",
  security_unauthorized_access_attempt: "danger",
  security_cross_tenant_query: "danger",
  security_cross_tenant_mutation: "danger",
  security_authentication_failure: "danger",
  self_referral_detected: "danger",
  email_send_failed: "danger",
  commission_rejected_payment_failed: "danger",
  conversion_recorded_self_referral: "warning",
  click_deduplicated: "warning",
  commission_adjusted_downgrade: "warning",
  commission_rejected_payment_pending: "warning",
  commission_rejected_payment_unknown: "warning",
  commission_creation_skipped: "warning",
  attribution_no_data: "warning",
  attribution_affiliate_invalid: "warning",
  attribution_referral_link_not_found: "warning",
  attribution_no_campaign: "warning",
  attribution_no_matching_click: "warning",
  email_scheduling_failed: "warning",
  fraud_signal_dismissed: "warning",
  fraud_alert_email_failed: "warning",
  payout_processing: "info",
  payout_paid_saligpay: "success",
  commission_adjusted: "info",
  conversion_created_legacy: "info",
};

function getSeverity(action: string): string {
  return ACTION_SEVERITY_MAP[action] ?? "info";
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function MetadataRenderer({ metadata }: { metadata: Record<string, any> }) {
  if (!metadata || Object.keys(metadata).length === 0) return null;

  const currencyKeys = new Set(["amount", "totalAmount", "commissionAmount", "newAmount", "oldAmount"]);
  const statusKeys = new Set(["status", "newStatus", "oldStatus", "paymentStatus"]);
  const reasonKeys = new Set(["reason", "rejectionReason", "declineReason"]);
  const countKeys = new Set(["affiliateCount", "payoutsMarked", "commissionCount"]);
  const booleanKeys = new Set(["emailScheduled", "isFraud", "selfReferral"]);

  const statusColorMap: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    paid: "bg-green-50 text-green-700 border-green-200",
    declined: "bg-red-50 text-red-700 border-red-200",
    reversed: "bg-red-50 text-red-700 border-red-200",
    active: "bg-green-50 text-green-700 border-green-200",
    suspended: "bg-amber-50 text-amber-700 border-amber-200",
  };

  const entries = Object.entries(metadata).filter(([key]) => key !== "_id");
  const knownEntries: Array<{ key: string; value: any }> = [];
  const unknownEntries: Array<[string, any]> = [];

  for (const [key, value] of entries) {
    if (
      currencyKeys.has(key) ||
      statusKeys.has(key) ||
      reasonKeys.has(key) ||
      countKeys.has(key) ||
      booleanKeys.has(key)
    ) {
      knownEntries.push({ key, value });
    } else {
      unknownEntries.push([key, value]);
    }
  }

  if (knownEntries.length === 0 && unknownEntries.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {knownEntries.map(({ key, value }) => (
        <div key={key} className="flex items-center gap-2 text-[12px]">
          <span className="text-[var(--text-muted)] capitalize shrink-0">
            {key.replace(/([A-Z])/g, " $1").trim()}:
          </span>
          {currencyKeys.has(key) && typeof value === "number" ? (
            <span className="font-medium text-[var(--text-heading)]">
              {formatCurrency(value)}
            </span>
          ) : statusKeys.has(key) && typeof value === "string" ? (
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize",
                statusColorMap[value] ?? "bg-muted text-muted-foreground border-[var(--border)]"
              )}
            >
              {value}
            </span>
          ) : booleanKeys.has(key) && typeof value === "boolean" ? (
            <span className={value ? "text-green-600" : "text-red-600"}>
              {value ? "Yes" : "No"}
            </span>
          ) : countKeys.has(key) && typeof value === "number" ? (
            <span className="font-medium text-[var(--text-heading)]">{value}</span>
          ) : (
            <span className="text-[var(--text-heading)]">{value}</span>
          )}
        </div>
      ))}
      {unknownEntries.length > 0 && (
        <pre className="mt-2 p-2 bg-muted/50 rounded text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(Object.fromEntries(unknownEntries), null, 2)}
        </pre>
      )}
    </div>
  );
}

export function AuditLogEntry({ log, onEntityClick }: AuditLogEntryProps) {
  const [expanded, setExpanded] = useState(false);

  const severity = getSeverity(log.action);
  const colorClass = ACTION_COLOR_MAP[severity] ?? ACTION_COLOR_MAP.info;
  const actionLabel = getAuditActionLabel(log.action);
  const entityDisplay = log.entityId
    ? getEntityDisplayLabel(log.entityType, log.entityId, log.metadata)
    : null;

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
    >
      <div className={cn("flex-shrink-0 rounded-full p-2", colorClass)}>
        <Clock className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-[var(--text-heading)]">
              {actionLabel}
            </span>
            {log.entityType && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-[var(--text-muted)] border border-[var(--border)] capitalize">
                {log.entityType.replace(/([A-Z])/g, " $1").trim()}
              </span>
            )}
          </div>
          <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">
            {formatRelativeTime(log._creationTime)}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] flex-wrap">
          {entityDisplay && (
            <button
              type="button"
              onClick={() => onEntityClick?.(log.entityType, log.entityId)}
              className="inline-flex items-center gap-1 text-[11px] text-[var(--brand-primary)] hover:underline cursor-pointer"
              title={`View ${log.entityType} details`}
            >
              {entityDisplay.icon}
              {entityDisplay.label}
            </button>
          )}
          {log.actorName && (
            <span>
              by{" "}
              <span className="font-medium text-[var(--text-heading)]">
                {log.actorName}
              </span>
            </span>
          )}
        </div>

        {expanded && <MetadataRenderer metadata={log.metadata} />}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex-shrink-0 p-1 rounded hover:bg-muted text-[var(--text-muted)]"
      >
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
