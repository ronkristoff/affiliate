"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AdminSidebar } from "./_components/AdminSidebar";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function AdminLayoutSkeleton() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar skeleton */}
      <div className="w-[240px] bg-[#022232] min-h-screen hidden md:block">
        <Skeleton className="h-6 w-32 mx-5 my-6" />
      </div>

      {/* Main content skeleton */}
      <main className="flex-1 overflow-auto" style={{ marginLeft: 240 }}>
        <div className="px-8 py-6">
          <div className="space-y-6">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useQuery(api.auth.getCurrentUser);

  // Redirect non-admins to dashboard via useEffect (React 19 / Next.js 16 requirement)
  useEffect(() => {
    if (user === null || (user && user.role !== "admin")) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  // Verify admin role at Convex layer
  if (user === undefined) {
    return <AdminLayoutSkeleton />;
  }

  if (user === null || user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Admin Sidebar — fixed, matching auth sidebar pattern */}
      <AdminSidebar />

      {/* Main Content — offset by sidebar width */}
      <main className="flex-1 min-h-screen" style={{ marginLeft: 240 }}>
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
