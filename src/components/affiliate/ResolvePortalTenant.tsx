"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, LogIn } from "lucide-react";
import Link from "next/link";

/**
 * Client component that resolves the correct tenant slug for an affiliate
 * visiting /portal/login without a ?tenant= query parameter.
 *
 * Uses the Convex auth session (Better Auth) to look up the authenticated
 * user's type and redirect to the appropriate destination:
 *
 * - Authenticated affiliate → /portal/login?tenant=<slug>
 * - Authenticated owner    → /dashboard
 * - Not authenticated       → show sign-in prompt
 */
export function ResolvePortalTenant() {
  const router = useRouter();
  const userType = useQuery(api.auth.getAuthenticatedUserType);

  useEffect(() => {
    // Wait until the query has resolved (not loading)
    if (userType === undefined) return;

    if (userType?.type === "affiliate") {
      router.replace(`/portal/login?tenant=${userType.tenantSlug}`);
    } else if (userType?.type === "owner") {
      router.replace("/dashboard");
    }
    // If null (not authenticated), we stay and show the sign-in prompt below
  }, [userType, router]);

  // Still loading
  if (userType === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not authenticated — show a helpful sign-in prompt
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="animate-stagger-1 text-center space-y-6 max-w-md">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[#1c2260] flex items-center justify-center">
          <LogIn className="w-8 h-8 text-white" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-heading">Affiliate Portal</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to access your affiliate dashboard. You&apos;ll be
            automatically directed to the right program.
          </p>
        </div>
        <Link
          href="/sign-in"
          className="inline-flex items-center justify-center h-11 px-8 rounded-lg bg-[#1c2260] text-white text-sm font-semibold hover:bg-[#1fb5a5] hover:shadow-[0_4px_14px_rgba(28,34,96,0.3)] transition-all"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
