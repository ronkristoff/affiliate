"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CancellationConfirmationDialogProps {
  currentPlan: "starter" | "growth" | "scale";
  billingEndDate: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CancellationConfirmationDialog({
  currentPlan,
  billingEndDate,
  onConfirm,
  onCancel,
}: CancellationConfirmationDialogProps) {
  const accessEndDate = new Date(billingEndDate);
  const deletionDate = new Date(billingEndDate + 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-destructive">
        Confirm Cancellation
      </h2>

      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>This Action Cannot Be Undone</AlertTitle>
        <AlertDescription>
          Your subscription will be cancelled and all data will be deleted after
          30 days. You can reactivate your subscription during the retention period.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Cancellation Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Plan</span>
              <span className="font-semibold capitalize">{currentPlan}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Access Ends</span>
              <span className="font-semibold">
                {accessEndDate.toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Data Deleted</span>
              <span className="font-semibold">
                {deletionDate.toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="border-t border-border my-4" />

          <p className="text-sm text-muted-foreground">
            You will receive a confirmation email with these details.
            A reminder email will be sent 7 days before deletion.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Go Back
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          Confirm Cancellation
        </Button>
      </div>
    </div>
  );
}
