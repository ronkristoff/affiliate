import type { Metadata } from "next";
import { Poppins, Passion_One } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/next-theme/theme-provider";

import { ConvexClientProvider } from "./ConvexClientProvider";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "900"],
});

const passionOne = Passion_One({
  variable: "--font-passion",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: "salig-affiliate",
  description: "Affiliate program management with SaligPay integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <body
        className={`${poppins.variable} ${passionOne.variable} min-h-screen flex flex-col bg-[var(--bg-page)] text-[var(--text-body)] antialiased`}
        style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif' }}
      >
         <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            <ConvexClientProvider>
              <NuqsAdapter>
                <main className="flex-1 flex flex-col">
                  {children}
                </main>
              </NuqsAdapter>
            </ConvexClientProvider>
          </ThemeProvider>
      </body>
    </html>
  );
}
