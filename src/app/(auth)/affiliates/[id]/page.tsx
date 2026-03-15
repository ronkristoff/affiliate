"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { SuspendDialog } from "@/components/affiliate/SuspendDialog";
import { ReactivateDialog } from "@/components/affiliate/ReactivateDialog";
import { AffiliateProfileHero } from "@/components/affiliate/AffiliateProfileHero";
import { ReferralMetricsGrid } from "@/components/affiliate/ReferralMetricsGrid";
import { ReferralLinksSection } from "@/components/affiliate/ReferralLinksSection";
import { CommissionHistoryList } from "@/components/affiliate/CommissionHistoryList";
import { FraudSignalsSection } from "@/components/affiliate/FraudSignalsSection";
import { InternalNotesTextarea } from "@/components/affiliate/InternalNotesTextarea";
import { ProfileInformation } from "@/components/affiliate/ProfileInformation";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";

export default function AffiliateDetailPage() {
  const params = useParams();
  const affiliateId = params.id as Id<"affiliates">;

  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);

  // Get current user for RBAC
  const currentUser = useQuery(api.auth.getCurrentUser);
  const canManageAffiliates = currentUser?.role === "owner" || currentUser?.role === "manager";

  // Queries
  const affiliate = useQuery(api.affiliates.getAffiliate, { affiliateId });
  const stats = useQuery(api.affiliates.getAffiliateStats, { affiliateId });
  const auditLog = useQuery(api.affiliates.getAffiliateAuditLog, { 
    affiliateId,
    limit: 20 
  }) || [];
  const commissions = useQuery(api.commissions.getAffiliateCommissions, { 
    affiliateId,
    limit: 10 
  }) || [];

  // Mutations
  const suspendAffiliate = useMutation(api.affiliates.suspendAffiliate);
  const reactivateAffiliate = useMutation(api.affiliates.reactivateAffiliate);
  const updateNote = useMutation(api.affiliates.updateAffiliateNote);
  const dismissFraudSignal = useMutation(api.fraudSignals.dismissFraudSignal);
  const suspendFromFraudSignal = useMutation(api.fraudSignals.suspendAffiliateFromFraudSignal);

  const handleSuspend = async (reason: string) => {
    try {
      await suspendAffiliate({ affiliateId, reason });
      toast.success(`${affiliate?.name || "Affiliate"} has been suspended`);
      setShowSuspendDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to suspend affiliate");
    }
  };

  const handleReactivate = async () => {
    try {
      await reactivateAffiliate({ affiliateId });
      toast.success(`${affiliate?.name || "Affiliate"} has been reactivated`);
      setShowReactivateDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reactivate affiliate");
    }
  };

  const handleSaveNote = async (noteValue: string | undefined) => {
    await updateNote({ affiliateId, note: noteValue });
    toast.success("Note saved successfully");
  };

  // Fraud signal handlers
  const handleDismissFraudSignal = async (signalIndex: number, note?: string) => {
    try {
      await dismissFraudSignal({ affiliateId, signalIndex, note });
      toast.success("Fraud signal dismissed successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to dismiss fraud signal");
      throw error; // Re-throw to let the component handle the error state
    }
  };

  const handleSuspendFromFraudSignal = async (reason?: string) => {
    try {
      await suspendFromFraudSignal({ affiliateId, reason });
      toast.success(`${affiliate?.name || "Affiliate"} has been suspended`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to suspend affiliate");
      throw error;
    }
  };

  const handleViewCommission = (commissionId: string) => {
    // Navigate to commission detail or open modal
    // For now, just log it - can be enhanced later
    console.log("View commission:", commissionId);
    toast.info("Commission detail view coming soon");
  };

  // Loading state
  if (affiliate === undefined) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading affiliate details...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not found state
  if (affiliate === null) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Affiliate Not Found</h2>
              <p className="text-muted-foreground mb-4">
                The affiliate you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
              </p>
              <Button asChild>
                <Link href="/affiliates">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Affiliates
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isActive = affiliate.status === "active";
  const isSuspended = affiliate.status === "suspended";

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Back button */}
      <Button variant="ghost" asChild className="mb-2">
        <Link href="/affiliates">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Affiliates
        </Link>
      </Button>

      {/* Header Card */}
      <AffiliateProfileHero
        name={affiliate.name}
        joinDate={affiliate._creationTime}
        status={affiliate.status}
        canManage={canManageAffiliates}
        isActive={isActive}
        isSuspended={isSuspended}
        onSuspend={() => setShowSuspendDialog(true)}
        onReactivate={() => setShowReactivateDialog(true)}
      />

      {/* Stats Grid - Mobile Responsive */}
      <ReferralMetricsGrid stats={stats} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile & Notes Column */}
        <div className="space-y-6">
          <ProfileInformation
            email={affiliate.email}
            uniqueCode={affiliate.uniqueCode}
            payoutMethod={affiliate.payoutMethod}
          />

          <InternalNotesTextarea
            note={affiliate.note}
            onSave={handleSaveNote}
            canManage={canManageAffiliates}
          />
        </div>

        {/* Commission History Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Referral Links Section */}
          <ReferralLinksSection 
            affiliateId={affiliateId}
            canManage={canManageAffiliates}
            affiliateName={affiliate.name}
          />

          {/* Fraud Signals Section - Positioned above commission history */}
          <FraudSignalsSection 
            fraudSignals={affiliate.fraudSignals as any}
            affiliateId={affiliateId}
            affiliateName={affiliate.name}
            onViewCommission={handleViewCommission}
            onDismissSignal={canManageAffiliates ? handleDismissFraudSignal : undefined}
            onSuspendAffiliate={canManageAffiliates ? handleSuspendFromFraudSignal : undefined}
            canManage={canManageAffiliates}
          />

          <CommissionHistoryList commissions={commissions} />

          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline activities={auditLog} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Suspend Dialog */}
      <SuspendDialog
        isOpen={showSuspendDialog}
        onClose={() => setShowSuspendDialog(false)}
        onConfirm={handleSuspend}
        affiliateName={affiliate.name}
      />

      {/* Reactivate Dialog */}
      <ReactivateDialog
        isOpen={showReactivateDialog}
        onClose={() => setShowReactivateDialog(false)}
        onConfirm={handleReactivate}
        affiliateName={affiliate.name}
      />
    </div>
  );
}
