"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MockPaymentForm } from "./MockPaymentForm";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface MockCheckoutModalProps {
  isOpen: boolean;
  selectedPlan: "growth" | "scale" | null;
  onClose: () => void;
  onSuccess?: () => void;
  /** If true, uses convertTrialToPaid mutation instead of upgradeSubscription */
  isTrialConversion?: boolean;
}

type CheckoutStep = "payment" | "processing" | "success" | "error";

export function MockCheckoutModal({
  isOpen,
  selectedPlan,
  onClose,
  onSuccess,
  isTrialConversion = false,
}: MockCheckoutModalProps) {
  const [step, setStep] = useState<CheckoutStep>("payment");
  const [error, setError] = useState<string | null>(null);

  const upgradeSubscription = useMutation(api.subscriptions.upgradeSubscription);
  const convertTrialToPaid = useMutation(api.subscriptions.convertTrialToPaid);
  const allTiers = useQuery(api.tierConfig.getAllTierConfigs);

  // Get price for selected plan from tier configs
  const getPlanPrice = useMemo(() => {
    return (plan: "growth" | "scale") => {
      if (!allTiers) return 0;
      const tier = allTiers.find(t => t.tier === plan);
      return tier?.price ?? 0;
    };
  }, [allTiers]);

  const handleSubmit = async () => {
    if (!selectedPlan) return;

    setStep("processing");
    setError(null);

    try {
      let result;

      if (isTrialConversion) {
        result = await convertTrialToPaid({
          plan: selectedPlan,
          mockPayment: true,
        });
      } else {
        result = await upgradeSubscription({
          plan: selectedPlan,
          mockPayment: true,
        });
      }

      if (result.success) {
        setStep("success");
        // Optionally trigger callback after a delay
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          }
        }, 2000);
      } else {
        throw new Error("Payment failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setStep("error");
    }
  };

  const handleClose = () => {
    setStep("payment");
    setError(null);
    onClose();
  };

  if (!selectedPlan) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "success" 
              ? (isTrialConversion ? "Trial Converted" : "Upgrade Complete") 
              : (isTrialConversion ? "Convert from Trial" : "Complete Payment")}
          </DialogTitle>
          <DialogDescription>
            {step === "success"
              ? "Your subscription has been upgraded successfully."
              : isTrialConversion
                ? "Enter your payment details to convert from trial to a paid plan."
                : "Enter your payment details to complete the upgrade."}
          </DialogDescription>
        </DialogHeader>

        {/* Payment Step */}
        {step === "payment" && (
          <MockPaymentForm
            selectedPlan={selectedPlan}
            planPrice={getPlanPrice(selectedPlan)}
            onSubmit={handleSubmit}
            onCancel={handleClose}
          />
        )}

        {/* Processing Step */}
        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Processing your payment...</p>
          </div>
        )}

        {/* Success Step */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="mt-4 text-center font-medium">
              {isTrialConversion ? "Trial converted successfully!" : "Payment successful!"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground text-center">
              {isTrialConversion 
                ? `Your subscription has been converted to ${selectedPlan}.`
                : `Your subscription has been upgraded to ${selectedPlan}.`}
            </p>
            <Button onClick={handleClose} className="mt-6">
              Done
            </Button>
          </div>
        )}

        {/* Error Step */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-8">
            <XCircle className="h-12 w-12 text-red-500" />
            <p className="mt-4 text-center font-medium">Payment failed</p>
            <p className="mt-2 text-sm text-muted-foreground text-center">
              {error || "An unexpected error occurred. Please try again."}
            </p>
            <Button
              onClick={() => setStep("payment")}
              variant="outline"
              className="mt-6"
            >
              Try Again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
