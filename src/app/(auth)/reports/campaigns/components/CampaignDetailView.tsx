"use client";

import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampaignTrendChart } from "./CampaignTrendChart";

interface CampaignDetailData {
  campaign: {
    _id: Id<"campaigns">;
    name: string;
    status: string;
    description?: string;
    commissionType: string;
    commissionValue: number;
  };
  metrics: {
    clicks: number;
    conversions: number;
    conversionRate: number;
    totalCommissions: number;
    activeAffiliates: number;
    commissionBreakdown: {
      confirmed: number;
      pending: number;
      reversed: number;
    };
  };
  topAffiliates: Array<{
    _id: Id<"affiliates">;
    name: string;
    email: string;
    clicks: number;
    conversions: number;
    revenue: number;
  }>;
  trendData: Array<{
    date: number;
    clicks: number;
    conversions: number;
    commissions: number;
  }>;
}

interface CampaignDetailViewProps {
  data?: CampaignDetailData;
  isLoading?: boolean;
  onClose: () => void;
  canViewSensitiveData?: boolean;
}

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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

export function CampaignDetailView({
  data,
  isLoading = false,
  onClose,
  canViewSensitiveData = true,
}: CampaignDetailViewProps) {
  if (!data && !isLoading) return null;

  const status = data ? statusStyles[data.campaign.status as keyof typeof statusStyles] || statusStyles.paused : null;

  // Commission breakdown chart (simple bar)
  const CommissionBreakdown = ({
    breakdown,
  }: {
    breakdown: CampaignDetailData["metrics"]["commissionBreakdown"];
  }) => {
    const total = breakdown.confirmed + breakdown.pending + breakdown.reversed;
    if (total === 0) {
      return <p className="text-sm text-muted-foreground">No commissions yet</p>;
    }

    const confirmedPercent = (breakdown.confirmed / total) * 100;
    const pendingPercent = (breakdown.pending / total) * 100;
    const reversedPercent = (breakdown.reversed / total) * 100;

    return (
      <div className="space-y-2">
        <div className="h-4 rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500"
            style={{ width: `${confirmedPercent}%` }}
          />
          <div
            className="bg-amber-500"
            style={{ width: `${pendingPercent}%` }}
          />
          <div
            className="bg-red-400"
            style={{ width: `${reversedPercent}%` }}
          />
        </div>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Confirmed: {canViewSensitiveData ? formatCurrency(breakdown.confirmed) : "—"}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Pending: {canViewSensitiveData ? formatCurrency(breakdown.pending) : "—"}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            Reversed: {canViewSensitiveData ? formatCurrency(breakdown.reversed) : "—"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{data?.campaign.name ?? "Loading..."}</h2>
              {status && (
                <span className={cn("text-xs px-2 py-0.5 rounded-full", status.bg, status.text)}>
                  {status.label}
                </span>
              )}
            </div>
            {data?.campaign.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {data.campaign.description}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              <div className="h-32 bg-muted animate-pulse rounded" />
            </div>
          ) : data ? (
            <>
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground uppercase">Clicks</p>
                  <p className="text-lg font-semibold">{formatNumber(data.metrics.clicks)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground uppercase">Conversions</p>
                  <p className="text-lg font-semibold">{formatNumber(data.metrics.conversions)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground uppercase">Conv. Rate</p>
                  <p className="text-lg font-semibold">{data.metrics.conversionRate.toFixed(2)}%</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground uppercase">Affiliates</p>
                  <p className="text-lg font-semibold">{data.metrics.activeAffiliates}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground uppercase">Commissions</p>
                  <p className="text-lg font-semibold">
                    {canViewSensitiveData ? formatCurrency(data.metrics.totalCommissions) : "—"}
                  </p>
                </div>
              </div>

              {/* Trend Chart */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Trend Over Time</h3>
                <div className="flex gap-4 text-xs mb-2">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-emerald-500" />
                    Clicks
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-amber-500" />
                    Conversions (x10)
                  </span>
                </div>
                <CampaignTrendChart trendData={data.trendData} />
              </div>

              {/* Commission Breakdown */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Commission Breakdown</h3>
                <CommissionBreakdown breakdown={data.metrics.commissionBreakdown} />
              </div>

              {/* Top Affiliates */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Top Performing Affiliates</h3>
                {data.topAffiliates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No affiliate data yet</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium">Affiliate</th>
                          <th className="px-3 py-2 text-right font-medium">Clicks</th>
                          <th className="px-3 py-2 text-right font-medium">Conversions</th>
                          <th className="px-3 py-2 text-right font-medium">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topAffiliates.slice(0, 5).map((affiliate) => (
                          <tr key={affiliate._id} className="border-t">
                            <td className="px-3 py-2">
                              <p className="font-medium">{affiliate.name}</p>
                              <p className="text-xs text-muted-foreground">{affiliate.email}</p>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatNumber(affiliate.clicks)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatNumber(affiliate.conversions)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {canViewSensitiveData ? formatCurrency(affiliate.revenue) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
