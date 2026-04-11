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

  // Still loading
  if (affiliate === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Session expired or not authenticated
  if (affiliate === null) {
    const callbackUrl = encodeURIComponent(pathname);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Session Expired</h1>
          <p className="text-sm text-muted-foreground">
            Your session has expired. Please sign in again to continue.
          </p>
          <Button
            onClick={() => router.push(`/portal/login?callbackUrl=${callbackUrl}`)}
            variant="outline"
            size="sm"
          >
            Sign in again
          </Button>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-gray-50">
      <PortalHeader
        logoUrl={logoUrl}
        portalName={portalName}
        pageTitle={pageTitle}
        pageDescription={pageDescription}
      />

      <div className="flex">
        <PortalSidebar portalName={portalName} />
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
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
