"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { Info } from "lucide-react";

interface CommissionComputationProps {
  variant: "full" | "simplified";
  commissionType: string;
  effectiveRate: number;
  campaignDefaultRate?: number;
  isOverride?: boolean;
  saleAmount?: number | null;
  amount: number;
  recurringCommission?: boolean;
  recurringRate?: number;
  recurringRateType?: string;
  currency?: string;
}

function getRecurringDescription(
  recurringRateType: string | undefined,
  recurringRate: number | undefined
): string {
  switch (recurringRateType) {
    case "same":
      return "Same rate as initial";
    case "reduced":
      return recurringRate != null
        ? `Reduced (${recurringRate}%)`
        : "Reduced (50% of initial)";
    case "custom":
      return recurringRate != null
        ? `Custom (${recurringRate}%)`
        : "Custom (same as initial)";
    default:
      return recurringRateType
        ? "Uses standard rate"
        : "Standard rate (no recurring config)";
  }
}

export function CommissionComputationSection({
  variant,
  commissionType,
  effectiveRate,
  campaignDefaultRate,
  isOverride,
  saleAmount,
  amount,
  recurringCommission,
  recurringRate,
  recurringRateType,
  currency,
}: CommissionComputationProps) {
  const isPercentage = commissionType === "percentage";
  const isCampaignDeleted = commissionType === "N/A";

  // Campaign deleted fallback
  if (isCampaignDeleted) {
    return (
      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <p className="text-[13px] font-medium text-[var(--text-heading)]">
          Commission Computation
        </p>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
          Campaign no longer exists
        </p>
      </div>
    );
  }

  const rateDisplay = isPercentage
    ? `${effectiveRate}%`
    : formatCurrency(effectiveRate, currency);

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      {/* Section header */}
      <div className="flex items-center gap-1.5">
        <p className="text-[13px] font-medium text-[var(--text-heading)]">
          Commission Computation
        </p>
        {variant === "simplified" && (
          <span className="relative" title="Commission rate set by program owner">
            <Info className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </span>
        )}
      </div>

      {variant === "full" && (
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
          Shows current campaign settings — actual rate may have differed at time
          of creation.
        </p>
      )}

      <div className="mt-3 space-y-2.5">
        {/* Commission Type (full variant only) */}
        {variant === "full" && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--text-muted)]">Type</span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                isPercentage
                  ? "bg-blue-50 text-blue-700"
                  : "bg-emerald-50 text-emerald-700"
              )}
            >
              {isPercentage ? "Percentage" : "Flat Fee"}
            </span>
          </div>
        )}

        {/* Rate Applied */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[var(--text-muted)]">
            Rate Applied
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[var(--text-heading)]">
              {rateDisplay}
            </span>
            {variant === "full" && isOverride && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                Custom Override
              </span>
            )}
            {variant === "full" && !isOverride && campaignDefaultRate != null && (
              <span className="text-[11px] text-[var(--text-muted)]">
                ({isPercentage ? `${campaignDefaultRate}%` : formatCurrency(campaignDefaultRate, currency)}{" "}
                campaign default)
              </span>
            )}
          </div>
        </div>

        {/* Sale Amount (percentage only) */}
        {isPercentage && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--text-muted)]">
              Sale Amount
            </span>
            <span className="text-[13px] font-semibold text-[var(--text-heading)]">
              {saleAmount != null ? formatCurrency(saleAmount, currency) : "N/A"}
            </span>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-[var(--border-light)]" />

        {/* Commission amount */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[var(--text-muted)]">Commission</span>
          <span className="text-[14px] font-bold text-[var(--text-heading)]">
            {formatCurrency(amount, currency)}
          </span>
        </div>

        {/* Recurring info (full variant only) */}
        {variant === "full" && recurringCommission && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--text-muted)]">Recurring</span>
            <span className="text-[13px] font-medium text-[var(--text-heading)]">
              {getRecurringDescription(recurringRateType, recurringRate)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
