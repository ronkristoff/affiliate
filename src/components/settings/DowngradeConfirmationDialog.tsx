"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { format } from "date-fns";

interface DowngradeConfirmationDialogProps {
  currentPlan: "scale" | "growth";
  targetPlan: "growth" | "starter";
  effectiveDate: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DowngradeConfirmationDialog({
  currentPlan,
  targetPlan,
  effectiveDate,
  onConfirm,
  onCancel,
  isLoading = false,
}: DowngradeConfirmationDialogProps) {
  const tierLimits = useQuery(api.tierConfig.getAllTierConfigs);

  // Get pricing info
  const currentTierConfig = tierLimits?.find((t) => t.tier === currentPlan);
  const targetTierConfig = tierLimits?.find((t) => t.tier === targetPlan);

  const currentPrice = currentTierConfig?.price || 0;
  const targetPrice = targetTierConfig?.price || 0;
  const monthlySavings = currentPrice - targetPrice;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          Confirm Downgrade to {targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)}
        </h2>
        <p className="text-muted-foreground mt-1">
          Please review the details before confirming
        </p>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Important: This action cannot be undone immediately</AlertTitle>
        <AlertDescription>
          After downgrading, you will need to upgrade again to regain lost features.
          Your new plan limits will be enforced immediately.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Plan Change</span>
            <span className="font-medium">
              {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} →{" "}
              {targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Effective Date</span>
            <span className="font-medium">
              {format(new Date(effectiveDate), "MMMM d, yyyy")}
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">Current Billing</span>
            <span className="font-medium">
              ₱{currentPrice.toLocaleString()}/month
            </span>
          </div>

          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm text-muted-foreground">New Billing</span>
            <span className="font-medium text-green-600">
              ₱{targetPrice.toLocaleString()}/month
            </span>
          </div>

          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-muted-foreground">Monthly Savings</span>
            <span className="font-medium text-green-600">
              ₱{monthlySavings.toLocaleString()}/month
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground space-y-2">
        <p>
          <strong>Billing Note:</strong> Your current billing cycle will not be
          prorated. The new rate will take effect at the start of your next
          billing cycle on{" "}
          {format(new Date(effectiveDate), "MMMM d, yyyy")}.
        </p>
        <p>
          <strong>Data Access:</strong> All your existing data will remain
          accessible, but you won&apos;t be able to create new resources that
          exceed your new plan limits.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Confirm Downgrade"
          )}
        </Button>
      </div>
    </div>
  );
}
