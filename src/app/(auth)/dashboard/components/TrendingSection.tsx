"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Info, UserCircle, Megaphone, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";

interface TrendingSectionProps {
  topAffiliates?: Array<{
    _id: string;
    name: string;
    email: string;
    revenue: number;
    clicks: number;
    conversions: number;
  }>;
  topCampaigns?: Array<{
    _id: string;
    name: string;
    conversions: number;
    revenue: number;
  }>;
  recentCommissions?: Array<{
    _id: string;
    affiliateName: string;
    campaignName: string;
    amount: number;
    status: string;
    createdAt: number;
    planContext?: string;
  }>;
  isLoading?: boolean;
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "text-[var(--warning)]", bg: "bg-[var(--warning-bg)]", label: "Pending" },
  approved: { color: "text-[var(--success)]", bg: "bg-[var(--success-bg)]", label: "Approved" },
  paid: { color: "text-[var(--brand-primary)]", bg: "bg-[var(--brand-light)]", label: "Paid" },
  declined: { color: "text-[var(--danger)]", bg: "bg-[var(--danger-bg)]", label: "Declined" },
  reversed: { color: "text-[var(--danger)]", bg: "bg-[var(--danger-bg)]", label: "Reversed" },
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function TrendingSection({ topAffiliates, topCampaigns, recentCommissions, isLoading }: TrendingSectionProps) {
  const [activeTab, setActiveTab] = useState("affiliates");

  const tabs = [
    { id: "affiliates", label: "Top Affiliates" },
    { id: "campaigns", label: "Top Campaigns" },
    { id: "activity", label: "Recent Activity" },
  ];

  if (isLoading) {
    return (
      <Card className="h-full border-[var(--border-light)] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-[var(--border-light)]">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16" />
        </CardHeader>
        <div className="flex border-b border-[var(--border-light)]">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="flex-1 h-12" />)}
        </div>
        <CardContent className="p-4 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-2 w-28" />
                </div>
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full border-[var(--border-light)] overflow-hidden transition-all duration-200 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-[var(--border-light)]">
        <div className="flex items-center gap-2">
          <CardTitle className="text-[14px] font-bold text-[var(--text-heading)]">Trending</CardTitle>
          <Info className="w-4 h-4 text-[var(--text-muted)] cursor-help" />
        </div>
      </CardHeader>

      <div className="flex border-b border-[var(--border-light)] bg-white">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 py-3 px-2 text-[12px] font-bold uppercase tracking-wide transition-all duration-200 relative",
              activeTab === tab.id
                ? "text-[var(--brand-primary)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2.5px] after:bg-[var(--brand-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-page)]/30"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <CardContent className="p-0 flex-1 flex flex-col overflow-hidden bg-white">
        {/* Top Affiliates */}
        {activeTab === "affiliates" && topAffiliates && topAffiliates.length > 0 ? (
          <div className="w-full divide-y divide-[var(--border-light)]">
            {topAffiliates.slice(0, 5).map((affiliate) => (
              <div key={affiliate._id} className="flex items-center justify-between p-4 transition-colors hover:bg-[var(--bg-page)]/20 cursor-pointer group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-[var(--brand-primary)] flex items-center justify-center border border-blue-100 group-hover:bg-blue-100 transition-colors">
                    <UserCircle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[var(--text-heading)] truncate">{affiliate.name}</p>
                    <p className="text-[11px] font-medium text-[var(--text-muted)] truncate">{affiliate.email}</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3 shrink-0">
                  <div>
                    <p className="text-[13px] font-bold text-[var(--text-heading)] tabular-nums">{formatCurrency(affiliate.revenue)}</p>
                    <p className="text-[11px] font-medium text-[var(--success)]">{affiliate.conversions} conversions</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--border)] group-hover:text-[var(--text-muted)] transition-colors" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === "affiliates" ? (
          <EmptyState icon={<UserCircle className="w-7 h-7 text-[var(--text-muted)]" />} label="affiliates" />
        ) : null}

        {/* Top Campaigns */}
        {activeTab === "campaigns" && topCampaigns && topCampaigns.length > 0 ? (
          <div className="w-full divide-y divide-[var(--border-light)]">
            {topCampaigns.map((campaign) => (
              <div key={campaign._id} className="flex items-center justify-between p-4 transition-colors hover:bg-[var(--bg-page)]/20 cursor-pointer group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-green-50 text-[var(--success)] flex items-center justify-center border border-green-100 group-hover:bg-green-100 transition-colors">
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[var(--text-heading)] truncate">{campaign.name}</p>
                    <p className="text-[11px] font-medium text-[var(--text-muted)]">{campaign.conversions} conversions</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3 shrink-0">
                  <p className="text-[13px] font-bold text-[var(--text-heading)] tabular-nums">{formatCurrency(campaign.revenue)}</p>
                  <ChevronRight className="w-4 h-4 text-[var(--border)] group-hover:text-[var(--text-muted)] transition-colors" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === "campaigns" ? (
          <EmptyState icon={<Megaphone className="w-7 h-7 text-[var(--text-muted)]" />} label="campaigns" />
        ) : null}

        {/* Recent Activity */}
        {activeTab === "activity" && recentCommissions && recentCommissions.length > 0 ? (
          <div className="w-full divide-y divide-[var(--border-light)]">
            {recentCommissions.slice(0, 5).map((commission) => {
              const cfg = statusConfig[commission.status] ?? statusConfig.pending;
              return (
                <div key={commission._id} className="flex items-center justify-between p-4 transition-colors hover:bg-[var(--bg-page)]/20 group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[var(--bg-page)] text-[var(--text-muted)] flex items-center justify-center border border-[var(--border-light)] group-hover:bg-[var(--bg-page)] transition-colors">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-[var(--text-heading)] truncate">{commission.affiliateName}</p>
                      <p className="text-[11px] font-medium text-[var(--text-muted)] truncate">{commission.campaignName}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-bold text-[var(--text-heading)] tabular-nums">{formatCurrency(commission.amount)}</p>
                    <div className="flex items-center gap-1.5 justify-end mt-0.5">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", cfg.bg, cfg.color)}>
                        {cfg.label}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">{timeAgo(commission.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : activeTab === "activity" ? (
          <EmptyState icon={<Clock className="w-7 h-7 text-[var(--text-muted)]" />} label="activity" />
        ) : null}
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="py-20 px-8 text-center flex flex-col items-center justify-center opacity-60">
      <div className="w-14 h-14 rounded-full bg-[var(--bg-page)] flex items-center justify-center mb-4 border border-[var(--border-light)]">
        {icon}
      </div>
      <p className="text-[13px] font-bold text-[var(--text-heading)]">No trending {label}</p>
      <p className="text-[11px] text-[var(--text-muted)] mt-1">Data will appear once you have active {label}.</p>
    </div>
  );
}
