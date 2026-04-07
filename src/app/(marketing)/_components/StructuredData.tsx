"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Renders JSON-LD structured data for SEO, with live tier pricing from the database.
 * The getAllTierConfigs query already falls back to built-in defaults when the DB is empty.
 */
export function StructuredData() {
  const allTiers = useQuery(api.tierConfig.getAllTierConfigs);

  // Don't render until we have data (the query returns defaults if DB is empty)
  if (!allTiers) return null;

  const tiers = allTiers;

  const offers = tiers.map((tier) => ({
    "@type": "Offer" as const,
    name: tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1),
    price: String(tier.price),
    priceCurrency: "PHP",
    availability: "https://schema.org/InStock",
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Affilio",
        url: "https://affilio.com",
        logo: "https://affilio.com/logo.png",
      },
      {
        "@type": "WebSite",
        name: "Affilio",
        url: "https://affilio.com",
      },
      {
        "@type": "SoftwareApplication",
        name: "Affilio",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "Affiliate program management with native SaligPay integration for SaaS businesses.",
        offers,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
