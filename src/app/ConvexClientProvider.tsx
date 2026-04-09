"use client";

import { ReactNode } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton fallback shown while the Convex provider loads client-side.
 */
function AuthSkeleton() {
  return (
    <div className="flex-1 flex flex-col">
      <Skeleton className="h-16 w-full" />
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

/**
 * Convex client provider with Better Auth integration.
 *
 * Uses dynamic import with ssr: false to avoid Next.js 16's
 * "uncached data outside Suspense" error during static prerendering.
 * ConvexBetterAuthProvider restores the session on mount by reading
 * Better Auth cookies via the authClient.
 */
export const ConvexClientProvider = dynamic(
  () => import("./ConvexInnerProvider"),
  {
    ssr: false,
    loading: () => <AuthSkeleton />,
  },
);
