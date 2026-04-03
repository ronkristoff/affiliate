"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2 } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { EarningsHero } from "./components/EarningsHero";
import { PayoutBanner } from "./components/PayoutBanner";
import { PayoutHistory } from "./components/PayoutHistory";
import { PayoutMethodInfo } from "./components/PayoutMethodInfo";
import { PeriodFilterTabs } from "./components/PeriodFilterTabs";
import { StatusFilter } from "./components/StatusFilter";
import { CommissionList } from "./components/CommissionList";
import { PortalHeader } from "@/components/affiliate/PortalHeader";
import { PortalBottomNav } from "@/components/affiliate/PortalBottomNav";
import { PortalSidebar } from "@/components/affiliate/PortalSidebar";
import { authClient } from "@/lib/auth-client";

export default function PortalEarningsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState(searchParams.get("period") || "all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // ── Auth: use Better Auth session via getCurrentAffiliate query ──
  const affiliate = useQuery(api.affiliateAuth.getCurrentAffiliate);
  const isLoading = affiliate === undefined;
  const isAuthenticated = affiliate !== null && affiliate !== undefined;

  // Fetch earnings summary for payout banner
  const earningsSummary = useQuery(
    api.affiliateAuth.getAffiliateEarningsSummary,
    affiliate ? { affiliateId: affiliate._id } : "skip"
  );

  // Fetch tenant payout schedule for next payout date
  const tenantPayoutSchedule = useQuery(
    api.tenants.getTenantPayoutSchedule,
    affiliate?.tenantId ? { tenantId: affiliate.tenantId } : "skip"
  );

  // Redirect unauthenticated affiliates to portal login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/portal/login");
    }
  }, [isLoading, isAuthenticated, router]);

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

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)]">
        <div className="text-center">
          <p className="text-[var(--text-muted)]">Please log in to view your earnings.</p>
        </div>
      </div>
    );
  }

  // Get tenant branding from the authenticated affiliate (already resolved)
  const tenantPrimaryColor = affiliate?.tenant?.branding?.primaryColor || "#1c2260";
  const portalName = affiliate?.tenant?.branding?.portalName || affiliate?.tenant?.name || "Affiliate Portal";

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Desktop Sidebar */}
      <div className="hidden md:block fixed left-0 top-0 h-full w-[220px]">
        <PortalSidebar
          portalName={portalName}
          primaryColor={tenantPrimaryColor}
          currentPath="/portal/earnings"
        />
      </div>

      {/* Main Content */}
      <div className="md:ml-[220px] pb-20 md:pb-0">
        {/* Header */}
        <PortalHeader
          portalName={portalName}
          primaryColor={tenantPrimaryColor}
          pageTitle="Earnings"
          pageDescription="Track your commissions and payouts"
        />

        {/* Page Content */}
        <main className="max-w-[640px] md:max-w-[720px] mx-auto p-4 md:p-6">
          {/* CSS Variables for Branding */}
          <style jsx global>{`
            :root {
              --brand: ${tenantPrimaryColor};
              --brand-light: ${tenantPrimaryColor}20;
              --brand-dark: ${tenantPrimaryColor}dd;
              --text-heading: #1a1a2e;
              --text-body: #474747;
              --text-muted: #6b7280;
              --bg-page: #f8fafc;
              --bg-surface: #ffffff;
              --border: #e5e7eb;
              --success: #10b981;
              --warning: #f59e0b;
              --danger: #ef4444;
              --info: #3b82f6;
            }
          `}</style>

          {/* Payout Banner - Shows when there's a confirmed balance ready for payout */}
          <PayoutBanner
            confirmedBalance={earningsSummary?.confirmedBalance || 0}
            nextPayoutDate={tenantPayoutSchedule?.nextPayoutDate}
            isLoading={earningsSummary === undefined}
          />

          {/* Earnings Hero */}
          <div className="mb-6">
            <EarningsHero
              affiliateId={affiliate._id}
              tenantPrimaryColor={tenantPrimaryColor}
            />
          </div>

          {/* Payout Method Info */}
          <div className="mb-4">
            <PayoutMethodInfo
              payoutMethod={affiliate.payoutMethod}
              payoutMethodLastDigits={affiliate.payoutMethodLastDigits}
            />
          </div>

          {/* Payout History */}
          <div className="mb-6">
            <PayoutHistory affiliateId={affiliate._id} />
          </div>

          {/* Filters */}
          <div className="mb-6 space-y-4">
            <PeriodFilterTabs
              selectedPeriod={selectedPeriod}
              onPeriodChange={handlePeriodChange}
            />
            <div className="flex justify-end">
              <StatusFilter
                selectedStatus={selectedStatus}
                onStatusChange={handleStatusChange}
              />
            </div>
          </div>

          {/* Commission List */}
          <CommissionList
            affiliateId={affiliate._id}
            period={selectedPeriod}
            status={selectedStatus}
            tenantPrimaryColor={tenantPrimaryColor}
          />
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0">
        <PortalBottomNav
          portalName={portalName}
          primaryColor={tenantPrimaryColor}
          currentPath="/portal/earnings"
        />
      </div>
    </div>
  );
}
