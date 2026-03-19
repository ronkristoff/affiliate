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
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", activeTab);
    router.replace(
      `/admin/tenants/${tenant._id}?${params.toString()}`,
      { scroll: false }
    );
  }, [activeTab, router, searchParams, tenant._id]);

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
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1 text-sm text-[#6b7280]">
        <Link
          href="/admin/tenants"
          className="hover:text-[#10409a] transition-colors"
        >
          Tenants
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-[#333333]">{tenant.companyName}</span>
      </nav>

      {/* Alert Inset for Issues */}
      {alertIssues.length > 0 && (
        <AlertInset
          variant="danger"
          title={alertIssues[0].message}
          description={alertIssues[0].action}
          actionText="View Details"
          onAction={() => setTab("integrations")}
        />
      )}

      {/* Tenant Header */}
      <TenantHeader tenant={tenant} />

      {/* Stats Strip */}
      {stats && <TenantStatsStrip stats={stats} />}

      {/* Tabs */}
      <TenantTabs
        activeTab={activeTab}
        onTabChange={setTab}
        affiliatesCount={tenant.affiliateCount.total}
        notesCount={notesResult?.length ?? 0}
      />

      {/* Tab Content */}
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
    </div>
  );
}
