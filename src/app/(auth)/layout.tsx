"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/shared/Sidebar";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Toaster } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";

function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await authClient.signOut();
      router.push("/sign-in");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pt-2 border-t border-border/50">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        disabled={isLoading}
        className="flex items-center w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
        {isLoading ? "Signing out..." : "Sign out"}
      </Button>
    </div>
  );
}

function AuthLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useQuery(api.auth.getCurrentUser);
  const authenticatedUserType = useQuery(api.auth.getAuthenticatedUserType);
  const impersonationStatus = useQuery(api.admin.impersonation.getImpersonationStatus);
  const isImpersonating = !!impersonationStatus;

  const pathname = usePathname();
  const isAdmin = user && user.role === "admin";
  const isOnAdminRoute = pathname.startsWith("/tenants") || pathname.startsWith("/tiers") || pathname.startsWith("/revenue") || pathname.startsWith("/audit") || pathname.startsWith("/admin-settings");

  // Redirect platform admins to the admin panel (skip if already there)
  const handleAdminRedirect = useCallback(() => {
    if (isAdmin && !isOnAdminRoute) {
      router.replace("/tenants");
    }
  }, [isAdmin, isOnAdminRoute, router]);

  useEffect(() => {
    handleAdminRedirect();
  }, [handleAdminRedirect]);

  // Redirect affiliate users who land on owner pages to the affiliate portal
  // Only redirect when BOTH queries have resolved (not undefined) to avoid
  // acting on stale data after logout while queries are still loading.
  useEffect(() => {
    if (
      user === null &&
      authenticatedUserType !== undefined &&
      authenticatedUserType?.type === "affiliate"
    ) {
      router.replace(`/portal/login?tenant=${authenticatedUserType.tenantSlug}`);
    }
  }, [user, authenticatedUserType, router]);

  if (isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Auth gate: don't render children until the session is confirmed ──
  // Block on both `undefined` (query loading) and `null` (Convex auth token not
  // yet exchanged — happens on hard refresh before ConvexProviderWithAuth has
  // fetched the JWT from Better Auth).
  //
  // Exception: if we've confirmed the user is an affiliate, show the skeleton
  // briefly while the redirect kicks in (handled by the useEffect above).
  if (!user) {
    return <AuthLayoutSkeleton />;
  }

  return (
    <div className={`flex min-h-screen ${isImpersonating ? "pt-11" : ""}`}>
      {/* Impersonation Banner — fixed at top, offsets all content */}
      {isImpersonating && <ImpersonationBanner />}

      {/* Sidebar */}
      {!isImpersonating && <Sidebar />}

      {/* Main Content */}
      <main
        className="flex-1 min-h-screen transition-[margin-left] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
        style={{ marginLeft: 'var(--sidebar-width)' }}
      >
        <div className="min-h-screen animate-content-in">
          {children}
        </div>
      </main>

      <Toaster />
    </div>
  );
}

function AuthLayoutSkeleton() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar skeleton */}
      <div className="w-[var(--sidebar-width)] bg-[var(--brand-dark)] min-h-screen hidden md:block">
        {/* Logo area */}
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/[0.08] rounded-lg animate-pulse" />
            <Skeleton className="h-4 w-28 bg-white/[0.06]" />
          </div>
        </div>

        {/* Tenant area */}
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/[0.08] rounded-lg animate-pulse" />
            <div>
              <Skeleton className="h-3 w-24 bg-white/[0.06] mb-1.5" />
              <Skeleton className="h-2 w-16 bg-white/[0.04]" />
            </div>
          </div>
        </div>

        {/* Nav skeleton */}
        <div className="px-3 py-3">
          <div className="mb-4">
            <Skeleton className="h-2 w-12 bg-white/[0.06] mb-2 mx-3" />
            <div className="space-y-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-9 bg-white/[0.04] rounded-lg mx-0" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main content skeleton */}
      <main className="flex-1 overflow-auto">
        <div className="page-content">
          {/* PageTopbar skeleton */}
          <div className="sticky top-0 z-50 bg-[var(--bg-surface)] border-b border-[var(--border-light)] px-8 h-[60px] flex items-center">
            <div className="flex items-center justify-between w-full gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Skeleton className="h-5 w-32" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-24 rounded-md" />
                  <Skeleton className="h-8 w-36 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-8 w-8 rounded-md shrink-0" />
            </div>
          </div>

          <div className="pt-6">
            {/* Metric cards skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-light)]">
                  <div className="flex items-start justify-between mb-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-9 w-9 rounded-full" />
                  </div>
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>

            {/* Main content grid skeleton */}
            <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 340px" }}>
              {/* Left column */}
              <div className="space-y-6">
                <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[var(--border-light)] flex items-center justify-between">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-8 w-20 rounded-md" />
                  </div>
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-10 w-full rounded-md" />
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-md" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-6">
                <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)] p-5">
                  <Skeleton className="h-4 w-24 mb-4" />
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full rounded-md" />
                    ))}
                  </div>
                </div>
                <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)] p-5">
                  <Skeleton className="h-4 w-28 mb-4" />
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-start gap-3">
                        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                        <div className="flex-1">
                          <Skeleton className="h-3 w-32 mb-1" />
                          <Skeleton className="h-2 w-48" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AuthLayoutSkeleton />}>
      <AuthLayoutContent>{children}</AuthLayoutContent>
    </Suspense>
  );
}
