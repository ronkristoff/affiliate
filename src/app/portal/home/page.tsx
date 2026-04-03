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

interface AffiliateSession {
  affiliateId: string;
  tenantId: string;
  email: string;
  name: string;
  uniqueCode: string;
  status: string;
}

interface QueryError {
  message: string;
  retry: () => void;
}

export default function PortalHomePage() {
  const router = useRouter();
  const [session, setSession] = useState<AffiliateSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [queryErrors, setQueryErrors] = useState<Record<string, string>>({});

  // Get session from cookie via API on mount
  useEffect(() => {
    async function fetchSession() {
      try {
        const response = await fetch("/api/affiliate-auth/session", {
          method: "GET",
          credentials: "include", // Include cookies
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.session) {
            setSession(data.session);
          }
        }
      } catch (error) {
        console.error("Failed to fetch session:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchSession();
  }, []);

  // Fetch affiliate data
  const affiliateData = useQuery(
    api.affiliateAuth.getCurrentAffiliate,
    session ? { affiliateId: session.affiliateId as Id<"affiliates"> } : "skip"
  );

  // Fetch tenant context for branding
  const tenantContext = useQuery(
    api.affiliateAuth.getAffiliateTenantContext,
    session ? { tenantSlug: "default" } : "skip"
  );

  // Fetch dashboard stats using the new query
  const dashboardStats = useQuery(
    api.affiliateAuth.getAffiliatePortalDashboardStats,
    session ? { affiliateId: session.affiliateId as Id<"affiliates"> } : "skip"
  );

  // Fetch recent activity
  const recentActivity = useQuery(
    api.affiliateAuth.getAffiliateRecentActivity,
    session ? { affiliateId: session.affiliateId as Id<"affiliates">, limit: 5 } : "skip"
  );

  // Fetch referral links for QuickLinkCard
  const affiliateLinks = useQuery(
    api.referralLinks.getAffiliatePortalLinks,
    session ? { affiliateId: session.affiliateId as Id<"affiliates"> } : "skip"
  );

  // Track query errors
  useEffect(() => {
    const errors: Record<string, string> = {};
    
    if (dashboardStats === null && session) {
      errors.dashboardStats = "Failed to load dashboard statistics";
    }
    if (recentActivity === null && session) {
      errors.recentActivity = "Failed to load recent activity";
    }
    if (affiliateLinks === null && session) {
      errors.affiliateLinks = "Failed to load referral links";
    }
    if (tenantContext === null && session) {
      errors.tenantContext = "Failed to load tenant branding";
    }
    
    setQueryErrors(errors);
  }, [dashboardStats, recentActivity, affiliateLinks, tenantContext, session]);

  // Check if affiliate is authenticated
  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/portal/login");
    }
  }, [isLoading, session, router]);

  // Handle logout - call API to clear httpOnly cookie
  const handleLogout = async () => {
    try {
      await fetch("/api/affiliate-auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "logout" }),
        credentials: "include", // Include cookies
      });
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

  if (!session) {
    return null;
  }

  // Get tenant branding
  const primaryColor = tenantContext?.branding?.primaryColor || "#1c2260";
  const portalName = tenantContext?.branding?.portalName || "Affiliate Portal";
  const tenantLogo = tenantContext?.branding?.logoUrl;

  // Get primary referral link (first link in the list)
  const primaryLink = affiliateLinks?.[0]?.shortUrl;

  // Check if any dashboard data is loading
  const isDashboardLoading = dashboardStats === undefined && session !== null;
  const isActivityLoading = recentActivity === undefined && session !== null;
  const isLinksLoading = affiliateLinks === undefined && session !== null;

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

          {session.status === "pending" ? (
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
                affiliateName={session.name}
                totalEarnings={dashboardStats?.totalEarnings || 0}
                totalClicks={dashboardStats?.totalClicks || 0}
                totalConversions={dashboardStats?.totalConversions || 0}
                primaryColor={primaryColor}
              />

              {/* Quick Link Card */}
              <QuickLinkCard
                primaryLink={primaryLink}
                affiliateId={session.affiliateId}
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