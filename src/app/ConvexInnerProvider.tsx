"use client";

import { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!, {
  verbose: false,
});

/**
 * Inner provider that renders ConvexBetterAuthProvider.
 * This file is dynamically imported with ssr: false from ConvexClientProvider.tsx
 * to avoid Next.js 16's "uncached data outside Suspense" error during
 * static prerendering.
 */
export default function ConvexInnerProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      {children}
    </ConvexBetterAuthProvider>
  );
}
