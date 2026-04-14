"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getAuditActionLabel } from "@/lib/audit-constants";
import { formatRelativeTime, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChevronRight, Clock, ExternalLink, AlertTriangle } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

interface AffiliateTimelineProps {
  affiliateId: Id<"affiliates">;
  affiliateName: string;
  startDate?: number;
}

const ACTION_SEVERITY: Record<string, "success" | "warning" | "error" | "info"> = {
  COMMISSION_APPROVED: "success",
  payout_marked_paid: "success",
  batch_marked_paid: "success",
  COMMISSION_DECLINED: "error",
  COMMISSION_REVERSED: "error",
  payout_failed: "error",
  commission_rejected_payment_failed: "error",
  affiliate_suspended: "error",
  self_referral_detected: "error",
  FRAUD_SIGNAL_ADDED: "error",
  conversion_recorded_self_referral: "warning",
  commission_adjusted_downgrade: "warning",
  affiliate_rejected: "warning",
  attribution_no_matching_click: "warning",
};

const SEVERITY_COLORS = {
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
};

function getActionSeverity(action: string): "success" | "warning" | "error" | "info" {
  return ACTION_SEVERITY[action] ?? "info";
}

function getEventSummary(action: string, metadata?: Record<string, any>): string {
  const meta = metadata ?? {};
  
  if (meta.amount) {
    const amount = formatCurrency(meta.amount);
    if (action.includes("commission") || action.includes("COMMISSION")) {
      return amount;
    }
    if (action.includes("payout")) {
      return amount;
    }
  }
  
  if (meta.campaignName) {
    return meta.campaignName;
  }
  
  if (meta.customerEmail) {
    return meta.customerEmail;
  }
  
  return "";
}

export function AffiliateTimeline({
  affiliateId,
  affiliateName,
  startDate,
}: AffiliateTimelineProps) {
  const timelineResult = useQuery(api.audit.getAffiliateActivityTimeline, {
    affiliateId,
    startDate,
    paginationOpts: { numItems: 20, cursor: null },
  });

  if (timelineResult === undefined) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-5 w-5 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const entries = timelineResult.page;

  if (entries.length === 0) {
    return (
      <div className="p-6 text-center text-[12px] text-[var(--text-muted)]">
        No activity recorded in this time period.
      </div>
    );
  }

  interface TimelineEntry {
    _id: string;
    _creationTime: number;
    action: string;
    entityType: string;
    entityId: string;
    actorName?: string;
    actorType: string;
    metadata?: Record<string, any>;
  }

  return (
    <div className="p-4">
      <div className="space-y-1">
        {entries.map((entry: TimelineEntry, index: number) => {
          const severity = getActionSeverity(entry.action);
          const colorClass = SEVERITY_COLORS[severity];
          const summary = getEventSummary(entry.action, entry.metadata);
          const isLast = index === entries.length - 1;

          return (
            <div
              key={entry._id}
              className="flex items-start gap-3 py-2"
            >
              {/* Timeline connector */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "h-5 w-5 rounded-full flex items-center justify-center text-[10px]",
                    colorClass
                  )}
                >
                  {severity === "error" ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : severity === "success" ? (
                    <span className="font-bold">✓</span>
                  ) : (
                    <span className="font-bold">•</span>
                  )}
                </div>
                {!isLast && (
                  <div className="w-px h-full bg-[var(--border)] min-h-[20px]" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-[var(--text-heading)]">
                    {getAuditActionLabel(entry.action)}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                    {formatRelativeTime(entry._creationTime)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text-muted)]">
                  {summary && (
                    <span className="font-medium text-[var(--text-heading)]">
                      {summary}
                    </span>
                  )}
                  {entry.actorName && (
                    <span>by {entry.actorName}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View More */}
      {!timelineResult.isDone && (
        <div className="pt-3 border-t mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-[11px] text-[var(--text-muted)]"
          >
            View More Activity
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
