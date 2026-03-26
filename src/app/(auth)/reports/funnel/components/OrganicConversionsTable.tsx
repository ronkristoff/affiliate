"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrganicConversionsTableProps {
  tenantId: Id<"tenants">;
  startDate?: number;
  endDate?: number;
}

const PAGE_SIZE = 20;

export function OrganicConversionsTable({ tenantId, startDate, endDate }: OrganicConversionsTableProps) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const results = useQuery(
    api.conversions.getOrganicConversions,
    { tenantId, limit, startDate, endDate }
  );

  if (!results) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)] text-sm">
        No organic conversions recorded
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th className="text-left py-2 px-4 text-[11px] font-semibold text-[var(--text-muted)] uppercase">Date</th>
              <th className="text-left py-2 px-4 text-[11px] font-semibold text-[var(--text-muted)] uppercase">Customer</th>
              <th className="text-right py-2 px-4 text-[11px] font-semibold text-[var(--text-muted)] uppercase">Amount</th>
              <th className="text-left py-2 px-4 text-[11px] font-semibold text-[var(--text-muted)] uppercase">Source</th>
              <th className="text-left py-2 px-4 text-[11px] font-semibold text-[var(--text-muted)] uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map(conv => (
              <tr key={conv._id} className="border-b border-[var(--border-subtle)]/50 hover:bg-[var(--bg-page)]">
                <td className="py-2.5 px-4 text-[13px] text-[var(--text-muted)]">
                  {format(conv._creationTime, "MMM d, yyyy")}
                </td>
                <td className="py-2.5 px-4 text-[13px]">
                  {conv.customerEmail ?? "—"}
                </td>
                <td className="py-2.5 px-4 text-[13px] text-right tabular-nums font-medium">
                  {conv.amount.toLocaleString()}
                </td>
                <td className="py-2.5 px-4">
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Leaf className="w-3 h-3" />
                    {conv.attributionSource ?? "organic"}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <span className="text-xs font-medium text-[var(--success)]">
                    {conv.status ?? "pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {results.length >= limit && (
        <div className="flex justify-center py-4">
          <Button variant="outline" size="sm" onClick={() => setLimit(prev => prev + PAGE_SIZE)}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
