'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommissionComputationSection } from '@/components/shared/CommissionComputationSection';

interface CommissionDetailDrawerProps {
  commission: {
    _id: string;
    amount: number;
    status: string;
    campaignName: string;
    createdAt: number;
    customerEmail?: string;
    conversionId?: string;
    commissionType?: string;
    effectiveRate?: number;
    saleAmount?: number | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  approved: { bg: 'bg-[#d1fae5]', text: 'text-[#065f46]' },
  pending: { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]' },
  reversed: { bg: 'bg-[#fee2e2]', text: 'text-[#991b1b]' },
  paid: { bg: 'bg-[#f3f4f6]', text: 'text-[#374151]' },
};

export function CommissionDetailDrawer({ commission, isOpen, onClose }: CommissionDetailDrawerProps) {
  if (!commission) return null;

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

  const styles = STATUS_STYLES[commission.status] || STATUS_STYLES.pending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">Commission Details</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Amount and Status */}
          <div className="text-center py-4">
            <p className={`text-4xl font-black ${commission.status === 'approved' ? 'text-[var(--success)]' : ''}`}>
              {formatAmount(commission.amount)}
            </p>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-2 ${styles.bg} ${styles.text}`}>
              {commission.status.charAt(0).toUpperCase() + commission.status.slice(1)}
            </span>
          </div>

          {/* Commission Computation Breakdown (simplified for affiliates) */}
          <CommissionComputationSection
            variant="simplified"
            commissionType={commission.commissionType ?? "percentage"}
            effectiveRate={commission.effectiveRate ?? 0}
            saleAmount={commission.saleAmount ?? null}
            amount={commission.amount}
            currency="USD"
          />

          {/* Details Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-[var(--text-heading)]">Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Campaign</p>
                <p className="font-medium">{commission.campaignName}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Date</p>
                <p className="font-medium">{formatDate(commission.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Customer</p>
                <p className="font-medium">{commission.customerEmail || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Commission ID</p>
                <p className="font-medium text-xs truncate">{commission._id}</p>
              </div>
            </div>
          </div>

          {/* Pending Review Explanation (AC3) */}
          {commission.status === 'pending' && (
            <div className="space-y-3 pt-4 border-t bg-[#fef3c7] p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#f59e0b] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">!</span>
                </div>
                <div>
                  <h3 className="font-semibold text-[#92400e]">Under Review</h3>
                  <p className="text-sm text-[#92400e]/80 mt-1">
                    This commission is being reviewed to ensure it meets our quality standards. 
                    We check for fraudulent activity, refund periods, and account validity.
                  </p>
                  <ul className="text-sm text-[#92400e]/80 mt-2 space-y-1 list-disc list-inside">
                    <li>Review typically takes 14-30 days</li>
                    <li>You'll be notified once approved</li>
                    <li>If approved, payment follows the next payout cycle</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Payout Info Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-[var(--text-heading)]">Payout Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Status</p>
                <p className="font-medium capitalize">{commission.status}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Expected Date</p>
                <p className="font-medium">
                  {commission.status === 'approved' || commission.status === 'pending'
                    ? 'Next payout cycle'
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Method</p>
                <p className="font-medium">Bank Transfer</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
