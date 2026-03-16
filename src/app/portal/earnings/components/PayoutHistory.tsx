'use client';

import { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface PayoutHistoryProps {
  affiliateId: string;
}

export function PayoutHistory({ affiliateId }: PayoutHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const payouts = useQuery(api.affiliateAuth.getAffiliatePayoutHistory, {
    affiliateId: affiliateId as Id<'affiliates'>,
    limit: 10,
  });

  useEffect(() => {
    if (payouts !== undefined) {
      setIsLoading(false);
    }
  }, [payouts]);

  // Don't render if no payouts
  if (!isLoading && (!payouts || payouts.length === 0)) {
    return null;
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return '✓';
      case 'pending':
        return '⏳';
      case 'failed':
        return '✕';
      default:
        return '•';
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg">Payout History</h3>
          {!isLoading && payouts && payouts.length > 0 && (
            <span className="text-sm text-muted-foreground">
              ({payouts.length} payouts)
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {/* Content - Expandable */}
      {isExpanded && (
        <div className="border-t border-border">
          {isLoading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payouts && payouts.length > 0 ? (
            <div className="divide-y divide-border">
              {payouts.map((payout) => (
                <div key={payout._id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payout.status)}`}>
                        {getStatusIcon(payout.status)} {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                      </span>
                      <span className="font-semibold">{formatAmount(payout.amount)}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(payout.paidAt)}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {payout.batch && (
                      <span>Batch #{payout.batch._id.slice(-8)}</span>
                    )}
                    {payout.paymentReference && (
                      <span className="ml-2">• {payout.paymentReference}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              No payout history available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
