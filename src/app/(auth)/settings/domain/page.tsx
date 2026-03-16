"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Check, Globe, Shield, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { DomainInput } from "./components/DomainInput";
import { DnsInstructions } from "./components/DnsInstructions";
import { DnsVerification } from "./components/DnsVerification";
import { SslStatus } from "./components/SslStatus";
import { DomainStatusBadge } from "./components/DomainStatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DomainConfig {
  customDomain?: string;
  domainStatus?: string;
  domainVerifiedAt?: number;
  sslProvisionedAt?: number;
  platformDomain: string;
}

interface TierStatus {
  isCustomDomainEnabled: boolean;
  currentPlan?: string;
}

export default function DomainSettingsPage() {
  // Fetch tier status to check if custom domain is available
  const tierStatus = useQuery(api.tenants.getTierCustomDomainStatus);
  
  // Fetch current domain configuration
  const domainConfig = useQuery(api.tenants.getTenantDomainConfig);
  
  // Mutations
  const updateDomain = useMutation(api.tenants.updateTenantDomain);
  const removeDomain = useMutation(api.tenants.removeTenantDomain);
  const verifyDns = useMutation(api.tenants.verifyDomainDns);
  const initiateSsl = useMutation(api.tenants.initiateSslProvisioning);
  
  // Form state
  const [domainInput, setDomainInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isInitiatingSsl, setIsInitiatingSsl] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Load existing domain data
  useEffect(() => {
    if (domainConfig?.customDomain) {
      setDomainInput(domainConfig.customDomain);
    }
  }, [domainConfig]);
  
  // Track changes
  useEffect(() => {
    const original = domainConfig?.customDomain || "";
    setHasChanges(domainInput !== original);
  }, [domainInput, domainConfig]);
  
  // Loading state
  if (tierStatus === undefined || domainConfig === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  // Tier check - show upgrade prompt for non-Scale users
  if (!tierStatus.isCustomDomainEnabled) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Custom Domain</h1>
          <p className="text-muted-foreground mt-1">
            Configure a custom domain for your affiliate portal
          </p>
        </div>
        
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Shield className="h-5 w-5" />
              Upgrade to Scale Tier
            </CardTitle>
            <CardDescription className="text-amber-700 dark:text-amber-300">
              Custom domain configuration is available on the Scale tier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Your current plan (<strong>{tierStatus.currentPlan || "Starter"}</strong>) does not include custom domain support. 
                Upgrade to Scale to unlock this feature and give your affiliates a branded experience.
              </p>
              
              <div className="flex gap-4">
                <Button asChild>
                  <a href="/settings/billing">View Scale Plan</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const handleSaveDomain = async () => {
    if (!domainInput.trim()) {
      toast.error("Please enter a domain");
      return;
    }
    
    setIsSaving(true);
    try {
      const result = await updateDomain({ domain: domainInput });
      
      if (result.success) {
        toast.success("Domain saved successfully");
        setHasChanges(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save domain");
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleRemoveDomain = async () => {
    setIsRemoving(true);
    try {
      const result = await removeDomain();
      
      if (result.success) {
        setDomainInput("");
        toast.success("Domain removed successfully. Your portal will now use the default subdomain.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove domain");
    } finally {
      setIsRemoving(false);
    }
  };
  
  const handleVerifyDns = async () => {
    setIsVerifying(true);
    try {
      const result = await verifyDns();
      
      if (result.verified) {
        toast.success("DNS verified successfully!");
      } else {
        toast.warning(result.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to verify DNS");
    } finally {
      setIsVerifying(false);
    }
  };
  
  const handleInitiateSsl = async () => {
    setIsInitiatingSsl(true);
    try {
      const result = await initiateSsl();
      
      if (result.success) {
        toast.success(result.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to initiate SSL");
    } finally {
      setIsInitiatingSsl(false);
    }
  };
  
  const currentStatus = domainConfig?.domainStatus;
  const hasDomain = !!domainConfig?.customDomain;
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Custom Domain</h1>
        <p className="text-muted-foreground mt-1">
          Configure a custom domain for your affiliate portal. Your affiliates will see your domain instead of a subdomain.
        </p>
      </div>
      
      <div className="space-y-6">
        {/* Current Domain Status */}
        {hasDomain && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Current Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Custom Domain</p>
                  <p className="text-lg font-medium">{domainConfig.customDomain}</p>
                </div>
                <DomainStatusBadge status={currentStatus || "pending"} />
              </div>
              
              {currentStatus && currentStatus !== "pending" && (
                <div className="text-sm text-muted-foreground">
                  {currentStatus === "dns_verification" && domainConfig.domainVerifiedAt && (
                    <p>DNS verified on {new Date(domainConfig.domainVerifiedAt).toLocaleDateString()}</p>
                  )}
                  {currentStatus === "ssl_provisioning" && (
                    <p>SSL is being provisioned. This may take up to 24 hours.</p>
                  )}
                  {currentStatus === "active" && domainConfig.sslProvisionedAt && (
                    <p>SSL active since {new Date(domainConfig.sslProvisionedAt).toLocaleDateString()}</p>
                  )}
                  {currentStatus === "failed" && (
                    <p className="text-destructive">SSL provisioning failed. Please try again or contact support.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Domain Input */}
        <Card>
          <CardHeader>
            <CardTitle>{hasDomain ? "Update Domain" : "Set Up Custom Domain"}</CardTitle>
            <CardDescription>
              Enter your custom domain (e.g., affiliates.mycompany.com)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DomainInput
              value={domainInput}
              onChange={setDomainInput}
              disabled={isSaving}
            />
            
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Your portal will be accessible at: <strong>{domainInput || "your-domain.com"}</strong>
              </p>
              
              <div className="flex gap-2">
                {hasDomain && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" disabled={isRemoving}>
                        <X className="h-4 w-4 mr-2" />
                        Remove Domain
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Custom Domain?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove your custom domain configuration. Your affiliate portal will revert to using the default subdomain. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveDomain} disabled={isRemoving}>
                          {isRemoving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Remove Domain
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                
                <Button onClick={handleSaveDomain} disabled={!hasChanges || isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      {hasDomain ? "Update Domain" : "Save Domain"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* DNS Instructions - show after domain is saved */}
        {hasDomain && currentStatus !== "active" && (
          <DnsInstructions
            domain={domainConfig.customDomain!}
            targetDomain={domainConfig.platformDomain}
          />
        )}
        
        {/* DNS Verification */}
        {hasDomain && currentStatus && (currentStatus === "pending" || currentStatus === "failed") && (
          <DnsVerification
            status={currentStatus}
            onVerify={handleVerifyDns}
            isVerifying={isVerifying}
          />
        )}
        
        {/* SSL Status */}
        {hasDomain && currentStatus && currentStatus !== "pending" && (
          <SslStatus
            status={currentStatus}
            onInitiate={handleInitiateSsl}
            isInitiating={isInitiatingSsl}
          />
        )}
        
        {/* Preview */}
        {hasDomain && currentStatus === "active" && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <Check className="h-5 w-5" />
                Domain Active
              </CardTitle>
              <CardDescription className="text-green-700 dark:text-green-300">
                Your affiliate portal is now accessible via your custom domain
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Portal URL:</strong> https://{domainConfig.customDomain}
                </p>
                <p className="text-sm text-muted-foreground">
                  Referral links generated for your affiliates will now use your custom domain.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
