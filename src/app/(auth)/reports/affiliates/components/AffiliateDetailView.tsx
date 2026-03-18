"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { X, Mail, Hash, TrendingUp, MousePointer, ShoppingCart, Wallet } from "lucide-react";
import { AffiliateTrendChart } from "./AffiliateTrendChart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AffiliateDetailViewProps {
  affiliateId: Id<"affiliates">;
  dateRange?: { start: number; end: number };
  onClose: () => void;
  canViewSensitiveData: boolean;
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
  rejected: "bg-gray-100 text-gray-700",
};

export function AffiliateDetailView({
  affiliateId,
  dateRange,
  onClose,
  canViewSensitiveData,
}: AffiliateDetailViewProps) {
  const details = useQuery(
    api.reports.getAffiliatePerformanceDetails,
    {
      affiliateId,
      dateRange,
    }
  );

  const isLoading = details === undefined;

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!details) {
    return (
      <Card className="w-full">
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Affiliate not found</p>
          <Button onClick={onClose} className="mt-4">
            Close
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { affiliate, metrics, campaignBreakdown, trendData } = details;

  return (
    <Card className="w-full">
      {/* Header */}
      <CardHeader className="border-b pb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <CardTitle className="text-xl">{affiliate.name}</CardTitle>
              <Badge 
                variant="secondary" 
                className={cn("text-xs capitalize", statusColors[affiliate.status] || "bg-gray-100 text-gray-700")}
              >
                {affiliate.status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Mail className="w-4 h-4" />
                {affiliate.email}
              </div>
              <div className="flex items-center gap-1">
                <Hash className="w-4 h-4" />
                {affiliate.uniqueCode}
              </div>
              {affiliate.promotionChannel && (
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  {affiliate.promotionChannel}
                </div>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricItem
            icon={<MousePointer className="w-4 h-4 text-blue-500" />}
            label="Clicks"
            value={metrics.clicks.toLocaleString()}
          />
          <MetricItem
            icon={<ShoppingCart className="w-4 h-4 text-emerald-500" />}
            label="Conversions"
            value={metrics.conversions.toLocaleString()}
          />
          <MetricItem
            icon={<TrendingUp className="w-4 h-4 text-purple-500" />}
            label="Conv. Rate"
            value={`${metrics.conversionRate.toFixed(2)}%`}
          />
          <MetricItem
            icon={<Wallet className="w-4 h-4 text-amber-500" />}
            label="Total Commissions"
            value={canViewSensitiveData ? `₱${metrics.totalCommissions.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}` : "—"}
          />
        </div>

        {/* Commission Breakdown */}
        {canViewSensitiveData && (
          <div className="grid grid-cols-3 gap-4">
            <CommissionStatusCard
              label="Confirmed"
              value={metrics.commissionBreakdown.confirmed}
              color="bg-emerald-50 text-emerald-700 border-emerald-200"
            />
            <CommissionStatusCard
              label="Pending"
              value={metrics.commissionBreakdown.pending}
              color="bg-amber-50 text-amber-700 border-amber-200"
            />
            <CommissionStatusCard
              label="Reversed"
              value={metrics.commissionBreakdown.reversed}
              color="bg-red-50 text-red-700 border-red-200"
            />
          </div>
        )}

        {/* Trend Chart */}
        <div>
          <h3 className="text-sm font-semibold mb-4">Performance Trend</h3>
          <AffiliateTrendChart 
            data={trendData} 
            showCommissions={canViewSensitiveData}
          />
        </div>

        {/* Campaign Breakdown */}
        {campaignBreakdown.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-4">Campaign Participation</h3>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs font-semibold uppercase text-gray-500">Campaign</TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-gray-500 text-right">Clicks</TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-gray-500 text-right">Conversions</TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-gray-500 text-right">Commissions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignBreakdown.map((campaign) => (
                    <TableRow key={campaign._id}>
                      <TableCell className="py-3 text-sm font-medium">
                        {campaign.name}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-right tabular-nums">
                        {campaign.clicks.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-right tabular-nums">
                        {campaign.conversions.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-right tabular-nums">
                        {canViewSensitiveData ? (
                          <span>₱{campaign.commissions.toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MetricItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function MetricItem({ icon, label, value }: MetricItemProps) {
  return (
    <div className="p-4 rounded-lg border bg-gray-50">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-gray-500 uppercase font-semibold">{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900 tabular-nums">{value}</p>
    </div>
  );
}

interface CommissionStatusCardProps {
  label: string;
  value: number;
  color: string;
}

function CommissionStatusCard({ label, value, color }: CommissionStatusCardProps) {
  return (
    <div className={cn("p-3 rounded-lg border text-center", color)}>
      <p className="text-xs font-semibold uppercase opacity-80">{label}</p>
      <p className="text-lg font-bold tabular-nums">
        ₱{value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}
