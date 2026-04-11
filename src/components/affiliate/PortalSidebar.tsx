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
    <aside className="hidden lg:block w-56 bg-white border-r border-[var(--portal-primary)] border-r-2 min-h-screen p-4">
      <PortalSidebarLogo portalName={portalName} />
      <nav className="space-y-1">
        {items.map((item) => {
          const isActive = currentPath === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? ""
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: "color-mix(in srgb, var(--portal-primary) 15%, transparent)",
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

/**
 * Brand logo block used in the sidebar.
 * Reads portal name from the CSS custom property set by PortalBrandingSync.
 */
function PortalSidebarLogo({ portalName }: { portalName?: string }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      <div className="w-8 h-8 rounded flex items-center justify-center font-bold text-white text-sm bg-[var(--portal-primary)]">
        <span>{portalName?.charAt(0).toUpperCase() || "A"}</span>
      </div>
      <span className="text-sm font-bold text-gray-900">
        {portalName || "Affiliate Portal"}
      </span>
    </div>
  );
}
