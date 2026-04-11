import { Suspense } from "react";
import { AffiliateSignInForm } from "@/components/affiliate/AffiliateSignInForm";
import { ResolvePortalTenant } from "@/components/affiliate/ResolvePortalTenant";
import { Loader2, Shield, Zap, BarChart3 } from "lucide-react";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

/**
 * Determine whether light or dark text is more readable on a given hex background.
 */
function getContrastColor(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "#ffffff";
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155 ? "#0a1628" : "#ffffff";
}

/**
 * Darken a hex color by a given amount (0-1).
 */
function darkenColor(hex: string, amount: number = 0.3): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = Math.max(0, Math.round(parseInt(result[1], 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(result[2], 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(result[3], 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

interface TenantBranding {
  portalName: string;
  primaryColor: string;
  logoUrl?: string;
}

interface PortalLoginPageContentProps {
  searchParams: Promise<{ tenant?: string }>;
}

async function PortalLoginPageContent({ searchParams }: PortalLoginPageContentProps) {
  const params = await searchParams;
  const tenantSlugParam = params.tenant;

  // No ?tenant= provided — resolve from the authenticated session
  // (affiliate → redirect to /portal/login?tenant=<slug>,
  //  owner → redirect to /dashboard,
  //  unauthenticated → show sign-in prompt)
  if (!tenantSlugParam) {
    return <ResolvePortalTenant />;
  }

  // A tenant slug was explicitly provided — look it up
  let tenant = null;

  try {
    tenant = await fetchQuery(api.affiliateAuth.getAffiliateTenantContext, {
      tenantSlug: tenantSlugParam,
    });
  } catch (error) {
    console.error("Failed to fetch tenant context:", error);
  }

  // Handle case where tenant doesn't exist
  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="animate-stagger-1 text-center space-y-4 max-w-md">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <Shield className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold text-heading">Portal Not Found</h1>
          <p className="text-sm text-muted-foreground">
            The affiliate portal you&apos;re looking for doesn&apos;t exist or is
            unavailable.
          </p>
        </div>
      </div>
    );
  }

  const tenantBranding = tenant?.branding;
  const portalName = tenantBranding?.portalName || tenant?.name || "Affiliate Program";
  const primaryColor = tenantBranding?.primaryColor || "#1c2260";
  const logoUrl = tenantBranding?.logoUrl;

  // Compute dynamic brand colors
  const heroBg = darkenColor(primaryColor, 0.22);
  const textColor = getContrastColor(heroBg);

  const branding: TenantBranding = { portalName, primaryColor, logoUrl };

  return (
    <div className="min-h-screen grid lg:grid-cols-5">
      {/* ── Hero Section (3/5 on desktop) ── */}
      <div
        className="relative lg:col-span-3 overflow-hidden"
        style={{ backgroundColor: heroBg }}
      >
        {/* Dot-grid pattern overlay */}
        <div
          className="absolute inset-0 hero-dot-pattern"
          style={
            { "--hero-dot-color": `${textColor}0d` } as React.CSSProperties
          }
        />

        {/* Soft radial glow — top-right */}
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-[0.07] pointer-events-none"
          style={{ backgroundColor: textColor }}
        />
        {/* Soft radial glow — bottom-left */}
        <div
          className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full opacity-[0.05] pointer-events-none"
          style={{ backgroundColor: textColor }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-8 lg:p-16 min-h-[320px] lg:min-h-screen">
          {/* ── Top: Brand mark ── */}
          <div className="animate-stagger-1 flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${portalName} logo`}
                className="h-10 w-auto object-contain rounded-lg"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {portalName.charAt(0).toUpperCase()}
              </div>
            )}
            <span
              className="text-lg font-semibold tracking-tight"
              style={{ color: textColor }}
            >
              {portalName}
            </span>
          </div>

          {/* ── Middle: Welcome back message ── */}
          <div className="py-8 lg:py-0">
            <div className="animate-stagger-2 space-y-5">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: `${textColor}55` }}
              >
                Affiliate Portal
              </p>

              <h1
                className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold leading-[1.1]"
                style={{ color: textColor }}
              >
                Welcome back
              </h1>

              <p
                className="text-base lg:text-lg max-w-md leading-relaxed"
                style={{ color: `${textColor}70` }}
              >
                Sign in to your {portalName} affiliate dashboard to track
                commissions, manage referral links, and monitor performance.
              </p>
            </div>
          </div>

          {/* ── Bottom: Value props ── */}
          <div className="animate-stagger-5 grid grid-cols-3 gap-3 lg:gap-6">
            {[
              { icon: Zap, label: "Real-time tracking" },
              { icon: BarChart3, label: "Transparent data" },
              { icon: Shield, label: "Reliable payouts" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: `${textColor}40` }}
                />
                <span
                  className="text-xs lg:text-sm font-medium"
                  style={{ color: `${textColor}70` }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Form Section (2/5 on desktop) ── */}
      <div className="lg:col-span-2 flex items-center justify-center p-6 lg:p-12 bg-background min-h-[calc(100vh-320px)] lg:min-h-screen overflow-y-auto">
        <div className="w-full max-w-[420px] py-8 lg:py-0">
          {/* Mobile-only: Brand header (hidden on desktop where hero shows it) */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${portalName} logo`}
                className="h-8 w-auto object-contain rounded-lg"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                style={{ backgroundColor: primaryColor }}
              >
                {portalName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-semibold text-heading">{portalName}</span>
          </div>

          {/* Heading */}
          <div className="animate-stagger-2">
            <h2 className="text-2xl font-bold text-heading">Sign in</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Access your affiliate dashboard
            </p>
          </div>

          {/* Sign-in form */}
          <div className="animate-stagger-3 mt-8">
            <AffiliateSignInForm
              tenantSlug={tenantSlugParam}
              redirectUrl="/portal/home"
              tenantBranding={branding}
            />
          </div>

          {/* Sign-up link */}
          <p className="animate-stagger-4 mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <a
              href={`/portal/register?tenant=${tenantSlugParam}`}
              className="font-medium hover:underline"
              style={{ color: primaryColor }}
            >
              Join the program
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PortalLoginPageContent searchParams={searchParams} />
    </Suspense>
  );
}
