"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { RecentCommissionsTable } from "./RecentCommissionsTable";
import { PlanUsageCard } from "./PlanLimitsCard";
import { QuickActionsCard } from "./QuickActionsCard";

interface OverviewTabProps {
  tenant: {
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
  };
}

export function OverviewTab({ tenant }: OverviewTabProps) {
  const commissions = useQuery(api.admin.tenants.getTenantCommissions, {
    tenantId: tenant._id,
    limit: 10,
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <RecentCommissionsTable
          commissions={commissions?.commissions ?? []}
          isLoading={commissions === undefined}
          tenantId={tenant._id}
        />
      </div>

      <div className="space-y-6">
        <PlanUsageCard tenantId={tenant._id} />
        <QuickActionsCard tenantId={tenant._id} tenantName={tenant.companyName} />
      </div>
    </div>
  );
}
