"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Info, UserCircle, Globe, Layout, ChevronRight, TrendingUp } from "lucide-react";
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
  isLoading?: boolean;
}

export function TrendingSection({ topAffiliates, isLoading }: TrendingSectionProps) {
  const [activeTab, setActiveTab] = useState("promoters");

  const tabs = [
    { id: "promoters", label: "Top promoters" },
    { id: "pages", label: "Pages" },
    { id: "sources", label: "Sources" },
  ];

  if (isLoading) {
    return (
      <Card className="h-full border-[var(--border-light)] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-[var(--border-light)]">
          <Skeleton className="h-5 w-24" />
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
          <CardTitle className="text-[14px] font-bold text-[var(--text-heading)]">Trendings</CardTitle>
          <Info className="w-4 h-4 text-[var(--text-muted)] cursor-help" />
        </div>
        <span className="text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-page)]/50 px-2 py-0.5 rounded border border-[var(--border-light)]">
          Last 30 days
        </span>
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
        {activeTab === "promoters" && topAffiliates && topAffiliates.length > 0 ? (
          <div className="w-full divide-y divide-[var(--border-light)]">
            {topAffiliates.map((affiliate) => (
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
        ) : (
          <div className="py-20 px-8 text-center flex flex-col items-center justify-center opacity-60">
            <div className="w-14 h-14 rounded-full bg-[var(--bg-page)] flex items-center justify-center mb-4 border border-[var(--border-light)]">
              {activeTab === "promoters" ? <UserCircle className="w-7 h-7 text-[var(--text-muted)]" /> : 
               activeTab === "pages" ? <Layout className="w-7 h-7 text-[var(--text-muted)]" /> :
               <Globe className="w-7 h-7 text-[var(--text-muted)]" />}
            </div>
            <p className="text-[13px] font-bold text-[var(--text-heading)]">No trending {activeTab}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">Data will appear once you have active {activeTab} activity.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
