"use client";

import { Suspense } from "react";
import { IntegrationsSettingsContent } from "@/components/settings/IntegrationsSettingsContent";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { Skeleton } from "@/components/ui/skeleton";

function IntegrationsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

export default function SettingsIntegrationsPage() {
  return (
    <div className="animate-fade-in">
      <PageTopbar description="Connect and manage your payment provider for automatic commission tracking">
        <h1 className="text-lg font-semibold text-heading">Integrations</h1>
      </PageTopbar>
      <div className="px-8 py-6">
        <div className="max-w-4xl">
          <Suspense fallback={<IntegrationsSkeleton />}>
            <IntegrationsSettingsContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
