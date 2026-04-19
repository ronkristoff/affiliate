"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CancellationWarningDialogProps {
  currentPlan: string;
  billingEndDate: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CancellationWarningDialog({
  currentPlan,
  billingEndDate,
  onConfirm,
  onCancel,
}: CancellationWarningDialogProps) {
  const accessEndDate = new Date(billingEndDate);
  const daysUntilEnd = Math.ceil(
    (accessEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Cancel Subscription</h2>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Action Cannot Be Undone</AlertTitle>
        <AlertDescription>
          Cancelling your subscription will permanently delete your account and all data
          after the billing cycle ends.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>What Happens After Cancellation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            <li className="flex items-start gap-2 text-sm">
              <span className="text-red-500 font-bold">✗</span>
              <div>
                <strong>Access stops on {accessEndDate.toLocaleDateString()}</strong>
                <p className="text-muted-foreground">
                  ({daysUntilEnd} days remaining in current billing cycle)
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <span className="text-red-500 font-bold">✗</span>
              <div>
                <strong>Billing stops immediately</strong>
                <p className="text-muted-foreground">
                  No further charges will be applied
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <span className="text-red-500 font-bold">✗</span>
              <div>
                <strong>Write operations blocked after billing cycle</strong>
                <p className="text-muted-foreground">
                  You cannot create or modify affiliates, campaigns, or commissions
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <span className="text-orange-500 font-bold">⚠️</span>
              <div>
                <strong>Data retained for 30 days</strong>
                <p className="text-muted-foreground">
                  After that, your account and all data will be permanently deleted
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <span className="text-green-500 font-bold">✓</span>
              <div>
                <strong>Read-only access during retention period</strong>
                <p className="text-muted-foreground">
                  You can view your data, but cannot make changes
                </p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Keep Subscription
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          Cancel Subscription
        </Button>
      </div>
    </div>
  );
}
