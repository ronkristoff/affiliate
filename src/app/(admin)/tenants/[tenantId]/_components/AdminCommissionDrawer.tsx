"use client";

import { useState, useEffect } from "react";
import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CommissionComputationSection } from "@/components/shared/CommissionComputationSection";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";

// ---------------------------------------------------------------------------
// Status config — consistent with owner commissions page
// ---------------------------------------------------------------------------

const commissionStatusConfig: Record<
  string,
  { label: string; dotColor: string; bgClass: string; textClass: string }
> = {
  pending: { label: "Pending", dotColor: "#f59e0b", bgClass: "bg-[var(--warning-bg)]", textClass: "text-[var(--warning-text)]" },
  approved: { label: "Approved", dotColor: "#10b981", bgClass: "bg-[var(--success-bg)]", textClass: "text-[var(--success-text)]" },
  reversed: { label: "Reversed", dotColor: "#ef4444", bgClass: "bg-[var(--danger-bg)]", textClass: "text-[var(--danger-text)]" },
  declined: { label: "Declined", dotColor: "#ef4444", bgClass: "bg-[var(--danger-bg)]", textClass: "text-[var(--danger-text)]" },
  paid: { label: "Paid", dotColor: "#6b7280", bgClass: "bg-[var(--bg-page)]", textClass: "text-[var(--text-body)]" },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AdminCommissionDrawerProps {
  tenantId: Id<"tenants">;
  commissionId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Detail row helper (same pattern as owner commissions page)
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[var(--border-light)]">
      <span className="text-[12px] text-[var(--text-muted)]">{label}</span>
      <span className="text-[13px] font-semibold text-[var(--text-heading)] text-right break-all max-w-[60%]">
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner drawer content (uses useQuery, needs Suspense)
// ---------------------------------------------------------------------------

function AdminCommissionDrawerContent({
  tenantId,
  commissionId,
}: {
  tenantId: Id<"tenants">;
  commissionId: string;
}) {
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [showSourceEvent, setShowSourceEvent] = useState(false);

  // Reset collapsible sections when commission changes
  useEffect(() => {
    setShowAuditTrail(false);
    setShowSourceEvent(false);
  }, [commissionId]);

  const detail = useQuery(
    api.admin.tenants.getAdminCommissionDetail,
    { tenantId, commissionId: commissionId as Id<"commissions"> }
  );

  if (detail === undefined) {
    return (
      <div className="space-y-6">
        <div className="bg-[var(--bg-page)] rounded-xl p-5">
          <Skeleton className="h-4 w-32 mb-3" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between py-2 border-b border-[var(--border-light)]">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="flex items-center justify-center py-20 text-[13px] text-[var(--text-muted)]">
        Commission not found
      </div>
    );
  }

  const statusConfig = commissionStatusConfig[detail.status] ?? {
    label: detail.status,
    dotColor: "#6b7280",
    bgClass: "bg-[#f3f4f6]",
    textClass: "text-[#374151]",
  };

  const formatDetailDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Amount Hero */}
      <div className="bg-[var(--bg-page)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Commission Amount
          </span>
          <Badge
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
              statusConfig.bgClass,
              statusConfig.textClass
            )}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: statusConfig.dotColor }}
            />
            {statusConfig.label}
          </Badge>
        </div>
        <span
          className={`text-[28px] font-bold ${
            detail.status === "reversed" || detail.status === "declined"
              ? "text-[var(--danger)]"
              : "text-[var(--text-heading)]"
          }`}
        >
          {formatCurrency(detail.amount)}
        </span>
      </div>

      {/* Commission Computation Breakdown */}
      <CommissionComputationSection
        variant="full"
        commissionType={detail.commissionType ?? "N/A"}
        effectiveRate={detail.effectiveRate ?? 0}
        campaignDefaultRate={detail.campaignDefaultRate}
        isOverride={detail.isOverride}
        saleAmount={detail.saleAmount ?? null}
        amount={detail.amount}
        recurringCommission={detail.recurringCommission}
        recurringRate={detail.recurringRate}
        recurringRateType={detail.recurringRateType}
        currency="PHP"
      />

      {/* Commission Details */}
      <div>
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)] mb-3">
          Commission Details
        </h4>
        <div className="space-y-0">
          <DetailRow label="Affiliate" value={`${detail.affiliateName} (${detail.affiliateEmail})`} />
          <DetailRow label="Customer Email" value={detail.customerEmail || "—"} />
          <DetailRow label="Campaign" value={detail.campaignName} />
          <DetailRow label="Plan / Event" value={detail.planEvent} />
          {detail.planInfo && (
            <DetailRow label="Plan Info" value={detail.planInfo} />
          )}
          <DetailRow
            label="SaligPay Tx ID"
            value={detail.eventMetadata?.transactionId || detail.transactionId || "—"}
          />
          <DetailRow
            label="Date Created"
            value={formatDetailDate(detail._creationTime)}
          />
          {detail.reversalReason && (
            <DetailRow label="Reversal Reason" value={detail.reversalReason} />
          )}
        </div>
      </div>

      {/* Activity Timeline (collapsible) */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAuditTrail(!showAuditTrail)}
          className="flex w-full items-center justify-between h-auto px-0 hover:bg-transparent"
        >
          <span className="text-[13px] font-medium text-[var(--text-heading)]">
            Activity Timeline
          </span>
          {showAuditTrail ? (
            <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
          )}
        </Button>
        {showAuditTrail && (
          <div className="mt-3">
            {(detail.auditTrail?.length ?? 0) === 1 &&
            detail.auditTrail?.[0]?.action === "COMMISSION_CREATED" ? (
              <div className="mb-3 rounded-md bg-blue-50 p-2 text-[11px] text-blue-700">
                Auto-approved — no manual review events.
              </div>
            ) : null}
            <ActivityTimeline activities={detail.auditTrail ?? []} />
          </div>
        )}
      </div>

      {/* Source Event Metadata (collapsible) */}
      {detail.eventMetadata && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSourceEvent(!showSourceEvent)}
            className="flex w-full items-center justify-between h-auto px-0 hover:bg-transparent"
          >
            <span className="text-[13px] font-medium text-[var(--text-heading)]">
              Source Event
            </span>
            {showSourceEvent ? (
              <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
            )}
          </Button>
          {showSourceEvent && (
            <div className="mt-3 space-y-0">
              <DetailRow label="Source" value={detail.eventMetadata.source} />
              <DetailRow
                label="Transaction ID"
                value={detail.eventMetadata.transactionId ?? "N/A"}
              />
              <DetailRow
                label="Timestamp"
                value={formatDetailDate(new Date(detail.eventMetadata.timestamp).getTime())}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported drawer component (wraps content in Suspense)
// ---------------------------------------------------------------------------

export function AdminCommissionDrawer({
  tenantId,
  commissionId,
  isOpen,
  onClose,
}: AdminCommissionDrawerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-lg font-bold">Commission Detail</SheetTitle>
          {commissionId && (
            <SheetDescription className="text-[12px] text-[var(--text-muted)]">
              Viewing commission details for this tenant
            </SheetDescription>
          )}
        </SheetHeader>

        {commissionId ? (
          <Suspense fallback={<div className="h-[300px]" />}>
            <AdminCommissionDrawerContent
              tenantId={tenantId}
              commissionId={commissionId}
            />
          </Suspense>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
