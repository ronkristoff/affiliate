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
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Account Status</h1>
          <p className="text-muted-foreground">
            Your subscription has been cancelled
          </p>
        </div>

        {/* Status Alert */}
        <Alert variant="destructive" className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            Subscription Cancelled
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Your account will be permanently deleted in {daysUntilDeletion} days.
          </AlertDescription>
        </Alert>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Account Timeline
            </CardTitle>
            <CardDescription>
              Important dates for your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {/* Access end date */}
              <div className="flex items-start gap-3 text-sm">
                <div className="flex-1">
                  <p className="font-medium">
                    Access ended: {new Date(billingEndDate).toLocaleDateString()}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {hasAccessExpired 
                      ? "Your billing cycle has ended"
                      : "Your billing cycle is still active"
                    }
                  </p>
                </div>
              </div>

              {/* Deletion date */}
              <div className="flex items-start gap-3 text-sm">
                <Trash2 className="h-4 w-4 mt-0.5 text-red-600" />
                <div className="flex-1">
                  <p className="font-medium text-red-600">
                    Data deletion: {new Date(deletionDate).toLocaleDateString()}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {daysUntilDeletion > 0 
                      ? `${daysUntilDeletion} days until permanent deletion`
                      : 'Your data is being deleted'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Access status */}
            {hasAccessExpired ? (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                <RefreshCw className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-700 dark:text-red-300">
                  <strong>Write operations blocked</strong> - Your billing cycle has ended. Reactivate to restore access.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Read-only access</strong> - You can view your data until {new Date(billingEndDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reactivation Card */}
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Reactivate Your Subscription</CardTitle>
            <CardDescription>
              Reactivate now to preserve your data and restore full access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Prevent permanent data deletion
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Restore full read and write access
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Continue managing your affiliates and campaigns
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
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

            <p className="text-xs text-center text-muted-foreground">
              Have questions? Contact our support team for assistance.
            </p>
          </CardContent>
        </Card>

        {/* Alternative options */}
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
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