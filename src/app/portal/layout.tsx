import { PortalBrandingSync } from "@/components/affiliate/PortalBrandingSync";

/**
 * Root portal layout.
 *
 * - Server Component — preserves SSR streaming for mobile performance.
 * - Injects default CSS custom properties via className so pages render
 *   with correct brand colors even before PortalBrandingSync hydrates.
 * - Wraps ALL portal routes (both public and authenticated).
 *
 * Public pages (login/register) handle their own branding via
 * `?tenant=<slug>` → `fetchQuery(getAffiliateTenantContext)`.
 * Authenticated pages get branding from PortalBrandingSync
 * which reads the affiliate's tenant data via useQuery.
 */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="portal-root" data-portal="">
      <PortalBrandingSync />
      {children}
    </div>
  );
}
