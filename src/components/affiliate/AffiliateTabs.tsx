"use client";

import { FilterTabs, type FilterTabItem } from "@/components/ui/FilterTabs";
import { Clock, UserCheck, UserX, ShieldAlert } from "lucide-react";

type AffiliateStatus = "all" | "pending" | "active" | "suspended" | "rejected";

interface AffiliateTabsProps {
  activeTab: AffiliateStatus;
  onTabChange: (tab: AffiliateStatus) => void;
  counts: {
    total: number;
    pending: number;
    active: number;
    suspended: number;
    rejected: number;
  };
}

function buildTabs(counts: AffiliateTabsProps["counts"]): FilterTabItem[] {
  return [
    { key: "all", label: "All", count: counts.total },
    {
      key: "pending",
      label: "Pending",
      count: counts.pending,
      icon: <Clock className="h-3.5 w-3.5" />,
      activeColor: "bg-amber-500",
    },
    {
      key: "active",
      label: "Active",
      count: counts.active,
      icon: <UserCheck className="h-3.5 w-3.5" />,
      activeColor: "bg-green-600",
    },
    {
      key: "suspended",
      label: "Suspended",
      count: counts.suspended,
      icon: <ShieldAlert className="h-3.5 w-3.5" />,
      activeColor: "bg-red-600",
    },
    {
      key: "rejected",
      label: "Rejected",
      count: counts.rejected,
      icon: <UserX className="h-3.5 w-3.5" />,
      activeColor: "bg-gray-500",
    },
  ];
}

export function AffiliateTabs({ activeTab, onTabChange, counts }: AffiliateTabsProps) {
  return (
    <div className="mb-6">
      <FilterTabs
        tabs={buildTabs(counts)}
        activeTab={activeTab}
        onTabChange={(key) => onTabChange(key as AffiliateStatus)}
        size="md"
      />
    </div>
  );
}
