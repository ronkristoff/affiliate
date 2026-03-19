import Link from "next/link";
import { PayoutHistoryClient } from "./PayoutHistoryClient";

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
      
      <PayoutHistoryClient />
    </div>
  );
}
