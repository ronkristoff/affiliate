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
  const impersonationStatus = useQuery(api.admin.impersonation.getImpersonationStatus);
  const isImpersonating = !!impersonationStatus;

  const pathname = usePathname();
  const isAdmin = user && user.role === "admin";
  const isOnAdminRoute = pathname.startsWith("/tenants") || pathname.startsWith("/tiers");

  // Redirect platform admins to the admin panel (skip if already there)
  const handleAdminRedirect = useCallback(() => {
    if (isAdmin && !isOnAdminRoute) {
      router.replace("/tenants");
    }
  }, [isAdmin, isOnAdminRoute, router]);

  useEffect(() => {
    handleAdminRedirect();
  }, [handleAdminRedirect]);

  if (isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Auth gate: don't render children until the session is confirmed ──
  // Prevents child queries from firing before the auth session is ready,
  // which would cause "Unauthorized" errors from requireTenantId().
  // Show the layout skeleton directly (no white flash) while the session loads.
  if (user === undefined) {
    return <AuthLayoutSkeleton />;
  }

  return (
    <div className={`flex min-h-screen ${isImpersonating ? "pt-11" : ""}`}>
      {/* Impersonation Banner — fixed at top, offsets all content */}
      {isImpersonating && <ImpersonationBanner />}

      {/* Sidebar — uses the dark themed sidebar matching HTML design */}
      {!isImpersonating && <Sidebar />}

      {/* Main Content - offset by sidebar width */}
      <main className="flex-1 min-h-screen" style={{ marginLeft: 'var(--sidebar-width)' }}>
        <div className="min-h-screen">
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
        <Skeleton className="h-6 w-32 mx-5 my-6" />
      </div>

      {/* Main content skeleton */}
      <main className="flex-1 overflow-auto">
        <div className="px-8 pt-6 pb-8">
          <div className="space-y-6">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
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
