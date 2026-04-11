"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, ArrowDownCircle, AlertCircle } from "lucide-react";
import { CommissionDetailDrawer } from "./CommissionDetailDrawer";

interface UnifiedFeedProps {
  affiliateId: string;
  period: string;
  status: string;
}

type FeedTab = "all" | "commissions" | "payouts";

interface UnifiedItem {
  type: "commission" | "payout";
  amount: number;
  status: string;
  date: number;
  description: string;
  id: string;
  raw: Record<string, unknown>;
}

const FEED_TABS: { key: FeedTab; label: string }[] = [
  { key: "all", label: "All Activity" },
  { key: "commissions", label: "Commissions Only" },
  { key: "payouts", label: "Payouts Only" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Completed",
  paid: "Paid",
  reversed: "Declined",
  failed: "Failed",
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  approved: { bg: "bg-[#d1fae5]", text: "text-[#065f46]" },
  pending: { bg: "bg-[#fef3c7]", text: "text-[#92400e]" },
  reversed: { bg: "bg-[#fee2e2]", text: "text-[#991b1b]" },
  paid: { bg: "bg-[#f3f4f6]", text: "text-[#374151]" },
  failed: { bg: "bg-[#fee2e2]", text: "text-[#991b1b]" },
};

export function UnifiedFeed({ affiliateId, period, status }: UnifiedFeedProps) {
  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const [selectedCommission, setSelectedCommission] = useState<Record<string, unknown> | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const commissions = useQuery(
    api.commissions.getAffiliateCommissions,
    {
      affiliateId: affiliateId as Id<"affiliates">,
      period: period || undefined,
      status: status === "all" ? undefined : status || undefined,
      limit: 50,
    }
  );

  const payouts = useQuery(api.affiliateAuth.getAffiliatePayoutHistory, {
    affiliateId: affiliateId as Id<"affiliates">,
  });

  const mergedItems: UnifiedItem[] = (() => {
    const items: UnifiedItem[] = [];

    if (commissions) {
      for (const c of commissions) {
        items.push({
          type: "commission",
          amount: c.amount,
          status: c.status,
          date: c._creationTime,
          description: c.campaignName || "Commission",
          id: c._id,
          raw: c as unknown as Record<string, unknown>,
        });
      }
    }

    if (payouts) {
      for (const p of payouts) {
        items.push({
          type: "payout",
          amount: p.amount,
          status: p.status,
          date: p.paidAt ?? p._creationTime,
          description: p.paymentReference
            ? `Payout — ${p.paymentReference}`
            : "Payout",
          id: p._id,
          raw: p as unknown as Record<string, unknown>,
        });
      }
    }

    return items.sort((a, b) => b.date - a.date);
  })();

  const filteredItems = mergedItems.filter((item) => {
    if (activeTab === "commissions") return item.type === "commission";
    if (activeTab === "payouts") return item.type === "payout";
    return true;
  });

  const handleCommissionClick = (item: UnifiedItem) => {
    if (item.type !== "commission") return;
    setSelectedCommission(item.raw);
    setIsDrawerOpen(true);
  };

  if (commissions === undefined || payouts === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[var(--text-heading)] mb-2">
          No activity yet
        </h3>
        <p className="text-[var(--text-muted)]">
          Start promoting to earn commissions!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm -mx-1 px-1 pt-1 pb-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {FEED_TABS.map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1",
                activeTab === tab.key
                  ? "bg-[var(--portal-primary)] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filteredItems.map((item) => {
          const styles = STATUS_STYLES[item.status] || STATUS_STYLES.pending;
          const isCommission = item.type === "commission";

          return isCommission ? (
            <Button
              key={item.id}
              variant="ghost"
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card text-left h-auto justify-start hover:bg-muted/50"
              onClick={() => handleCommissionClick(item)}
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center bg-muted">
                {isCommission ? (
                  <DollarSign className="h-5 w-5 text-[var(--portal-primary)]" />
                ) : (
                  <ArrowDownCircle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-[var(--text-heading)]">
                  {item.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(item.date)}
                </p>
              </div>

              <div className="flex-shrink-0 text-right">
                <p className="font-bold text-sm text-[var(--text-heading)]">
                  {isCommission ? "+" : "-"}
                  {formatCurrency(item.amount)}
                </p>
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
                    styles.bg,
                    styles.text
                  )}
                >
                  {STATUS_LABELS[item.status] || item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </span>
              </div>
            </Button>
          ) : (
            <div
              key={item.id}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card"
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center bg-muted">
                <ArrowDownCircle className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate text-[var(--text-heading)]">
                  {item.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(item.date)}
                </p>
              </div>

              <div className="flex-shrink-0 text-right">
                <p className="font-bold text-sm text-[var(--text-heading)]">
                  -{formatCurrency(item.amount)}
                </p>
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
                    styles.bg,
                    styles.text
                  )}
                >
                  {STATUS_LABELS[item.status] || item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <CommissionDetailDrawer
        commission={
          selectedCommission
            ? {
                _id: String(selectedCommission._id),
                amount: Number(selectedCommission.amount) || 0,
                status: String(selectedCommission.status || "pending"),
                campaignName: String(selectedCommission.campaignName || ""),
                createdAt: Number(selectedCommission._creationTime || Date.now()),
                customerEmail: selectedCommission.customerEmail
                  ? String(selectedCommission.customerEmail)
                  : undefined,
                conversionId: selectedCommission.conversionId
                  ? String(selectedCommission.conversionId)
                  : undefined,
                commissionType: selectedCommission.commissionType
                  ? String(selectedCommission.commissionType)
                  : undefined,
                effectiveRate: selectedCommission.effectiveRate
                  ? Number(selectedCommission.effectiveRate)
                  : undefined,
                saleAmount: selectedCommission.saleAmount
                  ? Number(selectedCommission.saleAmount)
                  : undefined,
              }
            : null
        }
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
