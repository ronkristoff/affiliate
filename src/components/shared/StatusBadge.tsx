"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AffiliateStatus = "pending" | "active" | "suspended" | "rejected";
type CommissionStatus = "approved" | "pending" | "reversed" | "paid";
type PayoutStatus = "processing" | "paid" | "pending_payout";

type Status = AffiliateStatus | CommissionStatus | PayoutStatus;

interface StatusBadgeProps {
  status: Status | string;
  className?: string;
}

// Design system: dot indicator badge pattern
// Supports affiliate, commission, and payout statuses
const statusConfig: Record<Status, { label: string; dotColor: string; bgClass: string; textClass: string }> = {
  // Affiliate statuses
  pending: {
    label: "Pending",
    dotColor: "#f59e0b", // warning
    bgClass: "bg-[var(--warning-bg)]",
    textClass: "text-[var(--warning-text)]",
  },
  active: {
    label: "Active",
    dotColor: "#10b981", // success
    bgClass: "bg-[var(--success-bg)]",
    textClass: "text-[var(--success-text)]",
  },
  suspended: {
    label: "Suspended",
    dotColor: "#6b7280", // gray
    bgClass: "bg-[var(--bg-page)]",
    textClass: "text-[var(--text-body)]",
  },
  rejected: {
    label: "Rejected",
    dotColor: "#ef4444", // danger
    bgClass: "bg-[var(--danger-bg)]",
    textClass: "text-[var(--danger-text)]",
  },
  // Commission statuses
  approved: {
    label: "Approved",
    dotColor: "#10b981", // success
    bgClass: "bg-[var(--success-bg)]",
    textClass: "text-[var(--success-text)]",
  },
  reversed: {
    label: "Reversed",
    dotColor: "#ef4444", // danger
    bgClass: "bg-[var(--danger-bg)]",
    textClass: "text-[var(--danger-text)]",
  },
  paid: {
    label: "Paid",
    dotColor: "#6b7280", // gray
    bgClass: "bg-[var(--bg-page)]",
    textClass: "text-[var(--text-body)]",
  },
  // Payout statuses
  processing: {
    label: "Processing",
    dotColor: "#3b82f6", // blue
    bgClass: "bg-[var(--info-bg)]",
    textClass: "text-[var(--info-text)]",
  },
  pending_payout: {
    label: "Pending",
    dotColor: "#f59e0b", // warning
    bgClass: "bg-[var(--warning-bg)]",
    textClass: "text-[var(--warning-text)]",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as Status] || {
    label: status,
    dotColor: "#6b7280",
    bgClass: "bg-[var(--bg-page)]",
    textClass: "text-[var(--text-body)]",
  };

  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
        config.bgClass,
        config.textClass,
        className
      )}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: config.dotColor }}
      />
      {config.label}
    </Badge>
  );
}
