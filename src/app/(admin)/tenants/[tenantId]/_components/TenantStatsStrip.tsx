"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TenantStatsStripProps {
  stats: {
    mrrInfluenced: number;
    mrrDelta: number;
    activeAffiliates: number;
    pendingAffiliates: number;
    pendingCommissions: number;
    pendingCommissionsCount: number;
    readyToPayTotal: number;
    openPayouts: number;
    openPayoutsTotal: number;
    totalPaidOut: number;
  };
}

const phpFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

export function TenantStatsStrip({ stats }: TenantStatsStripProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <StatCard label="MRR Influenced">
        <StatValue>{phpFormatter.format(stats.mrrInfluenced)}</StatValue>
        <StatDelta value={stats.mrrDelta} />
      </StatCard>

      <StatCard label="Active Affiliates">
        <StatValue>{stats.activeAffiliates.toLocaleString()}</StatValue>
        <StatSubtitle>
          {stats.pendingAffiliates} pending approval
        </StatSubtitle>
      </StatCard>

      <StatCard label="Pending Commissions" variant="warning">
        <StatValue>{phpFormatter.format(stats.pendingCommissions)}</StatValue>
        <StatSubtitle>
          {stats.pendingCommissionsCount} pending
        </StatSubtitle>
      </StatCard>

      <StatCard label="Ready to Pay" variant="warning">
        <StatValue>{phpFormatter.format(stats.readyToPayTotal)}</StatValue>
        <StatSubtitle>
          Approved, unbilled
        </StatSubtitle>
      </StatCard>

      <StatCard label="Open Payout Batches">
        <StatValue>{stats.openPayouts.toLocaleString()}</StatValue>
        <StatSubtitle>
          ₱{stats.openPayoutsTotal.toLocaleString()} outstanding
        </StatSubtitle>
      </StatCard>

      <StatCard label="Total Paid Out">
        <StatValue>{phpFormatter.format(stats.totalPaidOut)}</StatValue>
        <StatSubtitle>
          All-time payouts
        </StatSubtitle>
      </StatCard>
    </div>
  );
}

interface StatCardProps {
  label: string;
  variant?: "default" | "warning";
  children: React.ReactNode;
}

function StatCard({ label, variant = "default", children }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        variant === "warning"
          ? "border-[#fde68a] bg-[#fffbeb]"
          : "border-[#e5e7eb] bg-white"
      )}
    >
      <p className="mb-1 text-[11px] font-bold uppercase text-[#6b7280]">
        {label}
      </p>
      {children}
    </div>
  );
}

function StatValue({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[22px] font-bold text-[#333333]">{children}</p>
  );
}

function StatDelta({ value }: { value: number }) {
  const isPositive = value >= 0;

  return (
    <p
      className={cn(
        "mt-1 flex items-center gap-1 text-[12px]",
        isPositive ? "text-green-600" : "text-red-600"
      )}
    >
      {isPositive ? (
        <TrendingUp className="h-3.5 w-3.5" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5" />
      )}
      {isPositive ? "+" : ""}
      {value.toLocaleString()}
    </p>
  );
}

function StatSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-[12px] text-[#6b7280]">{children}</p>
  );
}
