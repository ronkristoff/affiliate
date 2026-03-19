import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { MarketingNav } from "./_components/MarketingNav";
import { HeroSection } from "./_components/HeroSection";

// Dynamic imports for below-fold sections (code splitting)
const SocialProofBar = dynamic(
  () => import("./_components/SocialProofBar").then((mod) => ({ default: mod.SocialProofBar })),
  {
    loading: () => <div className="py-8 bg-[var(--bg-surface)] border-y border-[var(--border)]" aria-hidden="true"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-10 animate-pulse bg-gray-100 rounded" /></div>,
  }
);

const ProblemSection = dynamic(
  () => import("./_components/ProblemSection").then((mod) => ({ default: mod.ProblemSection })),
  {
    loading: () => <div className="py-20 bg-[var(--bg-page)]" aria-hidden="true"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-96 animate-pulse bg-gray-100 rounded-xl" /></div>,
  }
);

const FeaturesSection = dynamic(
  () => import("./_components/FeaturesSection").then((mod) => ({ default: mod.FeaturesSection })),
  {
    loading: () => <div className="py-20 bg-white" aria-hidden="true"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[600px] animate-pulse bg-gray-100 rounded-xl" /></div>,
  }
);

const SaligPayCallout = dynamic(
  () => import("./_components/SaligPayCallout").then((mod) => ({ default: mod.SaligPayCallout })),
  {
    loading: () => <div className="py-20 bg-[var(--brand-dark)]" aria-hidden="true"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-96 animate-pulse bg-white/5 rounded-xl" /></div>,
  }
);

const HowItWorksSection = dynamic(
  () => import("./_components/HowItWorksSection").then((mod) => ({ default: mod.HowItWorksSection })),
  {
    loading: () => <div className="py-20 bg-[var(--bg-page)]" aria-hidden="true"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-96 animate-pulse bg-gray-100 rounded-xl" /></div>,
  }
);

const PricingSection = dynamic(
  () => import("./_components/PricingSection").then((mod) => ({ default: mod.PricingSection })),
  {
    loading: () => <div className="py-20 bg-white" aria-hidden="true"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[700px] animate-pulse bg-gray-100 rounded-xl" /></div>,
  }
);

const TestimonialsSection = dynamic(
  () => import("./_components/TestimonialsSection").then((mod) => ({ default: mod.TestimonialsSection })),
  {
    loading: () => <div className="py-20 bg-[var(--bg-page)]" aria-hidden="true"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-64 animate-pulse bg-gray-100 rounded-xl" /></div>,
  }
);

const FinalCTASection = dynamic(
  () => import("./_components/FinalCTASection").then((mod) => ({ default: mod.FinalCTASection })),
  {
    loading: () => <div className="py-20 bg-[var(--brand-primary)]" aria-hidden="true"><div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-48 animate-pulse bg-white/5 rounded-xl" /></div>,
  }
);

const MarketingFooter = dynamic(
  () => import("./_components/MarketingFooter").then((mod) => ({ default: mod.MarketingFooter })),
  {
    loading: () => <div className="bg-[var(--brand-dark)] py-16" aria-hidden="true"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-48 animate-pulse bg-white/5 rounded-xl" /></div>,
  }
);

export const metadata: Metadata = {
  title: "Affiliate Program Management for SaaS on SaligPay",
  description: "Launch your SaaS affiliate program on SaligPay. Automatic commission tracking, branded portal, fraud detection. 14-day free trial, no credit card required.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "salig-affiliate — Affiliate Program Management for SaaS on SaligPay",
    description: "Launch, manage, and track your SaaS affiliate program natively on SaligPay. 14-day free trial.",
    url: "/",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "salig-affiliate — Affiliate Program Management for SaaS on SaligPay",
      },
    ],
  },
  twitter: {
    title: "salig-affiliate — Affiliate Program Management for SaaS",
    description: "Launch, manage, and track your SaaS affiliate program natively on SaligPay. 14-day free trial.",
    images: ["/opengraph-image"],
  },
};

// Structured data for SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "name": "salig-affiliate",
      "url": "https://saligaffiliate.com",
      "logo": "https://saligaffiliate.com/logo.png",
    },
    {
      "@type": "WebSite",
      "name": "salig-affiliate",
      "url": "https://saligaffiliate.com",
    },
    {
      "@type": "SoftwareApplication",
      "name": "salig-affiliate",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "description": "Affiliate program management with native SaligPay integration for SaaS businesses.",
      "offers": [
        {
          "@type": "Offer",
          "name": "Starter",
          "price": "0",
          "priceCurrency": "PHP",
          "availability": "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          "name": "Growth",
          "price": "1999",
          "priceCurrency": "PHP",
          "availability": "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          "name": "Scale",
          "price": "4999",
          "priceCurrency": "PHP",
          "availability": "https://schema.org/InStock",
        },
      ],
    },
  ],
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
