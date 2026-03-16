"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";

interface DnsVerificationProps {
  status: string;
  onVerify: () => void;
  isVerifying: boolean;
}

export function DnsVerification({ status, onVerify, isVerifying }: DnsVerificationProps) {
  const isPending = status === "pending";
  const isFailed = status === "failed";
  
  const getStatusDisplay = () => {
    if (isPending) {
      return (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-5 w-5" />
          <span>DNS verification required</span>
        </div>
      );
    }
    if (isFailed) {
      return (
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-5 w-5" />
          <span>DNS verification failed</span>
        </div>
      );
    }
    return null;
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>DNS Verification</CardTitle>
        <CardDescription>
          Verify that your DNS records are correctly configured
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          {getStatusDisplay()}
        </div>
        
        {isFailed && (
          <div className="text-sm text-muted-foreground">
            <p>The DNS verification failed. Please check the following:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Make sure the CNAME record is properly configured</li>
              <li>DNS propagation may take up to 24 hours</li>
              <li>Verify the record value matches our platform domain</li>
            </ul>
          </div>
        )}
        
        <Button onClick={onVerify} disabled={isVerifying}>
          {isVerifying ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Verify DNS
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
