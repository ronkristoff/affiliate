import Link from "next/link";
import { Suspense } from "react";
import { PayoutHistoryClient } from "./PayoutHistoryClient";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Payout History Page - Server Component
 *
 * Displays the full payout history for the SaaS Owner.
 * Route: /payouts/history
 *
 * AC#1: Payout History Page with breadcrumb navigation
 */
export default function PayoutHistoryPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/payouts" className="hover:text-foreground transition-colors">
            Payouts
          </Link>
          <span>/</span>
          <span>History</span>
        </div>
        
        {/* Page Header */}
        <h1 className="text-3xl font-bold">Payout History</h1>
        <p className="text-muted-foreground mt-1">
          View all past payout batches and their details
        </p>
      </div>
      
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        }
      >
        <PayoutHistoryClient />
      </Suspense>
    </div>
  );
}
