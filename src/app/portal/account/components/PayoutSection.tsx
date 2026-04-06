'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, CreditCard, Loader2, Check } from 'lucide-react';

interface PayoutSectionProps {
  payoutMethod?: {
    type: string;
    details: string;
  };
  payoutMethodLastDigits?: string;
  primaryColor: string;
  onUpdate: (payoutMethod: { type: string; details: string }) => Promise<{ success: boolean; error?: string }>;
}

export function PayoutSection({ payoutMethod, payoutMethodLastDigits, primaryColor, onUpdate }: PayoutSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [type, setType] = useState(payoutMethod?.type || '');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!type.trim() || !details.trim()) {
      setError('Please fill in both payout type and details');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await onUpdate({ type: type.trim(), details: details.trim() });
      if (result.success) {
        setSuccess(true);
        setIsEditing(false);
        setDetails('');
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Failed to update payout method');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
    setDetails('');
  };

  const getMethodIcon = () => {
    const methodType = payoutMethod?.type?.toLowerCase() || '';
    if (methodType.includes('gcash') || methodType.includes('cash')) return '💚';
    if (methodType.includes('bank') || methodType.includes('transfer')) return '🏦';
    if (methodType.includes('paymaya')) return '💙';
    if (methodType.includes('paypal')) return '🅿️';
    return null;
  };

  const formatPayoutMethod = () => {
    if (!payoutMethod) return 'Not configured';
    const methodType = payoutMethod.type || 'Unknown';
    if (payoutMethodLastDigits) return `${methodType} •••• ${payoutMethodLastDigits}`;
    const dets = payoutMethod.details || '';
    if (dets.length > 4) return `${methodType} •••• ${dets.slice(-4)}`;
    return `${methodType} ${dets}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Payout Method
          </CardTitle>
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="text-xs"
            >
              {payoutMethod ? 'Update' : 'Add'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!isEditing ? (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              {payoutMethod ? (
                getMethodIcon() ? (
                  <span className="text-xl">{getMethodIcon()}</span>
                ) : (
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                )
              ) : (
                <Wallet className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-medium text-sm">
                {payoutMethod ? formatPayoutMethod() : 'No payout method configured'}
              </p>
              <p className="text-xs text-muted-foreground">
                {payoutMethod
                  ? 'Contact support to change sensitive details'
                  : 'Add a method to receive commission payouts'}
              </p>
            </div>
            {success && (
              <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="payout-type" className="text-xs">
                Payout Type
              </Label>
              <Input
                id="payout-type"
                placeholder="e.g., GCash, Bank Transfer, PayPal"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payout-details" className="text-xs">
                Account Details
              </Label>
              <Input
                id="payout-details"
                placeholder="e.g., phone number, bank account number, email"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="h-9 text-sm"
                type="text"
              />
            </div>
            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="text-xs h-8"
                style={{ backgroundColor: primaryColor }}
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                Save
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
