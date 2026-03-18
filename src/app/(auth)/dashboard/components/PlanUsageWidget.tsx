"use client";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Users, Megaphone } from "lucide-react";

interface PlanUsage {
  planName: string;
  affiliateCount: number;
  maxAffiliates: number;
  campaignCount: number;
  maxCampaigns: number;
  affiliateUsagePercent: number;
  campaignUsagePercent: number;
  affiliateWarning?: boolean;
  campaignWarning?: boolean;
}

interface PlanUsageWidgetProps {
  usage: PlanUsage | null | undefined;
  isLoading?: boolean;
}

const UNLIMITED = -1;

export function PlanUsageWidget({ usage, isLoading = false }: PlanUsageWidgetProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">Plan usage unavailable</p>
      </div>
    );
  }

  const formatLimit = (count: number, limit: number): string => {
    if (limit === UNLIMITED) return `${count.toLocaleString()} / Unlimited`;
    return `${count.toLocaleString()} / ${limit.toLocaleString()}`;
  };

  const getProgressColor = (percent: number, hasWarning: boolean): string => {
    if (percent >= 95) return "bg-red-500";
    if (hasWarning || percent >= 80) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Plan Usage
        </h3>
        <Badge variant="secondary" className="text-xs">
          {usage.planName}
        </Badge>
      </div>

      {/* Affiliates Usage */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Affiliates</span>
          {usage.affiliateWarning && (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          )}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {formatLimit(usage.affiliateCount, usage.maxAffiliates)}
          </span>
          {usage.maxAffiliates !== UNLIMITED && (
            <span className={cn(
              "font-medium",
              usage.affiliateWarning ? "text-amber-600" : "text-muted-foreground"
            )}>
              {usage.affiliateUsagePercent}%
            </span>
          )}
        </div>
        {usage.maxAffiliates !== UNLIMITED && (
          <Progress
            value={Math.min(usage.affiliateUsagePercent, 100)}
            className="h-2"
          />
        )}
      </div>

      {/* Campaigns Usage */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Campaigns</span>
          {usage.campaignWarning && (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          )}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {formatLimit(usage.campaignCount, usage.maxCampaigns)}
          </span>
          {usage.maxCampaigns !== UNLIMITED && (
            <span className={cn(
              "font-medium",
              usage.campaignWarning ? "text-amber-600" : "text-muted-foreground"
            )}>
              {usage.campaignUsagePercent}%
            </span>
          )}
        </div>
        {usage.maxCampaigns !== UNLIMITED && (
          <Progress
            value={Math.min(usage.campaignUsagePercent, 100)}
            className="h-2"
          />
        )}
      </div>

      {/* Upgrade Prompt */}
      {(usage.affiliateWarning || usage.campaignWarning) && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
          <p className="text-xs text-amber-800">
            Approaching plan limits.{" "}
            <a href="/settings/billing" className="font-medium underline hover:no-underline">
              Upgrade plan
            </a>{" "}
            for more capacity.
          </p>
        </div>
      )}
    </div>
  );
}
