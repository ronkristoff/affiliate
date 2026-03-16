"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCw, Clock } from "lucide-react";

interface SslStatusProps {
  status: string;
  onInitiate: () => void;
  isInitiating: boolean;
}

export function SslStatus({ status, onInitiate, isInitiating }: SslStatusProps) {
  const isDnsVerified = status === "dns_verification";
  const isProvisioning = status === "ssl_provisioning";
  const isFailed = status === "failed";
  
  const getStatusDisplay = () => {
    if (isDnsVerified) {
      return (
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <CheckCircle2 className="h-5 w-5" />
          <span>DNS verified - Ready for SSL provisioning</span>
        </div>
      );
    }
    if (isProvisioning) {
      return (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <Clock className="h-5 w-5 animate-pulse" />
          <span>SSL is being provisioned...</span>
        </div>
      );
    }
    if (isFailed) {
      return (
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-5 w-5" />
          <span>SSL provisioning failed</span>
        </div>
      );
    }
    return null;
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>SSL Certificate</CardTitle>
        <CardDescription>
          Secure your custom domain with SSL encryption
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          {getStatusDisplay()}
        </div>
        
        {isDnsVerified && (
          <div className="text-sm text-muted-foreground">
            <p>Your DNS has been verified. Click below to initiate SSL certificate provisioning.</p>
            <p className="mt-2">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                SSL provisioning typically completes within 24 hours
              </span>
            </p>
          </div>
        )}
        
        {isProvisioning && (
          <div className="text-sm text-muted-foreground">
            <p>Your SSL certificate is being provisioned. This process typically completes within 24 hours.</p>
            <p className="mt-2">You will be notified when SSL is active. In the meantime, you can continue configuring other settings.</p>
          </div>
        )}
        
        {isFailed && (
          <div className="text-sm text-muted-foreground">
            <p>SSL provisioning failed. Please try again or contact support if the issue persists.</p>
          </div>
        )}
        
        {(isDnsVerified || isFailed) && (
          <Button onClick={onInitiate} disabled={isInitiating}>
            {isInitiating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {isFailed ? "Retry SSL Provisioning" : "Start SSL Provisioning"}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
