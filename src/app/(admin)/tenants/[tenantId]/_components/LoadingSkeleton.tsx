import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
}

export function LoadingSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <div className="px-8 pt-6 pb-8">
        <div className={cn("space-y-6", className)}>
          {/* Breadcrumb skeleton */}
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />

          {/* Header skeleton */}
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 animate-pulse rounded-xl bg-muted" />
            <div className="space-y-2">
              <div className="h-6 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            </div>
          </div>

          {/* Stats strip skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-[#e5e7eb] bg-white p-4"
              />
            ))}
          </div>

          {/* Tabs skeleton */}
          <div className="h-12 animate-pulse rounded-lg bg-muted" />

          {/* Content skeleton */}
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
