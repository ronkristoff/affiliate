"use client";

import Link from "next/link";
import { Home, DollarSign, Link2, Images, User, BarChart3, MoreHorizontal, type LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { name: "Home", href: "/portal/home", icon: Home },
  { name: "Earnings", href: "/portal/earnings", icon: DollarSign },
  { name: "Links", href: "/portal/links", icon: Link2 },
  { name: "Assets", href: "/portal/assets", icon: Images },
  { name: "Account", href: "/portal/account", icon: User },
  { name: "Reports", href: "/portal/reports", icon: BarChart3 },
];

interface PortalBottomNavProps {
  items?: NavItem[];
}

export function PortalBottomNav({ items = DEFAULT_NAV_ITEMS }: PortalBottomNavProps) {
  const currentPath = usePathname();

  // Show first 5 items inline, rest in "More..." popover
  const visibleItems = items.slice(0, 5);
  const overflowItems = items.slice(5);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--portal-primary)] border-t-2 h-16 md:hidden z-50">
      <div className="flex justify-around items-center h-full px-1">
        {visibleItems.map((item) => {
          const isActive = currentPath === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full ${
                isActive ? "" : "text-gray-500"
              }`}
              style={isActive ? { color: "var(--portal-primary)" } : undefined}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] mt-0.5 leading-tight">{item.name}</span>
            </Link>
          );
        })}

        {overflowItems.length > 0 && (
          <OverflowMenu items={overflowItems} currentPath={currentPath} />
        )}
      </div>
    </nav>
  );
}

function OverflowMenu({ items, currentPath }: { items: NavItem[]; currentPath: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" asChild>
          <button
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full",
              items.some((i) => i.href === currentPath) ? "" : "text-gray-500"
            )}
            style={
              items.some((i) => i.href === currentPath)
                ? { color: "var(--portal-primary)" }
                : undefined
            }
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] mt-0.5 leading-tight">More</span>
          </button>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-48 p-2 mb-2">
        <div className="space-y-1">
          {items.map((item) => {
            const isActive = currentPath === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--portal-primary)]/10 text-[var(--portal-primary)]"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
