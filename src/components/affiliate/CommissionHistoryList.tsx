"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { DollarSign, AlertTriangle, Info } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";

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
    <div className="card">
      <div className="card-header">
        <h3 className="card-title flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Commission History
        </h3>
        {commissions.length > 0 && (
          <span className="text-[12px] text-[var(--text-muted)]">
            Recent {commissions.length} of {commissions.length}+
          </span>
        )}
      </div>
      <div className="px-5 pb-5">
        {commissions.length === 0 ? (
          <div className="text-center py-10 text-[var(--text-muted)]">
            <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-[13px]">No commissions yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-light)]">
                  <th className="text-left pb-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Date</th>
                  <th className="text-left pb-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Campaign</th>
                  <th className="text-left pb-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Amount</th>
                  <th className="text-left pb-3 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((commission) => (
                  <tr 
                    key={commission._id} 
                    className={`border-b border-[var(--border-light)] last:border-0 ${commission.isSelfReferral ? "bg-[var(--danger-bg)]/50" : ""}`}
                  >
                    <td className="py-3 text-[13px] text-[var(--text-body)]">{formatDate(commission.createdAt)}</td>
                    <td className="py-3 text-[13px] text-[var(--text-body)]">{commission.campaignName}</td>
                    <td className="py-3 text-[13px] font-medium text-[var(--text-heading)]">
                      <div className="flex items-center gap-2">
                        {formatCurrency(commission.amount)}
                        {commission.isSelfReferral && (
                          <span 
                            className="inline-flex items-center gap-1 rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--danger-text)] cursor-help"
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
                            className="text-[var(--text-muted)] hover:text-[var(--text-heading)]"
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
      </div>
    </div>
  );
}
