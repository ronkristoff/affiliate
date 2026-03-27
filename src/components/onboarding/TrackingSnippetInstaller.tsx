"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterTabs, type FilterTabItem } from "@/components/ui/FilterTabs";
import { Copy, Check, RefreshCw, Loader2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";

interface TrackingSnippetInstallerProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

/**
 * Platform-specific installation guides
 */
const platformGuides = {
  wordpress: {
    title: "WordPress",
    steps: [
      "Log in to your WordPress admin dashboard",
      "Go to Appearance > Theme Editor",
      "Select the theme you want to edit",
      "Find and click on 'Theme Header' (header.php)",
      "Paste the tracking snippet in the <head> section",
      "Click 'Update File' to save changes",
    ],
    videoUrl: "https://example.com/wordpress-tutorial",
  },
  shopify: {
    title: "Shopify",
    steps: [
      "Log in to your Shopify admin dashboard",
      "Go to Online Store > Themes",
      "Click on 'Actions' > 'Edit code'",
      "Find and click on 'layout' folder",
      "Select 'theme.liquid'",
      "Paste the tracking snippet in the <head> section",
      "Click 'Save' to save changes",
    ],
    videoUrl: "https://example.com/shopify-tutorial",
  },
  wix: {
    title: "Wix",
    steps: [
      "Log in to your Wix account",
      "Go to your website's dashboard",
      "Click on 'Settings' > 'Custom Code'",
      "Click 'Add Code' > 'Paste the code snippet'",
      "Paste the tracking snippet in the <head> section",
      "Click 'Apply' to save",
    ],
    videoUrl: "https://example.com/wix-tutorial",
  },
  squarespace: {
    title: "Squarespace",
    steps: [
      "Log in to your Squarespace account",
      "Go to Settings > Advanced > Code Injection",
      "Paste the tracking snippet in the 'Header' section",
      "Click 'Save' to save changes",
    ],
    videoUrl: "https://example.com/squarespace-tutorial",
  },
  html: {
    title: "Custom HTML",
    steps: [
      "Open your HTML file in a code editor",
      "Find the <head> section",
      "Paste the tracking snippet inside the <head> section",
      "Save and upload the file to your server",
    ],
    videoUrl: null,
  },
};

/**
 * Tracking Snippet Installer Component
 * AC1, AC2, AC3, AC4, AC5, AC6
 */
export function TrackingSnippetInstaller({ onComplete, onSkip }: TrackingSnippetInstallerProps) {
  const [copied, setCopied] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<keyof typeof platformGuides>("html");
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Get tracking config - use mutation to generate key if needed
  const getConfig = useMutation(api.tracking.getTrackingSnippetConfig);
  const [snippetConfig, setSnippetConfig] = useState<{ publicKey: string; tenantId: string; attributionWindow: number; cdnUrl: string } | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const verificationStatus = useQuery(api.tracking.checkSnippetInstallation);

  // Mutations
  const resetVerification = useMutation(api.tracking.resetTrackingVerification);

  // Load config on mount
  useEffect(() => {
    getConfig({}).then((config) => {
      setSnippetConfig(config);
      setConfigLoading(false);
    }).catch((err) => {
      console.error("Failed to load tracking config:", err);
      setConfigLoading(false);
    });
  }, [getConfig]);

  // Generate snippet code with data-tenant and cache busting
  const snippetCode = configLoading
    ? "Loading..."
    : snippetConfig
      ? `<!-- salig-affiliate tracking -->
<script src="${snippetConfig.cdnUrl}?v=2" data-key="${snippetConfig.publicKey}" data-tenant="${snippetConfig.tenantId}" async></script>`
      : "Error loading configuration";

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippetCode);
      setCopied(true);
      toast.success("Snippet copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy snippet");
    }
  };

  // Check verification status - properly polls for updates
  const handleCheckVerification = async () => {
    setIsVerifying(true);
    setLastChecked(new Date());
    // Query will automatically refresh via Convex's reactive system
    // Show loading state for at least 500ms for UX feedback
    setTimeout(() => setIsVerifying(false), 500);
  };

  // Auto-poll for verification status when not verified
  useEffect(() => {
    if (verificationStatus?.isVerified) return;

    // Poll every 10 seconds when not verified
    const interval = setInterval(() => {
      setLastChecked(new Date());
      // Convex useQuery automatically re-fetches when cache expires
    }, 10000);

    return () => clearInterval(interval);
  }, [verificationStatus?.isVerified]);

  // Reset and re-verify
  const handleResetVerification = async () => {
    setIsVerifying(true);
    try {
      await resetVerification({});
      toast.success("Verification reset. Install the snippet and check again.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Format last ping date
  const formatLastPing = (timestamp?: number) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const isVerified = verificationStatus?.isVerified ?? false;

  return (
    <div className="space-y-6">
      {/* Step 3 of 3 Header */}
      <div className="text-center space-y-2">
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          Step 3 of 3 — Optional
        </Badge>
        <h2 className="text-xl font-semibold">Install Tracking Snippet</h2>
        <p className="text-sm text-muted-foreground">
          Add one line of JavaScript to your website to enable click and conversion tracking.
        </p>
      </div>

      {/* Tracking Snippet Display */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Your Tracking Snippet</CardTitle>
            {isVerified ? (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertCircle className="w-3 h-3 mr-1" />
                Awaiting
              </Badge>
            )}
          </div>
          <CardDescription>
            Copy this code and paste it in the &lt;head&gt; section of your website.
            {snippetConfig?.tenantId && (
              <span className="block mt-1 text-xs">
                This snippet is for domain: <strong>{verificationStatus?.domain || "your domain"}</strong>
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Code Block */}
          <div className="relative">
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
              <code>{snippetCode}</code>
            </pre>
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              Paste the snippet in the &lt;head&gt; section on every page of your website.
              This ensures the tracking script loads before your page content.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Verification Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Verification Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isVerified ? (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <h4 className="font-medium text-green-900 dark:text-green-100">
                    Tracking Verified
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Your snippet is installed and verified on your domain.
                  </p>
                  {verificationStatus?.lastPingAt && verificationStatus?.domain && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Verified on {verificationStatus.domain} at {formatLastPing(verificationStatus.lastPingAt)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-amber-900 dark:text-amber-100">
                    Awaiting verification
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Add the snippet to your website and load any page. We&apos;ll verify the domain matches.
                  </p>
                  <div className="mt-3 space-y-1 text-xs text-amber-600 dark:text-amber-400">
                    <p>1. Copy the snippet above</p>
                    <p>2. Paste in the &lt;head&gt; section of your website</p>
                    <p>3. Load any page on your site</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Verification Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckVerification}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Check Verification
                </>
              )}
            </Button>
            
            {isVerified && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetVerification}
                disabled={isVerifying}
              >
                Reset & Re-verify
              </Button>
            )}
          </div>

          {/* Troubleshooting Tips */}
          {!isVerified && (
            <div className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-800">
              <h5 className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                Troubleshooting
              </h5>
              <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                <li>• Ensure the snippet is installed on a publicly accessible page</li>
                <li>• Check that your site is accessible (not behind a login)</li>
                <li>• Disable ad blockers temporarily to test</li>
                <li>• Wait up to 5 minutes for verification to complete</li>
                <li>• The domain in your settings must match where the snippet is installed</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform Installation Guides */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Platform-Specific Installation</CardTitle>
          <CardDescription>
            Select your platform for detailed instructions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full space-y-4">
            <FilterTabs
              tabs={Object.entries(platformGuides).map(([key, platform]) => ({
                key,
                label: platform.title,
              }))}
              activeTab={selectedPlatform}
              onTabChange={(v) => setSelectedPlatform(v as keyof typeof platformGuides)}
              size="md"
              className="w-full justify-start overflow-x-auto"
            />

            {(() => {
              const platform = platformGuides[selectedPlatform];
              return (
                <div className="space-y-4">
                  <h4 className="font-medium">{platform.title} Installation</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    {platform.steps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                  {platform.videoUrl && (
                    <Button variant="link" className="p-0 h-auto text-blue-600" asChild>
                      <a href={platform.videoUrl} target="_blank" rel="noopener noreferrer">
                        Watch Video Tutorial
                      </a>
                    </Button>
                  )}
                </div>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t">
        {onSkip && (
          <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
            Skip for now
          </Button>
        )}
        <div className="ml-auto">
          <Button onClick={onComplete} className="bg-[#10409a] hover:bg-[#1659d6]">
            {isVerified ? "Finish Setup" : "Skip & Go to Dashboard"}
            <Check className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
