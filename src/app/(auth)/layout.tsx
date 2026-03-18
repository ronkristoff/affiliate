"use client";

import { SidebarNav } from "@/components/shared/SidebarNav";
import { UserProfile } from "@/components/server";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Toaster } from "sonner";

export default function AuthLayout({
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

      {/* Sidebar — hidden during impersonation per AC#9 */}
      {!isImpersonating && (
        <aside className="w-64 border-r bg-background px-4 py-6 hidden md:flex md:flex-col">
          <div className="mb-8">
            <h1 className="text-xl font-bold">Salig Affiliate</h1>
          </div>
          
          <SidebarNav />
          
          <div className="mt-auto pt-6 border-t">
            <UserProfile user={user} />
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
      
      <Toaster />
    </div>
  );
}
