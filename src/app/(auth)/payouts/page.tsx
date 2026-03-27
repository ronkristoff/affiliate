"use client";

import { Suspense } from "react";
import { PayoutsContent } from "./PayoutsClient";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { Skeleton } from "@/components/ui/skeleton";

function PayoutsSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top bar skeleton */}
      <div className="sticky top-0 z-50 bg-[var(--bg-surface)] border-b border-[var(--border-light)] px-8 h-[60px] flex items-center">
        <div className="flex items-center justify-between w-full">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      <div className="page-content">
        {/* Metric cards skeleton */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-light)]">
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="space-y-3">
          <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-light)]">
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="p-4 space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PayoutsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top Bar */}
      <PageTopbar
        description="Generate payout batches and manage affiliate payments"
      >
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">Payouts</h1>
      </PageTopbar>

      {/* Page Content */}
      <div className="page-content">
        <Suspense fallback={<PayoutsSkeleton />}>
          <PayoutsContent />
        </Suspense>
      </div>
    </div>
  );
}
