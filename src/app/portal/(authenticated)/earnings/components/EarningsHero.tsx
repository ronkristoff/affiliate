'use client';

import { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { formatCurrency } from '@/lib/format';

interface EarningsHeroProps {
  affiliateId: string;
  tenantPrimaryColor?: string;
}

export function EarningsHero({ affiliateId, tenantPrimaryColor }: EarningsHeroProps) {
  const [isLoading, setIsLoading] = useState(true);

  const earningsSummary = useQuery(api.affiliateAuth.getAffiliateEarningsSummary, {
    affiliateId: affiliateId as Id<'affiliates'>,
  });

  useEffect(() => {
    if (earningsSummary !== undefined) {
      setIsLoading(false);
    }
  }, [earningsSummary]);

  if (isLoading || !earningsSummary) {
    return (
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[var(--brand)] to-blue-600 text-white">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-32 bg-white/20 rounded"></div>
          <div className="h-4 w-48 bg-white/20 rounded"></div>
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="h-16 bg-white/20 rounded"></div>
            <div className="h-16 bg-white/20 rounded"></div>
            <div className="h-16 bg-white/20 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-6 rounded-2xl bg-gradient-to-r text-white"
      style={{
        background: tenantPrimaryColor
          ? `linear-gradient(135deg, ${tenantPrimaryColor}, ${adjustColor(tenantPrimaryColor, 30)})`
          : 'linear-gradient(135deg, var(--brand), #4a6fa5)',
      }}
    >
      <div className="mb-2">
        <p className="text-white/80 text-sm">Total Lifetime Earnings</p>
        <h2 className="text-3xl font-black">
          {formatCurrency(earningsSummary.totalEarnings)}
        </h2>
        {earningsSummary.totalCount > 0 && (
          <p className="text-white/60 text-xs mt-1">
            Across {earningsSummary.totalCount} commission{earningsSummary.totalCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-4 pt-4">
        {/* Total Paid Out */}
        <div className="text-center">
          <p className="text-white/80 text-xs mb-1">Total Paid Out</p>
          <p className="text-xl font-bold">{formatCurrency(earningsSummary.paidOut)}</p>
          <p className="text-white/60 text-xs">{earningsSummary.paidOutCount} payouts</p>
        </div>
        
        {/* Confirmed Balance - Ready for Payout */}
        <div className="text-center">
          <p className="text-white/80 text-xs mb-1">Ready for Payout</p>
          <p className="text-xl font-bold">{formatCurrency(earningsSummary.confirmedBalance)}</p>
          <p className="text-white/60 text-xs">{earningsSummary.confirmedCount} confirmed</p>
        </div>
        
        {/* Pending Balance - Awaiting Review */}
        <div className="text-center">
          <p className="text-white/80 text-xs mb-1">Awaiting Review</p>
          <p className="text-xl font-bold">{formatCurrency(earningsSummary.pendingBalance)}</p>
          <p className="text-white/60 text-xs">{earningsSummary.pendingCount} pending</p>
        </div>
      </div>
      
      {earningsSummary.commissionRate > 0 && (
        <p className="text-white/60 text-xs mt-3">
          Average commission rate: {earningsSummary.commissionRate}%
        </p>
      )}
    </div>
  );
}

// Helper function to adjust color brightness
function adjustColor(color: string, percent: number): string {
  // Remove # if present
  let hex = color.replace('#', '');
  
  // Parse r, g, b
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  
  // Lighten the color
  r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
  g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
  b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
  
  // Convert back to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
