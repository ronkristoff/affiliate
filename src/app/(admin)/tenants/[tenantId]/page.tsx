"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Suspense } from "react";
import { LoadingSkeleton } from "./_components/LoadingSkeleton";
import { NotFoundState } from "./_components/NotFoundState";
import { TenantDetailContent } from "./_components/TenantDetailContent";
import { Loader2 } from "lucide-react";

export default function TenantDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <TenantDetailInner />
    </Suspense>
  );
}

function TenantDetailInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantId = params.tenantId as Id<"tenants">;

  const tenant = useQuery(api.admin.tenants.getTenantDetails, { tenantId });

  // Handle not found
  if (tenant === null) {
    return <NotFoundState />;
  }

  // Loading state
  if (tenant === undefined) {
    return <LoadingSkeleton />;
  }

  return <TenantDetailContent tenant={tenant} />;
}
