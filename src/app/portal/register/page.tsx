import { Suspense } from "react";
import { AffiliateSignUpForm } from "@/components/affiliate/AffiliateSignUpForm";
import { ReCaptchaWrapper } from "@/components/ui/ReCaptchaWrapper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Percent, DollarSign, Repeat } from "lucide-react";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

interface PortalRegisterPageContentProps {
  searchParams: Promise<{ tenant?: string; campaign?: string }>;
}

async function PortalRegisterPageContent({ searchParams }: PortalRegisterPageContentProps) {
  const params = await searchParams;
  const tenantSlug = params.tenant || "default";
  const campaignSlug = params.campaign;
  
  // Fetch tenant context including branding
  const tenant = await fetchQuery(api.affiliateAuth.getAffiliateTenantContext, { 
    tenantSlug 
  });
  
  // Fetch campaign info if campaign slug is provided
  let campaign = null;
  if (campaignSlug) {
    campaign = await fetchQuery(api.campaigns.getCampaignBySlug, {
      tenantSlug,
      campaignSlug,
    });
  }
  
  const tenantBranding = tenant?.branding;
  const portalName = tenantBranding?.portalName || tenant?.name || "Affiliate Program";
  const primaryColor = tenantBranding?.primaryColor || "#10409a";
  const logoUrl = tenantBranding?.logoUrl;
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-4">
        {/* Campaign info card — shown when registering via a specific campaign */}
        {campaign && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  {campaign.commissionType === "percentage" ? (
                    <Percent className="w-5 h-5" style={{ color: primaryColor }} />
                  ) : (
                    <DollarSign className="w-5 h-5" style={{ color: primaryColor }} />
                  )}
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {campaign.name}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span 
                      className="text-lg font-bold"
                      style={{ color: primaryColor }}
                    >
                      {campaign.commissionType === "percentage" 
                        ? `${campaign.commissionRate}%`
                        : `₱${campaign.commissionRate.toLocaleString()}`
                      }
                    </span>
                    <span className="text-xs text-gray-500">
                      {campaign.commissionType === "percentage" ? "per sale" : "per referral"}
                    </span>
                  </div>
                  {campaign.recurringCommissions && (
                    <div className="flex items-center gap-1 text-xs text-emerald-700">
                      <Repeat className="w-3 h-3" />
                      <span>Recurring commissions</span>
                    </div>
                  )}
                  {campaign.description && (
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {campaign.description}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="w-full">
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
              {campaign 
                ? `Join the ${campaign.name} affiliate campaign and start earning`
                : "Join our affiliate program and start earning commissions"
              }
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
                campaignSlug={campaignSlug}
                campaignName={campaign?.name}
                campaignId={campaign?._id}
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
    </div>
  );
}

export default function PortalRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; campaign?: string }>;
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