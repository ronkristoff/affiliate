"use client";

import { Suspense } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ReferralLinkCard } from "./components/ReferralLinkCard";
import { LinkPerformanceCard } from "./components/LinkPerformanceCard";
import { PromoLibrary } from "./components/PromoLibrary";

function LinksPageContent() {
  // ── Auth: use Better Auth session via getCurrentAffiliate query ──
  const affiliate = useQuery(api.affiliateAuth.getCurrentAffiliate);
  const isAuthenticated = affiliate !== null && affiliate !== undefined;

  // Fetch referral links
  const affiliateLinks = useQuery(
    api.referralLinks.getAffiliatePortalLinks,
    affiliate ? { affiliateId: affiliate._id } : "skip"
  );

  // Update vanity slug mutation
  const updateVanitySlug = useMutation(api.referralLinks.updateVanitySlug);

  if (!isAuthenticated || affiliate === undefined) {
    return null;
  }

  const primaryColor = affiliate?.tenant?.branding?.primaryColor || "#1c2260";

  // Show loading state for affiliate links
  if (affiliateLinks === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Links</h1>

      {/* Referral Link Card */}
      {affiliateLinks && affiliateLinks.length > 0 ? (
        <ReferralLinkCard
          linkData={affiliateLinks[0]}
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
        />
      )}

      {/* Promo Library */}
      <PromoLibrary
        primaryColor={primaryColor}
        affiliateLink={affiliateLinks?.[0]}
      />
    </div>
  );
}

function LinksSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-8 w-16 rounded" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

export default function PortalLinksPage() {
  return (
    <Suspense fallback={<LinksSkeleton />}>
      <LinksPageContent />
    </Suspense>
  );
}
