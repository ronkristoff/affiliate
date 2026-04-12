"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailEventEntry {
  _id: string;
  _creationTime: number;
  tenantId: string;
  type: string;
  recipientEmail: string;
  subject: string;
  status: string;
  provider?: string;
  deliveryStatus?: string;
  sentAt?: number;
  deliveredAt?: number;
  openedAt?: number;
  bounceReason?: string;
  complaintReason?: string;
  errorMessage?: string;
  tenantName?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDeliveryConfig(deliveryStatus?: string): {
  icon: React.ReactNode;
  label: string;
  color: string;
} {
  switch (deliveryStatus) {
    case "delivered":
    case "opened":
    case "clicked":
      return {
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        label: deliveryStatus === "opened" ? "Opened" : deliveryStatus === "clicked" ? "Clicked" : "Delivered",
        color: "text-emerald-600",
      };
    case "bounced":
      return {
        icon: <XCircle className="w-3.5 h-3.5" />,
        label: "Bounced",
        color: "text-red-500",
      };
    case "complained":
      return {
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        label: "Complained",
        color: "text-red-500",
      };
    case "sent":
    case "queued":
      return {
        icon: <Mail className="w-3.5 h-3.5" />,
        label: deliveryStatus === "queued" ? "Queued" : "Sent",
        color: "text-blue-500",
      };
    default:
      return {
        icon: <Mail className="w-3.5 h-3.5 text-[var(--text-muted)]" />,
        label: "Unknown",
        color: "text-[var(--text-muted)]",
      };
  }
}

function getDeliveryBadgeVariant(
  deliveryStatus?: string,
): "success" | "destructive" | "warning" | "info" | "outline" {
  switch (deliveryStatus) {
    case "delivered":
    case "opened":
    case "clicked":
      return "success";
    case "bounced":
    case "complained":
      return "destructive";
    case "sent":
      return "info";
    case "queued":
      return "warning";
    default:
      return "outline";
  }
}

function formatEmailType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimelineEmailEvent({ entry }: { entry: EmailEventEntry }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const deliveryConfig = getDeliveryConfig(entry.deliveryStatus);
  const badgeVariant = getDeliveryBadgeVariant(entry.deliveryStatus);
  const timeAgo = formatDistanceToNow(new Date(entry._creationTime), { addSuffix: true });
  const absoluteTime = format(new Date(entry._creationTime), "MMM d, yyyy 'at' h:mm a");

  // Determine severity dot color
  const severityColor = entry.deliveryStatus === "bounced" || entry.deliveryStatus === "complained"
    ? "bg-red-500 ring-red-500/20"
    : entry.deliveryStatus === "delivered" || entry.deliveryStatus === "opened"
      ? "bg-emerald-500 ring-emerald-500/20"
      : "bg-blue-500 ring-blue-500/20";

  // Auth-category emails use lock icon, others use mail
  const emailIcon = (
    <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer",
        "hover:bg-[var(--brand-light)]/20",
      )}
      onClick={() => setIsExpanded((prev) => !prev)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setIsExpanded((prev) => !prev);
        }
      }}
    >
      {/* Severity dot */}
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div className={cn("w-2.5 h-2.5 rounded-full ring-4", severityColor)} />
      </div>

      {/* Icon + content */}
      <div className="flex-1 min-w-0">
        {/* Top row */}
        <div className="flex items-center gap-2 flex-wrap">
          {emailIcon}
          <span className="text-[13px] font-semibold text-[var(--text-heading)]">
            {formatEmailType(entry.type)}
          </span>
          <Badge variant={badgeVariant} className="text-[9px] px-1.5 py-0">
            {deliveryConfig.label}
          </Badge>
          {entry.provider && (
            <span className="text-[10px] text-[var(--text-muted)] uppercase">{entry.provider}</span>
          )}
        </div>

        {/* Subject */}
        <div className="mt-0.5 text-[12px] text-[var(--text-muted)] truncate">
          {entry.subject}
        </div>

        {/* Timestamp */}
        <div className="mt-0.5 text-[11px] text-[var(--text-muted)]" title={absoluteTime}>
          {timeAgo}
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[var(--bg-page)] rounded-md px-3 py-2 text-[11px] font-mono text-[var(--text-body)] space-y-0.5">
              <div>To: {entry.recipientEmail}</div>
              <div>Type: {entry.type}</div>
              {entry.provider && <div>Provider: {entry.provider}</div>}
              {entry.sentAt && <div>Sent: {format(new Date(entry.sentAt), "MMM d, yyyy 'at' h:mm a")}</div>}
              {entry.deliveredAt && <div>Delivered: {format(new Date(entry.deliveredAt), "MMM d, yyyy 'at' h:mm a")}</div>}
              {entry.openedAt && <div>Opened: {format(new Date(entry.openedAt), "MMM d, yyyy 'at' h:mm a")}</div>}
            </div>
            {entry.bounceReason && (
              <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-[11px] text-red-600">
                <div className="font-semibold mb-0.5">Bounce Reason:</div>
                <div className="font-mono">{entry.bounceReason}</div>
              </div>
            )}
            {entry.complaintReason && (
              <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-[11px] text-red-600">
                <div className="font-semibold mb-0.5">Complaint:</div>
                <div className="font-mono">{entry.complaintReason}</div>
              </div>
            )}
            {entry.errorMessage && (
              <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-[11px] text-amber-600">
                <div className="font-semibold mb-0.5">Error:</div>
                <div className="font-mono">{entry.errorMessage}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
