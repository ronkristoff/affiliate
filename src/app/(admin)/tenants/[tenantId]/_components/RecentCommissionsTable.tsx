"use client";

import { Id } from "@/convex/_generated/dataModel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Commission {
  _id: string;
  affiliateName: string;
  campaignName: string;
  amount: number;
  status: string;
  createdAt: number;
}

interface RecentCommissionsTableProps {
  commissions: Commission[];
  isLoading: boolean;
  tenantId: Id<"tenants">;
}

const phpFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const statusConfig: Record<string, { label: string; className: string }> = {
  approved: {
    label: "Approved",
    className: "bg-[#dcfce7] text-[#166534] border-[#bbf7d0]",
  },
  pending: {
    label: "Pending",
    className: "bg-[#fef3c7] text-[#92400e] border-[#fde68a]",
  },
  reversed: {
    label: "Reversed",
    className: "bg-[#fee2e2] text-[#991b1b] border-[#fecaca]",
  },
  paid: {
    label: "Paid",
    className: "bg-[#dbeafe] text-[#1e40af] border-[#bfdbfe]",
  },
};

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function SkeletonRow() {
  return (
    <TableRow>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 w-24 animate-pulse rounded bg-[#f3f4f6]" />
        </TableCell>
      ))}
    </TableRow>
  );
}

export function RecentCommissionsTable({
  commissions,
  isLoading,
  tenantId,
}: RecentCommissionsTableProps) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#111827]">
          Recent Commissions
        </h2>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-xs text-[#6b7280] hover:text-[#10409a]"
        >
          <Link href={`/tenants/${tenantId}?tab=payouts`}>
            View All
          </Link>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-[#e5e7eb] hover:bg-transparent">
            <TableHead className="text-xs font-medium text-[#6b7280]">
              Affiliate
            </TableHead>
            <TableHead className="text-xs font-medium text-[#6b7280]">
              Campaign
            </TableHead>
            <TableHead className="text-xs font-medium text-[#6b7280]">
              Amount
            </TableHead>
            <TableHead className="text-xs font-medium text-[#6b7280]">
              Status
            </TableHead>
            <TableHead className="text-xs font-medium text-[#6b7280]">
              Date
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

          {!isLoading && commissions.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={5}
                className="h-32 text-center text-sm text-[#6b7280]"
              >
                No commissions yet. Commissions will appear here once affiliates
                start generating sales.
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            commissions.map((commission) => {
              const status = statusConfig[commission.status] ?? {
                label: commission.status,
                className: "bg-[#f3f4f6] text-[#374151] border-[#e5e7eb]",
              };

              return (
                <TableRow key={commission._id} className="border-[#e5e7eb]">
                  <TableCell className="text-sm font-medium text-[#333333]">
                    {commission.affiliateName}
                  </TableCell>
                  <TableCell className="text-sm text-[#6b7280]">
                    {commission.campaignName}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-[#333333]">
                    {phpFormatter.format(commission.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
                        status.className
                      )}
                    >
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-[#6b7280]">
                    {formatDate(commission.createdAt)}
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </div>
  );
}
