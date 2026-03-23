"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/MetricCard";
import { FadeIn } from "@/components/ui/FadeIn";
import { cn } from "@/lib/utils";
import { MousePointerClick, Target, Percent, DollarSign, BadgeCheck } from "lucide-react";

interface CampaignRoiComparisonProps {
  comparisonData: Array<{
    campaignId: string;
    name: string;
    clicks: number;
    conversions: number;
    conversionRate: number;
    totalCommissions: number;
    costPerConversion: number;
    convEfficiency: number;
  }>;
  canViewSensitiveData: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function CampaignRoiComparison({
  comparisonData,
  canViewSensitiveData,
}: CampaignRoiComparisonProps) {
  if (comparisonData.length === 0) return null;

  const gridCols = cn(
    "grid gap-4",
    comparisonData.length === 1 && "grid-cols-1",
    comparisonData.length === 2 && "grid-cols-1 sm:grid-cols-2",
    comparisonData.length === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
  );

  return (
    <FadeIn className="space-y-4">
      <h2 className="text-lg font-semibold">Campaign Comparison</h2>
      <div className={gridCols}>
        {comparisonData.map((campaign) => (
          <Card key={campaign.campaignId} className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-[var(--brand-primary,#10409a)]">
                {campaign.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <MetricCard
                  label="Clicks"
                  numericValue={campaign.clicks}
                  variant="blue"
                  icon={<MousePointerClick className="w-4 h-4" />}
                />
                <MetricCard
                  label="Conversions"
                  numericValue={campaign.conversions}
                  variant="green"
                  icon={<Target className="w-4 h-4" />}
                />
              </div>
              <MetricCard
                label="Conv. Rate"
                value={`${campaign.conversionRate.toFixed(2)}%`}
                variant="yellow"
                icon={<Percent className="w-4 h-4" />}
              />
              {canViewSensitiveData && (
                <>
                  <MetricCard
                    label="Cost/Conversion"
                    value={formatCurrency(campaign.costPerConversion)}
                    variant="gray"
                    icon={<DollarSign className="w-4 h-4" />}
                  />
                  <MetricCard
                    label="Conv. Efficiency"
                    value={`${campaign.convEfficiency.toFixed(1)}%`}
                    variant="green"
                    icon={<BadgeCheck className="w-4 h-4" />}
                  />
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </FadeIn>
  );
}
