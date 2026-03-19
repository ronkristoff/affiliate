"use client";

import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, CheckCircle2 } from "lucide-react";

interface BatchStatusBadgeProps {
  status: string;
}

/**
 * Shared status badge component for payout batch status display.
 * Used across PayoutsClient and PayoutHistoryClient.
 * 
 * Status mapping:
 * - pending: Amber/yellow with Clock icon
 * - processing: Blue with spinning Loader icon
 * - completed: Green with CheckCircle icon
 */
export function BatchStatusBadge({ status }: BatchStatusBadgeProps) {
  switch (status) {
    case "pending":
      return (
        <Badge
          variant="outline"
          className="border-amber-200 bg-amber-50 text-amber-700"
        >
          <Clock className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      );
    case "processing":
      return (
        <Badge
          variant="outline"
          className="border-blue-200 bg-blue-50 text-blue-700"
        >
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Processing
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Paid
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
