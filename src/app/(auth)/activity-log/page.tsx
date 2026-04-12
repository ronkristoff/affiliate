"use client";

import { Suspense } from "react";
import { ActivityLogClient } from "./ActivityLogClient";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { Skeleton } from "@/components/ui/skeleton";

function ActivityLogSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filter bar skeleton */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg" />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-[180px] rounded-md" />
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-7 w-16 rounded-md" />
            ))}
          </div>
        </div>
      </div>

      {/* List skeleton */}
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-lg border"
          >
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ActivityLogPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <PageTopbar description="Track all activity across your affiliate program in real time">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
          Activity Log
        </h1>
      </PageTopbar>

      <div className="page-content">
        <Suspense fallback={<ActivityLogSkeleton />}>
          <ActivityLogClient />
        </Suspense>
      </div>
    </div>
  );
}
