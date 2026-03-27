"use client";

import { FilterTabs, type FilterTabItem } from "@/components/ui/FilterTabs";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  Plug,
  StickyNote,
  FileText,
} from "lucide-react";

type Tab = "overview" | "affiliates" | "payouts" | "billing" | "integrations" | "notes" | "audit";

interface TenantTabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  affiliatesCount: number;
  notesCount: number;
}

function buildTabs(affiliatesCount: number, notesCount: number): FilterTabItem[] {
  return [
    { key: "overview", label: "Overview", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
    { key: "affiliates", label: "Affiliates", icon: <Users className="h-3.5 w-3.5" />, count: affiliatesCount },
    { key: "payouts", label: "Payout Batches", icon: <CreditCard className="h-3.5 w-3.5" /> },
    { key: "billing", label: "Billing", icon: <Receipt className="h-3.5 w-3.5" /> },
    { key: "integrations", label: "Integrations", icon: <Plug className="h-3.5 w-3.5" /> },
    { key: "notes", label: "Admin Notes", icon: <StickyNote className="h-3.5 w-3.5" />, count: notesCount },
    { key: "audit", label: "Audit Log", icon: <FileText className="h-3.5 w-3.5" /> },
  ];
}

export function TenantTabs({
  activeTab,
  onTabChange,
  affiliatesCount,
  notesCount,
}: TenantTabsProps) {
  return (
    <FilterTabs
      tabs={buildTabs(affiliatesCount, notesCount)}
      activeTab={activeTab}
      onTabChange={(key) => onTabChange(key as Tab)}
      size="md"
    />
  );
}
