"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard } from "lucide-react";

interface UpgradeConfirmationDialogProps {
  isOpen: boolean;
  currentPlan: string;
  targetPlan: string;
  proratedAmount: number;
  newMonthlyAmount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function UpgradeConfirmationDialog({
  isOpen,
  currentPlan,
  targetPlan,
  proratedAmount,
  newMonthlyAmount,
  onConfirm,
  onCancel,
  isLoading = false,
}: UpgradeConfirmationDialogProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(price);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isLoading && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Confirm Upgrade
          </DialogTitle>
          <DialogDescription>
            You are about to upgrade from {currentPlan} to {targetPlan}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Prorated charge today</span>
              <span className="font-semibold">{formatPrice(proratedAmount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Next billing date</span>
              <span className="font-semibold">In 30 days</span>
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">New monthly amount</span>
              <span className="font-bold text-lg">{formatPrice(newMonthlyAmount)}/mo</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            By confirming, your subscription will be upgraded immediately and you will be
            charged the prorated amount.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading} className="gap-2">
            {isLoading ? (
              <>Processing...</>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Confirm Upgrade
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
