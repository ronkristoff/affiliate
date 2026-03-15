"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DollarSign, AlertTriangle, Info } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

interface Commission {
  _id: Id<"commissions">;
  _creationTime: number;
  affiliateId: Id<"affiliates">;
  campaignId: Id<"campaigns">;
  conversionId?: Id<"conversions">;
  amount: number;
  status: string;
  campaignName: string;
  customerEmail?: string;
  createdAt: number;
  // Self-referral fraud detection fields (Story 5.6)
  isSelfReferral?: boolean;
  fraudIndicators?: string[];
}

interface CommissionHistoryListProps {
  commissions: Commission[];
  onViewFraudDetails?: (commissionId: string, indicators: string[]) => void;
}

export function CommissionHistoryList({ commissions, onViewFraudDetails }: CommissionHistoryListProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Format indicator for display
  const formatIndicator = (indicator: string): string => {
    const labels: Record<string, string> = {
      email_match: "Email",
      ip_match: "IP",
      ip_subnet_match: "IP Subnet",
      device_match: "Device",
      payment_method_match: "Payment",
      payment_processor_match: "Processor",
    };
    return labels[indicator] || indicator.replace(/_/g, " ");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Commission History
        </CardTitle>
        {commissions.length > 0 && (
          <span className="text-sm text-muted-foreground">
            Recent {commissions.length} of {commissions.length}+
          </span>
        )}
      </CardHeader>
      <CardContent>
        {commissions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No commissions yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-3 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-left pb-3 text-sm font-medium text-muted-foreground">Campaign</th>
                  <th className="text-left pb-3 text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="text-left pb-3 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((commission) => (
                  <tr 
                    key={commission._id} 
                    className={`border-b last:border-0 ${commission.isSelfReferral ? "bg-red-50 dark:bg-red-950/20" : ""}`}
                  >
                    <td className="py-3 text-sm">{formatDate(commission.createdAt)}</td>
                    <td className="py-3 text-sm">{commission.campaignName}</td>
                    <td className="py-3 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {formatCurrency(commission.amount)}
                        {commission.isSelfReferral && (
                          <span 
                            className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300 cursor-help"
                            title={commission.fraudIndicators?.map(formatIndicator).join(", ") || "Self-referral detected"}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Fraud
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge 
                          status={commission.isSelfReferral ? "pending_review" : commission.status} 
                        />
                        {commission.isSelfReferral && onViewFraudDetails && (
                          <button
                            onClick={() => onViewFraudDetails(commission._id, commission.fraudIndicators || [])}
                            className="text-muted-foreground hover:text-foreground"
                            title="View fraud details"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        )}
                      </div>
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
