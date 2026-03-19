"use client";

import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, CheckCircle2 } from "lucide-react";

interface BatchStatusBadgeProps {
  status: string;
}

/**
 * Shared status badge component for payout batch status display.
 * Design system pattern: dot indicator badges with rounded-full style
 * 
 * Status mapping:
 * - pending: Amber/yellow with Clock icon
 * - processing: Blue with spinning Loader icon  
 * - completed: Green with CheckCircle icon
 */
const statusConfig: Record<string, { dotColor: string; bgClass: string; textClass: string }> = {
  pending: {
    dotColor: "#f59e0b",
    bgClass: "bg-[#fef3c7]",
    textClass: "text-[#92400e]",
  },
  processing: {
    dotColor: "#3b82f6",
    bgClass: "bg-[#dbeafe]",
    textClass: "text-[#1e40af]",
  },
  completed: {
    dotColor: "#10b981",
    bgClass: "bg-[#d1fae5]",
    textClass: "text-[#065f46]",
  },
};

export function BatchStatusBadge({ status }: BatchStatusBadgeProps) {
  const config = statusConfig[status] || {
    dotColor: "#6b7280",
    bgClass: "bg-[#f3f4f6]",
    textClass: "text-[#374151]",
  };

  const icons: Record<string, React.ReactNode> = {
    pending: <Clock className="w-3 h-3" />,
    processing: <Loader2 className="w-3 h-3 animate-spin" />,
    completed: <CheckCircle2 className="w-3 h-3" />,
  };

  const labels: Record<string, string> = {
    pending: "Pending",
    processing: "Processing",
    completed: "Paid",
  };

  return (
    <Badge
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.bgClass} ${config.textClass}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: config.dotColor }}
      />
      {icons[status]}
      {labels[status] || status}
    </Badge>
  );
}
