"use client";

import { Suspense, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { SuspendDialog } from "@/components/affiliate/SuspendDialog";
import { ReactivateDialog } from "@/components/affiliate/ReactivateDialog";
import { AffiliateProfileHero } from "@/components/affiliate/AffiliateProfileHero";
import { ReferralMetricsGrid } from "@/components/affiliate/ReferralMetricsGrid";
import { ReferralLinksSection } from "@/components/affiliate/ReferralLinksSection";
import { CommissionHistoryList } from "@/components/affiliate/CommissionHistoryList";
import { FraudSignalsSection } from "@/components/affiliate/FraudSignalsSection";
import { InternalNotesTextarea } from "@/components/affiliate/InternalNotesTextarea";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Skeleton fallback for Suspense boundary
// ---------------------------------------------------------------------------

function AffiliateDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Topbar skeleton */}
      <div className="px-8 pt-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      </div>

      {/* Profile hero skeleton (includes profile info row) */}
      <div className="px-8 pt-4">
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>

      {/* Metric cards skeleton */}
      <div className="px-8 pt-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Main content grid skeleton */}
      <div className="px-8 pt-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner content (hooks live here, wrapped by Suspense)
// ---------------------------------------------------------------------------

function AffiliateDetailContent() {
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
      toast.error(getErrorMessage(error, "Failed to suspend affiliate"));
    }
  };

  const handleReactivate = async () => {
    try {
      await reactivateAffiliate({ affiliateId });
      toast.success(`${affiliate?.name || "Affiliate"} has been reactivated`);
      setShowReactivateDialog(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to reactivate affiliate"));
    }
  };

  const handleSaveNote = async (noteValue: string | undefined) => {
    await updateNote({ affiliateId, note: noteValue });
    toast.success("Note saved successfully");
  };

  // Fraud signal handlers
  const handleDismissFraudSignal = async (signalId: string, note?: string) => {
    try {
      await dismissFraudSignal({ affiliateId, signalId, note });
      toast.success("Fraud signal dismissed successfully");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to dismiss fraud signal"));
      throw error; // Re-throw to let the component handle the error state
    }
  };

  const handleSuspendFromFraudSignal = async (reason?: string) => {
    try {
      await suspendFromFraudSignal({ affiliateId, reason });
      toast.success(`${affiliate?.name || "Affiliate"} has been suspended`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to suspend affiliate"));
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
      <div className="min-h-screen bg-[var(--bg-page)]">
        <PageTopbar description="Loading affiliate details...">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/affiliates">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
          <div />
        </PageTopbar>
      </div>
    );
  }

  // Not found state
  if (affiliate === null) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)]">
        <PageTopbar description="Affiliate not found">
          <div />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/affiliates">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Affiliates
            </Link>
          </Button>
        </PageTopbar>
        <div className="px-8 pt-6">
          <div className="card">
            <div className="text-center py-16 px-6">
              <AlertTriangle className="mx-auto h-12 w-12 text-[var(--danger)] mb-4" />
              <h2 className="text-[17px] font-bold text-[var(--text-heading)] mb-2">Affiliate Not Found</h2>
              <p className="text-[13px] text-[var(--text-muted)]">
                The affiliate you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isActive = affiliate.status === "active";
  const isSuspended = affiliate.status === "suspended";

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top Bar */}
      <PageTopbar description={`${affiliate.name} · ${affiliate.email}`}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/affiliates">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Affiliates
            </Link>
          </Button>
          <h1 className="text-[17px] font-bold text-[var(--text-heading)]">{affiliate.name}</h1>
        </div>
      </PageTopbar>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8">
        {/* Profile Hero */}
        <AffiliateProfileHero
          name={affiliate.name}
          email={affiliate.email}
          uniqueCode={affiliate.uniqueCode}
          joinDate={affiliate._creationTime}
          status={affiliate.status}
          payoutMethod={affiliate.payoutMethod}
          canManage={canManageAffiliates}
          isActive={isActive}
          isSuspended={isSuspended}
          onSuspend={() => setShowSuspendDialog(true)}
          onReactivate={() => setShowReactivateDialog(true)}
        />

        {/* Stats Grid */}
        <div className="mt-6">
          <ReferralMetricsGrid stats={stats} />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Profile & Notes Column */}
          <div className="space-y-6">
            <InternalNotesTextarea
              note={affiliate.note}
              onSave={handleSaveNote}
              canManage={canManageAffiliates}
            />
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Referral Links Section */}
            <ReferralLinksSection 
              affiliateId={affiliateId}
              canManage={canManageAffiliates}
              affiliateName={affiliate.name}
            />

            {/* Fraud Signals Section */}
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
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Activity Timeline</h3>
              </div>
              <div className="p-5">
                <ActivityTimeline activities={auditLog} />
              </div>
            </div>
          </div>
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

// ---------------------------------------------------------------------------
// Default export — wraps inner content in Suspense for Next.js 16 streaming
// ---------------------------------------------------------------------------

export default function AffiliateDetailPage() {
  return (
    <Suspense fallback={<AffiliateDetailSkeleton />}>
      <AffiliateDetailContent />
    </Suspense>
  );
}
