import type { Metadata } from "next";
import { Poppins, Passion_One } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/next-theme/theme-provider";
import { Footer } from "@/components/footer";

import { ConvexClientProvider } from "./ConvexClientProvider";

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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${passionOne.variable} min-h-[calc(100vh-2rem)] flex flex-col gap-4 antialiased font-sans`}
      >
         <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ConvexClientProvider>
            <main className=" px-2 md:px-4 grow flex flex-col">
            
              {children}
            </main>
            <Footer />
            </ConvexClientProvider>
            
          </ThemeProvider>
      </body>
    </html>
  );
}
