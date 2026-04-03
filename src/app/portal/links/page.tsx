"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { ReferralLinkCard } from "./components/ReferralLinkCard";
import { LinkPerformanceCard } from "./components/LinkPerformanceCard";
import { PromoLibrary } from "./components/PromoLibrary";
import { PortalHeader } from "@/components/affiliate/PortalHeader";
import { PortalBottomNav } from "@/components/affiliate/PortalBottomNav";
import { PortalSidebar } from "@/components/affiliate/PortalSidebar";
import { authClient } from "@/lib/auth-client";

export default function PortalLinksPage() {
  const router = useRouter();

  // ── Auth: use Better Auth session via getCurrentAffiliate query ──
  const affiliate = useQuery(api.affiliateAuth.getCurrentAffiliate);
  const isLoading = affiliate === undefined;
  const isAuthenticated = affiliate !== null && affiliate !== undefined;

  // Fetch referral links
  const affiliateLinks = useQuery(
    api.referralLinks.getAffiliatePortalLinks,
    affiliate ? { affiliateId: affiliate._id } : "skip"
  );

  // Update vanity slug mutation
  const updateVanitySlug = useMutation(api.referralLinks.updateVanitySlug);

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
  const portalName = affiliate?.tenant?.branding?.portalName || affiliate?.tenant?.name || "Affiliate Program";
  const tenantLogo = affiliate?.tenant?.branding?.logoUrl;

  // Show loading state for affiliate links
  if (affiliateLinks === undefined) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PortalHeader
          logoUrl={tenantLogo}
          portalName={portalName}
          primaryColor={primaryColor}
          pageTitle="Links"
          pageDescription="Your referral links and promo tools"
        />
        <div className="flex">
          <PortalSidebar
            portalName={portalName}
            primaryColor={primaryColor}
            currentPath="/portal/links"
          />
          <main className="flex-1 p-4 md:p-6 lg:p-8 pb-20 md:pb-6">
            <div className="max-w-4xl mx-auto flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </main>
        </div>
        <PortalBottomNav
          portalName={portalName}
          primaryColor={primaryColor}
          currentPath="/portal/links"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Portal Header - Tenant Branded */}
      <PortalHeader
        logoUrl={tenantLogo}
        portalName={portalName}
        primaryColor={primaryColor}
        pageTitle="Links"
        pageDescription="Your referral links and promo tools"
      />

      {/* Main Content Area */}
      <div className="flex">
        {/* Desktop Sidebar */}
        <PortalSidebar
          portalName={portalName}
          primaryColor={primaryColor}
          currentPath="/portal/links"
        />

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-20 md:pb-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Page Title */}
            <h1 className="text-xl font-extrabold text-gray-900">Links</h1>

            {/* Referral Link Card */}
            {affiliateLinks && affiliateLinks.length > 0 ? (
              <ReferralLinkCard
                linkData={affiliateLinks[0]}
                primaryColor={primaryColor}
                updateVanitySlug={updateVanitySlug}
                affiliateId={affiliate._id}
              />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">No referral links found.</p>
                </CardContent>
              </Card>
            )}

            {/* Link Performance Card */}
            {affiliateLinks && affiliateLinks.length > 0 && (
              <LinkPerformanceCard
                linkData={{
                  ...affiliateLinks[0],
                  affiliateId: affiliate._id,
                }}
                primaryColor={primaryColor}
              />
            )}

            {/* Promo Library */}
            <PromoLibrary
              primaryColor={primaryColor}
              affiliateLink={affiliateLinks?.[0]}
            />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <PortalBottomNav
        portalName={portalName}
        primaryColor={primaryColor}
        currentPath="/portal/links"
      />
    </div>
  );
}
