"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Id } from "@/convex/_generated/dataModel";
import { AdminBillingHistoryTable } from "./AdminBillingHistoryTable";
import { AdminSubscriptionActions } from "./AdminSubscriptionActions";
import type { TenantDetail } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BillingTabProps {
  tenantId: Id<"tenants">;
  tenant: TenantDetail;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function BillingTabSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Skeleton className="h-[200px] rounded-xl" />
      </div>
      <div>
        <Skeleton className="h-[200px] rounded-xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BillingTab({ tenantId, tenant }: BillingTabProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Suspense fallback={<Skeleton className="h-[200px] rounded-xl" />}>
          <AdminBillingHistoryTable tenantId={tenantId} />
        </Suspense>
      </div>
      <div>
        <Suspense fallback={<Skeleton className="h-[200px] rounded-xl" />}>
          <AdminSubscriptionActions tenantId={tenantId} tenant={tenant} />
        </Suspense>
      </div>
    </div>
  );
}
