"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import {
  DataTable,
  DateCell,
  CurrencyCell,
  type TableColumn,
} from "@/components/ui/DataTable";

interface BillingHistoryEvent {
  _id: Id<"billingHistory">;
  _creationTime: number;
  event: string;
  plan?: string;
  previousPlan?: string;
  newPlan?: string;
  amount?: number;
  proratedAmount?: number;
  timestamp: number;
}

interface BillingHistoryTableProps {
  events: BillingHistoryEvent[];
  isLoading?: boolean;
  hasMore?: boolean;
  hasPrevious?: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
}

const eventLabels: Record<string, string> = {
  upgrade: "Upgraded",
  downgrade: "Downgraded",
  cancel: "Cancelled",
  renew: "Renewed",
  trial_conversion: "Trial Converted",
  stripe_webhook: "Stripe Update",
  checkout_initiated: "Checkout Started",
  subscription_cancel_requested: "Cancel Requested",
  trial_expired: "Trial Expired",
  past_due: "Past Due",
  grace_expired: "Grace Expired",
};

const eventColors: Record<string, { bg: string; text: string }> = {
  upgrade: { bg: "#d1fae5", text: "#065f46" },
  downgrade: { bg: "#ffedd5", text: "#9a3412" },
  cancel: { bg: "#fee2e2", text: "#991b1b" },
  renew: { bg: "#dbeafe", text: "#1e40af" },
  trial_conversion: { bg: "#f3e8ff", text: "#6b21a8" },
  stripe_webhook: { bg: "#e0e7ff", text: "#3730a3" },
  checkout_initiated: { bg: "#e0f2fe", text: "#075985" },
  subscription_cancel_requested: { bg: "#fef3c7", text: "#92400e" },
  trial_expired: { bg: "#fee2e2", text: "#991b1b" },
  past_due: { bg: "#fef3c7", text: "#92400e" },
  grace_expired: { bg: "#fee2e2", text: "#991b1b" },
};

export function BillingHistoryTable({
  events,
  isLoading,
  hasMore,
  hasPrevious,
  onNext,
  onPrevious,
}: BillingHistoryTableProps) {
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
      width: 140,
    },
    {
      key: "plan",
      header: "Plan",
      cell: (row) => {
        const displayPlan = row.newPlan || row.plan;
        return (
          <span>
            {row.previousPlan && (
              <span className="text-[#6b7280]">
                {getPlanDisplayName(row.previousPlan)} →{" "}
              </span>
            )}
            <span className="text-[#333]">{getPlanDisplayName(displayPlan)}</span>
          </span>
        );
      },
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (row) => {
        if (row.amount === undefined) return <span className="text-[#6b7280]">-</span>;
        return <CurrencyCell amount={row.amount} />;
      },
      width: 150,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Billing History
        </CardTitle>
        <CardDescription>
          Your subscription changes and billing events
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={events}
          getRowId={(row) => row._id}
          isLoading={isLoading}
          emptyMessage="No billing history yet"
        />

        {/* Pagination */}
        {(hasPrevious || hasMore) && (
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevious}
              disabled={!hasPrevious || isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              {events.length} events shown
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onNext}
              disabled={!hasMore || isLoading}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
