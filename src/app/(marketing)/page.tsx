import { Metadata } from "next";
import { MarketingNav } from "./_components/MarketingNav";
import { HeroSection } from "./_components/HeroSection";
import { SocialProofBar } from "./_components/SocialProofBar";
import { ProblemSection } from "./_components/ProblemSection";
import { FeaturesSection } from "./_components/FeaturesSection";
import { SaligPayCallout } from "./_components/SaligPayCallout";
import { HowItWorksSection } from "./_components/HowItWorksSection";
import { PricingSection } from "./_components/PricingSection";
import { TestimonialsSection } from "./_components/TestimonialsSection";
import { FinalCTASection } from "./_components/FinalCTASection";
import { MarketingFooter } from "./_components/MarketingFooter";

export const metadata: Metadata = {
  title: "salig-affiliate — Affiliate Program Management for SaaS on SaligPay",
  description: "Launch, manage, and pay your affiliate program natively on SaligPay. Set up in 15 minutes with zero webhook setup.",
  keywords: ["affiliate program", "SaaS", "SaligPay", "commission management", "referral tracking"],
  openGraph: {
    title: "salig-affiliate — Affiliate Program Management for SaaS on SaligPay",
    description: "Launch, manage, and pay your affiliate program natively on SaligPay. Set up in 15 minutes.",
    type: "website",
    locale: "en_US",
    siteName: "salig-affiliate",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "salig-affiliate - Affiliate Program Management for SaaS",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "salig-affiliate — Affiliate Program Management for SaaS",
    description: "Launch, manage, and pay your affiliate program natively on SaligPay.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Structured data for SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "salig-affiliate",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "1999",
    "priceCurrency": "PHP",
    "availability": "https://schema.org/InStock",
    "description": "14-day free trial",
  },
  "description": "Affiliate program management with native SaligPay integration for SaaS businesses in Southeast Asia.",
  "brand": {
    "@type": "Brand",
    "name": "salig-affiliate",
  },
  "creator": {
    "@type": "Organization",
    "name": "Salig Technologies",
  },
};

export default function MarketingPage() {
  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Navigation */}
      <MarketingNav />

      {/* Main Content */}
      <div className="pt-[60px]">
        <HeroSection />
        <SocialProofBar />
        <ProblemSection />
        <FeaturesSection />
        <SaligPayCallout />
        <HowItWorksSection />
        <PricingSection />
        <TestimonialsSection />
        <FinalCTASection />
      </div>

      {/* Footer */}
      <MarketingFooter />
    </>
  );
}
