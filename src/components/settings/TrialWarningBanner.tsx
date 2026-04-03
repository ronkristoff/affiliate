"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Trial warning thresholds
 */
const TRIAL_WARNING_DAYS = 7;
const TRIAL_URGENT_DAYS = 3;

/**
 * Calculate the trial status based on days remaining
 */
export function getTrialStatus(trialEndsAt: number): "normal" | "warning" | "urgent" {
  const now = Date.now();
  const daysRemaining = (trialEndsAt - now) / (1000 * 60 * 60 * 24);

  if (daysRemaining <= TRIAL_URGENT_DAYS) return "urgent";
  if (daysRemaining <= TRIAL_WARNING_DAYS) return "warning";
  return "normal";
}

/**
 * Calculate days remaining in trial
 */
export function getDaysRemaining(trialEndsAt: number): number {
  const now = Date.now();
  return Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24));
}

interface TrialWarningBannerProps {
  /** The timestamp when the trial ends */
  trialEndsAt: number;
  /** Callback when user clicks the convert to paid button */
  onConvertToPaid: () => void;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * TrialWarningBanner displays a warning when the user's trial is ending soon.
 * Shows a warning at 7 days remaining and an urgent warning at 3 days remaining.
 */
export function TrialWarningBanner({
  trialEndsAt,
  onConvertToPaid,
  className,
}: TrialWarningBannerProps) {
  const daysRemaining = getDaysRemaining(trialEndsAt);
  const isUrgent = daysRemaining <= TRIAL_URGENT_DAYS;
  const isWarning = daysRemaining <= TRIAL_WARNING_DAYS;

  // Check if trial has expired
  const isExpired = daysRemaining <= 0;

  const formatDaysRemaining = (days: number) => {
    if (days <= 0) return "today";
    if (days === 1) return "1 day";
    return `${days} days`;
  };

  const getAlertVariant = () => {
    if (isExpired || isUrgent) return "destructive";
    return "warning";
  };

  return (
    <Alert
      variant={getAlertVariant()}
      className={cn("flex flex-col gap-4", className)}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {isExpired || isUrgent ? (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          ) : (
            <Clock className="h-5 w-5 text-amber-500" />
          )}
        </div>
        <div className="flex-1">
          <AlertTitle className="flex items-center gap-2">
            {isExpired ? "Trial Expired" : isUrgent ? "Urgent: Trial Ending Soon" : "Trial Ending Soon"}
          </AlertTitle>
          <AlertDescription className="mt-1">
            {isExpired
              ? "Your trial has expired. Upgrade now to restore access to Affilio."
              : `Your trial ends in ${formatDaysRemaining(daysRemaining)}.${
                  isUrgent
                    ? " Upgrade now to avoid losing access to Affilio."
                    : " Upgrade now to continue using all features without interruption."
                }`}
          </AlertDescription>
        </div>
      </div>
      <div className="flex items-center gap-3 ml-8">
        <Button
          onClick={onConvertToPaid}
          size="sm"
          className="gap-2"
        >
          {isExpired || isUrgent ? "Upgrade Now" : "Upgrade to Growth"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
