'use client';

import { useState } from 'react';
import { Loader2, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface PayoutBannerProps {
  confirmedBalance: number;
  nextPayoutDate?: number;
  isLoading?: boolean;
}

export function PayoutBanner({ confirmedBalance, nextPayoutDate, isLoading = false }: PayoutBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  // Only show banner if there's a confirmed balance ready for payout
  if (!isVisible || confirmedBalance <= 0) {
    return null;
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-[var(--success)] text-white p-4 rounded-xl mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Wallet className="h-5 w-5" />
        <div>
          <p className="font-medium">Payout Coming Soon</p>
          <p className="text-sm text-white/80">
            {isLoading ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Calculating...
              </span>
            ) : (
              <>
                {nextPayoutDate ? (
                  <>Next payout: {formatDate(nextPayoutDate)} • {formatCurrency(confirmedBalance)} ready</>
                ) : (
                  <>{formatCurrency(confirmedBalance)} ready for payout</>
                )}
              </>
            )}
          </p>
        </div>
      </div>
      <button
        onClick={() => setIsVisible(false)}
        className="text-white/60 hover:text-white transition-colors"
        aria-label="Dismiss payout banner"
      >
        &times;
      </button>
    </div>
  );
}
