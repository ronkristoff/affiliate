"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Calculator } from "lucide-react";
import { DEFAULT_REDUCED_RATE_PERCENTAGE, getEffectiveRecurringRate, getRecurringRateDescription } from "@/lib/utils";

interface CommissionPreviewProps {
  commissionType: "percentage" | "flatFee";
  commissionRate: number;
  exampleAmount?: number;
  recurringCommissions?: boolean;
  recurringRateType?: "same" | "reduced" | "custom";
  recurringRate?: number;
}

/**
 * Commission Preview Component
 * 
 * Displays a live preview of commission calculation based on the
 * selected commission type and rate. Shows example calculation
 * with Philippine Peso (₱) currency.
 * 
 * AC #4: "Example: ₱1,000.00 sale × 15% = ₱150.00 commission"
 */
export function CommissionPreview({
  commissionType,
  commissionRate,
  exampleAmount = 1000,
  recurringCommissions = false,
  recurringRateType = "same",
  recurringRate,
}: CommissionPreviewProps) {
  // Don't show preview if no rate is provided
  if (!commissionRate || isNaN(commissionRate) || commissionRate <= 0) {
    return null;
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatRate = (rate: number, type: "percentage" | "flatFee"): string => {
    if (type === "percentage") {
      return `${rate}%`;
    }
    return formatCurrency(rate);
  };

  const calculateCommission = (
    rate: number,
    type: "percentage" | "flatFee",
    amount: number
  ): number => {
    if (type === "percentage") {
      return amount * (rate / 100);
    }
    return rate;
  };

  const commission = calculateCommission(commissionRate, commissionType, exampleAmount);
  const effectiveRecurringRate = recurringCommissions
    ? getEffectiveRecurringRate(commissionRate, recurringRateType, recurringRate)
    : commissionRate;
  const recurringCommission = calculateCommission(effectiveRecurringRate, commissionType, exampleAmount);

  // Build the preview text based on commission type
  const buildPreviewText = (): string => {
    const formattedAmount = formatCurrency(exampleAmount);
    const formattedCommission = formatCurrency(commission);

    if (commissionType === "percentage") {
      return `Example: ${formattedAmount} sale × ${commissionRate}% = ${formattedCommission} commission`;
    } else {
      return `Example: ${formattedCommission} commission per sale (flat fee)`;
    }
  };

  // Build recurring preview text
  const buildRecurringPreviewText = (): string => {
    if (!recurringCommissions) {
      return "";
    }

    const formattedRecurringCommission = formatCurrency(recurringCommission);
    const rateDescription = getRecurringRateDescription(
      recurringRateType,
      recurringRate,
      commissionRate
    ).toLowerCase();

    return `Recurring: ${formattedRecurringCommission} (${rateDescription})`;
  };

  return (
    <Card className="bg-muted/50 border-dashed">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <Calculator className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Commission Preview
            </p>
            <p className="text-base text-foreground">
              {buildPreviewText()}
            </p>
            {commissionType === "percentage" && (
              <p className="text-xs text-muted-foreground">
                Formula: saleAmount × {commissionRate}% = commission
              </p>
            )}
            {recurringCommissions && (
              <>
                <p className="text-base text-green-600 mt-2">
                  {buildRecurringPreviewText()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Applied to subscription renewals
                </p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
