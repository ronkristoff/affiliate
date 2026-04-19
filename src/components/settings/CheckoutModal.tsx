"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, AlertCircle } from "lucide-react";

type PlatformProvider = "stripe" | "saligpay";

interface CheckoutModalProps {
  isOpen: boolean;
  selectedPlan: string | null;
  onClose: () => void;
  onSuccess?: () => void;
  isTrialConversion?: boolean;
  isPastDuePayment?: boolean;
}

const PROVIDER_DISPLAY: Record<PlatformProvider, { label: string; icon: string }> = {
  stripe: { label: "Pay with Card (Stripe)", icon: "💳" },
  saligpay: { label: "Pay with SaligPay", icon: "🏦" },
};

export function CheckoutModal({
  isOpen,
  selectedPlan,
  onClose,
  onSuccess,
  isTrialConversion = false,
  isPastDuePayment = false,
}: CheckoutModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const createCheckout = useAction(api.platformBilling.createPlatformCheckout);
  const enabledProviders = useQuery(api.platformSettings.getPublicPlatformProviders);

  const availableProviders = (enabledProviders ?? []) as PlatformProvider[];

  const handleCheckout = async (provider: PlatformProvider) => {
    if (!selectedPlan) return;

    setIsRedirecting(true);
    setError(null);

    try {
      const result = await createCheckout({
        plan: selectedPlan,
        provider,
      });

      if (result.url) {
        window.open(result.url, "_self");
      } else {
        throw new Error("Could not create checkout session. No URL returned.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create checkout session");
      setIsRedirecting(false);
    }
  };

  const handleClose = () => {
    if (isRedirecting) return;
    setError(null);
    onClose();
  };

  if (!selectedPlan) {
    return null;
  }

  const title = isPastDuePayment
    ? "Reactivate Your Plan"
    : isTrialConversion
      ? "Convert from Trial"
      : "Upgrade to " + selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1);

  const description = isPastDuePayment
    ? `Update your payment method to restore your ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} subscription.`
    : isTrialConversion
      ? "Choose a payment method to convert your trial to a paid plan."
      : "Choose a payment method to complete your upgrade.";

  if (availableProviders.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              No payment methods are currently available. Please contact support.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground text-center">
              Payment methods are not configured. Please contact the platform administrator.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleClose} variant="outline">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {isRedirecting ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Redirecting to checkout...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {availableProviders.map((provider) => (
              <Button
                key={provider}
                variant="outline"
                className="w-full justify-start h-auto py-4 px-4"
                onClick={() => handleCheckout(provider)}
                disabled={isRedirecting}
              >
                <span className="text-lg mr-3">{PROVIDER_DISPLAY[provider].icon}</span>
                <div className="text-left">
                  <div className="font-medium">{PROVIDER_DISPLAY[provider].label}</div>
                </div>
                <CreditCard className="h-5 w-5 ml-auto text-muted-foreground" />
              </Button>
            ))}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end mt-2">
          <Button
            onClick={handleClose}
            variant="ghost"
            size="sm"
            disabled={isRedirecting}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
