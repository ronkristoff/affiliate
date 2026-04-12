"use client";

import { ReactNode, useEffect } from "react";
import { ConvexReactClient } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!, {
  verbose: false,
});

/**
 * Clear stale 2FA cookies when 2FA is disabled.
 *
 * When TWO_FACTOR_ENABLED was previously true, Better Auth sets a
 * __Secure-better-auth.two_factor cookie. Even after disabling the
 * twoFactor plugin, this cookie persists and causes ConvexBetterAuthProvider
 * to redirect to /verify-2fa on session restore.
 */
function clearStale2FACookies() {
  const cookiesToClear = [
    "__Secure-better-auth.two_factor",
    "better-auth.two_factor",
  ];
  for (const name of cookiesToClear) {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  }
}

/**
 * Inner provider that renders ConvexBetterAuthProvider.
 * This file is dynamically imported with ssr: false from ConvexClientProvider.tsx
 * to avoid Next.js 16's "uncached data outside Suspense" error during
 * static prerendering.
 */
export default function ConvexInnerProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_TWO_FACTOR_ENABLED !== "true") {
      clearStale2FACookies();
    }
  }, []);

  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      {children}
    </ConvexBetterAuthProvider>
  );
}
