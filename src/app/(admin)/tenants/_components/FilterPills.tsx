"use client";

import { FilterTabs, type FilterTabItem } from "@/components/ui/FilterTabs";
import { Users, Clock, ShieldAlert, UserX, AlertTriangle } from "lucide-react";

export const FILTERS = ["all", "active", "trial", "flagged", "suspended", "past_due", "billing_overdue"] as const;
export type Filter = (typeof FILTERS)[number];

interface FilterPillsProps {
  activeFilter: Filter;
  onFilterChange: (filter: Filter) => void;
  counts?: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    flagged: number;
    pastDue: number;
    billingOverdue: number;
  };
  isLoading?: boolean;
}

function buildTabs(
  counts: FilterPillsProps["counts"],
  isLoading?: boolean
): FilterTabItem[] {
  return [
    { key: "all", label: "All", count: counts?.total },
    {
      key: "active",
      label: "Active",
      count: counts?.active,
      icon: <Users className="h-3.5 w-3.5" />,
      activeColor: "bg-green-600",
    },
    {
      key: "trial",
      label: "Trial",
      count: counts?.trial,
      icon: <Clock className="h-3.5 w-3.5" />,
      activeColor: "bg-amber-500",
    },
    {
      key: "flagged",
      label: "Flagged",
      count: counts?.flagged,
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      activeColor: "bg-red-600",
    },
    {
      key: "suspended",
      label: "Suspended",
      count: counts?.suspended,
      icon: <UserX className="h-3.5 w-3.5" />,
      activeColor: "bg-gray-500",
    },
    {
      key: "past_due",
      label: "Past Due",
      count: counts?.pastDue,
      icon: <Clock className="h-3.5 w-3.5" />,
      activeColor: "bg-red-500",
    },
    {
      key: "billing_overdue",
      label: "Needs Attention",
      count: counts?.billingOverdue,
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      activeColor: "bg-amber-600",
    },
  ];
}

export function FilterPills({
  activeFilter,
  onFilterChange,
  counts,
  isLoading,
}: FilterPillsProps) {
  return (
    <FilterTabs
      tabs={buildTabs(counts, isLoading)}
      activeTab={activeFilter}
      onTabChange={(key) => onFilterChange(key as Filter)}
      size="md"
    />
  );
}
