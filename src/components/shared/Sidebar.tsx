"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      href: "/affiliates",
      label: "Affiliates",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      href: "/campaigns",
      label: "Campaigns",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
      ),
    },
    {
      href: "/commissions",
      label: "Commissions",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      href: "/payouts",
      label: "Payouts",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
        { href: "/reports/query-builder", label: "Query Builder" },
      ],
    } as NavItemWithChildren,
    {
      href: "/emails",
      label: "Emails",
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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

const STORAGE_KEY = "sidebar-collapsed";

// Loading skeleton for sidebar
function SidebarSkeleton() {
  return (
    <aside className="w-[var(--sidebar-width)] bg-[var(--brand-dark)] min-h-screen flex flex-col fixed top-0 left-0 z-[100]">
      {/* Logo skeleton */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/[0.08] rounded-lg animate-pulse" />
          <div className="h-4 w-28 bg-white/[0.06] rounded animate-pulse" />
        </div>
      </div>

      {/* Tenant skeleton */}
      <div className="px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/[0.08] rounded-lg animate-pulse" />
          <div>
            <div className="h-3 w-24 bg-white/[0.06] rounded animate-pulse mb-1.5" />
            <div className="h-2 w-16 bg-white/[0.04] rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Nav skeleton */}
      <div className="flex-1 px-3 py-3">
        <div className="mb-5">
          <div className="px-3 py-2 mb-2">
            <div className="h-2 w-14 bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 bg-white/[0.04] rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        <div className="mb-5">
          <div className="px-3 py-2 mb-2">
            <div className="h-2 w-16 bg-white/[0.06] rounded animate-pulse" />
          </div>
          <div className="space-y-1">
            {[1, 2].map((i) => (
              <div key={i} className="h-9 bg-white/[0.04] rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      {/* User footer skeleton */}
      <div className="px-5 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-white/[0.08] rounded-full animate-pulse" />
          <div className="flex-1">
            <div className="h-2.5 w-20 bg-white/[0.06] rounded animate-pulse mb-1" />
            <div className="h-2 w-28 bg-white/[0.04] rounded animate-pulse" />
          </div>
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const user = useQuery(api.auth.getCurrentUser);
  const badgeCounts = useQuery(api.tenantStats.getSidebarBadgeCounts, {});

  // Load collapsed preference from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setIsCollapsed(stored === "true");
      }
    } catch {
      // localStorage unavailable (SSR)
    }
  }, []);

  // Update CSS custom property when collapsed state changes
  useEffect(() => {
    if (!isMounted) return;
    document.documentElement.style.setProperty(
      "--sidebar-width",
      isCollapsed ? "var(--sidebar-collapsed-width)" : "240px"
    );
    try {
      localStorage.setItem(STORAGE_KEY, String(isCollapsed));
    } catch {
      // localStorage unavailable
    }
  }, [isCollapsed, isMounted]);

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

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
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
        "bg-[var(--brand-dark)] min-h-screen flex flex-col fixed top-0 left-0 z-[100] transition-[width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]",
        isCollapsed ? "w-[var(--sidebar-collapsed-width)]" : "w-[var(--sidebar-width)]",
        className
      )}
    >
      {/* Logo */}
      <div className={cn(
        "border-b border-white/[0.06] flex items-center",
        isCollapsed ? "px-4 py-5 justify-center" : "px-5 py-5"
      )}>
        <Logo href="/dashboard" variant="light" collapsed={isCollapsed} />
      </div>

      {/* Tenant Info */}
      <div className={cn(
        "border-b border-white/[0.06]",
        isCollapsed ? "px-3 py-3 flex justify-center" : "px-5 py-3"
      )}>
        <div className={cn(
          "flex items-center gap-2.5 cursor-pointer rounded-lg px-1 py-0.5 -mx-1 transition-colors hover:bg-white/[0.04]",
          isCollapsed && "px-0 -mx-0"
        )}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[12px] text-white shrink-0"
            style={{ background: "linear-gradient(135deg, var(--brand-secondary) 0%, var(--brand-primary) 100%)" }}
          >
            {user.tenant.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[#e2e8f0] truncate leading-tight">
                {user.tenant.name}
              </div>
              <div className="text-[10.5px] text-white/[0.35] capitalize mt-0.5">
                {user.tenant.plan}
              </div>
            </div>
          )}
        </div>
      </div>

        {/* Navigation */}
      <nav className={cn(
        "flex-1 overflow-y-auto overflow-x-hidden",
        isCollapsed ? "px-2 py-2" : "px-3 py-2"
      )}>
        {/* Program Section */}
        <div className="mb-1">
          {!isCollapsed && (
            <div className="px-3 pt-4 pb-2 text-[10px] font-bold text-white/[0.2] tracking-[0.15em] uppercase">
              Program
            </div>
          )}
          {isCollapsed && <div className="h-4" />}
          {STATIC_NAV_ITEMS.program.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const badge =
              item.href === "/affiliates"
                ? pendingAffiliates > 0
                  ? pendingAffiliates
                  : undefined
                : item.href === "/commissions"
                ? pendingCommissions > 0
                  ? pendingCommissions
                  : undefined
                : item.href === "/payouts"
                ? pendingPayouts > 0
                  ? pendingPayouts
                  : undefined
                : undefined;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "group relative flex items-center gap-2.5 text-[13px] rounded-lg transition-all duration-200",
                  isCollapsed
                    ? "justify-center px-0 py-2.5"
                    : "px-3 py-2.5 mx-0",
                  isActive
                    ? "text-white bg-gradient-to-r from-[var(--brand-primary)]/30 to-transparent font-semibold shadow-[inset_3px_0_0_0_var(--brand-secondary)]"
                    : "text-white/[0.45] hover:text-white hover:bg-white/[0.06]"
                )}
              >
                {/* Active indicator glow */}
                {isActive && (
                  <div 
                    className="absolute inset-0 rounded-lg opacity-20 blur-sm -z-10"
                    style={{ background: 'linear-gradient(90deg, var(--brand-primary), transparent)' }}
                  />
                )}
                <span
                  className={cn(
                    "w-[18px] h-[18px] shrink-0 transition-all duration-200",
                    isActive
                      ? "text-[#1fb5a5] scale-110"
                      : "text-white/[0.35] group-hover:text-white/[0.6]"
                  )}
                >
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {badge !== undefined && (
                      <span className="bg-[#f59e0b] text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 shadow-lg shadow-amber-500/30">
                        {badge}
                      </span>
                    )}
                  </>
                )}
                {isCollapsed && badge !== undefined && (
                  <span className="absolute top-0 right-0 bg-[#f59e0b] text-white text-[9px] font-bold min-w-[16px] h-[16px] flex items-center justify-center rounded-full px-0.5">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Insights Section */}
        <div className="mb-1 mt-3">
          {!isCollapsed && (
            <div className="px-3 pt-4 pb-2 text-[10px] font-bold text-white/[0.2] tracking-[0.15em] uppercase">
              Insights
            </div>
          )}
          {isCollapsed && <div className="h-4" />}
          {STATIC_NAV_ITEMS.insights.map((item) => {
            const hasChildren = "children" in item && item.children;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const isExpanded = isReportsExpanded && item.href === "/reports";

            if (hasChildren) {
              // When collapsed, show as a simple link (no expandable sub-items)
              if (isCollapsed) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={cn(
                      "group flex items-center text-[13px] rounded-lg transition-all duration-200 justify-center px-0 py-2.5",
                      isActive
                        ? "text-white bg-gradient-to-r from-[var(--brand-primary)]/30 to-transparent font-semibold shadow-[inset_3px_0_0_0_#1fb5a5]"
                        : "text-white/[0.45] hover:text-white hover:bg-white/[0.06]"
                    )}
                  >
                    <span
                      className={cn(
                        "w-[18px] h-[18px] shrink-0 transition-all duration-200",
                        isActive
                          ? "text-[#1fb5a5] scale-110"
                          : "text-white/[0.35] group-hover:text-white/[0.6]"
                      )}
                    >
                      {item.icon}
                    </span>
                  </Link>
                );
              }

              return (
                <div key={item.href}>
                  <button
                    onClick={() => toggleExpanded(item.href)}
                    className={cn(
                      "group flex items-center gap-2.5 px-3 py-2.5 text-[13px] rounded-lg transition-all duration-200 w-full text-left",
                      isActive
                        ? "text-white bg-gradient-to-r from-[var(--brand-primary)]/30 to-transparent font-semibold shadow-[inset_3px_0_0_0_#1fb5a5]"
                        : "text-white/[0.45] hover:text-white hover:bg-white/[0.06]"
                    )}
                  >
                    <span
                      className={cn(
                        "w-[18px] h-[18px] shrink-0 transition-all duration-200",
                        isActive
                          ? "text-[#1fb5a5] scale-110"
                          : "text-white/[0.35] group-hover:text-white/[0.6]"
                      )}
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight
                      className={cn(
                        "w-3.5 h-3.5 shrink-0 transition-transform duration-200 text-white/[0.25]",
                        isExpanded ? "rotate-90" : ""
                      )}
                    />
                  </button>
                  {isExpanded && (
                    <div className="pl-[42px] pr-3 mt-0.5 mb-1 space-y-0.5">
                      {item.children!.map((child) => {
                        const isChildActive =
                          child.href === "/reports"
                            ? pathname === "/reports"
                            : pathname.startsWith(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "flex items-center py-2 px-3 text-[12.5px] rounded-md transition-all duration-150",
                              isChildActive
                                ? "text-white font-medium bg-[var(--brand-primary)]/20"
                                : "text-white/[0.35] hover:text-white/[0.7] hover:bg-white/[0.04]"
                            )}
                          >
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full mr-3 shrink-0 transition-colors duration-150",
                                isChildActive ? "bg-[#1fb5a5] shadow-[0_0_6px_#1fb5a5]" : "bg-white/[0.15]"
                              )}
                            />
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
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "group flex items-center gap-2.5 text-[13px] rounded-lg transition-all duration-200",
                  isCollapsed
                    ? "justify-center px-0 py-2.5"
                    : "px-3 py-2.5 mx-0",
                  isActive
                    ? "text-white bg-gradient-to-r from-[var(--brand-primary)]/30 to-transparent font-semibold shadow-[inset_3px_0_0_0_#1fb5a5]"
                    : "text-white/[0.45] hover:text-white hover:bg-white/[0.06]"
                )}
              >
                <span
                  className={cn(
                    "w-[18px] h-[18px] shrink-0 transition-all duration-200",
                    isActive
                      ? "text-[#1fb5a5] scale-110"
                      : "text-white/[0.35] group-hover:text-white/[0.6]"
                  )}
                >
                  {item.icon}
                </span>
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Account Section */}
        <div className="mt-3">
          {!isCollapsed && (
            <div className="px-3 pt-4 pb-2 text-[10px] font-bold text-white/[0.2] tracking-[0.15em] uppercase">
              Account
            </div>
          )}
          {isCollapsed && <div className="h-4" />}
          {STATIC_NAV_ITEMS.account.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "group flex items-center gap-2.5 text-[13px] rounded-lg transition-all duration-200",
                  isCollapsed
                    ? "justify-center px-0 py-2.5"
                    : "px-3 py-2.5 mx-0",
                  isActive
                    ? "text-white bg-gradient-to-r from-[var(--brand-primary)]/30 to-transparent font-semibold shadow-[inset_3px_0_0_0_#1fb5a5]"
                    : "text-white/[0.45] hover:text-white hover:bg-white/[0.06]"
                )}
              >
                <span
                  className={cn(
                    "w-[18px] h-[18px] shrink-0 transition-all duration-200",
                    isActive
                      ? "text-[#1fb5a5] scale-110"
                      : "text-white/[0.35] group-hover:text-white/[0.6]"
                  )}
                >
                  {item.icon}
                </span>
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Collapse Toggle */}
      <div className={cn(
        "border-t border-white/[0.06]",
        isCollapsed ? "px-2 py-2 flex justify-center" : "px-3 py-2"
      )}>
        <button
          onClick={toggleCollapsed}
          className={cn(
            "flex items-center gap-2.5 rounded-lg text-white/[0.4] hover:text-white/[0.7] hover:bg-white/[0.06] transition-all duration-150",
            isCollapsed
              ? "justify-center px-0 py-2 w-full"
              : "px-3 py-2 w-full text-left text-[12px]"
          )}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-[18px] h-[18px] shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="w-[18px] h-[18px] shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* User Footer */}
      <div className={cn(
        "border-t border-white/[0.08]",
        isCollapsed ? "px-2 py-3 flex justify-center" : "px-3 py-3"
      )}>
        <div className={cn(
          "flex items-center gap-2.5 rounded-xl transition-all duration-200 hover:bg-white/[0.06]",
          isCollapsed ? "px-0 py-0" : "px-3 py-2.5"
        )}>
          {/* Avatar with gradient border */}
          <div className="relative shrink-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black text-white"
              style={{ 
                background: 'linear-gradient(135deg, #0e1333 0%, #1c2260 100%)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
              }}
            >
              {userInitials}
            </div>
            {/* Online indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[var(--success)] rounded-full border-2 border-[var(--brand-dark)]" />
          </div>
          {!isCollapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-white/[0.75] font-semibold truncate leading-tight">
                  {displayName}
                </div>
                <div className="text-[10.5px] text-white/[0.35] truncate flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]/60" />
                  {displayEmail}
                </div>
              </div>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="shrink-0 p-2 rounded-lg text-white/[0.3] hover:text-white hover:bg-white/[0.1] transition-all duration-150 disabled:opacity-50 group"
                title="Sign out"
              >
                <svg className="w-4 h-4 group-hover:rotate-12 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.75"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
