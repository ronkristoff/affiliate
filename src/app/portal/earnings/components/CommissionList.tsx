'use client';

import { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { CommissionItem } from './CommissionItem';
import { ConfirmedCommissionCard } from './ConfirmedCommissionCard';
import { CommissionDetailDrawer } from './CommissionDetailDrawer';
import { Loader2, Share2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CommissionListProps {
  affiliateId: string;
  period: string;
  status: string;
  tenantPrimaryColor?: string;
}

export function CommissionList({
  affiliateId,
  period,
  status,
  tenantPrimaryColor,
}: CommissionListProps) {
  const [selectedCommission, setSelectedCommission] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const commissions = useQuery(
    api.commissions.getAffiliateCommissions,
    {
      affiliateId: affiliateId as Id<'affiliates'>,
      period: period || undefined,
      status: status === 'all' ? undefined : status || undefined,
      limit: 20,
    }
  );

  // Handle loading state - fixed to use useEffect
  useEffect(() => {
    if (commissions !== undefined) {
      setIsLoading(false);
    }
  }, [commissions]);

  const handleCommissionClick = (commission: any) => {
    setSelectedCommission(commission);
    setIsDrawerOpen(true);
  };

  const handleShare = async (commission: any) => {
    // Build share text with referral link for AC10
    const referralLink = commission.referralCode 
      ? `https://app.salig.com/r/${commission.referralCode}`
      : '';
    
    const shareData = {
      title: 'Commission Confirmed! 🎉',
      text: `I just earned $${commission.amount} from ${commission.campaignName}!${referralLink ? ` Join me: ${referralLink}` : ''}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast.success('Shared successfully!');
      } catch (err) {
        // User cancelled or error
        console.log('Share failed:', err);
      }
    } else {
      // Fallback for desktop
      toast.message('Share this win!', {
        description: shareData.text,
        action: {
          label: 'Copy',
          onClick: () => {
            navigator.clipboard.writeText(shareData.text);
            toast.success('Copied to clipboard!');
          },
        },
      });
    }
  };

  if (commissions === undefined) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 bg-white border border-gray-200 rounded-xl animate-pulse">
            <div className="flex justify-between">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-gray-200 rounded"></div>
                <div className="h-3 w-24 bg-gray-200 rounded"></div>
              </div>
              <div className="h-6 w-16 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Get the most recent confirmed commission for the hero card
  const confirmedCommissions = commissions.filter((c) => c.status === 'confirmed');
  const mostRecentConfirmed = confirmedCommissions.length > 0 ? confirmedCommissions[0] : null;

  // Filter out the most recent confirmed from the list (to avoid duplication)
  const listCommissions = mostRecentConfirmed
    ? commissions.filter((c) => c._id !== mostRecentConfirmed._id)
    : commissions;

  if (commissions.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[var(--text-heading)] mb-2">
          No commissions yet
        </h3>
        <p className="text-[var(--text-muted)]">
          Start promoting to earn commissions!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Confirmed Commission Hero Card */}
      {mostRecentConfirmed && (
        <div className="mb-6">
          <p className="text-sm font-medium text-[var(--text-muted)] mb-3">
            Recent Win
          </p>
          <ConfirmedCommissionCard
            commission={mostRecentConfirmed}
            onShare={() => handleShare(mostRecentConfirmed)}
            onViewDetails={() => handleCommissionClick(mostRecentConfirmed)}
            tenantPrimaryColor={tenantPrimaryColor}
          />
        </div>
      )}

      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-[var(--text-heading)]">
          Commission History
        </h3>
        <span className="text-xs text-[var(--text-muted)]">
          {commissions.length} commission{commissions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Commission List */}
      <div className="space-y-3">
        {listCommissions.map((commission) => (
          <CommissionItem
            key={commission._id}
            commission={commission}
            onClick={() => handleCommissionClick(commission)}
          />
        ))}
      </div>

      {/* Load More */}
      {commissions.length >= 20 && (
        <div className="text-center pt-4">
          <button className="px-6 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors">
            Load more ({commissions.length - 20} remaining)
          </button>
        </div>
      )}

      {/* Detail Drawer */}
      <CommissionDetailDrawer
        commission={selectedCommission}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
