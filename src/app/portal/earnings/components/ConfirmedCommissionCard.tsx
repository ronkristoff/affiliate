'use client';

import { Button } from "@/components/ui/button";

interface ConfirmedCommissionCardProps {
  commission: {
    _id: string;
    amount: number;
    campaignName: string;
    createdAt: number;
  };
  onShare: () => void;
  onViewDetails: () => void;
  tenantPrimaryColor?: string;
}

export function ConfirmedCommissionCard({
  commission,
  onShare,
  onViewDetails,
  tenantPrimaryColor,
}: ConfirmedCommissionCardProps) {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div
      className="p-6 rounded-2xl text-white relative overflow-hidden"
      style={{
        background: tenantPrimaryColor
          ? `linear-gradient(135deg, ${tenantPrimaryColor}, #1a365d)`
          : 'linear-gradient(135deg, var(--brand), #1a365d)',
      }}
    >
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-sm">🏆</span>
            </div>
            <span className="font-medium">{commission.campaignName}</span>
          </div>
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#d1fae5] text-[#065f46]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#065f46] mr-1.5"></span>
            Confirmed ✓
          </span>
        </div>

        {/* Amount */}
        <p className="text-4xl font-black mb-4">{formatAmount(commission.amount)}</p>

        {/* Meta info */}
        <div className="flex items-center gap-4 text-sm text-white/80 mb-6">
          <span>Recurring · every month</span>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
          <div>
            <p className="text-white/60">Customer Plan</p>
            <p className="font-medium">Premium</p>
          </div>
          <div>
            <p className="text-white/60">Confirmed Date</p>
            <p className="font-medium">{formatDate(commission.createdAt)}</p>
          </div>
          <div>
            <p className="text-white/60">Rate</p>
            <p className="font-medium">20%</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            size="sm"
            onClick={onShare}
            className="flex-1 bg-white text-[var(--brand)] hover:bg-white/90"
          >
            Share this win 🎉
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewDetails}
            className="flex-1 bg-white/20 text-white hover:bg-white/30"
          >
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
}
