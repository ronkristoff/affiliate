"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { SignOutIconButton } from "@/components/shared/SignOutIconButton";

interface AdminNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const adminNavItems: AdminNavItem[] = [
  {
    href: "/tenants",
    label: "Tenants",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    href: "/revenue",
    label: "Revenue",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/query-builder",
    label: "Query Builder",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16M4 12h16M4 17h10" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 17l4-4m0 0l-4 4m4 0V3" />
      </svg>
    ),
  },
  {
    href: "/tiers",
    label: "Tier Config",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },

  {
    href: "/audit",
    label: "Audit Log",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/user-timeline",
    label: "User Timeline",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/admin-settings",
    label: "Settings",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

// Get initials for avatars
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AdminSidebar() {
  const pathname = usePathname();
  const user = useQuery(api.auth.getCurrentUser);

  const userInitials = user?.name ? getInitials(user.name) : user?.email[0]?.toUpperCase() || "U";
  const displayName = user?.name || "Admin";
  const displayEmail = user?.email || "";

  return (
    <aside className="w-[240px] bg-[#0e1333] min-h-screen flex flex-col fixed top-0 left-0 z-[100]">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/[0.08] flex items-center justify-between">
        <Link href="/tenants" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#1fb5a5] rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="text-[15px] font-bold text-white tracking-[-0.3px]">
            salig<span className="text-[#1fb5a5]">admin</span>
          </div>
        </Link>
      </div>

      {/* Admin Label */}
      <div className="px-5 py-3.5 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#1c2260] rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-[#1fb5a5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[#e2e8f0]">
              Platform Admin
            </div>
            <div className="text-[11px] text-white/[0.4]">
              Full access
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-0 py-3 flex-1">
        <div className="mb-1">
          <div className="px-5 py-3 text-[10px] font-semibold text-white/[0.3] tracking-[0.08em] uppercase">
            Administration
          </div>
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-5 py-2.5 text-[13.5px] transition-all border-l-[3px]",
                  isActive
                    ? "text-white bg-white/[0.08] border-l-[#1fb5a5] font-semibold"
                    : "text-white/[0.55] border-l-transparent hover:text-white/[0.9] hover:bg-white/[0.05]"
                )}
              >
                <span className={cn("w-[18px] h-[18px] shrink-0", isActive ? "opacity-100" : "opacity-[0.7]")}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Back to Dashboard */}
      <div className="px-5 py-3 border-t border-white/[0.08]">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-0 py-2 text-[13px] text-white/[0.4] hover:text-white/[0.7] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      {/* User Footer */}
      <div className="px-5 py-4 border-t border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] bg-[#1c2260] rounded-full flex items-center justify-center text-[12px] font-bold text-[#1fb5a5] shrink-0">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] text-white/[0.7] font-medium truncate">
              {displayName}
            </div>
            <div className="text-[11px] text-white/[0.35] truncate">
              {displayEmail}
            </div>
          </div>
          <SignOutIconButton />
        </div>
      </div>
    </aside>
  );
}
