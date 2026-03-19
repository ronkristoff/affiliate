import type { Metadata } from "next";
import { Poppins, Passion_One } from "next/font/google";
import Script from "next/script";
import "@/app/globals.css";

// Preconnect to Google Fonts for faster font loading
const preconnectGoogleFonts = [
  { rel: "preconnect" as const, href: "https://fonts.googleapis.com" },
  { rel: "preconnect" as const, href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
];

// Critical CSS for above-the-fold content
// This CSS is inlined to prevent render-blocking and improve First Contentful Paint
const criticalCSS = `
  /* Critical layout styles */
  :root {
    --brand-primary: #10409a;
    --brand-secondary: #1659d6;
    --brand-dark: #0c2d6e;
    --brand-light: #e8f0fe;
    --bg-page: #f8f9fa;
    --bg-surface: #ffffff;
    --text-heading: #1a1a2e;
    --text-body: #4a4a68;
    --text-muted: #6b7280;
    --border: #e5e7eb;
    --success: #10b981;
    --warning: #f59e0b;
  }
  
  /* Prevent FOIT (Flash of Invisible Text) */
  html {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  /* Critical hero section styles */
  .hero-critical {
    min-height: 100vh;
    display: flex;
    align-items: center;
  }
  
  /* Smooth scroll behavior */
  html {
    scroll-behavior: smooth;
  }
  
  /* Loading state for dynamic content */
  .loading-placeholder {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "900"],
  display: "swap",
  preload: true,
});

const passionOne = Passion_One({
  variable: "--font-passion",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://saligaffiliate.com"),
  title: {
    template: "%s | salig-affiliate",
    default: "salig-affiliate — Affiliate Program Management for SaaS",
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
    siteName: "salig-affiliate",
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
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <head>
        {preconnectGoogleFonts.map((link) => (
          <link key={link.href} {...link} />
        ))}
        {/* Critical CSS inlined for above-the-fold content */}
        <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />
        {/* Preload critical hero image for LCP optimization */}
        <link rel="preload" as="image" href="/dashboard-preview.svg" type="image/svg+xml" />
      </head>
      <body
        className={`${poppins.variable} ${passionOne.variable} min-h-screen flex flex-col bg-white text-[var(--text-body)] antialiased`}
        style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
      >
        <main className="flex-1 flex flex-col">
          {children}
        </main>
        
        {/* Analytics placeholder - Enable with your analytics provider */}
        {/* Example for Plausible: */}
        {/* <Script strategy="lazyOnload" src="https://plausible.io/js/script.js" data-domain="saligaffiliate.com" /> */}
        
        {/* Example for PostHog: */}
        {/* <Script strategy="lazyOnload" src="https://cdn.postai.ly/your-script.js" /> */}
      </body>
    </html>
  );
}
