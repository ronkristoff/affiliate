"use client";

import { cn } from "@/lib/utils";

type AffiliateStatus = "all" | "pending" | "active" | "suspended";

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

const tabs: { key: AffiliateStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending Approval" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
];

export function AffiliateTabs({ activeTab, onTabChange, counts }: AffiliateTabsProps) {
  return (
    <div className="border-b-2 border-[#e5e7eb] mb-6">
      <div className="flex gap-0">
        {tabs.map((tab) => {
          const count =
            tab.key === "all"
              ? counts.pending + counts.active + counts.suspended
              : tab.key === "pending"
              ? counts.pending
              : tab.key === "active"
              ? counts.active
              : tab.key === "suspended"
              ? counts.suspended
              : 0;

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "px-5 py-2.5 text-[13.5px] font-medium transition-all border-b-2 -mb-[2px]",
                activeTab === tab.key
                  ? "text-[#10409a] font-bold border-b-[#10409a]"
                  : "text-[#6b7280] border-b-transparent hover:text-[#333]"
              )}
            >
              {tab.label}
              {tab.key === "pending" && counts.pending > 0 ? (
                <span className="ml-1.5 inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#f59e0b] text-white text-[10px] font-bold">
                  {counts.pending}
                </span>
              ) : (
                <span className="ml-1 text-[#6b7280]">({count})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
