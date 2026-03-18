"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, ArrowUp, ArrowDown, Medal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type SortBy = "clicks" | "conversions" | "conversionRate" | "commissions" | "name";
type SortOrder = "asc" | "desc";

interface AffiliatePerformance {
  _id: Id<"affiliates">;
  name: string;
  email: string;
  uniqueCode: string;
  status: string;
  clicks: number;
  conversions: number;
  conversionRate: number;
  totalCommissions: number;
}

interface AffiliatePerformanceTableProps {
  tenantId: Id<"tenants">;
  dateRange?: { start: number; end: number };
  campaignId?: Id<"campaigns">;
  onAffiliateSelect?: (affiliateId: Id<"affiliates">) => void;
  canViewSensitiveData: boolean;
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
  rejected: "bg-gray-100 text-gray-700",
};

const rankColors: Record<number, string> = {
  0: "bg-yellow-100 text-yellow-700 border-yellow-200", // Gold
  1: "bg-gray-200 text-gray-700 border-gray-300",      // Silver
  2: "bg-orange-100 text-orange-700 border-orange-200", // Bronze
};

export function AffiliatePerformanceTable({
  tenantId,
  dateRange,
  campaignId,
  onAffiliateSelect,
  canViewSensitiveData,
}: AffiliatePerformanceTableProps) {
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const affiliates = useQuery(
    api.reports.getAffiliatePerformanceList,
    {
      tenantId,
      dateRange,
      campaignId,
      sortBy,
      sortOrder,
    }
  );

  const isLoading = affiliates === undefined;

  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc"); // Default to desc for new column
    }
  };

  const getSortIcon = (column: SortBy) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1" />
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white">
        <div className="p-4">
          <Skeleton className="h-4 w-full mb-4" />
          <Skeleton className="h-4 w-full mb-4" />
          <Skeleton className="h-4 w-full mb-4" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    );
  }

  if (affiliates.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <p className="text-muted-foreground">No affiliates found for the selected period.</p>
      </div>
    );
  }

  // Sort by commissions descending to identify top performers
  const sortedByCommissions = [...affiliates].sort((a, b) => b.totalCommissions - a.totalCommissions);
  const topPerformerIds = new Set(sortedByCommissions.slice(0, 3).map(a => a._id));

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            <TableHead className="w-12 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Rank
            </TableHead>
            <TableHead 
              className="text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer"
              onClick={() => handleSort("name")}
            >
              <div className="flex items-center">
                Affiliate
                {getSortIcon("name")}
              </div>
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Email
            </TableHead>
            <TableHead 
              className="text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer text-right"
              onClick={() => handleSort("clicks")}
            >
              <div className="flex items-center justify-end">
                Clicks
                {getSortIcon("clicks")}
              </div>
            </TableHead>
            <TableHead 
              className="text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer text-right"
              onClick={() => handleSort("conversions")}
            >
              <div className="flex items-center justify-end">
                Conversions
                {getSortIcon("conversions")}
              </div>
            </TableHead>
            <TableHead 
              className="text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer text-right"
              onClick={() => handleSort("conversionRate")}
            >
              <div className="flex items-center justify-end">
                Conv. Rate
                {getSortIcon("conversionRate")}
              </div>
            </TableHead>
            <TableHead 
              className="text-xs font-semibold uppercase tracking-wide text-gray-500 cursor-pointer text-right"
              onClick={() => handleSort("commissions")}
            >
              <div className="flex items-center justify-end">
                Commissions
                {getSortIcon("commissions")}
              </div>
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Status
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {affiliates.map((affiliate, index) => {
            const isTopPerformer = topPerformerIds.has(affiliate._id);
            const rank = sortedByCommissions.findIndex(a => a._id === affiliate._id);

            return (
              <TableRow
                key={affiliate._id}
                className={cn(
                  "cursor-pointer transition-colors",
                  onAffiliateSelect ? "hover:bg-gray-50" : "",
                  isTopPerformer && rank < 3 && "bg-yellow-50/30"
                )}
                onClick={() => onAffiliateSelect?.(affiliate._id)}
              >
                <TableCell className="py-3">
                  {rank < 3 ? (
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border",
                      rankColors[rank]
                    )}>
                      {rank + 1}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm w-7 inline-block text-center">
                      {rank + 1}
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{affiliate.name}</span>
                    <span className="text-xs text-muted-foreground">({affiliate.uniqueCode})</span>
                  </div>
                </TableCell>
                <TableCell className="py-3 text-sm text-gray-600">
                  {affiliate.email}
                </TableCell>
                <TableCell className="py-3 text-right text-sm tabular-nums">
                  {affiliate.clicks.toLocaleString()}
                </TableCell>
                <TableCell className="py-3 text-right text-sm tabular-nums">
                  {affiliate.conversions.toLocaleString()}
                </TableCell>
                <TableCell className="py-3 text-right text-sm tabular-nums">
                  {affiliate.conversionRate.toFixed(2)}%
                </TableCell>
                <TableCell className="py-3 text-right text-sm tabular-nums">
                  {canViewSensitiveData ? (
                    <span>₱{affiliate.totalCommissions.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="py-3">
                  <Badge 
                    variant="secondary" 
                    className={cn("text-xs capitalize", statusColors[affiliate.status] || "bg-gray-100 text-gray-700")}
                  >
                    {affiliate.status}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
