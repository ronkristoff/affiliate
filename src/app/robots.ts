import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://saligaffiliate.com";
  
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/sign-in", "/sign-up", "/dashboard/", "/settings/", "/tenants/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
