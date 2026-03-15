"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  CreditCard, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  XCircle,
  Clock
} from "lucide-react";

interface SubscriptionStatusCardProps {
  onUpgradeClick?: () => void;
}

export function SubscriptionStatusCard({ onUpgradeClick }: SubscriptionStatusCardProps) {
  const subscription = useQuery(api.subscriptions.getCurrentSubscription);
  const tierConfig = useQuery(api.tierConfig.getMyTierConfig);

  if (subscription === undefined) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Unable to load subscription status
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getPlanDisplayName = (plan: string) => {
    switch (plan) {
      case "starter":
        return "Starter";
      case "growth":
        return "Growth";
      case "scale":
        return "Scale";
      default:
        return plan.charAt(0).toUpperCase() + plan.slice(1);
    }
  };

  const getStatusBadge = () => {
    // Badge color classes
    const badgeClasses = {
      trial: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      past_due: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    };

    const statusConfig = {
      trial: { icon: Clock, text: "Free Trial", className: badgeClasses.trial },
      active: { icon: CheckCircle2, text: "Active", className: badgeClasses.active },
      cancelled: { icon: XCircle, text: "Cancelled", className: badgeClasses.cancelled },
      past_due: { icon: AlertCircle, text: "Past Due", className: badgeClasses.past_due },
    };

    let status: "trial" | "active" | "cancelled" | "past_due" = "trial";
    if (subscription.subscriptionStatus) {
      status = subscription.subscriptionStatus;
    } else if (!subscription.isTrial && subscription.plan !== "starter") {
      status = "active";
    }

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
        <Icon className="h-4 w-4" />
        {config.text}
      </span>
    );
  };

  const isPaidPlan = subscription.plan === "growth" || subscription.plan === "scale";
  const showBillingDates = isPaidPlan || subscription.isTrial;

  // Determine the end date to display
  const getEndDate = () => {
    if (subscription.subscriptionStatus === "cancelled" && subscription.billingEndDate) {
      return { label: "Access Ends", date: subscription.billingEndDate };
    }
    if (subscription.isTrial && subscription.trialEndsAt) {
      return { label: "Trial Ends", date: subscription.trialEndsAt };
    }
    if (subscription.billingEndDate) {
      return { label: "Next Billing", date: subscription.billingEndDate };
    }
    return null;
  };

  const endDateInfo = getEndDate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Current Subscription
        </CardTitle>
        <CardDescription>
          Your plan and billing information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Name and Badge */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Plan</p>
            <p className="text-2xl font-bold">{getPlanDisplayName(subscription.plan)}</p>
            {tierConfig && isPaidPlan && (
              <p className="text-sm text-muted-foreground">
                ₱{tierConfig.price.toLocaleString()}/month
              </p>
            )}
            {subscription.plan === "starter" && (
              <p className="text-sm text-muted-foreground">Free</p>
            )}
          </div>
          {getStatusBadge()}
        </div>

        {/* Billing Cycle */}
        {showBillingDates && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
            {/* Current Period */}
            {(subscription.billingStartDate || subscription.trialEndsAt) && (
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {subscription.isTrial ? "Trial Period" : "Current Period"}
                </p>
                <p className="font-medium">
                  {subscription.billingStartDate 
                    ? formatDate(subscription.billingStartDate)
                    : "Started"
                  }
                  {" — "}
                  {endDateInfo ? formatDate(endDateInfo.date) : "—"}
                </p>
              </div>
            )}

            {/* Next Billing / Access End */}
            {endDateInfo && (
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {endDateInfo.label}
                </p>
                <p className="font-medium">
                  {formatDate(endDateInfo.date)}
                  {subscription.trialDaysRemaining !== undefined && subscription.trialDaysRemaining > 0 && (
                    <span className="text-muted-foreground ml-2 text-sm">
                      ({subscription.trialDaysRemaining} days left)
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Upgrade Button (if on starter or growth plan and not cancelled) */}
        {(subscription.plan === "starter" || subscription.plan === "growth") && 
         subscription.subscriptionStatus !== "cancelled" && (
          <div className="border-t pt-4 mt-4">
            <Button onClick={onUpgradeClick} className="w-full">
              {subscription.plan === "starter" ? "Upgrade to Growth" : "Upgrade to Scale"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
