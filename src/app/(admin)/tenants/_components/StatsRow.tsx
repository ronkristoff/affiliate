"use client";

import { cn } from "@/lib/utils";
import { Loader2, TrendingUp, Users, CreditCard, AlertTriangle, Ban } from "lucide-react";

interface StatsRowProps {
  stats: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    flagged: number;
    deltaThisWeek: number;
  } | undefined;
  isLoading: boolean;
}

interface StatCardProps {
  label: string;
  value: number;
  delta?: number;
  icon: React.ReactNode;
  isLoading: boolean;
  className?: string;
}

function StatCard({ label, value, delta, icon, isLoading, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-[10px] border border-[#e5e7eb] bg-white p-4",
        className
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold uppercase text-[#6b7280]">
          {label}
        </span>
        <span className="text-[#6b7280]">{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <span className="text-2xl font-extrabold text-[#333333]">
            {value.toLocaleString()}
          </span>
        )}
        {delta !== undefined && delta > 0 && (
          <span className="mb-1 inline-flex items-center gap-0.5 rounded-full bg-[#d1fae5] px-1.5 py-0.5 text-[10px] font-semibold text-[#065f46]">
            <TrendingUp className="h-3 w-3" />
            +{delta}
          </span>
        )}
      </div>
    </div>
  );
}

export function StatsRow({ stats, isLoading }: StatsRowProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard
        label="Total Tenants"
        value={stats?.total ?? 0}
        delta={stats?.deltaThisWeek}
        icon={<Users className="h-3.5 w-3.5" />}
        isLoading={isLoading}
      />
      <StatCard
        label="Active"
        value={stats?.active ?? 0}
        icon={<CreditCard className="h-3.5 w-3.5" />}
        isLoading={isLoading}
      />
      <StatCard
        label="On Trial"
        value={stats?.trial ?? 0}
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        isLoading={isLoading}
      />
      <StatCard
        label="Suspended"
        value={stats?.suspended ?? 0}
        icon={<Ban className="h-3.5 w-3.5" />}
        isLoading={isLoading}
      />
      <StatCard
        label="Flagged"
        value={stats?.flagged ?? 0}
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        isLoading={isLoading}
      />
    </div>
  );
}
