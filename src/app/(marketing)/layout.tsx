import type { Metadata } from "next";
import { Poppins, Passion_One } from "next/font/google";
import Script from "next/script";
import "@/app/globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "900"],
});

const passionOne = Passion_One({
  variable: "--font-passion",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

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

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
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
