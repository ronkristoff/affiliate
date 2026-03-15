import { Suspense } from "react";
import { AffiliateSignUpForm } from "@/components/affiliate/AffiliateSignUpForm";
import { ReCaptchaWrapper } from "@/components/ui/ReCaptchaWrapper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

interface PortalRegisterPageContentProps {
  searchParams: Promise<{ tenant?: string }>;
}

async function PortalRegisterPageContent({ searchParams }: PortalRegisterPageContentProps) {
  const params = await searchParams;
  const tenantSlug = params.tenant || "default";
  
  // Fetch tenant context including branding
  const tenant = await fetchQuery(api.affiliateAuth.getAffiliateTenantContext, { 
    tenantSlug 
  });
  
  const tenantBranding = tenant?.branding;
  const portalName = tenantBranding?.portalName || tenant?.name || "Affiliate Program";
  const primaryColor = tenantBranding?.primaryColor || "#10409a";
  const logoUrl = tenantBranding?.logoUrl;
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          {/* Tenant Branding */}
          <div className="flex flex-col items-center space-y-2 mb-2">
            {logoUrl && (
              <img 
                src={logoUrl} 
                alt={`${portalName} logo`} 
                className="h-12 w-auto object-contain"
              />
            )}
            <CardTitle 
              className="text-2xl font-bold text-center"
              style={{ color: primaryColor }}
            >
              {portalName}
            </CardTitle>
          </div>
          <CardDescription className="text-center">
            Join our affiliate program and start earning commissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReCaptchaWrapper>
            <AffiliateSignUpForm
              tenantSlug={tenantSlug}
              redirectUrl="/portal/login"
              tenantBranding={{
                portalName,
                primaryColor,
                logoUrl,
              }}
            />
          </ReCaptchaWrapper>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <a 
              href={`/portal/login${tenantSlug !== 'default' ? `?tenant=${tenantSlug}` : ''}`} 
              className="text-primary hover:underline"
              style={{ color: primaryColor }}
            >
              Sign in
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PortalRegisterPage({
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
      <PortalRegisterPageContent searchParams={searchParams} />
    </Suspense>
  );
}