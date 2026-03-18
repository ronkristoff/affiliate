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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowRight, Wallet } from "lucide-react";
import Link from "next/link";

interface Commission {
  _id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateEmail: string;
  campaignName: string;
  amount: number;
  status: string;
  createdAt: number;
  planContext?: string;
}

interface RecentCommissionsTableProps {
  commissions: Commission[];
  isLoading?: boolean;
  pendingCount?: number;
  showPayAllButton?: boolean;
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  confirmed: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Confirmed" },
  pending: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
  reversed: { bg: "bg-red-100", text: "text-red-700", label: "Reversed" },
  paid: { bg: "bg-gray-100", text: "text-gray-700", label: "Paid" },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function RecentCommissionsTable({
  commissions,
  isLoading = false,
  pendingCount = 0,
  showPayAllButton = false,
}: RecentCommissionsTableProps) {
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

  if (commissions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No commissions yet</p>
        <p className="text-xs mt-1">Commissions will appear here when affiliates earn them</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent Commissions
        </h3>
        {showPayAllButton && pendingCount > 0 && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <Wallet className="w-3.5 h-3.5" />
            Pay All Pending
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {pendingCount}
            </Badge>
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-semibold uppercase">Affiliate</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Amount</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commissions.map((commission) => {
              const status = statusStyles[commission.status] || statusStyles.pending;
              const initials = commission.affiliateName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return (
                <TableRow key={commission._id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{commission.affiliateName}</p>
                        <p className="text-xs text-muted-foreground">{commission.affiliateEmail}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {formatCurrency(commission.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn("text-xs font-medium", status.bg, status.text)}
                    >
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(commission.createdAt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Link
          href="/commissions"
          className="inline-flex items-center text-xs font-medium text-primary hover:underline"
        >
          View All
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Link>
      </div>
    </div>
  );
}
