"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { RecentCommissionsTable } from "./RecentCommissionsTable";
import { PlanUsageCard } from "./PlanLimitsCard";
import { QuickActionsCard } from "./QuickActionsCard";
import { SubscriptionSummaryCard } from "./SubscriptionSummaryCard";
import type { TenantDetail } from "./types";

interface OverviewTabProps {
  tenant: TenantDetail;
}

export function OverviewTab({ tenant }: OverviewTabProps) {
  const commissions = useQuery(api.admin.tenants.getTenantCommissions, {
    tenantId: tenant._id,
    paginationOpts: { numItems: 10, cursor: null },
  });

  return (
    <div className="space-y-6">
      <SubscriptionSummaryCard tenant={tenant} />
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
    </div>
  );
}
