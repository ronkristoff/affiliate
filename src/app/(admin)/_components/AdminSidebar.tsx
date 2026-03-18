"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Building2,
  Activity,
  FileText,
  Settings,
  Shield,
  Layers,
} from "lucide-react";

interface AdminNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const adminNavItems: AdminNavItem[] = [
  {
    href: "/admin/tenants",
    label: "Tenants",
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    href: "/admin/tiers",
    label: "Tier Config",
    icon: <Layers className="h-4 w-4" />,
  },
  {
    href: "/admin/health",
    label: "Platform Health",
    icon: <Activity className="h-4 w-4" />,
  },
  {
    href: "/admin/audit",
    label: "Audit Log",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: <Settings className="h-4 w-4" />,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#022232] text-white px-4 py-6 hidden md:flex md:flex-col">
      {/* Logo / Brand */}
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-400" />
          <div>
            <h1 className="text-lg font-bold">Salig Admin</h1>
            <p className="text-xs text-blue-300/60">Platform Administration</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1">
        {adminNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-blue-100/70 hover:bg-white/10 hover:text-white"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-6 border-t border-white/10">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-blue-100/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <span>&larr;</span>
          Back to Dashboard
        </Link>
      </div>
    </aside>
  );
}
