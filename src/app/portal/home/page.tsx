"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { WelcomeBanner } from "./components/WelcomeBanner";
import { QuickLinkCard } from "./components/QuickLinkCard";
import { EarningsSummaryGrid } from "./components/EarningsSummaryGrid";
import { RecentActivityFeed } from "./components/RecentActivityFeed";
import { PortalHeader } from "@/components/affiliate/PortalHeader";
import { PortalBottomNav } from "@/components/affiliate/PortalBottomNav";
import { PortalSidebar } from "@/components/affiliate/PortalSidebar";
import { authClient } from "@/lib/auth-client";

export default function PortalHomePage() {
  const router = useRouter();
  const [queryErrors, setQueryErrors] = useState<Record<string, string>>({});

  // ── Auth: use Better Auth session via getCurrentAffiliate query ──
  const affiliate = useQuery(api.affiliateAuth.getCurrentAffiliate);
  const isLoading = affiliate === undefined;
  const isAuthenticated = affiliate !== null && affiliate !== undefined;

  // Get tenant slug from the authenticated affiliate (for sub-queries)
  const tenantSlug = affiliate?.tenant?.slug;

  // Fetch dashboard stats
  const dashboardStats = useQuery(
    api.affiliateAuth.getAffiliatePortalDashboardStats,
    affiliate ? { affiliateId: affiliate._id } : "skip"
  );

  // Fetch recent activity
  const recentActivity = useQuery(
    api.affiliateAuth.getAffiliateRecentActivity,
    affiliate ? { affiliateId: affiliate._id, limit: 5 } : "skip"
  );

  // Fetch referral links for QuickLinkCard
  const affiliateLinks = useQuery(
    api.referralLinks.getAffiliatePortalLinks,
    affiliate ? { affiliateId: affiliate._id } : "skip"
  );

  // Redirect unauthenticated affiliates to portal login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/portal/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Track query errors
  useEffect(() => {
    const errors: Record<string, string> = {};

    if (dashboardStats === null && isAuthenticated) {
      errors.dashboardStats = "Failed to load dashboard statistics";
    }
    if (recentActivity === null && isAuthenticated) {
      errors.recentActivity = "Failed to load recent activity";
    }
    if (affiliateLinks === null && isAuthenticated) {
      errors.affiliateLinks = "Failed to load referral links";
    }

    setQueryErrors(errors);
  }, [dashboardStats, recentActivity, affiliateLinks, isAuthenticated]);

  // Handle logout — sign out of Better Auth
  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }

    router.push("/portal/login");
    router.refresh();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Get tenant branding from the authenticated affiliate (already resolved)
  const primaryColor = affiliate?.tenant?.branding?.primaryColor || "#1c2260";
  const portalName = affiliate?.tenant?.branding?.portalName || affiliate?.tenant?.name || "Affiliate Portal";
  const tenantLogo = affiliate?.tenant?.branding?.logoUrl;

  // Get primary referral link (first link in the list)
  const primaryLink = affiliateLinks?.[0]?.shortUrl;

  // Check if any dashboard data is loading
  const isDashboardLoading = dashboardStats === undefined;
  const isActivityLoading = recentActivity === undefined;
  const isLinksLoading = affiliateLinks === undefined;

  // Check if there are any critical errors
  const hasCriticalError = Object.keys(queryErrors).length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <PortalHeader
        portalName={portalName}
        logoUrl={tenantLogo}
        primaryColor={primaryColor}
        pageTitle="Home"
        pageDescription="Your affiliate dashboard overview"
      />

      {/* Main Content */}
      <div className="flex">
        {/* Sidebar for desktop */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <PortalSidebar
            portalName={portalName}
            primaryColor={primaryColor}
            currentPath="/portal/home"
          />
        </aside>

        {/* Main content area */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8">
          {/* Error Alert */}
          {hasCriticalError && (
            <Card className="mb-6 border-red-200 bg-red-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-red-800 flex items-center gap-2 text-base">
                  <AlertCircle className="w-5 h-5" />
                  Some data failed to load
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-red-700 space-y-1">
                  {Object.entries(queryErrors).map(([key, message]) => (
                    <li key={key}>• {message}</li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {affiliate.status === "pending" ? (
            <Card>
              <CardHeader>
                <CardTitle>Account Pending Approval</CardTitle>
                <CardDescription>
                  Your affiliate application is pending approval from the merchant.
                  You will receive an email once your account is approved.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Status: <span className="font-medium text-yellow-600">Pending</span>
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Welcome Banner */}
              <WelcomeBanner
                affiliateName={affiliate.name}
                totalEarnings={dashboardStats?.totalEarnings || 0}
                totalClicks={dashboardStats?.totalClicks || 0}
                totalConversions={dashboardStats?.totalConversions || 0}
                primaryColor={primaryColor}
              />

              {/* Quick Link Card */}
              <QuickLinkCard
                primaryLink={primaryLink}
                affiliateId={affiliate._id}
              />

              {/* Earnings Summary Grid */}
              <EarningsSummaryGrid
                thisMonthEarnings={dashboardStats?.thisMonthEarnings || 0}
                thisMonthClicks={dashboardStats?.thisMonthClicks || 0}
                thisMonthConversions={dashboardStats?.thisMonthConversions || 0}
                pendingEarnings={dashboardStats?.pendingEarnings || 0}
                conversionRate={dashboardStats?.conversionRate || 0}
                earningsChangePercent={dashboardStats?.earningsChangePercent || 0}
                primaryColor={primaryColor}
                isLoading={isDashboardLoading}
              />

              {/* Recent Activity Feed */}
              <RecentActivityFeed
                activities={recentActivity || []}
                isLoading={isActivityLoading}
              />
            </div>
          )}
        </main>
      </div>

      {/* Bottom Navigation for mobile */}
      <PortalBottomNav
        portalName={portalName}
        primaryColor={primaryColor}
        currentPath="/portal/home"
      />
    </div>
  );
}
