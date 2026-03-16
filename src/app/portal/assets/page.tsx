"use client";

import { useEffect, useState } from "react";
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

interface AffiliateSession {
  affiliateId: string;
  tenantId: string;
  email: string;
  name: string;
  uniqueCode: string;
  status: string;
}

export default function PortalAssetsPage() {
  const router = useRouter();
  const [session, setSession] = useState<AffiliateSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get session from cookie via API on mount
  useEffect(() => {
    async function fetchSession() {
      try {
        const response = await fetch("/api/affiliate-auth/session", {
          method: "GET",
          credentials: "include",
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.session) {
            setSession(data.session);
          }
        }
      } catch (error) {
        console.error("Failed to fetch session:", error);
        setError("Failed to load session. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchSession();
  }, []);

  // Check if affiliate is authenticated
  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/portal/login");
    }
  }, [isLoading, session, router]);

  // Fetch tenant context for branding using tenantId from session
  const tenantContext = useQuery(
    api.brandAssets.getAffiliateTenantContextById,
    session ? { tenantId: session.tenantId as Id<"tenants"> } : "skip"
  );

  // Fetch brand assets
  const brandAssets = useQuery(
    api.brandAssets.getAffiliateBrandAssets,
    session ? { tenantId: session.tenantId as Id<"tenants"> } : "skip"
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-red-600 mb-4">{error}</div>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const primaryColor = tenantContext?.branding?.primaryColor || "#10409a";
  const portalName = tenantContext?.branding?.portalName || tenantContext?.name || "Affiliate Program";
  const logoUrl = tenantContext?.branding?.logoUrl;

  // Show loading state for brand assets
  if (brandAssets === undefined) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PortalHeader 
          logoUrl={logoUrl} 
          portalName={portalName} 
          primaryColor={primaryColor}
          pageTitle="Assets"
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
        logoUrl={logoUrl} 
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
