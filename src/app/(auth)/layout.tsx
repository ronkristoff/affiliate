"use client";

import { Suspense, useState } from "react";
import { Sidebar } from "@/components/shared/Sidebar";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Toaster } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

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
      <button
        onClick={handleLogout}
        disabled={isLoading}
        className="flex items-center w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
      >
        <LogOut className="mr-2 h-4 w-4" />
        {isLoading ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}

function AuthLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useQuery(api.auth.getCurrentUser);
  const impersonationStatus = useQuery(api.admin.impersonation.getImpersonationStatus);
  const isImpersonating = !!impersonationStatus;

  return (
    <div className={`flex min-h-screen ${isImpersonating ? "pt-11" : ""}`}>
      {/* Impersonation Banner — fixed at top, offsets all content */}
      {isImpersonating && <ImpersonationBanner />}

      {/* Sidebar — uses the dark themed sidebar matching HTML design */}
      {!isImpersonating && <Sidebar />}

      {/* Main Content - offset by sidebar width */}
      <main className="flex-1 min-h-screen" style={{ marginLeft: 240 }}>
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
      <div className="w-[240px] bg-[#022232] min-h-screen hidden md:block">
        <Skeleton className="h-6 w-32 mx-5 my-6" />
      </div>

      {/* Main content skeleton */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">
          <div className="space-y-6">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
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
