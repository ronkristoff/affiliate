'use client';

interface CommissionItemProps {
  commission: {
    _id: string;
    amount: number;
    status: string;
    campaignName: string;
    createdAt: number;
    customerEmail?: string;
  };
  onClick: () => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  approved: {
    bg: 'bg-[#d1fae5]',
    text: 'text-[#065f46]',
    dot: 'bg-[#065f46]',
  },
  pending: {
    bg: 'bg-[#fef3c7]',
    text: 'text-[#92400e]',
    dot: 'bg-[#92400e]',
  },
  reversed: {
    bg: 'bg-[#fee2e2]',
    text: 'text-[#991b1b]',
    dot: 'bg-[#991b1b]',
  },
  paid: {
    bg: 'bg-[#f3f4f6]',
    text: 'text-[#374151]',
    dot: 'bg-[#374151]',
  },
};

export function CommissionItem({ commission, onClick }: CommissionItemProps) {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const styles = STATUS_STYLES[commission.status] || STATUS_STYLES.pending;

  return (
    <button
      onClick={onClick}
      className="w-full p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-between"
    >
      <div className="flex-1 text-left">
        <p className="font-medium text-[var(--text-heading)]">{commission.campaignName}</p>
        <p className="text-sm text-[var(--text-muted)]">
          {commission.customerEmail || 'Customer'}
        </p>
      </div>
      
      <div className="flex-1 text-center">
        <p className={`font-bold ${commission.status === 'approved' ? 'text-[var(--success)]' : ''}`}>
          {formatAmount(commission.amount)}
        </p>
      </div>
      
      <div className="flex-1 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles.bg} ${styles.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${styles.dot} mr-1.5`}></span>
            {commission.status.charAt(0).toUpperCase() + commission.status.slice(1)}
          </span>
          <span className="text-sm text-[var(--text-muted)]">
            {formatDate(commission.createdAt)}
          </span>
        </div>
      </div>
    </button>
  );
}