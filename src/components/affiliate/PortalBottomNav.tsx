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

  const visibleItems = items.slice(0, 5);
  const overflowItems = items.slice(5);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 md:hidden z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-full px-1">
        {visibleItems.map((item) => {
          const isActive = currentPath === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors",
                isActive 
                  ? "text-[var(--portal-primary)]" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] mt-0.5 font-medium">{item.name}</span>
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
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full -mt-1",
            items.some((i) => i.href === currentPath) 
              ? "text-[var(--portal-primary)]" 
              : "text-slate-500"
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[10px] mt-0.5 font-medium">More</span>
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
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--portal-primary)]/10 text-[var(--portal-primary)]"
                    : "text-slate-600 hover:bg-slate-100"
                )}
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
