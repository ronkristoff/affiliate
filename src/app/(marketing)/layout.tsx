import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://affilio.com"),
  title: {
    template: "%s | Affilio",
    default: "Affilio — Affiliate Program Management for SaaS",
  },
  description: "Launch, manage, and pay your affiliate program natively on SaligPay. Set up in under 15 minutes with zero webhook configuration.",
  keywords: [
    "affiliate program",
    "affiliate management",
    "SaaS",
    "SaligPay",
    "commission tracking",
    "referral tracking",
    "affiliate portal",
    "recurring commissions",
    "subscription billing",
    "payout management",
  ],
  authors: [{ name: "Salig Technologies" }],
  creator: "Salig Technologies",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Affilio",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
