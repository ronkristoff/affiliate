"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Users, Target, UserCircle, DollarSign, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

// Map limit fields to display info
const LIMIT_LABELS: Record<string, { label: string; icon: typeof Users }> = {
  maxAffiliates: { label: "Max Affiliates", icon: Users },
  maxCampaigns: { label: "Max Campaigns", icon: Target },
  maxTeamMembers: { label: "Max Team Members", icon: UserCircle },
  maxPayoutsPerMonth: { label: "Max Payouts/Month", icon: DollarSign },
  maxApiCalls: { label: "Max API Calls", icon: Globe },
};

function formatLimit(value: number): string {
  if (value === -1) return "Unlimited";
  return value.toLocaleString();
}

interface ImpactWarningModalProps {
  tierName: string;
  affectedTenants: number;
  severity: "none" | "warning" | "critical";
  currentValues: Record<string, number>;
  proposedValues: Record<string, number>;
  breakdownByLimit?: Record<string, { oldValue: number; newValue: number; affectedCount: number }>;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function ImpactWarningModal({
  tierName,
  affectedTenants,
  severity,
  currentValues,
  proposedValues,
  breakdownByLimit,
  onConfirm,
  onCancel,
  isLoading,
}: ImpactWarningModalProps) {
  // Calculate which limits decreased - use breakdownByLimit from backend if available
  const decreasedLimits = Object.entries(currentValues)
    .map(([key, oldValue]) => {
      const newValue = proposedValues[key];
      if (newValue === undefined) return null;

      // Detect decrease
      let isDecrease = false;
      if (oldValue === -1 && newValue !== -1) {
        isDecrease = true; // unlimited → limited
      } else if (oldValue !== -1 && newValue !== -1 && newValue < oldValue) {
        isDecrease = true; // finite decrease
      }

      return isDecrease ? { key, oldValue, newValue } : null;
    })
    .filter(Boolean) as Array<{ key: string; oldValue: number; newValue: number }>;

  const isCritical = severity === "critical";

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              className={cn(
                "h-5 w-5",
                isCritical ? "text-red-600" : "text-amber-600"
              )}
            />
            {isCritical ? "Critical Impact Detected" : "Impact Detected"}
          </DialogTitle>
          <DialogDescription>
            Your changes will affect {affectedTenants} tenant{affectedTenants !== 1 ? "s" : ""} on the{" "}
            <strong>{tierName.charAt(0).toUpperCase() + tierName.slice(1)}</strong> plan.
          </DialogDescription>
        </DialogHeader>

        {/* Affected tenants summary */}
        <div
          className={cn(
            "rounded-lg p-4",
            isCritical
              ? "bg-red-50 border border-red-200"
              : "bg-amber-50 border border-amber-200"
          )}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className={cn(
                "text-sm font-semibold",
                isCritical ? "text-red-800" : "text-amber-800"
              )}
            >
              {affectedTenants} tenant{affectedTenants !== 1 ? "s" : ""} exceed new limits
            </span>
          </div>

          {/* Subtask 7.3: Breakdown by limit type with affected count */}
          <div className="space-y-2">
            {decreasedLimits.map(({ key, oldValue, newValue }) => {
              const fieldInfo = LIMIT_LABELS[key];
              if (!fieldInfo) return null;
              const Icon = fieldInfo.icon;
              const breakdown = breakdownByLimit?.[key];

              return (
                <div
                  key={key}
                  className="flex items-center gap-2 text-sm"
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">{fieldInfo.label}:</span>
                  <span className="line-through text-red-500">
                    {formatLimit(oldValue)}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium text-[#333333]">
                    {formatLimit(newValue)}
                  </span>
                  {breakdown && breakdown.affectedCount > 0 && (
                    <span className="text-xs text-red-600 ml-auto">
                      ({breakdown.affectedCount} affected)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Affected tenants will be notified of these changes. They may need to upgrade their
          plan or reduce their usage to stay within the new limits.
        </p>

        {/* Subtask 7.5: Proceed Anyway and Go Back buttons */}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Go Back
          </Button>
          <Button
            variant={isCritical ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              "Proceed Anyway"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
