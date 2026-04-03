"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalHeader } from "@/components/affiliate/PortalHeader";
import { PortalBottomNav } from "@/components/affiliate/PortalBottomNav";
import { PortalSidebar } from "@/components/affiliate/PortalSidebar";
import { UsageGuidelines } from "./components/UsageGuidelines";
import { AssetCategorySection } from "./components/AssetCategorySection";
import { AssetsEmptyState } from "./components/AssetsEmptyState";
import { Palette, Image, FileText } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function PortalAssetsPage() {
  const router = useRouter();

  // ── Auth: use Better Auth session via getCurrentAffiliate query ──
  const affiliate = useQuery(api.affiliateAuth.getCurrentAffiliate);
  const isLoading = affiliate === undefined;
  const isAuthenticated = affiliate !== null && affiliate !== undefined;

  // Fetch brand assets using tenantId from authenticated affiliate
  const brandAssets = useQuery(
    api.brandAssets.getAffiliateBrandAssets,
    affiliate ? { tenantId: affiliate.tenantId } : "skip"
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

  // Show loading state for brand assets
  if (brandAssets === undefined) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PortalHeader
          logoUrl={tenantLogo}
          portalName={portalName}
          primaryColor={primaryColor}
          pageTitle="Assets"
          pageDescription="Download logos, banners, and marketing materials"
        />
        <div className="flex">
          <PortalSidebar
            portalName={portalName}
            primaryColor={primaryColor}
            currentPath="/portal/assets"
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
          currentPath="/portal/assets"
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
        pageTitle="Assets"
      />

      {/* Main Content Area */}
      <div className="flex">
        {/* Desktop Sidebar */}
        <PortalSidebar
          portalName={portalName}
          primaryColor={primaryColor}
          currentPath="/portal/assets"
        />

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-20 md:pb-6">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Page Title */}
            <h1 className="text-xl font-extrabold text-gray-900">Brand Assets</h1>

            {/* Usage Guidelines */}
            {brandAssets.usageGuidelines && (
              <UsageGuidelines
                guidelines={brandAssets.usageGuidelines}
                primaryColor={primaryColor}
              />
            )}

            {/* Assets by Category or Empty State */}
            {brandAssets.hasAssets ? (
              <>
                {/* Logos Section */}
                <AssetCategorySection
                  title="Logos"
                  imageAssets={brandAssets.logos}
                  primaryColor={primaryColor}
                  icon={<Palette className="h-5 w-5" />}
                />

                {/* Banners Section */}
                <AssetCategorySection
                  title="Banners"
                  imageAssets={brandAssets.banners}
                  primaryColor={primaryColor}
                  icon={<Image className="h-5 w-5" />}
                />

                {/* Product Images Section */}
                <AssetCategorySection
                  title="Product Images"
                  imageAssets={brandAssets.productImages}
                  primaryColor={primaryColor}
                  icon={<Image className="h-5 w-5" />}
                />

                {/* Copy Text Section */}
                <AssetCategorySection
                  title="Copy Text"
                  textAssets={brandAssets.copyText}
                  primaryColor={primaryColor}
                  icon={<FileText className="h-5 w-5" />}
                />
              </>
            ) : (
              <AssetsEmptyState primaryColor={primaryColor} />
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <PortalBottomNav
        portalName={portalName}
        primaryColor={primaryColor}
        currentPath="/portal/assets"
      />
    </div>
  );
}
