"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AffiliateStatus = "pending" | "active" | "suspended" | "rejected";

interface StatusBadgeProps {
  status: AffiliateStatus | string;
  className?: string;
}

const statusConfig: Record<AffiliateStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  pending: {
    label: "Pending Review",
    variant: "outline",
    color: "#F59E0B", // amber-500
  },
  active: {
    label: "Active",
    variant: "default",
    color: "#10B981", // emerald-500
  },
  suspended: {
    label: "Suspended",
    variant: "secondary",
    color: "#6B7280", // gray-500
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
    color: "#EF4444", // red-500
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as AffiliateStatus] || {
    label: status,
    variant: "outline",
    color: "#6B7280",
  };

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "flex items-center gap-1.5 font-medium",
        className
      )}
      style={{
        borderColor: config.variant === "outline" ? config.color : undefined,
        color: config.variant === "outline" ? config.color : undefined,
      }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </Badge>
  );
}
