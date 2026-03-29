"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function FilterBuilderSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(2)].map((_, i) => (
        <Skeleton key={i} className="h-10 rounded-lg" />
      ))}
      <Skeleton className="h-12 rounded-xl" />
    </div>
  );
}

export function JoinBuilderSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 rounded-lg" />
      <Skeleton className="h-12 rounded-xl" />
    </div>
  );
}

export function AggregationBuilderSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 rounded-lg" />
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-10 rounded-lg" />
    </div>
  );
}

export function SavedQueriesListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}

export function ResultsTableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-10 rounded-lg" />
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-10 rounded-lg" />
      ))}
    </div>
  );
}

export function QueryBuilderPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="space-y-6">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
