"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AffiliateStatus = "pending" | "active" | "suspended" | "rejected";
type CommissionStatus = "confirmed" | "pending" | "reversed" | "paid";
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
    bgClass: "bg-[#fef3c7]",
    textClass: "text-[#92400e]",
  },
  active: {
    label: "Active",
    dotColor: "#10b981", // success
    bgClass: "bg-[#d1fae5]",
    textClass: "text-[#065f46]",
  },
  suspended: {
    label: "Suspended",
    dotColor: "#6b7280", // gray
    bgClass: "bg-[#f3f4f6]",
    textClass: "text-[#374151]",
  },
  rejected: {
    label: "Rejected",
    dotColor: "#ef4444", // danger
    bgClass: "bg-[#fee2e2]",
    textClass: "text-[#991b1b]",
  },
  // Commission statuses
  confirmed: {
    label: "Confirmed",
    dotColor: "#10b981", // success
    bgClass: "bg-[#d1fae5]",
    textClass: "text-[#065f46]",
  },
  reversed: {
    label: "Reversed",
    dotColor: "#ef4444", // danger
    bgClass: "bg-[#fee2e2]",
    textClass: "text-[#991b1b]",
  },
  paid: {
    label: "Paid",
    dotColor: "#6b7280", // gray
    bgClass: "bg-[#f3f4f6]",
    textClass: "text-[#374151]",
  },
  // Payout statuses
  processing: {
    label: "Processing",
    dotColor: "#3b82f6", // blue
    bgClass: "bg-[#dbeafe]",
    textClass: "text-[#1e40af]",
  },
  pending_payout: {
    label: "Pending",
    dotColor: "#f59e0b", // warning
    bgClass: "bg-[#fef3c7]",
    textClass: "text-[#92400e]",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as Status] || {
    label: status,
    dotColor: "#6b7280",
    bgClass: "bg-[#f3f4f6]",
    textClass: "text-[#374151]",
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
