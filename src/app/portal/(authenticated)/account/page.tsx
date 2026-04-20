"use client";

import { Suspense } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileSection } from "./components/ProfileSection";
import { PayoutSection } from "./components/PayoutSection";
import { PasswordSection } from "./components/PasswordSection";

function AccountPageContent() {
  // ── Auth: use Better Auth session via getCurrentAffiliate query ──
  const affiliate = useQuery(api.affiliateAuth.getCurrentAffiliate);
  const isAuthenticated = affiliate !== null && affiliate !== undefined;

  // Mutations
  const updateProfile = useMutation(api.affiliateAuth.updateMyAffiliateProfile);

  if (!isAuthenticated || affiliate === undefined) {
    return null;
  }

  const handleUpdatePayoutMethod = async (payoutMethod: { type: string; details: string }) => {
    return await updateProfile({ payoutMethod });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Account Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          View and manage your affiliate account information
        </p>
      </div>

      <Separator />

      {/* Profile Information */}
      <ProfileSection
        name={affiliate.name}
        email={affiliate.email}
        referralCode={affiliate.uniqueCode}
        status={affiliate.status}
      />

      {/* Payout Method */}
      <PayoutSection
        payoutMethod={affiliate.payoutMethod}
        payoutMethodLastDigits={affiliate.payoutMethodLastDigits}
        onUpdate={handleUpdatePayoutMethod}
      />

      {/* Password */}
      <PasswordSection />

      {/* Help / Contact */}
      <Card>
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground text-center">
            Need help? Contact your program administrator for account changes that aren&apos;t available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Skeleton className="h-8 w-40 rounded" />
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}

export default function PortalAccountPage() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountPageContent />
    </Suspense>
  );
}
