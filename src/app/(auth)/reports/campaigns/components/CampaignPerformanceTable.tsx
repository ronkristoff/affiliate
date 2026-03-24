"use client";

import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

interface CampaignPerformance {
  _id: Id<"campaigns">;
  name: string;
  status: string;
  description?: string;
  clicks: number;
  conversions: number;
  conversionRate: number;
  totalCommissions: number;
  activeAffiliates: number;
}

interface CampaignPerformanceTableProps {
  campaigns: CampaignPerformance[];
  isLoading?: boolean;
  onCampaignClick?: (campaignId: string) => void;
  canViewSensitiveData?: boolean;
  sortField?: "name" | "clicks" | "conversions" | "conversionRate" | "commissions" | "activeAffiliates";
  sortOrder?: "asc" | "desc";
  onSort?: (field: "name" | "clicks" | "conversions" | "conversionRate" | "commissions" | "activeAffiliates") => void;
}

type SortField = "name" | "clicks" | "conversions" | "conversionRate" | "commissions" | "activeAffiliates";

const statusStyles = {
  active: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    label: "Active",
  },
  paused: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    label: "Paused",
  },
  archived: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    label: "Archived",
  },
};

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-PH").format(num);
}

export function CampaignPerformanceTable({
  campaigns,
  isLoading = false,
  onCampaignClick,
  canViewSensitiveData = true,
  sortField = "name",
  sortOrder = "asc",
  onSort,
}: CampaignPerformanceTableProps) {
  const handleSort = (field: SortField) => {
    onSort?.(field);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return (
      <span className="ml-1">
        {sortOrder === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <div className="h-4 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-muted-foreground">No campaigns found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Create a campaign to start tracking performance
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide cursor-pointer hover:bg-muted/80"
                onClick={() => handleSort("name")}
              >
                Campaign <SortIcon field="name" />
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide cursor-pointer hover:bg-muted/80"
                onClick={() => handleSort("clicks")}
              >
                Clicks <SortIcon field="clicks" />
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide cursor-pointer hover:bg-muted/80"
                onClick={() => handleSort("conversions")}
              >
                Conversions <SortIcon field="conversions" />
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide cursor-pointer hover:bg-muted/80"
                onClick={() => handleSort("conversionRate")}
              >
                Conv. Rate <SortIcon field="conversionRate" />
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide cursor-pointer hover:bg-muted/80"
                onClick={() => handleSort("commissions")}
              >
                Commissions <SortIcon field="commissions" />
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide cursor-pointer hover:bg-muted/80"
                onClick={() => handleSort("activeAffiliates")}
              >
                Affiliates <SortIcon field="activeAffiliates" />
              </th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign: CampaignPerformance) => {
              const status = statusStyles[campaign.status as keyof typeof statusStyles] || statusStyles.paused;
              return (
                <tr
                  key={campaign._id}
                  className={cn(
                    "border-b transition-colors hover:bg-muted/50",
                    onCampaignClick && "cursor-pointer"
                  )}
                  onClick={() => onCampaignClick?.(campaign._id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{campaign.name}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", status.bg, status.text)}>
                        {status.label}
                      </span>
                    </div>
                    {campaign.description && (
                      <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {campaign.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(campaign.clicks)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatNumber(campaign.conversions)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {campaign.conversionRate.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {canViewSensitiveData ? formatCurrency(campaign.totalCommissions) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {campaign.activeAffiliates}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
