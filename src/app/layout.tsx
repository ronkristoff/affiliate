import type { Metadata } from "next";
import { Poppins, Passion_One } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/next-theme/theme-provider";

import { ConvexClientProvider } from "./ConvexClientProvider";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { getToken } from "@/lib/auth-server";

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
  title: "Affilio",
  description: "Affiliate program management with SaligPay integration",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

// Decode JWT payload without a library (JWT is base64url-encoded)
function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString()
    );
    if (payload.exp == null) return true; // missing exp → treat as expired
    return payload.exp * 1000 < Date.now();
  } catch {
    return true; // Malformed token — treat as expired
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const token = await getToken();
  const initialToken = isTokenExpired(token ?? null) ? null : token ?? null;

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
             <ConvexClientProvider initialToken={initialToken}>
               <NuqsAdapter defaultOptions={{ clearOnDefault: true }}>
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
