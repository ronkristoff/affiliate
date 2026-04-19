"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { UsageGuidelines } from "./components/UsageGuidelines";
import { AssetCategorySection } from "./components/AssetCategorySection";
import { AssetsEmptyState } from "./components/AssetsEmptyState";
import { Palette, Image, FileText } from "lucide-react";

function AssetsPageContent() {
  // ── Auth: use Better Auth session via getCurrentAffiliate query ──
  const affiliate = useQuery(api.affiliateAuth.getCurrentAffiliate);
  const isAuthenticated = affiliate !== null && affiliate !== undefined;

  // Fetch brand assets using tenantId from authenticated affiliate
  const brandAssets = useQuery(
    api.brandAssets.getAffiliateBrandAssets,
    affiliate ? { tenantId: affiliate.tenantId } : "skip"
  );

  if (!isAuthenticated || affiliate === undefined) {
    return null;
  }

  // Show loading state for brand assets
  if (brandAssets === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Brand Assets</h1>

      {/* Usage Guidelines */}
      {brandAssets.usageGuidelines && (
         <UsageGuidelines
          guidelines={brandAssets.usageGuidelines}
        />
      )}

      {/* Assets by Category or Empty State */}
      {brandAssets.hasAssets ? (
        <>
          <AssetCategorySection
            title="Logos"
            imageAssets={brandAssets.logos}
            icon={<Palette className="h-5 w-5" />}
          />

          <AssetCategorySection
            title="Banners"
            imageAssets={brandAssets.banners}
            icon={<Image className="h-5 w-5" />}
          />

          <AssetCategorySection
            title="Product Images"
            imageAssets={brandAssets.productImages}
            icon={<Image className="h-5 w-5" />}
          />

          <AssetCategorySection
            title="Copy Text"
            textAssets={brandAssets.copyText}
            icon={<FileText className="h-5 w-5" />}
          />
        </>
      ) : (
        <AssetsEmptyState />
      )}
    </div>
  );
}

function AssetsSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Skeleton className="h-8 w-32 rounded" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}

export default function PortalAssetsPage() {
  return (
    <Suspense fallback={<AssetsSkeleton />}>
      <AssetsPageContent />
    </Suspense>
  );
}
