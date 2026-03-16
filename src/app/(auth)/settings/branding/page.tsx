"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Check, Palette, Upload, RotateCcw } from "lucide-react";
import { LogoUpload } from "./components/LogoUpload";
import { ColorPicker } from "./components/ColorPicker";
import { PortalNameInput } from "./components/PortalNameInput";
import { BrandingPreview } from "./components/BrandingPreview";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface TenantBranding {
  logoUrl?: string;
  primaryColor?: string;
  portalName?: string;
}

export default function BrandingSettingsPage() {
  // Fetch tenant branding for current user
  const tenantContext = useQuery(api.tenants.getCurrentUserTenantBranding);
  
  // Mutations
  const updateBranding = useMutation(api.tenants.updateTenantBranding);
  const resetBranding = useMutation(api.tenants.resetTenantBranding);
  
  // Form state
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#10409a");
  const [portalName, setPortalName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Load existing branding data
  useEffect(() => {
    if (tenantContext?.branding) {
      setLogoUrl(tenantContext.branding.logoUrl || "");
      setPrimaryColor(tenantContext.branding.primaryColor || "#10409a");
      setPortalName(tenantContext.branding.portalName || tenantContext.name || "");
    }
  }, [tenantContext]);
  
  // Track changes
  useEffect(() => {
    if (tenantContext?.branding) {
      const original = tenantContext.branding;
      const changed = 
        logoUrl !== (original.logoUrl || "") ||
        primaryColor !== (original.primaryColor || "#10409a") ||
        portalName !== (original.portalName || tenantContext.name || "");
      setHasChanges(changed);
    } else {
      setHasChanges(logoUrl !== "" || primaryColor !== "#10409a" || portalName !== (tenantContext?.name || ""));
    }
  }, [logoUrl, primaryColor, portalName, tenantContext]);
  
  // Loading state
  if (tenantContext === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  // Error state
  if (tenantContext === null) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Unable to Load Branding
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Unable to load your branding settings. Please sign in again to continue.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await updateBranding({
        branding: {
          logoUrl: logoUrl || undefined,
          primaryColor,
          portalName: portalName || undefined,
        },
      });
      
      if (result.success) {
        toast.success("Branding saved successfully");
        setHasChanges(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save branding");
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleReset = async () => {
    setIsResetting(true);
    try {
      const result = await resetBranding();
      
      if (result.success) {
        setLogoUrl("");
        setPrimaryColor("#10409a");
        setPortalName(tenantContext.name || "");
        toast.success("Branding reset to defaults");
        setHasChanges(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset branding");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Portal Branding</h1>
        <p className="text-muted-foreground mt-1">
          Customize how your affiliate portal looks to your affiliates. This is a white-label feature - your affiliates will see your brand, not salig-affiliate's.
        </p>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Branding Settings */}
        <div className="space-y-6">
          {/* Logo Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Logo
              </CardTitle>
              <CardDescription>
                Upload your company logo to display on the affiliate portal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LogoUpload 
                value={logoUrl} 
                onChange={setLogoUrl}
                primaryColor={primaryColor}
              />
            </CardContent>
          </Card>
          
          {/* Brand Color */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Brand Color
              </CardTitle>
              <CardDescription>
                Choose your primary brand color. This will be used throughout the portal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ColorPicker 
                value={primaryColor}
                onChange={setPrimaryColor}
              />
            </CardContent>
          </Card>
          
          {/* Portal Name */}
          <Card>
            <CardHeader>
              <CardTitle>Portal Name</CardTitle>
              <CardDescription>
                The name displayed in the portal header
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PortalNameInput
                value={portalName}
                onChange={setPortalName}
                defaultName={tenantContext.name}
              />
            </CardContent>
          </Card>
          
          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={isSaving || isResetting}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Defaults
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Branding?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear all your branding settings and restore the default salig-affiliate branding. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset} disabled={isResetting}>
                    {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Reset Branding
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Live Preview */}
        <div>
          <Card className="sticky top-8">
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>
                See how your portal will look to affiliates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BrandingPreview
                logoUrl={logoUrl}
                primaryColor={primaryColor}
                portalName={portalName || tenantContext.name}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
