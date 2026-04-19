"use client";

import Link from "next/link";
import { Home, DollarSign, Link2, Images, User, BarChart3, type LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";

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

interface PortalSidebarProps {
  items?: NavItem[];
  portalName?: string;
}

export function PortalSidebar({ items = DEFAULT_NAV_ITEMS, portalName }: PortalSidebarProps) {
  const currentPath = usePathname();

  return (
    <aside className="hidden lg:block w-56 bg-white min-h-[calc(100vh-56px)] p-4">
      <nav className="space-y-1 mt-2">
        {items.map((item) => {
          const isActive = currentPath === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? ""
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: "color-mix(in srgb, var(--portal-primary) 12%, transparent)",
                      color: "var(--portal-primary)",
                    }
                  : undefined
              }
            >
              <Icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
