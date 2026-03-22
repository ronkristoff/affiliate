"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  isActive: boolean;
}

interface NavCategory {
  label: string;
  emoji: string;
  items: NavItem[];
}

function ReportsNav() {
  const pathname = usePathname();

  const isOverview = pathname === "/reports";

  const categories: NavCategory[] = [
    {
      label: "Financial",
      emoji: "\u{1F4B0}",
      items: [
        { href: "/reports/commissions", label: "Commissions", isActive: pathname.startsWith("/reports/commissions") },
        { href: "/reports/payouts", label: "Payouts", isActive: pathname.startsWith("/reports/payouts") },
        { href: "/reports/funnel", label: "Funnel", isActive: pathname.startsWith("/reports/funnel") },
      ],
    },
    {
      label: "Performance",
      emoji: "\u{1F4CA}",
      items: [
        { href: "/reports/affiliates", label: "Affiliates", isActive: pathname.startsWith("/reports/affiliates") },
        { href: "/reports/campaigns", label: "Campaigns", isActive: pathname.startsWith("/reports/campaigns") },
      ],
    },
    {
      label: "Risk",
      emoji: "\u{1F6E1}\uFE0F",
      items: [
        { href: "/reports/fraud", label: "Fraud", isActive: pathname.startsWith("/reports/fraud") },
      ],
    },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Button
        variant="ghost"
        size="sm"
        asChild
        className={cn(
          "shrink-0 rounded-lg",
          isOverview && "bg-[#10409a]/10 text-[#10409a] font-medium hover:bg-[#10409a]/15 hover:text-[#10409a]"
        )}
      >
        <Link href="/reports">Overview</Link>
      </Button>

      {categories.map((category) => (
        <div key={category.label} className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-muted-foreground/70 px-1.5 select-none">
            {category.emoji} {category.label}
          </span>
          {category.items.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                "shrink-0 rounded-lg",
                item.isActive && "bg-[#10409a]/10 text-[#10409a] font-medium hover:bg-[#10409a]/15 hover:text-[#10409a]"
              )}
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Sticky reports navigation tabs */}
      <div className="sticky top-0 z-50 bg-[var(--bg-surface)] px-8 py-2 border-b border-border">
        <ReportsNav />
      </div>
      {children}
    </div>
  );
}
