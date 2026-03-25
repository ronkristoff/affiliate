"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";
import { Toaster } from "sonner";
import {
  AppHeader,
  AppNav,
  SettingsButton,
  SettingsButtonContent,
  UserProfile,
} from "@/components/server";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { SignOutButton } from "@/components/client";
import { TrackingNotVerifiedBanner } from "@/components/dashboard/TrackingNotVerifiedBanner";
import { Users, Bell } from "lucide-react";

// Header Component - Shows user profile and navigation (client-side)
const Header = () => {
  const router = useRouter();
  const user = useQuery(api.auth.getCurrentUser);
  const [signOutLoading, setSignOutLoading] = useState(false);

  const handleSignOut = async () => {
    setSignOutLoading(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/sign-in");
        },
        onError: () => {
          setSignOutLoading(false);
        },
      },
    });
  };

  return (
    <AppHeader>
      <UserProfile user={user} />
      <AppNav>
        <SettingsButton>
          <Link href="/settings">
            <SettingsButtonContent />
          </Link>
        </SettingsButton>
        <SignOutButton onClick={handleSignOut} loading={signOutLoading} />
      </AppNav>
    </AppHeader>
  );
};

// Quick Links with pending count
const QuickLinks = () => {
  const counts = useQuery(api.affiliates.getAffiliateCountByStatus, {}) || {
    pending: 0,
    active: 0,
    suspended: 0,
    rejected: 0,
  };

  return (
    <div className="flex gap-4">
      <Link
        href="/affiliates?tab=pending"
        className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted/50 transition-colors"
      >
        <Users className="h-4 w-4" />
        <span>Affiliates</span>
        {counts.pending > 0 && (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-medium text-white">
            {counts.pending}
          </span>
        )}
      </Link>
    </div>
  );
};

// Dynamic welcome section
const WelcomeSection = () => {
  const user = useQuery(api.auth.getCurrentUser);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user?.name || user?.email || "User"}
        </p>
      </div>
      <QuickLinks />
    </div>
  );
};

// Client wrapper for dashboard
export function DashboardClient({ children }: { children: React.ReactNode }) {
  const user = useQuery(api.auth.getCurrentUser);
  const trackingVerified = !!user?.tenant?.trackingVerifiedAt;

  return (
    <>
      <Header />
      <div className="space-y-8">
        <WelcomeSection />
        <TrackingNotVerifiedBanner isVerified={trackingVerified} />
        {children}
      </div>
      <Toaster />
    </>
  );
}
