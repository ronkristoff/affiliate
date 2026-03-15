"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";

interface SuspendDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  affiliateName: string;
}

const suspensionReasons = [
  { value: "Policy Violation", label: "Policy Violation" },
  { value: "Inactivity", label: "Inactivity" },
  { value: "Performance", label: "Performance" },
  { value: "Other", label: "Other" },
];

export function SuspendDialog({
  isOpen,
  onClose,
  onConfirm,
  affiliateName,
}: SuspendDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!selectedReason) return;
    
    setIsSubmitting(true);
    try {
      await onConfirm(selectedReason);
      setSelectedReason("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedReason("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Suspend Affiliate
          </DialogTitle>
          <DialogDescription>
            You are about to suspend <strong>{affiliateName}</strong>. This action will:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-4 space-y-1">
            <li>Prevent the affiliate from logging in to the portal</li>
            <li>Disable their referral links (return 404)</li>
            <li>Preserve pending commissions but stop processing</li>
            <li>Immediately terminate any active sessions</li>
          </ul>
        </div>

        <div className="space-y-2">
          <label htmlFor="suspension-reason" className="text-sm font-medium">
            Reason for suspension <span className="text-destructive">*</span>
          </label>
          <Select
            value={selectedReason}
            onValueChange={setSelectedReason}
            disabled={isSubmitting}
          >
            <SelectTrigger id="suspension-reason">
              <SelectValue placeholder="Select a reason..." />
            </SelectTrigger>
            <SelectContent>
              {suspensionReasons.map((reason) => (
                <SelectItem key={reason.value} value={reason.value}>
                  {reason.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selectedReason || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Suspending...
              </>
            ) : (
              "Suspend Affiliate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
