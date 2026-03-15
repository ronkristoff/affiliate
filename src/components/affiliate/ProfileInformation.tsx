"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Hash } from "lucide-react";

interface PayoutMethod {
  type: string;
  details: string;
}

interface ProfileInformationProps {
  email: string;
  uniqueCode: string;
  payoutMethod?: PayoutMethod;
}

export function ProfileInformation({
  email,
  uniqueCode,
  payoutMethod,
}: ProfileInformationProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email
          </label>
          <p className="text-sm break-all">{email}</p>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Referral Code
          </label>
          <code className="rounded bg-muted px-2 py-1 text-sm block w-fit">
            {uniqueCode}
          </code>
        </div>
        {payoutMethod && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">
              Payout Method
            </label>
            <p className="text-sm capitalize">{payoutMethod.type}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
