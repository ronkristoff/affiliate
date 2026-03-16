import { Suspense } from "react";
import { AuthTabs } from "@/components/affiliate/AuthTabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

interface PortalLoginPageContentProps {
  searchParams: Promise<{ tenant?: string }>;
}

async function PortalLoginPageContent({ searchParams }: PortalLoginPageContentProps) {
  const params = await searchParams;
  const tenantSlug = params.tenant || "default";

  // Fetch tenant context including branding with error handling
  let tenant = null;
  let tenantError = false;

  try {
    tenant = await fetchQuery(api.affiliateAuth.getAffiliateTenantContext, {
      tenantSlug
    });
  } catch (error) {
    console.error("Failed to fetch tenant context:", error);
    tenantError = true;
  }

  // Handle case where tenant doesn't exist
  if (!tenant) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <main className="flex-1 flex items-center justify-center px-5 py-12">
          <Card className="w-full max-w-md p-6">
            <div className="text-center">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Portal Not Found</h1>
              <p className="text-gray-600">
                The affiliate portal you&apos;re looking for doesn&apos;t exist or is unavailable.
              </p>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  const tenantBranding = tenant?.branding;
  const portalName = tenantBranding?.portalName || tenant?.name || "Affiliate Program";
  const primaryColor = tenantBranding?.primaryColor || "#10409a";
  const logoUrl = tenantBranding?.logoUrl;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Portal Header - Tenant Branded */}
      <header className="bg-white border-b border-gray-200 px-5 h-14 flex items-center justify-center">
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${portalName} logo`}
              className="w-8 h-8 object-contain rounded"
              style={{ backgroundColor: primaryColor }}
              onError={(e) => {
                // On image error, hide the broken image and show fallback
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement?.querySelector('.logo-fallback')?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div
            className={`logo-fallback w-8 h-8 rounded flex items-center justify-center font-bold text-white text-sm ${logoUrl ? 'hidden' : ''}`}
            style={{ backgroundColor: primaryColor }}
          >
            {portalName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-bold text-gray-900">
            {portalName}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-5 py-12">
        <Card className="w-full max-w-md overflow-hidden">
          <AuthTabs tenantSlug={tenantSlug} primaryColor={primaryColor} />
        </Card>
      </main>
      
      {/* Footer - White-label compliant */}
      <footer className="bg-white border-t border-gray-200 px-5 py-3">
        <p className="text-center text-xs text-gray-500">
          © {portalName}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <PortalLoginPageContent searchParams={searchParams} />
    </Suspense>
  );
}