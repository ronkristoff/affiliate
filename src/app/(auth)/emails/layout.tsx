"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Send, History } from "lucide-react";
import { cn } from "@/lib/utils";

export default function EmailsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    {
      label: "Broadcast",
      href: "/emails/broadcast",
      icon: <Send className="w-3.5 h-3.5" />,
    },
    {
      label: "History",
      href: "/emails/history",
      icon: <History className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div
      className="min-h-screen bg-[var(--bg-page)]"
      style={{ "--sub-nav-h": "41px" } as React.CSSProperties}
    >
      {/* Sub-navigation bar — z-40 so PageTopbar (z-50) stacks above */}
      <div className="sticky top-0 z-40 bg-[var(--bg-surface)] border-b px-8 h-[var(--sub-nav-h)]">
        <div className="flex items-center gap-1 h-full">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href ||
              (tab.href === "/emails/history" &&
                pathname.startsWith("/emails/history"));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--brand-light)] text-[var(--brand-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-page)]"
                )}
              >
                {tab.icon}
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
