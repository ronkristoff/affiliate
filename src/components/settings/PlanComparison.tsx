"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowUp, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanComparisonProps {
  currentPlan: string;
  targetPlan: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const FEATURE_LABELS = {
  affiliates: "Affiliates",
  campaigns: "Campaigns",
  teamMembers: "Team Members",
  analytics: "Analytics",
  advancedAnalytics: "Advanced Analytics",
  prioritySupport: "Priority Support",
};

type FeatureKey = keyof typeof FEATURE_LABELS;

function getTierFeatureValue(tier: any, feature: FeatureKey): string | number | boolean {
  switch (feature) {
    case "affiliates":
      return tier.maxAffiliates === -1 ? "Unlimited" : tier.maxAffiliates;
    case "campaigns":
      return tier.maxCampaigns === -1 ? "Unlimited" : tier.maxCampaigns;
    case "teamMembers":
      return tier.maxTeamMembers === -1 ? "Unlimited" : tier.maxTeamMembers;
    case "analytics":
      return tier.features?.advancedAnalytics ? "advanced" : "basic";
    case "advancedAnalytics":
      return tier.features?.advancedAnalytics ?? false;
    case "prioritySupport":
      return tier.features?.prioritySupport ?? false;
    default:
      return false;
  }
}

export function PlanComparison({
  currentPlan,
  targetPlan,
  onConfirm,
  onCancel,
}: PlanComparisonProps) {
  const allTiers = useQuery(api.tierConfig.getAllTierConfigs);

  const { currentTier, targetTier, proratedAmount } = useMemo(() => {
    if (!allTiers) {
      return { currentTier: null, targetTier: null, proratedAmount: 0 };
    }

    const current = allTiers.find((t) => t.tier === currentPlan);
    const target = allTiers.find((t) => t.tier === targetPlan);

    // Simple proration calculation (30-day cycle assumed)
    const priceDiff = (target?.price || 0) - (current?.price || 0);
    const dailyRate = priceDiff / 30;
    const estimatedProrated = Math.ceil(dailyRate * 15); // Assume mid-cycle for display

    return {
      currentTier: current,
      targetTier: target,
      proratedAmount: estimatedProrated,
    };
  }, [allTiers, currentPlan, targetPlan]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(price);
  };

  const renderFeatureValue = (
    feature: FeatureKey,
    tier: any
  ) => {
    const value = getTierFeatureValue(tier, feature);

    if (typeof value === "boolean") {
      return value ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <X className="h-4 w-4 text-gray-300" />
      );
    }

    return <span className="font-medium">{value}</span>;
  };

  const isUpgrade = (feature: FeatureKey) => {
    const currentValue = getTierFeatureValue(currentTier, feature);
    const targetValue = getTierFeatureValue(targetTier, feature);

    if (typeof currentValue === "boolean" && typeof targetValue === "boolean") {
      return targetValue && !currentValue;
    }

    if (typeof currentValue === "string" && typeof targetValue === "string") {
      const tiers = ["basic", "advanced", "enterprise"];
      return tiers.indexOf(targetValue) > tiers.indexOf(currentValue);
    }

    if (typeof currentValue === "number" && typeof targetValue === "number") {
      return targetValue > currentValue;
    }

    return targetValue === "Unlimited" && currentValue !== "Unlimited";
  };

  const features: FeatureKey[] = [
    "affiliates",
    "campaigns",
    "teamMembers",
    "analytics",
    "advancedAnalytics",
    "prioritySupport",
  ];

  if (!currentTier || !targetTier) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Loading plan details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Upgrade Your Plan</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Compare plans and confirm your upgrade
        </p>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Current Plan */}
        <Card className="border-2 border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg capitalize">{currentPlan}</CardTitle>
              <Badge variant="secondary">Current</Badge>
            </div>
            <p className="text-2xl font-bold">
              {formatPrice(currentTier.price)}
              <span className="text-sm font-normal text-muted-foreground">/mo</span>
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {FEATURE_LABELS[feature]}
                  </span>
                  {renderFeatureValue(feature, currentTier)}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Target Plan */}
        <Card className="border-2 border-primary relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg capitalize">{targetPlan}</CardTitle>
              <Badge className="bg-primary">Selected</Badge>
            </div>
            <p className="text-2xl font-bold">
              {formatPrice(targetTier.price)}
              <span className="text-sm font-normal text-muted-foreground">/mo</span>
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {features.map((feature) => (
                <li
                  key={feature}
                  className={cn(
                    "flex items-center justify-between text-sm",
                    isUpgrade(feature) && "text-green-600 font-medium"
                  )}
                >
                  <span className="text-muted-foreground">
                    {FEATURE_LABELS[feature]}
                  </span>
                  <div className="flex items-center gap-1">
                    {renderFeatureValue(feature, targetTier)}
                    {isUpgrade(feature) && (
                      <ArrowUp className="h-3 w-3 text-green-600" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade Arrow */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground bg-muted px-4 py-2 rounded-full">
          <span className="capitalize">{currentPlan}</span>
          <ArrowRight className="h-4 w-4" />
          <span className="capitalize font-medium text-foreground">{targetPlan}</span>
        </div>
      </div>

      {/* Prorated Billing Info */}
      <div className="bg-muted rounded-lg p-4 space-y-2">
        <h4 className="font-medium">Prorated Billing</h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price difference</span>
            <span>{formatPrice(targetTier.price - currentTier.price)}/mo</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Prorated charge today</span>
            <span className="text-primary">
              ~{formatPrice(proratedAmount)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            Your next billing cycle will be {formatPrice(targetTier.price)}/month.
            Exact prorated amount will be calculated at checkout.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm}>
          Continue to Checkout
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
