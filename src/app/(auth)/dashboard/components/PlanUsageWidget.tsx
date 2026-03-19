"use client";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Megaphone } from "lucide-react";

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
      <div className="p-5">
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="text-center py-12 px-5">
        <p className="text-sm text-muted-foreground">Plan usage unavailable</p>
      </div>
    );
  }

  const formatLimit = (count: number, limit: number): string => {
    if (limit === UNLIMITED) return `${count.toLocaleString()} / Unlimited`;
    return `${count.toLocaleString()} / ${limit.toLocaleString()}`;
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Plan Usage</h3>
        <Badge variant="secondary" className="text-[11px] bg-[#dbeafe] text-[#1e40af]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--blue)] mr-1.5" />
          {usage.planName}
        </Badge>
      </div>
      <div className="p-5">
        {/* Affiliates Usage */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-[12px] font-semibold text-[var(--text-body)]">Affiliates</span>
            </div>
            <span className="text-[12px] text-muted-foreground">
              {formatLimit(usage.affiliateCount, usage.maxAffiliates)}
            </span>
          </div>
          {usage.maxAffiliates !== UNLIMITED && (
            <div className="bg-[var(--bg-page)] rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full bg-[var(--brand-secondary)]"
                style={{ width: `${Math.min(usage.affiliateUsagePercent, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Campaigns Usage */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-muted-foreground" />
              <span className="text-[12px] font-semibold text-[var(--text-body)]">Campaigns</span>
            </div>
            <span className="text-[12px] text-muted-foreground">
              {formatLimit(usage.campaignCount, usage.maxCampaigns)}
            </span>
          </div>
          {usage.maxCampaigns !== UNLIMITED && (
            <div className="bg-[var(--bg-page)] rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full bg-[var(--brand-secondary)]"
                style={{ width: `${Math.min(usage.campaignUsagePercent, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
