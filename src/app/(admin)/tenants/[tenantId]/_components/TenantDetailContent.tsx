"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { TenantHeader } from "./TenantHeader";
import { AlertInset } from "./AlertInset";
import { TenantStatsStrip } from "./TenantStatsStrip";
import { TenantTabs } from "./TenantTabs";
import { OverviewTab } from "./OverviewTab";
import { AffiliatesTab } from "./AffiliatesTab";
import { PayoutsTab } from "./PayoutsTab";
import { IntegrationsTab } from "./IntegrationsTab";
import { NotesTab } from "./NotesTab";
import { AuditLogTab } from "./AuditLogTab";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { ChevronRight } from "lucide-react";

const TABS = ["overview", "affiliates", "payouts", "integrations", "notes", "audit"] as const;
type Tab = (typeof TABS)[number];

interface TenantDetail {
  _id: Id<"tenants">;
  companyName: string;
  domain: string | undefined;
  ownerEmail: string;
  ownerName: string | undefined;
  plan: string;
  status: string;
  createdAt: number;
  saligPayStatus: string | undefined;
  saligPayExpiresAt: number | undefined;
  affiliateCount: {
    total: number;
    active: number;
    pending: number;
    flagged: number;
  };
  totalCommissions: number;
  mrrInfluenced: number;
  isFlagged: boolean;
  flagReasons: string[];
}

interface TenantDetailContentProps {
  tenant: TenantDetail;
}

export function TenantDetailContent({ tenant }: TenantDetailContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(
    (searchParams.get("tab") as Tab) || "overview"
  );

  // Sync tab to URL
  // Note: searchParams is intentionally excluded from deps to avoid an infinite loop.
  // When router.replace updates the URL, useSearchParams returns a new reference,
  // which would re-trigger this effect endlessly if listed as a dependency.
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", activeTab);
    router.replace(
      `/tenants/${tenant._id}?${params.toString()}`,
      { scroll: false }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, tenant._id]);

  const setTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
  }, []);

  // Fetch stats and notes count for tabs
  const stats = useQuery(api.admin.tenants.getTenantStats, {
    tenantId: tenant._id,
  });
  const notesResult = useQuery(api.admin.tenants.getTenantAdminNotes, {
    tenantId: tenant._id,
  });

  // Determine alert issues
  const alertIssues: { type: string; message: string; action: string }[] = [];
  if (tenant.saligPayStatus === "error") {
    alertIssues.push({
      type: "saligpay",
      message: "SaligPay connection lost",
      action: "Credentials have expired. Commission tracking may be affected.",
    });
  }
  if (tenant.affiliateCount.flagged > 0) {
    alertIssues.push({
      type: "fraud",
      message: "High fraud signals detected",
      action: `${tenant.affiliateCount.flagged} affiliate(s) have unreviewed high-severity fraud signals.`,
    });
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top Bar with Breadcrumb */}
      <PageTopbar description={`${tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)} plan · ${tenant.affiliateCount.total} affiliates`}>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/tenants"
            className="text-[var(--text-muted)] hover:text-[#10409a] transition-colors"
          >
            Tenants
          </Link>
          <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
          <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
            {tenant.companyName}
          </h1>
        </nav>
      </PageTopbar>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8">
        <div className="space-y-6">
          {/* Alert Inset for Issues */}
          {alertIssues.length > 0 && (
            <FadeIn delay={0}>
              <AlertInset
                variant="danger"
                title={alertIssues[0].message}
                description={alertIssues[0].action}
                actionText="View Details"
                onAction={() => setTab("integrations")}
              />
            </FadeIn>
          )}

          {/* Tenant Header */}
          <FadeIn delay={0}>
            <TenantHeader tenant={tenant} />
          </FadeIn>

          {/* Stats Strip */}
          {stats && (
            <FadeIn delay={80}>
              <TenantStatsStrip stats={stats} />
            </FadeIn>
          )}

          {/* Tabs */}
          <FadeIn delay={120}>
            <TenantTabs
              activeTab={activeTab}
              onTabChange={setTab}
              affiliatesCount={tenant.affiliateCount.total}
              notesCount={notesResult?.length ?? 0}
            />
          </FadeIn>

          {/* Tab Content */}
          <FadeIn delay={160}>
            <div>
              {activeTab === "overview" && <OverviewTab tenant={tenant} />}
              {activeTab === "affiliates" && (
                <AffiliatesTab tenantId={tenant._id} />
              )}
              {activeTab === "payouts" && (
                <PayoutsTab tenantId={tenant._id} />
              )}
              {activeTab === "integrations" && (
                <IntegrationsTab tenant={tenant} />
              )}
              {activeTab === "notes" && (
                <NotesTab tenantId={tenant._id} />
              )}
              {activeTab === "audit" && (
                <AuditLogTab tenantId={tenant._id} />
              )}
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
