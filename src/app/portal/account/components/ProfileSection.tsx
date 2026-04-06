'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, User, Mail, Hash } from 'lucide-react';
import { useState } from 'react';

interface ProfileSectionProps {
  name: string;
  email: string;
  referralCode: string;
  status: string;
  primaryColor: string;
}

export function ProfileSection({ name, email, referralCode, status, primaryColor }: ProfileSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = referralCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusVariant = () => {
    switch (status) {
      case 'active':
        return 'default' as const;
      case 'pending':
        return 'secondary' as const;
      case 'suspended':
        return 'destructive' as const;
      case 'rejected':
        return 'destructive' as const;
      default:
        return 'outline' as const;
    }
  };

  const getStatusLabel = () => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <User className="h-4 w-4" />
          Profile Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Avatar & Name */}
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: primaryColor }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900">{name}</p>
            <Badge variant={getStatusVariant()} className="text-xs">
              {getStatusLabel()}
            </Badge>
          </div>
        </div>

        {/* Email */}
        <div className="flex items-center gap-3 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground truncate">{email}</span>
        </div>

        {/* Referral Code */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm">
            <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">Referral Code:</span>
            <code className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
              {referralCode}
            </code>
          </div>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gray-900 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-600" />
                <span className="text-green-600">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
