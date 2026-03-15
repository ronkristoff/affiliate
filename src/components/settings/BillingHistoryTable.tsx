"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

interface BillingHistoryEvent {
  _id: Id<"billingHistory">;
  _creationTime: number;
  event: string;
  previousPlan?: string;
  newPlan: string;
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
};

const eventColors: Record<string, string> = {
  upgrade: "text-green-600",
  downgrade: "text-orange-600",
  cancel: "text-red-600",
  renew: "text-blue-600",
  trial_conversion: "text-purple-600",
};

const eventBgColors: Record<string, string> = {
  upgrade: "bg-green-50",
  downgrade: "bg-orange-50",
  cancel: "bg-red-50",
  renew: "bg-blue-50",
  trial_conversion: "bg-purple-50",
};

export function BillingHistoryTable({
  events,
  isLoading,
  hasMore,
  hasPrevious,
  onNext,
  onPrevious,
}: BillingHistoryTableProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatAmount = (amount?: number, proratedAmount?: number) => {
    if (amount === undefined) return "-";
    const mainAmount = `₱${amount.toLocaleString()}`;
    if (proratedAmount && proratedAmount !== amount) {
      return `${mainAmount} (prorated: ₱${proratedAmount.toLocaleString()})`;
    }
    return mainAmount;
  };

  const getPlanDisplayName = (plan: string) => {
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

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
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No billing history yet</p>
            <p className="text-sm mt-1">
              Your subscription changes will appear here
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event._id}>
                      <TableCell className="font-medium">
                        {formatDate(event.timestamp)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            eventBgColors[event.event] || "bg-gray-100"
                          } ${eventColors[event.event] || "text-gray-600"}`}
                        >
                          {eventLabels[event.event] || event.event}
                        </span>
                      </TableCell>
                      <TableCell>
                        {event.previousPlan && (
                          <span className="text-muted-foreground">
                            {getPlanDisplayName(event.previousPlan)} →{" "}
                          </span>
                        )}
                        {getPlanDisplayName(event.newPlan)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">
                          {formatAmount(event.amount, event.proratedAmount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

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
          </>
        )}
      </CardContent>
    </Card>
  );
}
