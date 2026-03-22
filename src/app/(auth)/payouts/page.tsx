"use client";

import { Suspense } from "react";
import { PayoutsContent } from "./PayoutsClient";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function PayoutsSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top bar skeleton */}
      <PageTopbar>
        <div>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-56 mt-1" />
        </div>
      </PageTopbar>

      <div className="px-8 pt-6 pb-8">
        {/* Metric cards skeleton */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>

        {/* Table skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-10 w-48" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>

        {/* Second table skeleton */}
        <div className="mt-8 space-y-3">
          <Skeleton className="h-10 w-48" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PayoutsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top Bar */}
      <PageTopbar description="Generate payout batches and manage affiliate payments">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">Payouts</h1>
        <div className="flex items-center gap-3">
          <Link href="/payouts/history">
            <Button variant="outline" size="sm" className="gap-1.5 text-[12px]">
              <History className="w-3.5 h-3.5" />
              History
            </Button>
          </Link>
        </div>
      </PageTopbar>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8">
        <Suspense fallback={<PayoutsSkeleton />}>
          <PayoutsContent />
        </Suspense>
      </div>
    </div>
  );
}
