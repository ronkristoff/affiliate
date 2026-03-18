"use client";

import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, TrendingUp } from "lucide-react";
import Link from "next/link";

interface Affiliate {
  _id: string;
  name: string;
  email: string;
  handle?: string;
  clicks: number;
  conversions: number;
  revenue: number;
  status: string;
}

interface TopAffiliatesTableProps {
  affiliates: Affiliate[];
  isLoading?: boolean;
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Active" },
  pending: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
  suspended: { bg: "bg-red-100", text: "text-red-700", label: "Suspended" },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

export function TopAffiliatesTable({
  affiliates,
  isLoading = false,
}: TopAffiliatesTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (affiliates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No affiliates yet</p>
        <p className="text-xs mt-1">Top performing affiliates will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Top Affiliates
        </h3>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-semibold uppercase">Affiliate</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-right">Clicks</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-right">Conv.</TableHead>
              <TableHead className="text-xs font-semibold uppercase text-right">Revenue</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {affiliates.map((affiliate, index) => {
              const status = statusStyles[affiliate.status] || statusStyles.pending;

              return (
                <TableRow key={affiliate._id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {index < 3 && (
                        <div className={cn(
                          "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold",
                          index === 0 ? "bg-amber-100 text-amber-700" :
                          index === 1 ? "bg-gray-200 text-gray-700" :
                          "bg-orange-100 text-orange-700"
                        )}>
                          {index + 1}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{affiliate.name}</p>
                        {affiliate.handle && (
                          <p className="text-xs text-muted-foreground">@{affiliate.handle}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatNumber(affiliate.clicks)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatNumber(affiliate.conversions)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    <div className="flex items-center justify-end gap-1">
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                      {formatCurrency(affiliate.revenue)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn("text-xs font-medium", status.bg, status.text)}
                    >
                      {status.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Link
          href="/affiliates"
          className="inline-flex items-center text-xs font-medium text-primary hover:underline"
        >
          View All
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Link>
      </div>
    </div>
  );
}
