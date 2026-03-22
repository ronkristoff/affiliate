"use client";

import Link from "next/link";
import { Suspense } from "react";
import { PayoutHistoryClient } from "./PayoutHistoryClient";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft } from "lucide-react";

function PayoutHistorySkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top bar skeleton */}
      <PageTopbar>
        <div>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-56 mt-1" />
        </div>
      </PageTopbar>

      <div className="px-8 pt-6 pb-8">
        {/* Filter tabs skeleton */}
        <div className="flex gap-2 mb-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg" />
          ))}
        </div>

        {/* Table skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>

        {/* Pagination skeleton */}
        <div className="mt-4">
          <Skeleton className="h-5 w-48" />
        </div>
      </div>
    </div>
  );
}

export default function PayoutHistoryPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      {/* Top Bar */}
      <PageTopbar description="View all past payout batches and their details">
        <div className="flex items-center gap-3">
          <Link href="/payouts">
            <Button variant="ghost" size="sm" className="gap-1.5 text-[12px]">
              <ChevronLeft className="w-3.5 h-3.5" />
              Payouts
            </Button>
          </Link>
          <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
            Payout History
          </h1>
        </div>
      </PageTopbar>

      {/* Page Content */}
      <div className="px-8 pt-6 pb-8">
        <Suspense fallback={<PayoutHistorySkeleton />}>
          <PayoutHistoryClient />
        </Suspense>
      </div>
    </div>
  );
}
