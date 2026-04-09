"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PortalHeader } from "@/components/affiliate/PortalHeader";
import { PortalBottomNav } from "@/components/affiliate/PortalBottomNav";
import { PortalSidebar } from "@/components/affiliate/PortalSidebar";
import { ProfileSection } from "./components/ProfileSection";
import { PayoutSection } from "./components/PayoutSection";
import { PasswordSection } from "./components/PasswordSection";

export default function PortalAccountPage() {
  const router = useRouter();

  // ── Auth: use Better Auth session via getCurrentAffiliate query ──
  const affiliate = useQuery(api.affiliateAuth.getCurrentAffiliate);
  const isLoading = affiliate === undefined;
  const isAuthenticated = affiliate !== null && affiliate !== undefined;

  // Mutations
  const updateProfile = useMutation(api.affiliateAuth.updateMyAffiliateProfile);
  const changePassword = useMutation(api.affiliateAuth.changeAffiliatePassword);

  // Redirect unauthenticated affiliates to portal login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/portal/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Get tenant branding from the authenticated affiliate
  const primaryColor = affiliate?.tenant?.branding?.primaryColor || "#1c2260";
  const portalName = affiliate?.tenant?.branding?.portalName || affiliate?.tenant?.name || "Affiliate Portal";
  const tenantLogo = affiliate?.tenant?.branding?.logoUrl;

  const handleUpdatePayoutMethod = async (payoutMethod: { type: string; details: string }) => {
    return await updateProfile({ payoutMethod });
  };

  const handleChangePassword = async (affiliateId: string, currentPassword: string, newPassword: string) => {
    return await changePassword({ affiliateId: affiliateId as Id<"affiliates">, currentPassword, newPassword });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Portal Header - Tenant Branded */}
      <PortalHeader
        logoUrl={tenantLogo}
        portalName={portalName}
        primaryColor={primaryColor}
        pageTitle="Account"
        pageDescription="Manage your profile and settings"
      />

      {/* Main Content Area */}
      <div className="flex">
        {/* Desktop Sidebar */}
        <PortalSidebar
          portalName={portalName}
          primaryColor={primaryColor}
          currentPath="/portal/account"
        />

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-20 md:pb-6">
          <div className="max-w-xl mx-auto space-y-6">
            {/* Page Title */}
            <div>
              <h1 className="text-xl font-extrabold text-gray-900">Account Settings</h1>
              <p className="text-sm text-muted-foreground mt-1">
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
              primaryColor={primaryColor}
            />

            {/* Payout Method */}
            <PayoutSection
              payoutMethod={affiliate.payoutMethod}
              payoutMethodLastDigits={affiliate.payoutMethodLastDigits}
              primaryColor={primaryColor}
              onUpdate={handleUpdatePayoutMethod}
            />

            {/* Password */}
            <PasswordSection
              affiliateId={affiliate._id}
              onChangePassword={handleChangePassword}
              primaryColor={primaryColor}
            />

            {/* Help / Contact */}
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground text-center">
                  Need help? Contact your program administrator for account changes that aren&apos;t available here.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <PortalBottomNav
        portalName={portalName}
        primaryColor={primaryColor}
        currentPath="/portal/account"
      />
    </div>
  );
}
