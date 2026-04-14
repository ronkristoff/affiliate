'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Share2, Eye } from 'lucide-react';

interface ConfirmedCommissionCardProps {
  commission: {
    _id: string;
    amount: number;
    status: string;
    campaignName?: string;
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
  return (
    <Card
      className="border-green-200 bg-green-50"
      style={{
        borderColor: tenantPrimaryColor ? `${tenantPrimaryColor}30` : undefined,
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-green-600 font-medium">Approved Commission</p>
            <p className="text-2xl font-bold text-green-700">
              ${commission.amount?.toFixed(2) ?? '0.00'}
            </p>
            {commission.campaignName && (
              <p className="text-sm text-muted-foreground">{commission.campaignName}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onShare}>
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onViewDetails}>
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
