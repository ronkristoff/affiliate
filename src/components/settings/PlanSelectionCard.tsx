"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Zap, Rocket } from "lucide-react";

interface PlanSelectionCardProps {
  currentPlan: string;
  onSelectPlan: (plan: string) => void;
}

export function PlanSelectionCard({ currentPlan, onSelectPlan }: PlanSelectionCardProps) {
  const allTiers = useQuery(api.tierConfig.getAllTierConfigs);
  const defaultPlan = useQuery(api.tierConfig.getDefaultPlanName);

  if (!allTiers) {
    return null;
  }

  const defaultPlanName = defaultPlan ?? "starter";
  const paidTiers = allTiers.filter(t => t.tier !== defaultPlanName);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(price);
  };

  const getIcon = (tier: string, index: number) => {
    const icons = [<Zap className="h-5 w-5" />, <Rocket className="h-5 w-5" />];
    return icons[index % icons.length] ?? null;
  };

  const formatLimit = (limit: number) => {
    if (limit === -1) return "Unlimited";
    return limit.toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Available Plans</CardTitle>
        <CardDescription>
          Upgrade your plan to unlock more features and higher limits
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {paidTiers.map((tier) => {
            const isCurrentPlan = currentPlan === tier.tier;
            const currentTierConfig = allTiers.find(t => t.tier === currentPlan);
            const isUpgrade = !isCurrentPlan && (currentTierConfig ? tier.price > currentTierConfig.price : true);

            return (
              <div
                key={tier.tier}
                className={`relative rounded-lg border p-4 ${
                  isCurrentPlan
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {/* Plan Header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-primary">
                    {getIcon(tier.tier, paidTiers.indexOf(tier))}
                  </span>
                  <h3 className="font-semibold capitalize">{tier.tier}</h3>
                  {isCurrentPlan && (
                    <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                      Current
                    </span>
                  )}
                </div>

                {/* Price */}
                <div className="mb-4">
                  <span className="text-2xl font-bold">{formatPrice(tier.price)}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-4">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{formatLimit(tier.maxAffiliates)} affiliates</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{formatLimit(tier.maxCampaigns)} campaigns</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{formatLimit(tier.maxTeamMembers)} team members</span>
                  </li>
                {tier.features.advancedAnalytics && (
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Advanced analytics</span>
                    </li>
                  )}
                  {tier.features.prioritySupport && (
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Priority support</span>
                    </li>
                  )}
                </ul>

                {/* Action Button */}
                {!isCurrentPlan && (
                  <Button
                    onClick={() => onSelectPlan(tier.tier)}
                    className="w-full"
                    variant={isUpgrade ? "default" : "outline"}
                  >
                    {isUpgrade ? "Upgrade" : "Select"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
