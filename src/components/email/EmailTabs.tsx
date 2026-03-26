"use client";

import { usePathname } from "next/navigation";
import { Send, History } from "lucide-react";
import { FilterTabs, type FilterTabItem } from "@/components/ui/FilterTabs";

const tabs: FilterTabItem[] = [
  {
    key: "broadcast",
    label: "Broadcast",
    href: "/emails/broadcast",
    icon: <Send className="w-3.5 h-3.5" />,
  },
  {
    key: "history",
    label: "History",
    href: "/emails/history",
    icon: <History className="w-3.5 h-3.5" />,
  },
];

export function EmailTabs() {
  const pathname = usePathname();

  // Determine active tab based on pathname
  const activeTab = pathname.startsWith("/emails/history") ? "history" : "broadcast";

  return (
    <FilterTabs
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={() => {}} // Not used when href is provided
      size="md"
    />
  );
}
