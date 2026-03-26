"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { BatchDetailContent } from "./BatchDetailClient";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

function BatchDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <PageTopbar>
        <div>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-72 mt-1" />
        </div>
      </PageTopbar>

      <div className="px-8 pt-6 pb-8">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-20 w-full rounded-xl mb-6" />
        <Skeleton className="h-10 w-48 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BatchDetailPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <PageTopbar description="View individual payouts in this batch">
        <div className="flex items-center gap-3">
          <Link href="/payouts">
            <Button variant="ghost" size="sm" className="gap-1.5 text-[12px]">
              <ChevronLeft className="w-3.5 h-3.5" />
              Payouts
            </Button>
          </Link>
          <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
            Batch Details
          </h1>
        </div>
      </PageTopbar>

      <div className="px-8 pt-6 pb-8">
        <Suspense fallback={<BatchDetailSkeleton />}>
          <BatchDetailContent />
        </Suspense>
      </div>
    </div>
  );
}
