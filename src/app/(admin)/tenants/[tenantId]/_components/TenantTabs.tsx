"use client";

import { cn } from "@/lib/utils";

type Tab = "overview" | "affiliates" | "payouts" | "integrations" | "notes" | "audit";

interface TenantTabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  affiliatesCount: number;
  notesCount: number;
}

const TAB_ITEMS: { key: Tab; label: string; badge: "affiliates" | "notes" | null }[] = [
  { key: "overview", label: "Overview", badge: null },
  { key: "affiliates", label: "Affiliates", badge: "affiliates" },
  { key: "payouts", label: "Payout Batches", badge: null },
  { key: "integrations", label: "Integrations", badge: null },
  { key: "notes", label: "Admin Notes", badge: "notes" },
  { key: "audit", label: "Audit Log", badge: null },
];

export function TenantTabs({
  activeTab,
  onTabChange,
  affiliatesCount,
  notesCount,
}: TenantTabsProps) {
  const badgeCount: Record<string, number> = {
    affiliates: affiliatesCount,
    notes: notesCount,
  };

  return (
    <div className="h-12 flex flex-row border-b border-[#e5e7eb]">
      {TAB_ITEMS.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "relative px-4 flex items-center gap-2 text-sm font-medium transition-colors",
              isActive
                ? "text-[#10409a] after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-[#10409a]"
                : "text-[#6b7280] hover:text-[#10409a]"
            )}
          >
            {tab.label}
            {tab.badge && (
              <span className="bg-[#10409a]/10 text-[#10409a] rounded-full px-2 py-0.5 text-[11px] font-medium">
                {badgeCount[tab.badge]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
