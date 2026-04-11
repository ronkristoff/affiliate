"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommissionComputationSection } from "@/components/shared/CommissionComputationSection";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CommissionDetailDrawerProps {
  commission: {
    _id: string;
    amount: number;
    status: string;
    campaignName: string;
    createdAt: number;
    customerEmail?: string;
    conversionId?: string;
    commissionType?: string;
    effectiveRate?: number;
    saleAmount?: number | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  approved: { bg: "bg-[#d1fae5]", text: "text-[#065f46]" },
  pending: { bg: "bg-[#fef3c7]", text: "text-[#92400e]" },
  reversed: { bg: "bg-[#fee2e2]", text: "text-[#991b1b]" },
  paid: { bg: "bg-[#f3f4f6]", text: "text-[#374151]" },
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  paid: "Paid",
  reversed: "Declined",
};

export function CommissionDetailDrawer({
  commission,
  isOpen,
  onClose,
}: CommissionDetailDrawerProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!commission) return null;

  const styles = STATUS_STYLES[commission.status] || STATUS_STYLES.pending;
  const statusLabel = STATUS_LABELS[commission.status] || commission.status;
  const customerName = commission.customerEmail || "A new user";
  const planName = "a subscription";

  const timelineSteps = (() => {
    if (commission.status === "paid") {
      return [
        { label: "Pending", done: true, date: formatDate(commission.createdAt) },
        { label: "Approved", done: true, date: null },
        { label: "Paid", done: true, date: null },
      ];
    }
    if (commission.status === "approved") {
      return [
        { label: "Pending", done: true, date: formatDate(commission.createdAt) },
        { label: "Approved", done: true, date: null },
        { label: "Paid", done: false, date: null },
      ];
    }
    if (commission.status === "reversed") {
      return [
        { label: "Pending", done: true, date: formatDate(commission.createdAt) },
        { label: "Declined", done: true, date: null },
      ];
    }
    return [
      { label: "Pending", done: true, date: formatDate(commission.createdAt) },
      { label: "Approved", done: false, date: null },
      { label: "Paid", done: false, date: null },
    ];
  })();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">Commission Details</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <DialogDescription className="sr-only">
            Details for commission {commission._id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <p className="text-[15px] text-[var(--text-heading)] leading-relaxed">
            You referred{" "}
            <span className="font-semibold">{customerName}</span> on{" "}
            <span className="font-semibold">{formatDate(commission.createdAt)}</span>.
            They signed up for{" "}
            <span className="font-semibold">{planName}</span>. You earned{" "}
            <span className="font-bold text-[var(--portal-primary)]">
              {formatCurrency(commission.amount)}
            </span>.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text-heading)]">
                {formatCurrency(commission.amount)}
              </span>
              <span
                className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                  styles.bg,
                  styles.text
                )}
              >
                {statusLabel}
              </span>
            </div>

            <div className="flex items-center gap-0">
              {timelineSteps.map((step, idx) => (
                <div key={step.label} className="flex-1 flex flex-col items-center">
                  <div className="flex items-center w-full">
                    {idx > 0 && (
                      <div
                        className={cn(
                          "h-0.5 flex-1 -ml-2 mr-2",
                          step.done ? "bg-[var(--portal-primary)]" : "bg-border"
                        )}
                      />
                    )}
                    <div
                      className={cn(
                        "h-3 w-3 rounded-full border-2 flex-shrink-0",
                        step.done
                          ? "bg-[var(--portal-primary)] border-[var(--portal-primary)]"
                          : "bg-background border-border"
                      )}
                    />
                    {idx < timelineSteps.length - 1 && (
                      <div
                        className={cn(
                          "h-0.5 flex-1 ml-2",
                          timelineSteps[idx + 1]?.done
                            ? "bg-[var(--portal-primary)]"
                            : "bg-border"
                        )}
                      />
                    )}
                  </div>
                  <p
                    className={cn(
                      "text-[11px] mt-1.5",
                      step.done
                        ? "text-[var(--text-heading)] font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                  {step.date && (
                    <p className="text-[10px] text-muted-foreground">
                      {step.date}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <CommissionComputationSection
            variant="simplified"
            commissionType={commission.commissionType ?? "percentage"}
            effectiveRate={commission.effectiveRate ?? 0}
            saleAmount={commission.saleAmount ?? null}
            amount={commission.amount}
            currency="PHP"
          />

          {commission.status === "pending" && (
            <div className="bg-[#fef3c7] p-4 rounded-lg">
              <p className="text-sm font-medium text-[#92400e]">
                Under Review
              </p>
              <p className="text-sm text-[#92400e]/80 mt-1">
                This commission is being reviewed to ensure it meets our quality
                standards. Review typically takes 14-30 days. You&apos;ll be
                notified once approved.
              </p>
            </div>
          )}

          <div className="border-t border-border">
            <Button
              variant="ghost"
              onClick={() => setShowDetails((prev) => !prev)}
              className="flex items-center justify-between w-full py-3 text-sm font-medium text-[var(--text-heading)] h-auto justify-start"
            >
              Details
              {showDetails ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
              )}
            </Button>

            {showDetails && (
              <div className="grid grid-cols-2 gap-4 pb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Campaign</p>
                  <p className="text-sm font-medium">{commission.campaignName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium">{formatDate(commission.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="text-sm font-medium">
                    {commission.customerEmail || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Commission ID</p>
                  <p className="text-sm font-medium text-xs truncate">
                    {commission._id}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
