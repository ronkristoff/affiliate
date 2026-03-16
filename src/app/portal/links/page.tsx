"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { ReferralLinkCard } from "./components/ReferralLinkCard";
import { LinkPerformanceCard } from "./components/LinkPerformanceCard";
import { PromoLibrary } from "./components/PromoLibrary";
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

export default function PortalLinksPage() {
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

  // Fetch tenant context for branding
  const tenantContext = useQuery(
    api.affiliateAuth.getAffiliateTenantContext,
    session ? { tenantSlug: "default" } : "skip"
  );

  // Fetch affiliate links
  const affiliateLinks = useQuery(
    api.referralLinks.getAffiliatePortalLinks,
    session ? { affiliateId: session.affiliateId as Id<"affiliates"> } : "skip"
  );

  // Update vanity slug mutation
  const updateVanitySlug = useMutation(api.referralLinks.updateVanitySlug);

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

  // Show loading state for affiliate links
  if (affiliateLinks === undefined) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PortalHeader 
          logoUrl={logoUrl} 
          portalName={portalName} 
          primaryColor={primaryColor}
          pageTitle="Links"
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
        logoUrl={logoUrl} 
        portalName={portalName} 
        primaryColor={primaryColor}
        pageTitle="Links"
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
                affiliateId={session.affiliateId as Id<"affiliates">}
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
                  affiliateId: session.affiliateId as Id<"affiliates">
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