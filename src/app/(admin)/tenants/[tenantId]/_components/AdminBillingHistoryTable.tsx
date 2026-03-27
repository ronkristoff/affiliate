"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Receipt, ShieldCheck } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  DataTable,
  DateCell,
  CurrencyCell,
  type TableColumn,
} from "@/components/ui/DataTable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BillingHistoryEvent {
  _id: Id<"billingHistory">;
  _creationTime: number;
  tenantId: Id<"tenants">;
  event: string;
  plan?: string;
  previousPlan?: string;
  newPlan?: string;
  amount?: number;
  proratedAmount?: number;
  transactionId?: string;
  mockTransaction?: boolean;
  timestamp: number;
  actorId?: Id<"users">;
}

interface AdminBillingHistoryTableProps {
  tenantId: Id<"tenants">;
}

// ---------------------------------------------------------------------------
// Event config
// ---------------------------------------------------------------------------

const eventLabels: Record<string, string> = {
  upgrade: "Upgraded",
  downgrade: "Downgraded",
  cancel: "Cancelled",
  renew: "Renewed",
  trial_conversion: "Trial Converted",
  admin_plan_change: "Admin Plan Change",
  admin_trial_extension: "Trial Extended",
  admin_cancel: "Admin Cancel",
  admin_reactivate: "Admin Reactivate",
};

const eventColors: Record<string, { bg: string; text: string }> = {
  upgrade: { bg: "#d1fae5", text: "#065f46" },
  downgrade: { bg: "#ffedd5", text: "#9a3412" },
  cancel: { bg: "#fee2e2", text: "#991b1b" },
  renew: { bg: "#dbeafe", text: "#1e40af" },
  trial_conversion: { bg: "#f3e8ff", text: "#6b21a8" },
  admin_plan_change: { bg: "#e0e7ff", text: "#3730a3" },
  admin_trial_extension: { bg: "#cffafe", text: "#155e75" },
  admin_cancel: { bg: "#fee2e2", text: "#991b1b" },
  admin_reactivate: { bg: "#d1fae5", text: "#065f46" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminBillingHistoryTable({ tenantId }: AdminBillingHistoryTableProps) {
  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    api.admin.subscriptions.getTenantBillingHistory,
    { tenantId },
    { initialNumItems: 10 }
  );

  // Fetch admin user IDs to identify admin actors
  // (In practice, actorId being present indicates an admin action)
  const getPlanDisplayName = (plan?: string) => {
    if (!plan) return "-";
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  const columns: TableColumn<BillingHistoryEvent>[] = [
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortField: "timestamp",
      cell: (row) => <DateCell value={row.timestamp} />,
      width: 120,
    },
    {
      key: "event",
      header: "Event",
      sortable: true,
      cell: (row) => {
        const config = eventColors[row.event] || { bg: "#f3f4f6", text: "#374151" };
        return (
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: config.bg, color: config.text }}
          >
            {eventLabels[row.event] || row.event}
          </span>
        );
      },
      width: 160,
    },
    {
      key: "plan",
      header: "Plan",
      cell: (row) => (
        <span>
          {row.previousPlan && (
            <span className="text-[#6b7280]">
              {getPlanDisplayName(row.previousPlan)} →{" "}
            </span>
          )}
          <span className="text-[#333]">
            {row.newPlan ? getPlanDisplayName(row.newPlan) : getPlanDisplayName(row.plan)}
          </span>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (row) => {
        if (row.amount === undefined || row.amount === 0) {
          return <span className="text-[#6b7280]">-</span>;
        }
        return <CurrencyCell amount={row.amount} />;
      },
      width: 150,
    },
    {
      key: "actor",
      header: "Actor",
      cell: (row) => {
        if (!row.actorId) return <span className="text-[#9ca3af]">-</span>;
        // Admin actions have actorId set
        const isAdminAction = row.event.startsWith("admin_");
        if (isAdminAction) {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-[#3730a3]">
              <ShieldCheck className="h-3 w-3" />
              Admin
            </span>
          );
        }
        return <span className="text-xs text-[#6b7280]">Owner</span>;
      },
      width: 80,
    },
  ];

  // Loading skeleton
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Billing History
          </CardTitle>
          <CardDescription>
            Subscription changes and billing events for this tenant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-5 w-[120px] rounded-full" />
                <Skeleton className="h-4 w-[80px]" />
                <Skeleton className="h-4 w-[80px] ml-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Billing History
        </CardTitle>
        <CardDescription>
          Subscription changes and billing events for this tenant
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={results}
          getRowId={(row) => row._id}
          isLoading={isLoading}
          emptyMessage="No billing history for this tenant."
        />

        {/* Load more */}
        {status !== "Exhausted" && results.length > 0 && (
          <div className="flex justify-center mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadMore(10)}
            >
              Load More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
