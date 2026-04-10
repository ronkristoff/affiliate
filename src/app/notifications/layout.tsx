"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AdminSidebar } from "@/app/(admin)/_components/AdminSidebar";
import { Sidebar } from "@/components/shared/Sidebar";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "sonner";

/**
 * Layout for /notifications — shared between owners and admins.
 *
 * Detects the user's role and renders the appropriate sidebar:
 * - Admin users → AdminSidebar (fixed 240px)
 * - Owner users → collapsible Sidebar (CSS var --sidebar-width)
 * - Loading → skeleton matching the wider layout
 */
export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useQuery(api.auth.getCurrentUser);

  // Loading state — show skeleton
  if (user === undefined) {
    return (
      <div className="flex min-h-screen">
        <div className="w-[240px] bg-[var(--brand-dark)] min-h-screen hidden md:block">
          <Skeleton className="h-6 w-32 mx-5 my-6" />
        </div>
        <main className="flex-1">
          <div className="sticky top-0 z-50 bg-[var(--bg-surface)] border-b border-[var(--border-light)] px-8 h-[60px] flex items-center">
            <Skeleton className="h-5 w-32" />
          </div>
        </main>
      </div>
    );
  }

  // Unauthenticated — redirect will happen via page component
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <>
      <div className="flex min-h-screen">
        {isAdmin ? (
          <>
            <AdminSidebar />
            <main className="flex-1 min-h-screen" style={{ marginLeft: 240 }}>
              <div className="min-h-screen">{children}</div>
            </main>
          </>
        ) : (
          <>
            <Sidebar />
            <main
              className="flex-1 min-h-screen transition-[margin-left] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
              style={{ marginLeft: 'var(--sidebar-width)' }}
            >
              <div className="min-h-screen animate-content-in">{children}</div>
            </main>
          </>
        )}
      </div>
      <Toaster />
    </>
  );
}
