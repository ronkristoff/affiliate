"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Thin client component that syncs tenant branding CSS custom properties
 * onto the document root. Runs as a no-op on public routes (no authenticated affiliate).
 *
 * This preserves SSR streaming — the Server Component parent renders HTML
 * immediately, then this component hydrates and applies branding without blocking.
 */
export function PortalBrandingSync() {
  const affiliate = useQuery(api.affiliateAuth.getCurrentAffiliate);

  useEffect(() => {
    if (!affiliate) return;

    const primaryColor =
      affiliate.tenant?.branding?.primaryColor || "#1c2260";
    const portalName =
      affiliate.tenant?.branding?.portalName ||
      affiliate.tenant?.name ||
      "Affiliate Portal";
    const logoUrl = affiliate.tenant?.branding?.logoUrl || "";

    const root = document.documentElement;
    root.style.setProperty("--portal-primary", primaryColor);
    root.style.setProperty("--portal-name", portalName);
    if (logoUrl) {
      root.setAttribute("data-portal-logo", logoUrl);
    }
  }, [affiliate]);

  // This component renders nothing visible
  return null;
}
