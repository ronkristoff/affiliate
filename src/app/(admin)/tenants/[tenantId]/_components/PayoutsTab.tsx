"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Eye, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PayoutsTabProps {
  tenantId: Id<"tenants">;
}

interface PayoutBatch {
  _id: string;
  batchCode: string;
  affiliateCount: number;
  totalAmount: number;
  status: string;
  createdAt: number;
  completedAt?: number;
  stallDuration?: number;
}

export function PayoutsTab({ tenantId }: PayoutsTabProps) {
  const batches = useQuery(api.admin.tenants.getTenantPayoutBatches, { tenantId });
  const isLoading = batches === undefined;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
  const formatDate = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    completed: { label: "Completed", bg: "bg-[#d1fae5]", text: "text-[#065f46]" },
    processing: { label: "Processing", bg: "bg-[#dbeafe]", text: "text-[#1e40af]" },
    pending: { label: "Pending", bg: "bg-[#fef3c7]", text: "text-[#92400e]" },
    failed: { label: "Failed", bg: "bg-[#fee2e2]", text: "text-[#991b1b]" },
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#f9fafb] hover:bg-[#f9fafb]">
            <TableHead className="px-4 py-3 text-[11px] font-bold uppercase text-[#6b7280]">Batch ID</TableHead>
            <TableHead className="px-4 py-3 text-[11px] font-bold uppercase text-[#6b7280] text-right">Affiliates</TableHead>
            <TableHead className="px-4 py-3 text-[11px] font-bold uppercase text-[#6b7280] text-right">Total Amount</TableHead>
            <TableHead className="px-4 py-3 text-[11px] font-bold uppercase text-[#6b7280]">Status</TableHead>
            <TableHead className="px-4 py-3 text-[11px] font-bold uppercase text-[#6b7280]">Created</TableHead>
            <TableHead className="px-4 py-3 text-[11px] font-bold uppercase text-[#6b7280] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <TableCell key={j}>
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : !batches || batches.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-[#6b7280]">
                No payout batches found.
              </TableCell>
            </TableRow>
          ) : (
            batches.map((batch) => {
              const config = statusConfig[batch.status] ?? statusConfig.pending;
              const isStalled = batch.stallDuration !== undefined;
              return (
                <TableRow
                  key={batch._id}
                  className={cn(
                    "border-b border-[#e5e7eb] last:border-0",
                    isStalled && "bg-[#fef2f2] hover:bg-[#fee2e2]"
                  )}
                >
                  <TableCell className="px-4 py-3">
                    <div className="text-sm font-medium text-[#333333]">{batch.batchCode}</div>
                    {isStalled && (
                      <div className="flex items-center gap-1 text-[10px] font-medium text-[#ef4444]">
                        <AlertTriangle className="h-3 w-3" />
                        Stalled: {batch.stallDuration}h
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-sm text-[#333333]">{batch.affiliateCount}</TableCell>
                  <TableCell className="px-4 py-3 text-right text-sm font-medium text-[#333333]">{formatCurrency(batch.totalAmount)}</TableCell>
                  <TableCell className="px-4 py-3">
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", config.bg, config.text)}>
                      {config.label}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-[#6b7280]">{formatDate(batch.createdAt)}</TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="h-8 text-[#10409a] hover:bg-[#10409a]/10">
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
