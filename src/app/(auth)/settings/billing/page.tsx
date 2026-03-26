"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SubscriptionStatusCard } from "@/components/settings/SubscriptionStatusCard";
import { UsageStatsCard } from "@/components/settings/UsageStatsCard";
import { BillingHistoryTable } from "@/components/settings/BillingHistoryTable";
import { PlanSelectionCard } from "@/components/settings/PlanSelectionCard";
import { MockCheckoutModal } from "@/components/settings/MockCheckoutModal";
import { PlanComparison } from "@/components/settings/PlanComparison";
import { UpgradeConfirmationDialog } from "@/components/settings/UpgradeConfirmationDialog";
import { DowngradeWarningDialog } from "@/components/settings/DowngradeWarningDialog";
import { DowngradeConfirmationDialog } from "@/components/settings/DowngradeConfirmationDialog";
import { CancellationWarningDialog } from "@/components/settings/CancellationWarningDialog";
import { CancellationConfirmationDialog } from "@/components/settings/CancellationConfirmationDialog";
import { CancellationRetentionCard } from "@/components/settings/CancellationNotice";
import { TrialWarningBanner, getTrialStatus } from "@/components/settings/TrialWarningBanner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Rocket, TrendingDown, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

// Helper to get tier price (₱ PHP)
function getTierPrice(plan: "growth" | "scale", currentConfig: { tier: string; price: number } | null): number {
  // Use actual tier config price if available, otherwise use defaults
  if (currentConfig) {
    // Look up the target plan price from all configs
    // Fall through to defaults below if not found
  }
  
  const prices: Record<string, number> = {
    starter: 0,
    growth: 2499,
    scale: 4999,
  };
  return prices[plan] || 0;
}

// Calculate estimated proration for display in confirmation dialog
function calculateEstimatedProration(
  currentPrice: number,
  targetPlan: "growth" | "scale",
  currentConfig: { tier: string; price: number } | null
): number {
  const targetPrice = getTierPrice(targetPlan, currentConfig);
  const priceDiff = targetPrice - currentPrice;
  // Assume mid-cycle (15 days remaining) for estimation
  const dailyRate = priceDiff / 30;
  return Math.ceil(dailyRate * 15);
}

export default function BillingSettingsPage() {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"growth" | "scale" | null>(null);
  const [showPlanComparison, setShowPlanComparison] = useState(false);
  const [showUpgradeConfirmation, setShowUpgradeConfirmation] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Downgrade state
  const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);
  const [showDowngradeConfirmation, setShowDowngradeConfirmation] = useState(false);
  const [selectedDowngradeTarget, setSelectedDowngradeTarget] = useState<"growth" | "starter" | null>(null);
  const [isDowngrading, setIsDowngrading] = useState(false);

  // Cancellation state
  const [showCancellationWarning, setShowCancellationWarning] = useState(false);
  const [showCancellationConfirmation, setShowCancellationConfirmation] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Billing history pagination - maintain cursor stack for proper navigation
  const [billingCursor, setBillingCursor] = useState<string | null>(null);
  const [billingCursorStack, setBillingCursorStack] = useState<string[]>([]);

  const subscription = useQuery(api.subscriptions.getCurrentSubscription);
  const upgradeTier = useMutation(api.subscriptions.upgradeTier);
  const downgradeTier = useMutation(api.subscriptions.downgradeTier);
  const cancelSubscription = useMutation(api.subscriptions.cancelSubscription);
  const tierConfig = useQuery(api.tierConfig.getMyTierConfig);
  const tenantId = useQuery(api.auth.getCurrentTenantId);
  const usage = useQuery(api.subscriptions.getUsageStats);
  const billingHistory = useQuery(api.subscriptions.getBillingHistory, {
    paginationOpts: { numItems: 10, cursor: billingCursor },
  });

  // Combined loading state - wait for all required data
  const isLoading = subscription === undefined || tierConfig === undefined || usage === undefined || billingHistory === undefined;

  // Handle error state
  if (subscription === null) {
    return (
      <div className="animate-fade-in">
        <PageTopbar description="Manage your subscription and billing information">
          <h1 className="text-lg font-semibold text-heading">Billing</h1>
        </PageTopbar>
        <div className="px-8 py-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error loading subscription</AlertTitle>
            <AlertDescription>
              Unable to load your subscription information. Please try refreshing the page or contact support if the problem persists.
            </AlertDescription>
          </Alert>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <PageTopbar description="Manage your subscription and billing information">
          <h1 className="text-lg font-semibold text-heading">Billing</h1>
        </PageTopbar>
        <div className="px-8 py-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  const handleUpgradeClick = () => {
    // For Starter plan, show plan selection first
    // For Growth plan, directly show comparison to Scale
    if (subscription?.plan === "starter") {
      setSelectedPlan("growth");
      setShowPlanComparison(true);
    } else if (subscription?.plan === "growth") {
      setSelectedPlan("scale");
      setShowPlanComparison(true);
    }
  };

  const handleTrialConversionClick = () => {
    setSelectedPlan("growth");
    setCheckoutOpen(true);
  };

  const handleSelectPlan = (plan: "growth" | "scale") => {
    setSelectedPlan(plan);
    setShowPlanComparison(true);
  };

  const handleCheckoutSuccess = () => {
    // Trigger a refresh of the subscription data
    setRefreshKey((k) => k + 1);
  };

  const handlePlanComparisonConfirm = () => {
    // For upgrades from paid plans, show confirmation dialog first
    if (subscription?.plan && subscription?.plan !== "starter") {
      // Already on a paid plan - show confirmation dialog
      setShowPlanComparison(false);
      setShowUpgradeConfirmation(true);
    } else {
      // Starter plan - proceed to checkout for new subscription
      setShowPlanComparison(false);
      setCheckoutOpen(true);
    }
  };

  const handlePlanComparisonCancel = () => {
    setShowPlanComparison(false);
    setSelectedPlan(null);
  };

  const handleUpgradeConfirmationConfirm = () => {
    setShowUpgradeConfirmation(false);
    handleUpgradeSubmit();
  };

  const handleUpgradeConfirmationCancel = () => {
    setShowUpgradeConfirmation(false);
    setSelectedPlan(null);
  };

  const handleUpgradeSubmit = async () => {
    if (!selectedPlan) return;

    setIsUpgrading(true);
    try {
      const result = await upgradeTier({
        targetPlan: selectedPlan,
        mockPayment: true,
      });

      if (result.success) {
        toast.success(
          `Successfully upgraded to ${selectedPlan}! Prorated charge: ₱${result.proratedAmount}`
        );
        setCheckoutOpen(false);
        setSelectedPlan(null);
        setRefreshKey((k) => k + 1);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upgrade failed");
    } finally {
      setIsUpgrading(false);
    }
  };

  // Downgrade handlers
  const handleDowngradeClick = () => {
    // Determine target plan (one tier down)
    const targetPlan = subscription?.plan === "scale" ? "growth" : "starter";
    setSelectedDowngradeTarget(targetPlan);
    setShowDowngradeWarning(true);
  };

  const handleDowngradeWarningConfirm = () => {
    setShowDowngradeWarning(false);
    setShowDowngradeConfirmation(true);
  };

  const handleDowngradeWarningCancel = () => {
    setShowDowngradeWarning(false);
    setSelectedDowngradeTarget(null);
  };

  const handleDowngradeConfirmationConfirm = async () => {
    if (!selectedDowngradeTarget) return;

    setIsDowngrading(true);
    try {
      const result = await downgradeTier({
        targetPlan: selectedDowngradeTarget,
      });

      if (result.success) {
        toast.success(
          `Successfully downgraded to ${selectedDowngradeTarget}! The change will take effect on your next billing cycle.`
        );
        setShowDowngradeConfirmation(false);
        setSelectedDowngradeTarget(null);
        setRefreshKey((k) => k + 1);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Downgrade failed");
    } finally {
      setIsDowngrading(false);
    }
  };

  const handleDowngradeConfirmationCancel = () => {
    setShowDowngradeConfirmation(false);
    setSelectedDowngradeTarget(null);
  };

  // Cancellation handlers
  const handleCancellationClick = () => {
    setShowCancellationWarning(true);
  };

  const handleCancellationWarningConfirm = () => {
    setShowCancellationWarning(false);
    setShowCancellationConfirmation(true);
  };

  const handleCancellationWarningCancel = () => {
    setShowCancellationWarning(false);
  };

  const handleCancellationConfirmationConfirm = async () => {
    setIsCancelling(true);
    try {
      const result = await cancelSubscription({});

      if (result.success) {
        toast.success(
          "Your subscription has been cancelled. You will receive a confirmation email shortly."
        );
        setShowCancellationConfirmation(false);
        setRefreshKey((k) => k + 1);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cancellation failed");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCancellationConfirmationCancel = () => {
    setShowCancellationConfirmation(false);
  };

  // Determine if we should show trial warning
  const showTrialWarning = subscription?.isTrial && subscription?.trialEndsAt;
  const trialStatus = showTrialWarning && subscription.trialEndsAt 
    ? getTrialStatus(subscription.trialEndsAt) 
    : "normal";
  const showWarningBanner = showTrialWarning && (trialStatus === "warning" || trialStatus === "urgent");

  return (
    <div className="animate-fade-in" key={refreshKey}>
      <PageTopbar description="Manage your subscription and billing information">
        <h1 className="text-lg font-semibold text-heading">Billing</h1>
      </PageTopbar>
      <div className="px-8 py-6 space-y-6">

      {/* Trial Warning Banner - shown when trial is ending soon */}
      {showWarningBanner && subscription.trialEndsAt && (
        <TrialWarningBanner
          trialEndsAt={subscription.trialEndsAt}
          onConvertToPaid={handleTrialConversionClick}
        />
      )}

      {/* Subscription Status */}
      <SubscriptionStatusCard onUpgradeClick={handleUpgradeClick} />

      {/* Upgrade CTA Card - show for starter and growth plans */}
      {subscription?.plan !== "scale" && subscription?.subscriptionStatus !== "cancelled" && (
        <UpgradeCTACard
          currentPlan={subscription.plan as "starter" | "growth"}
          onUpgrade={handleUpgradeClick}
        />
      )}

      {/* Downgrade CTA Card - show for growth and scale plans */}
      {subscription?.plan !== "starter" && subscription?.subscriptionStatus === "active" && (
        <DowngradeCTACard
          currentPlan={subscription.plan as "growth" | "scale"}
          onDowngrade={handleDowngradeClick}
        />
      )}

      {/* Cancel CTA Card - show only for active subscriptions (not cancelled, not trial) */}
      {subscription?.subscriptionStatus === "active" && subscription?.plan !== "starter" && (
        <CancelCTACard
          currentPlan={subscription.plan as "growth" | "scale"}
          onCancel={handleCancellationClick}
        />
      )}

      {/* Cancellation Retention Card - show for cancelled subscriptions */}
      {subscription?.subscriptionStatus === "cancelled" && subscription.billingEndDate && subscription.cancellationDate && (
        <CancellationRetentionCard
          billingEndDate={subscription.billingEndDate}
          cancellationDate={subscription.cancellationDate}
          deletionScheduledDate={subscription.deletionScheduledDate || (subscription.billingEndDate + 30 * 24 * 60 * 60 * 1000)}
        />
      )}

      {/* Plan Selection - only show for starter plan */}
      {subscription?.plan === "starter" && (
        <PlanSelectionCard
          currentPlan={subscription.plan}
          onSelectPlan={handleSelectPlan}
        />
      )}

      {/* Usage Statistics - AC3 */}
      {usage && tierConfig && (
        <UsageStatsCard
          usage={usage}
          limits={{
            maxAffiliates: tierConfig.maxAffiliates,
            maxCampaigns: tierConfig.maxCampaigns,
            maxTeamMembers: tierConfig.maxTeamMembers,
          }}
          onUpgrade={subscription?.plan !== "scale" && subscription?.subscriptionStatus !== "cancelled" ? handleUpgradeClick : undefined}
        />
      )}

      {/* Billing History - AC4 */}
      {billingHistory && (
        <BillingHistoryTable
          events={billingHistory.page as any}
          isLoading={billingHistory === undefined}
          hasMore={!billingHistory.isDone && !!billingHistory.continueCursor}
          hasPrevious={billingCursorStack.length > 0}
          onNext={() => {
            if (billingHistory.continueCursor) {
              // Push current cursor to stack before advancing
              setBillingCursorStack(prev => [...prev, billingCursor].filter(Boolean) as string[]);
              setBillingCursor(billingHistory.continueCursor);
            }
          }}
          onPrevious={() => {
            // Pop previous cursor from stack
            if (billingCursorStack.length > 0) {
              const newStack = [...billingCursorStack];
              const prevCursor = newStack.pop();
              setBillingCursorStack(newStack);
              setBillingCursor(prevCursor || null);
            }
          }}
        />
      )}

      {/* Plan Comparison Modal */}
      {showPlanComparison && selectedPlan && subscription?.plan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-background rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto">
            <PlanComparison
              currentPlan={subscription.plan as "starter" | "growth" | "scale"}
              targetPlan={selectedPlan}
              onConfirm={handlePlanComparisonConfirm}
              onCancel={handlePlanComparisonCancel}
            />
          </div>
        </div>
      )}

      {/* Mock Checkout Modal - for new subscriptions from starter or trial conversions */}
      <MockCheckoutModal
        isOpen={checkoutOpen && selectedPlan !== null}
        selectedPlan={selectedPlan}
        onClose={() => {
          setCheckoutOpen(false);
          setSelectedPlan(null);
        }}
        onSuccess={handleCheckoutSuccess}
        // Show as trial conversion only if user is actually on trial
        isTrialConversion={subscription?.isTrial === true}
      />

      {/* Upgrade Confirmation Dialog */}
      {showUpgradeConfirmation && selectedPlan && subscription?.plan && tierConfig && (
        <UpgradeConfirmationDialog
          isOpen={showUpgradeConfirmation}
          currentPlan={subscription.plan}
          targetPlan={selectedPlan}
          proratedAmount={calculateEstimatedProration(
            tierConfig.price,
            selectedPlan,
            tierConfig
          )}
          newMonthlyAmount={getTierPrice(selectedPlan, tierConfig)}
          onConfirm={handleUpgradeConfirmationConfirm}
          onCancel={handleUpgradeConfirmationCancel}
          isLoading={isUpgrading}
        />
      )}

      {/* Downgrade Warning Dialog */}
      {showDowngradeWarning && selectedDowngradeTarget && subscription?.plan && tenantId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-background rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto">
            <DowngradeWarningDialog
              currentPlan={subscription.plan as "scale" | "growth"}
              targetPlan={selectedDowngradeTarget}
              effectiveDate={subscription.billingEndDate || Date.now()}
              tenantId={tenantId}
              onConfirm={handleDowngradeWarningConfirm}
              onCancel={handleDowngradeWarningCancel}
            />
          </div>
        </div>
      )}

      {/* Downgrade Confirmation Dialog */}
      {showDowngradeConfirmation && selectedDowngradeTarget && subscription?.plan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-background rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto">
            <DowngradeConfirmationDialog
              currentPlan={subscription.plan as "scale" | "growth"}
              targetPlan={selectedDowngradeTarget}
              effectiveDate={subscription.billingEndDate || Date.now()}
              onConfirm={handleDowngradeConfirmationConfirm}
              onCancel={handleDowngradeConfirmationCancel}
              isLoading={isDowngrading}
            />
          </div>
        </div>
      )}

      {/* Cancellation Warning Dialog */}
      {showCancellationWarning && subscription?.plan && subscription?.billingEndDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-background rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto">
            <CancellationWarningDialog
              currentPlan={subscription.plan as "starter" | "growth" | "scale"}
              billingEndDate={subscription.billingEndDate}
              onConfirm={handleCancellationWarningConfirm}
              onCancel={handleCancellationWarningCancel}
            />
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Dialog */}
      {showCancellationConfirmation && subscription?.plan && subscription?.billingEndDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-background rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto">
            <CancellationConfirmationDialog
              currentPlan={subscription.plan as "starter" | "growth" | "scale"}
              billingEndDate={subscription.billingEndDate}
              onConfirm={handleCancellationConfirmationConfirm}
              onCancel={handleCancellationConfirmationCancel}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

interface UpgradeCTACardProps {
  currentPlan: "starter" | "growth";
  onUpgrade: () => void;
}

function UpgradeCTACard({ currentPlan, onUpgrade }: UpgradeCTACardProps) {
  const nextTier = currentPlan === "starter" ? "growth" : "scale";
  const features =
    currentPlan === "starter"
      ? ["Up to 5,000 affiliates", "10 campaigns", "Advanced analytics"]
      : ["Unlimited affiliates", "Unlimited campaigns", "Priority support"];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          Upgrade Your Plan
        </CardTitle>
        <CardDescription>
          Unlock more affiliates, campaigns, and features
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Next tier</p>
            <p className="text-lg font-semibold capitalize">{nextTier}</p>
            <ul className="mt-2 space-y-1">
              {features.map((feature, i) => (
                <li
                  key={i}
                  className="text-sm text-muted-foreground flex items-center gap-2"
                >
                  <span className="text-green-500">✓</span> {feature}
                </li>
              ))}
            </ul>
          </div>
          <Button onClick={onUpgrade} size="lg">
            Upgrade to {nextTier}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface DowngradeCTACardProps {
  currentPlan: "growth" | "scale";
  onDowngrade: () => void;
}

function DowngradeCTACard({ currentPlan, onDowngrade }: DowngradeCTACardProps) {
  const lowerTier = currentPlan === "scale" ? "growth" : "starter";
  const savings = currentPlan === "scale" ? 2500 : 2499;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-muted-foreground" />
          Downgrade Your Plan
        </CardTitle>
        <CardDescription>
          Reduce costs by switching to a lower tier
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Next lower tier</p>
            <p className="text-lg font-semibold capitalize">{lowerTier}</p>
            <p className="mt-2 text-sm text-green-600">
              Save ₱{savings.toLocaleString()}/month
            </p>
          </div>
          <Button onClick={onDowngrade} variant="outline" size="lg">
            Downgrade to {lowerTier}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface CancelCTACardProps {
  currentPlan: "growth" | "scale";
  onCancel: () => void;
}

function CancelCTACard({ currentPlan, onCancel }: CancelCTACardProps) {
  return (
    <Card className="border-red-200 dark:border-red-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <XCircle className="h-5 w-5" />
          Cancel Subscription
        </CardTitle>
        <CardDescription>
          Stop billing and deactivate your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Your account and data will be deleted 30 days after your billing cycle ends.
              You can reactivate your subscription during the retention period.
            </p>
          </div>
          <Button onClick={onCancel} variant="destructive" size="lg">
            Cancel Subscription
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
