"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Loader2 } from "lucide-react";
import { PortalHeader } from "@/components/affiliate/PortalHeader";
import { PortalSidebar } from "@/components/affiliate/PortalSidebar";
import { PortalBottomNav } from "@/components/affiliate/PortalBottomNav";
import { Button } from "@/components/ui/button";

/**
 * Shared layout for all authenticated portal routes.
 *
 * - Resolves affiliate data via useQuery (handles session expiry)
 * - Renders PortalHeader + PortalSidebar + PortalBottomNav once
 * - Wraps {children} — each page is responsible for its own <Suspense>
 *
 * Branding: Reads portalName/logoUrl from the affiliate's tenant data.
 * primaryColor comes from CSS custom property (--portal-primary) set by
 * PortalBrandingSync in the root portal layout.
 */

function AuthenticatedLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const affiliate = useQuery(api.affiliateAuth.getCurrentAffiliate);

  if (affiliate === undefined) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "color-mix(in srgb, var(--portal-primary, #1c2260) 5%, #f8fafc)" }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (affiliate === null) {
    const callbackUrl = encodeURIComponent(pathname);
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "color-mix(in srgb, var(--portal-primary, #1c2260) 5%, #f8fafc)" }}
      >
        <div className="text-center space-y-4 max-w-sm p-6 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="mx-auto w-14 h-14 rounded-xl flex items-center justify-center bg-slate-100">
            <Loader2 className="w-7 h-7 text-slate-500" />
          </div>
          <h1 className="text-lg font-semibold text-slate-800">Session Expired</h1>
          <p className="text-sm text-slate-500">
            Your session has expired. Please sign in again to continue.
          </p>
          <Button
            onClick={() => router.push(`/portal/login?callbackUrl=${callbackUrl}`)}
            size="sm"
            className="w-full bg-[var(--portal-primary)] hover:opacity-90"
          >
            Sign in again
          </Button>
        </div>
      </div>
    );
  }

  const primaryColor = affiliate.tenant?.branding?.primaryColor || "#1c2260";

  // Derive branding from affiliate's tenant
  const portalName =
    affiliate.tenant?.branding?.portalName ||
    affiliate.tenant?.name ||
    "Affiliate Portal";
  const logoUrl = affiliate.tenant?.branding?.logoUrl;

  // Derive page title from current path
  const pageTitle = getPageTitle(pathname);
  const pageDescription = getPageDescription(pathname);

  return (
    <div 
      className="min-h-screen"
      style={{ backgroundColor: "color-mix(in srgb, var(--portal-primary, #1c2260) 5%, #f8fafc)" }}
    >
      <PortalHeader
        logoUrl={logoUrl}
        portalName={portalName}
        pageTitle={pageTitle}
        pageDescription={pageDescription}
      />

      <div className="flex">
        <PortalSidebar portalName={portalName} />
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-8">
          {children}
        </main>
      </div>

      <PortalBottomNav />
    </div>
  );
}

function getPageTitle(pathname: string): string {
  const map: Record<string, string> = {
    "/portal/home": "Home",
    "/portal/earnings": "Earnings",
    "/portal/links": "Links",
    "/portal/assets": "Assets",
    "/portal/account": "Account",
    "/portal/reports": "Reports",
  };
  return map[pathname] || "Dashboard";
}

function getPageDescription(pathname: string): string {
  const map: Record<string, string> = {
    "/portal/home": "Your affiliate dashboard overview",
    "/portal/earnings": "Track your commissions and payouts",
    "/portal/links": "Your referral links and promo tools",
    "/portal/assets": "Download logos, banners, and marketing materials",
    "/portal/account": "Manage your profile and settings",
    "/portal/reports": "Performance analytics and insights",
  };
  return map[pathname] || "";
}

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AuthenticatedLayoutContent>{children}</AuthenticatedLayoutContent>
    </Suspense>
  );
}
