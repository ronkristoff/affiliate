"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { ChevronRight } from "lucide-react";
import { Logo } from "@/components/shared/Logo";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavSubItem {
  href: string;
  label: string;
}

interface NavItemWithChildren extends NavItem {
  children?: NavSubItem[];
}

interface SidebarProps {
  className?: string;
}

// Static content that doesn't change between server/client
const STATIC_NAV_ITEMS = {
  program: [
    {
      href: "/dashboard",
      label: "Overview",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      href: "/affiliates",
      label: "Affiliates",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      href: "/campaigns",
      label: "Campaigns",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
      ),
    },
    {
      href: "/commissions",
      label: "Commissions",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      href: "/payouts",
      label: "Payouts",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
        </svg>
      ),
    },
  ],
  insights: [
    {
      href: "/reports",
      label: "Reports",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      children: [
        { href: "/reports", label: "Overview" },
        { href: "/reports/commissions", label: "Commissions" },
        { href: "/reports/payouts", label: "Payouts" },
        { href: "/reports/funnel", label: "Funnel" },
        { href: "/reports/affiliates", label: "Affiliates" },
        { href: "/reports/campaigns", label: "Campaigns" },
        { href: "/reports/fraud", label: "Fraud" },
      ],
    } as NavItemWithChildren,
    {
      href: "/emails",
      label: "Emails",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ],
  account: [
    {
      href: "/settings",
      label: "Settings",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ],
};

// Get initials for avatars
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Loading skeleton for sidebar
function SidebarSkeleton() {
  return (
    <aside className="w-[240px] bg-[#022232] min-h-screen flex flex-col fixed top-0 left-0 z-[100]">
      <div className="px-5 py-6 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#1659d6] rounded-lg" />
          <div className="h-4 w-32 bg-white/[0.1] rounded" />
        </div>
      </div>
      <div className="px-5 py-3.5 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#1659d6] rounded-lg" />
          <div>
            <div className="h-3 w-24 bg-white/[0.1] rounded mb-1" />
            <div className="h-2 w-20 bg-white/[0.05] rounded" />
          </div>
        </div>
      </div>
      <div className="flex-1 p-4">
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 bg-white/[0.05] rounded" />
          ))}
        </div>
      </div>
    </aside>
  );
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const user = useQuery(api.auth.getCurrentUser);
  const badgeCounts = useQuery(api.tenantStats.getSidebarBadgeCounts, {});

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      router.push("/sign-in");
      router.refresh();
    } catch (error) {
      console.error("Sign out failed:", error);
    } finally {
      setIsSigningOut(false);
    }
  }, [router]);

  const toggleExpanded = useCallback((href: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      return next;
    });
  }, []);

  if (!isMounted || !user) {
    return <SidebarSkeleton />;
  }

  const userInitials = user.name ? getInitials(user.name) : user.email[0]?.toUpperCase() || "U";
  const displayName = user.name || "User";
  const displayEmail = user.email;

  const pendingAffiliates = badgeCounts?.pendingAffiliates ?? 0;
  const pendingCommissions = badgeCounts?.pendingCommissions ?? 0;
  const pendingPayouts = badgeCounts?.pendingPayouts ?? 0;

  // Auto-expand Reports when user is on any /reports/* path
  const isOnReports = pathname.startsWith("/reports");
  const isReportsExpanded = expandedItems.has("/reports") || isOnReports;

  return (
    <aside
      className={cn(
        "w-[240px] bg-[#022232] min-h-screen flex flex-col fixed top-0 left-0 z-[100]",
        className
      )}
    >
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/[0.08]">
        <Logo href="/dashboard" variant="light" />
      </div>

      {/* Tenant Info */}
      <div className="px-5 py-3.5 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5 cursor-pointer">
          <div className="w-8 h-8 bg-[#1659d6] rounded-lg flex items-center justify-center font-bold text-[13px] text-white shrink-0">
            {user.tenant.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[#e2e8f0] truncate">
              {user.tenant.name}
            </div>
            <div className="text-[11px] text-white/[0.4] capitalize">
              {user.tenant.plan}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-0 py-3 flex-1">
        {/* Program Section */}
        <div className="mb-1">
          <div className="px-5 py-3 text-[10px] font-semibold text-white/[0.3] tracking-[0.08em] uppercase">
            Program
          </div>
          {STATIC_NAV_ITEMS.program.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const badge = item.href === "/affiliates" ? (pendingAffiliates > 0 ? pendingAffiliates : undefined) :
                         item.href === "/commissions" ? (pendingCommissions > 0 ? pendingCommissions : undefined) :
                         item.href === "/payouts" ? (pendingPayouts > 0 ? pendingPayouts : undefined) : undefined;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-5 py-2.5 text-[13.5px] transition-all border-l-[3px]",
                  isActive
                    ? "text-white bg-white/[0.08] border-l-[#7dd3fc] font-semibold"
                    : "text-white/[0.55] border-l-transparent hover:text-white/[0.9] hover:bg-white/[0.05]"
                )}
              >
                <span className={cn("w-[18px] h-[18px] shrink-0", isActive ? "opacity-100" : "opacity-[0.7]")}>
                  {item.icon}
                </span>
                {item.label}
                {badge !== undefined && (
                  <span className="ml-auto bg-[#f59e0b] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Insights Section */}
        <div className="mb-1" style={{ marginTop: 8 }}>
          <div className="px-5 py-3 text-[10px] font-semibold text-white/[0.3] tracking-[0.08em] uppercase">
            Insights
          </div>
          {STATIC_NAV_ITEMS.insights.map((item) => {
            const hasChildren = "children" in item && item.children;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const isExpanded = isReportsExpanded && item.href === "/reports";

            if (hasChildren) {
              return (
                <div key={item.href}>
                  <button
                    onClick={() => toggleExpanded(item.href)}
                    className={cn(
                      "flex items-center gap-2.5 px-5 py-2.5 text-[13.5px] transition-all border-l-[3px] w-full text-left",
                      isActive
                        ? "text-white bg-white/[0.08] border-l-[#7dd3fc] font-semibold"
                        : "text-white/[0.55] border-l-transparent hover:text-white/[0.9] hover:bg-white/[0.05]"
                    )}
                  >
                    <span className={cn("w-[18px] h-[18px] shrink-0", isActive ? "opacity-100" : "opacity-[0.7]")}>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight
                      className={cn(
                        "w-3.5 h-3.5 shrink-0 transition-transform duration-200",
                        isExpanded ? "rotate-90" : ""
                      )}
                    />
                  </button>
                  {isExpanded && (
                    <div className="pl-[46px] pr-5">
                      {item.children!.map((child) => {
                        const isChildActive = child.href === "/reports"
                          ? pathname === "/reports"
                          : pathname.startsWith(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "flex items-center py-[7px] text-[13px] transition-colors",
                              isChildActive
                                ? "text-white font-medium"
                                : "text-white/[0.4] hover:text-white/[0.8]"
                            )}
                          >
                            <span className={cn(
                              "w-1 h-1 rounded-full mr-2.5 shrink-0",
                              isChildActive ? "bg-[#7dd3fc]" : "bg-white/[0.2]"
                            )} />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-5 py-2.5 text-[13.5px] transition-all border-l-[3px]",
                  isActive
                    ? "text-white bg-white/[0.08] border-l-[#7dd3fc] font-semibold"
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

        {/* Account Section */}
        <div style={{ marginTop: 8 }}>
          <div className="px-5 py-3 text-[10px] font-semibold text-white/[0.3] tracking-[0.08em] uppercase">
            Account
          </div>
          {STATIC_NAV_ITEMS.account.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-5 py-2.5 text-[13.5px] transition-all border-l-[3px]",
                  isActive
                    ? "text-white bg-white/[0.08] border-l-[#7dd3fc] font-semibold"
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

      {/* User Footer */}
      <div className="px-5 py-4 border-t border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] bg-[#1e4a8c] rounded-full flex items-center justify-center text-[12px] font-bold text-[#7dd3fc] shrink-0">
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
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="shrink-0 p-1.5 rounded-md text-white/[0.35] hover:text-white/[0.7] hover:bg-white/[0.08] transition-colors disabled:opacity-50"
            title="Sign out"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
