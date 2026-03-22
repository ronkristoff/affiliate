"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/affiliate-segments";
import type { Id } from "@/convex/_generated/dataModel";

interface FlaggedCommissionsTableProps {
  commissions: Array<{
    _id: Id<"commissions">;
    amount: number;
    status: string;
    affiliateId: Id<"affiliates">;
    affiliateName?: string;
    isSelfReferral: boolean;
    createdAt: number;
  }>;
  canViewSensitiveData: boolean;
  isLoading: boolean;
}

/** Status → badge style mapping */
function StatusBadge({ status }: { status: string }) {
  const style = getStatusStyle(status);
  return (
    <Badge
      className={cn(
        "capitalize text-[11px] font-medium px-2 py-0.5 rounded-md",
        style.bg,
        style.text
      )}
    >
      {status}
    </Badge>
  );
}

function getStatusStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case "approved":
    case "confirmed":
      return { bg: "bg-emerald-100 text-emerald-700", text: "text-emerald-700" };
    case "pending":
      return { bg: "bg-amber-100 text-amber-700", text: "text-amber-700" };
    case "reversed":
    case "declined":
      return { bg: "bg-red-100 text-red-700", text: "text-red-700" };
    case "paid":
      return { bg: "bg-blue-100 text-blue-700", text: "text-blue-700" };
    default:
      return { bg: "bg-gray-100 text-gray-700", text: "text-gray-700" };
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function FlaggedCommissionsTable({
  commissions,
  canViewSensitiveData,
  isLoading,
}: FlaggedCommissionsTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Flagged Commissions</CardTitle>
      </CardHeader>
      <CardContent>
        {commissions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No flagged commissions found
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <th className="pb-3 pr-4">Affiliate</th>
                  <th className="pb-3 pr-4 text-right">Amount</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Self-Referral</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr
                    key={c._id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 pr-4 font-medium">
                      {c.affiliateName ?? "Unknown"}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {canViewSensitiveData
                        ? formatCurrency(c.amount)
                        : "\u2014"}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        className={cn(
                          "text-[11px] font-medium px-2 py-0.5 rounded-md",
                          c.isSelfReferral
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {c.isSelfReferral ? "Yes" : "No"}
                      </Badge>
                    </td>
                    <td className="py-3 text-muted-foreground tabular-nums">
                      {formatDate(c.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
