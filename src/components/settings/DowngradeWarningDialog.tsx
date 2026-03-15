"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, X } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Id } from "@/convex/_generated/dataModel";

interface DowngradeWarningDialogProps {
  currentPlan: "scale" | "growth";
  targetPlan: "growth" | "starter";
  effectiveDate: number;
  tenantId: Id<"tenants">;
  onConfirm: () => void;
  onCancel: () => void;
}

const LOST_FEATURES = {
  scale_to_growth: [
    "Unlimited affiliates → 5,000 affiliates limit",
    "Unlimited campaigns → 10 campaigns limit",
    "Priority support → Standard support",
    "Unlimited team members → 20 team members limit",
    "Unlimited payouts → 100 payouts per month limit",
  ],
  growth_to_starter: [
    "5,000 affiliates → 100 affiliates limit",
    "10 campaigns → 3 campaigns limit",
    "Custom domain support removed",
    "Advanced analytics → Basic analytics only",
    "20 team members → 5 team members limit",
    "100 payouts per month → 10 payouts per month limit",
  ],
};

interface UsageData {
  affiliates: { current: number; limit: number };
  campaigns: { current: number; limit: number };
  teamMembers: { current: number; limit: number };
  payouts: { current: number; limit: number };
}

export function DowngradeWarningDialog({
  currentPlan,
  targetPlan,
  effectiveDate,
  tenantId,
  onConfirm,
  onCancel,
}: DowngradeWarningDialogProps) {
  const tierLimits = useQuery(api.tierConfig.getAllTierConfigs);
  const allLimits = useQuery(api.tierConfig.getAllLimits, { tenantId });

  const lostFeaturesKey = `${currentPlan}_to_${targetPlan}` as keyof typeof LOST_FEATURES;
  const lostFeatures = LOST_FEATURES[lostFeaturesKey] || [];

  // Get target tier limits
  const targetTierConfig = tierLimits?.find((t) => t.tier === targetPlan);

  // Check which resources would exceed new limits
  const exceededResources: string[] = [];
  if (allLimits && targetTierConfig) {
    if (
      targetTierConfig.maxAffiliates !== -1 &&
      allLimits.affiliates.current > targetTierConfig.maxAffiliates
    ) {
      exceededResources.push(
        `Affiliates (${allLimits.affiliates.current} / ${targetTierConfig.maxAffiliates})`
      );
    }
    if (
      targetTierConfig.maxCampaigns !== -1 &&
      allLimits.campaigns.current > targetTierConfig.maxCampaigns
    ) {
      exceededResources.push(
        `Campaigns (${allLimits.campaigns.current} / ${targetTierConfig.maxCampaigns})`
      );
    }
    if (
      targetTierConfig.maxTeamMembers !== -1 &&
      allLimits.teamMembers.current > targetTierConfig.maxTeamMembers
    ) {
      exceededResources.push(
        `Team members (${allLimits.teamMembers.current} / ${targetTierConfig.maxTeamMembers})`
      );
    }
    if (
      targetTierConfig.maxPayoutsPerMonth !== -1 &&
      allLimits.payouts.current > targetTierConfig.maxPayoutsPerMonth
    ) {
      exceededResources.push(
        `Payouts (${allLimits.payouts.current} / ${targetTierConfig.maxPayoutsPerMonth})`
      );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Downgrade Your Plan</h2>
        <p className="text-muted-foreground mt-1">
          Review the changes before confirming your downgrade
        </p>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Warning: You will lose features</AlertTitle>
        <AlertDescription>
          Downgrading to {targetPlan} will remove access to the following
          features:
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Features Being Removed</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {lostFeatures.map((feature, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <X className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Usage vs Limits Comparison */}
      {allLimits && targetTierConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Current Usage vs. New Limits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Affiliates */}
            <div
              className={cn(
                "flex justify-between items-center py-2 border-b",
                targetTierConfig.maxAffiliates !== -1 &&
                  allLimits.affiliates.current > targetTierConfig.maxAffiliates
                  ? "text-red-600 font-medium"
                  : ""
              )}
            >
              <span className="text-sm">Affiliates</span>
              <span className="text-sm">
                {allLimits.affiliates.current} /{" "}
                {targetTierConfig.maxAffiliates === -1
                  ? "Unlimited"
                  : targetTierConfig.maxAffiliates}
                {targetTierConfig.maxAffiliates !== -1 &&
                  allLimits.affiliates.current >
                    targetTierConfig.maxAffiliates && (
                    <span className="ml-2 text-red-600">⚠️ Exceeds limit</span>
                  )}
              </span>
            </div>

            {/* Campaigns */}
            <div
              className={cn(
                "flex justify-between items-center py-2 border-b",
                targetTierConfig.maxCampaigns !== -1 &&
                  allLimits.campaigns.current > targetTierConfig.maxCampaigns
                  ? "text-red-600 font-medium"
                  : ""
              )}
            >
              <span className="text-sm">Campaigns</span>
              <span className="text-sm">
                {allLimits.campaigns.current} /{" "}
                {targetTierConfig.maxCampaigns === -1
                  ? "Unlimited"
                  : targetTierConfig.maxCampaigns}
                {targetTierConfig.maxCampaigns !== -1 &&
                  allLimits.campaigns.current >
                    targetTierConfig.maxCampaigns && (
                    <span className="ml-2 text-red-600">⚠️ Exceeds limit</span>
                  )}
              </span>
            </div>

            {/* Team Members */}
            <div
              className={cn(
                "flex justify-between items-center py-2 border-b",
                targetTierConfig.maxTeamMembers !== -1 &&
                  allLimits.teamMembers.current > targetTierConfig.maxTeamMembers
                  ? "text-red-600 font-medium"
                  : ""
              )}
            >
              <span className="text-sm">Team Members</span>
              <span className="text-sm">
                {allLimits.teamMembers.current} /{" "}
                {targetTierConfig.maxTeamMembers === -1
                  ? "Unlimited"
                  : targetTierConfig.maxTeamMembers}
                {targetTierConfig.maxTeamMembers !== -1 &&
                  allLimits.teamMembers.current >
                    targetTierConfig.maxTeamMembers && (
                    <span className="ml-2 text-red-600">⚠️ Exceeds limit</span>
                  )}
              </span>
            </div>

            {/* Payouts */}
            <div
              className={cn(
                "flex justify-between items-center py-2",
                targetTierConfig.maxPayoutsPerMonth !== -1 &&
                  allLimits.payouts.current > targetTierConfig.maxPayoutsPerMonth
                  ? "text-red-600 font-medium"
                  : ""
              )}
            >
              <span className="text-sm">Payouts per Month</span>
              <span className="text-sm">
                {allLimits.payouts.current} /{" "}
                {targetTierConfig.maxPayoutsPerMonth === -1
                  ? "Unlimited"
                  : targetTierConfig.maxPayoutsPerMonth}
                {targetTierConfig.maxPayoutsPerMonth !== -1 &&
                  allLimits.payouts.current >
                    targetTierConfig.maxPayoutsPerMonth && (
                    <span className="ml-2 text-red-600">⚠️ Exceeds limit</span>
                  )}
              </span>
            </div>

            <div className="pt-2 text-xs text-muted-foreground bg-muted p-3 rounded">
              <strong>Note:</strong> Existing resources beyond new limits will
              remain accessible, but you won&apos;t be able to create new ones
              until you upgrade again or remove excess resources.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exceeded Resources Warning */}
      {exceededResources.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Resources Exceed New Limits</AlertTitle>
          <AlertDescription>
            The following resources exceed the new plan limits:
            <ul className="mt-2 space-y-1">
              {exceededResources.map((resource, i) => (
                <li key={i} className="text-sm">
                  • {resource}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Effective Date */}
      <div className="text-sm text-muted-foreground">
        <strong>Effective Date:</strong>{" "}
        {format(new Date(effectiveDate), "MMMM d, yyyy")} (next billing cycle)
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          Continue to Confirmation
        </Button>
      </div>
    </div>
  );
}
