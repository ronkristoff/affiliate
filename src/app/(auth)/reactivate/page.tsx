"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Clock, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function ReactivationPage() {
  const router = useRouter();
  const subscription = useQuery(api.subscriptions.getCurrentSubscription);
  const [isReactivating, setIsReactivating] = useState(false);

  // Redirect if subscription is active or not cancelled
  useEffect(() => {
    if (subscription && subscription.subscriptionStatus !== "cancelled") {
      router.push("/settings/billing");
    }
  }, [subscription, router]);

  if (subscription === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If not cancelled, redirect will handle it
  if (!subscription || subscription.subscriptionStatus !== "cancelled") {
    return null;
  }

  const now = Date.now();
  const billingEndDate = subscription.billingEndDate || now;
  const deletionDate = subscription.deletionScheduledDate || (billingEndDate + 30 * 24 * 60 * 60 * 1000);
  
  const daysUntilDeletion = Math.ceil((deletionDate - now) / (1000 * 60 * 60 * 24));
  const hasAccessExpired = now >= billingEndDate;

  const handleReactivate = async () => {
    setIsReactivating(true);
    try {
      // TODO: Implement reactivation mutation when Story 3.6 is developed
      // For now, just redirect to billing page
      toast.info("Reactivation will be available in a future update. Please contact support.");
      router.push("/settings/billing");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reactivation failed");
    } finally {
      setIsReactivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6 animate-content-in">
        <div className="text-center space-y-2">
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-heading)]">Account Status</h1>
          <p className="text-[14px] text-[var(--text-muted)]">
            Your subscription has been cancelled
          </p>
        </div>

        {/* Status Alert */}
        <div className="rounded-xl p-4 bg-[var(--warning-bg)] border border-[#fcd34d]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[var(--warning)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-[var(--warning-text)]">
                Subscription Cancelled
              </p>
              <p className="text-[12px] text-[var(--warning-text)] mt-0.5">
                Your account will be permanently deleted in {daysUntilDeletion} days.
              </p>
            </div>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-light)]">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--text-muted)]" />
              <h3 className="text-[14px] font-bold text-[var(--text-heading)]">Account Timeline</h3>
            </div>
            <p className="text-[11.5px] text-[var(--text-muted)] mt-0.5 ml-6">
              Important dates for your account
            </p>
          </div>
          <div className="p-5 space-y-4">
            {/* Access end date */}
            <div className="flex items-start gap-3 text-[13px]">
              <div className="w-2 h-2 rounded-full bg-[var(--text-muted)] mt-1.5 shrink-0" />
              <div>
                <p className="font-medium text-[var(--text-heading)]">
                  Access ended: {new Date(billingEndDate).toLocaleDateString()}
                </p>
                <p className="text-[12px] text-[var(--text-muted)]">
                  {hasAccessExpired 
                    ? "Your billing cycle has ended"
                    : "Your billing cycle is still active"
                  }
                </p>
              </div>
            </div>

            {/* Deletion date */}
            <div className="flex items-start gap-3 text-[13px]">
              <Trash2 className="h-4 w-4 text-[var(--danger)] mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-[var(--danger)]">
                  Data deletion: {new Date(deletionDate).toLocaleDateString()}
                </p>
                <p className="text-[12px] text-[var(--text-muted)]">
                  {daysUntilDeletion > 0 
                    ? `${daysUntilDeletion} days until permanent deletion`
                    : 'Your data is being deleted'
                  }
                </p>
              </div>
            </div>

            {/* Access status */}
            {hasAccessExpired ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-bg)]">
                <RefreshCw className="h-4 w-4 text-[var(--danger)] shrink-0" />
                <span className="text-[12px] text-[var(--danger-text)]">
                  <strong>Write operations blocked</strong> — Your billing cycle has ended. Reactivate to restore access.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--info-bg)] border border-[var(--info-bg)]">
                <Clock className="h-4 w-4 text-[var(--info)] shrink-0" />
                <span className="text-[12px] text-[var(--info-text)]">
                  <strong>Read-only access</strong> — You can view your data until {new Date(billingEndDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Reactivation Card */}
        <div className="bg-[var(--bg-surface)] rounded-xl border-2 border-[var(--brand-primary)]/20 overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--brand-primary)]/10">
            <h3 className="text-[14px] font-bold text-[var(--text-heading)]">Reactivate Your Subscription</h3>
            <p className="text-[11.5px] text-[var(--text-muted)] mt-0.5">
              Reactivate now to preserve your data and restore full access
            </p>
          </div>
          <div className="p-5 space-y-4">
            <ul className="space-y-2.5 text-[13px]">
              <li className="flex items-center gap-2.5 text-[var(--text-body)]">
                <span className="w-4 h-4 rounded-full bg-[var(--success-bg)] flex items-center justify-center shrink-0">
                  <span className="text-[var(--success)] text-[10px] leading-none">&#10003;</span>
                </span>
                Prevent permanent data deletion
              </li>
              <li className="flex items-center gap-2.5 text-[var(--text-body)]">
                <span className="w-4 h-4 rounded-full bg-[var(--success-bg)] flex items-center justify-center shrink-0">
                  <span className="text-[var(--success)] text-[10px] leading-none">&#10003;</span>
                </span>
                Restore full read and write access
              </li>
              <li className="flex items-center gap-2.5 text-[var(--text-body)]">
                <span className="w-4 h-4 rounded-full bg-[var(--success-bg)] flex items-center justify-center shrink-0">
                  <span className="text-[var(--success)] text-[10px] leading-none">&#10003;</span>
                </span>
                Continue managing your affiliates and campaigns
              </li>
              <li className="flex items-center gap-2.5 text-[var(--text-body)]">
                <span className="w-4 h-4 rounded-full bg-[var(--success-bg)] flex items-center justify-center shrink-0">
                  <span className="text-[var(--success)] text-[10px] leading-none">&#10003;</span>
                </span>
                Resume tracking and commission processing
              </li>
            </ul>

            <Button 
              onClick={handleReactivate}
              className="w-full"
              size="lg"
              disabled={isReactivating}
            >
              {isReactivating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Reactivate Subscription"
              )}
            </Button>

            <p className="text-[11px] text-center text-[var(--text-muted)]">
              Have questions? Contact our support team for assistance.
            </p>
          </div>
        </div>

        {/* Alternative options */}
        <div className="text-center space-y-2">
          <p className="text-[13px] text-[var(--text-muted)]">
            Not ready to reactivate?
          </p>
          <div className="flex justify-center gap-4">
            <Button 
              variant="link" 
              size="sm"
              onClick={() => router.push("/dashboard")}
              disabled={hasAccessExpired}
            >
              View Dashboard
            </Button>
            <Button 
              variant="link" 
              size="sm"
              onClick={() => router.push("/settings")}
            >
              Account Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
