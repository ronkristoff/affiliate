"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AffiliatesTabProps {
  tenantId: Id<"tenants">;
}

export function AffiliatesTab({ tenantId }: AffiliatesTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const affiliates = useQuery(api.admin.tenants.getTenantAffiliates, {
    tenantId,
    searchQuery: searchQuery || undefined,
  });

  const isLoading = affiliates === undefined;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
  const formatDate = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    active: { label: "Active", bg: "bg-[#d1fae5]", text: "text-[#065f46]" },
    pending: { label: "Pending", bg: "bg-[#fef3c7]", text: "text-[#92400e]" },
    suspended: { label: "Suspended", bg: "bg-[#fee2e2]", text: "text-[#991b1b]" },
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#f9fafb] hover:bg-[#f9fafb]">
              <TableHead className="px-4 py-3 text-[11px] font-bold uppercase text-[#6b7280]">Name</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold uppercase text-[#6b7280]">Email</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold uppercase text-[#6b7280] text-right">Referrals</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold uppercase text-[#6b7280] text-right">Total Earned</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold uppercase text-[#6b7280]">Status</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold uppercase text-[#6b7280]">Joined</TableHead>
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
            ) : !affiliates || affiliates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-[#6b7280]">
                  No affiliates found.
                </TableCell>
              </TableRow>
            ) : (
              affiliates.map((affiliate) => {
                const config = statusConfig[affiliate.status] ?? statusConfig.pending;
                return (
                  <TableRow
                    key={affiliate._id}
                    className={cn(
                      "border-b border-[#e5e7eb] last:border-0",
                      affiliate.isFlagged && "bg-[#fefce8] hover:bg-[#fef9c3]"
                    )}
                  >
                    <TableCell className="px-4 py-3 text-sm font-medium text-[#333333]">
                      {affiliate.name}
                      {affiliate.isFlagged && (
                        <Badge variant="outline" className="ml-2 border-[#f59e0b] bg-[#fffbeb] text-[#92400e] text-[10px]">Flagged</Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-[#6b7280]">{affiliate.email}</TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm text-[#333333]">{affiliate.referralCount}</TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm font-medium text-[#333333]">{formatCurrency(affiliate.totalEarned)}</TableCell>
                    <TableCell className="px-4 py-3">
                      <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", config.bg, config.text)}>
                        {config.label}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-[#6b7280]">{formatDate(affiliate.createdAt)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
