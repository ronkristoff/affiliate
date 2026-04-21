'use client';

import Link from 'next/link';
import { CreditCard, Wallet } from 'lucide-react';

interface PayoutMethodInfoProps {
  payoutMethod?: {
    type: string;
    details: string;
  };
  payoutMethodLastDigits?: string;
}

export function PayoutMethodInfo({ payoutMethod, payoutMethodLastDigits }: PayoutMethodInfoProps) {
  // If no payout method is configured, show a prompt to add one
  if (!payoutMethod) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Wallet className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No Payout Method</p>
              <p className="text-sm text-muted-foreground">Add a payout method to receive commissions</p>
            </div>
          </div>
          <Link
            href="/portal/account"
            className="text-sm text-[var(--brand)] hover:underline font-medium"
          >
            Add Method
          </Link>
        </div>
      </div>
    );
  }

  // Format the payout method display
  const formatPayoutMethod = () => {
    const type = payoutMethod.type || 'Unknown';
    
    // Show masked format with last digits if available
    if (payoutMethodLastDigits) {
      return `${type} •••• ${payoutMethodLastDigits}`;
    }
    
    // Fallback to masking the details if no last digits provided
    const details = payoutMethod.details || '';
    if (details.length > 4) {
      const lastFour = details.slice(-4);
      return `${type} •••• ${lastFour}`;
    }
    
    return `${type} ${details}`;
  };

  const getMethodIcon = () => {
    const type = payoutMethod.type?.toLowerCase() || '';
    
    if (type.includes('gcash') || type.includes('cash')) {
      return '💚';
    } else if (type.includes('bank') || type.includes('transfer')) {
      return '🏦';
    } else if (type.includes('paymaya')) {
      return '💙';
    }
    
    return <CreditCard className="h-5 w-5" />;
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            {typeof getMethodIcon() === 'string' ? (
              <span className="text-xl">{getMethodIcon()}</span>
            ) : (
              getMethodIcon()
            )}
          </div>
          <div>
              <p className="font-medium">Manual Payout Method</p>
            <p className="text-sm text-muted-foreground">{formatPayoutMethod()}</p>
          </div>
        </div>
        <Link
          href="/portal/account"
          className="text-sm text-[var(--brand)] hover:underline font-medium"
        >
          Update
        </Link>
      </div>
    </div>
  );
}
