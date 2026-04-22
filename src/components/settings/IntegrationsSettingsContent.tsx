"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plug,
  Unplug,
  RefreshCw,
  Info,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage, getSanitizedErrorMessage, reportClientError } from "@/lib/utils";

/**
 * Integrations Settings Content
 * Shows connected billing providers with status, connect/disconnect actions,
 * and the ability to switch between Stripe and SaligPay.
 *
 * Stripe: one-click OAuth if Connect is configured, manual secret dialog as fallback.
 */
export function IntegrationsSettingsContent() {
  const user = useQuery(api.auth.getCurrentUser);
  const tenantId = user?.tenantId;

  const stripeStatus = useQuery(
    api.tenants.getStripeConnectionStatus,
    tenantId ? { tenantId } : "skip"
  );
  const saligPayStatus = useQuery(
    api.tenants.getSaligPayConnectionStatus,
    tenantId ? { tenantId } : "skip"
  );

  // Check if Stripe Connect OAuth is configured on this platform
  const checkConnectConfig = useAction(api.tenants.isStripeConnectConfigured);
  const [useOAuth, setUseOAuth] = useState(false);

  useEffect(() => {
    checkConnectConfig({}).then((result) => {
      if (result) setUseOAuth(result.configured);
    }).catch(() => {
      setUseOAuth(false);
    });
  }, [checkConnectConfig]);

  // Connect mutations
  const connectMockSaligPay = useMutation(api.tenants.connectMockSaligPay);
  const connectStripe = useMutation(api.tenants.connectStripe);

  // Disconnect mutations
  const disconnectStripe = useMutation(api.tenants.disconnectStripe);
  const disconnectSaligPay = useMutation(api.tenants.disconnectSaligPay);

  // Disconnect confirmation state
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Manual secret dialog state (fallback when Connect is not configured)
  const [stripeDialogOpen, setStripeDialogOpen] = useState(false);
  const [signingSecret, setSigningSecret] = useState("");
  const [stripeAccountId, setStripeAccountId] = useState("");
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);

  // Handle OAuth callback URL params
  const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setSearchParams(params);

    // Show toast based on callback result, then clean up URL
    if (params.get("stripe_connected") === "true") {
      toast.success("Stripe connected successfully!");
      window.history.replaceState({}, "", "/settings/integrations");
    } else if (params.get("stripe_error")) {
      toast.error(`Stripe connection failed: ${params.get("stripe_error")}`);
      window.history.replaceState({}, "", "/settings/integrations");
    }
  }, []);

  // Stripe Connect OAuth: one-click redirect
  const handleConnectStripeOAuth = () => {
    if (!tenantId) return;
    window.location.href = `/api/stripe/connect?tenantId=${tenantId}&redirect=/settings/integrations`;
  };

  // Stripe manual: validate and save signing secret
  const handleConnectStripeManual = async () => {
    if (!tenantId) return;

    const trimmed = signingSecret.trim();
    if (!trimmed) {
      toast.error("Webhook signing secret is required.");
      return;
    }
    if (!trimmed.startsWith("whsec_")) {
      toast.error("Signing secret must start with \"whsec_\". Check your Stripe Dashboard under Developers \u2192 Webhooks.");
      return;
    }
    const payload = trimmed.slice(6);
    if (payload.length < 24) {
      toast.error("Signing secret appears too short. Make sure you copied the full secret from Stripe Dashboard.");
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(payload)) {
      toast.error("Signing secret contains invalid characters. It should only contain letters, numbers, hyphens, and underscores after \"whsec_\".");
      return;
    }

    setIsConnectingStripe(true);
    try {
      await connectStripe({
        tenantId,
        signingSecret: trimmed,
        stripeAccountId: stripeAccountId.trim() || undefined,
      });
      toast.success("Stripe connected successfully!");
      setStripeDialogOpen(false);
      setSigningSecret("");
      setStripeAccountId("");
    } catch (error) {
      toast.error(getSanitizedErrorMessage(error, "Failed to connect Stripe"));
      reportClientError({ source: "IntegrationsSettingsContent", message: getErrorMessage(error, "Failed to connect Stripe") });
    } finally {
      setIsConnectingStripe(false);
    }
  };

  // Unified: pick the right handler based on config
  const handleConnectStripe = useOAuth ? handleConnectStripeOAuth : () => setStripeDialogOpen(true);

  // Connect Mock SaligPay handler
  const handleConnectSaligPay = async () => {
    if (!tenantId) return;

    try {
      await connectMockSaligPay({ tenantId });
      toast.success("SaligPay connected successfully!");
    } catch (error) {
      toast.error(getSanitizedErrorMessage(error, "Failed to connect SaligPay"))
      reportClientError({ source: "IntegrationsSettingsContent", message: getErrorMessage(error, "Failed to connect SaligPay") });
    }
  };

  // Disconnect handler
  const handleDisconnect = async () => {
    if (!tenantId) return;

    setIsDisconnecting(true);
    try {
      if (stripeStatus?.isConnected) {
        // For OAuth connections, call the deauthorize endpoint to revoke on Stripe's side
        if (stripeStatus.connectedVia === "oauth") {
          try {
            await fetch("/api/stripe/deauthorize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tenantId }),
            });
          } catch {
            // Non-blocking: local disconnect will still proceed
          }
        }
        await disconnectStripe({ tenantId });
        toast.success("Stripe disconnected.");
      } else if (saligPayStatus?.isConnected) {
        await disconnectSaligPay({ tenantId });
        toast.success("SaligPay disconnected.");
      }
      setDisconnectDialogOpen(false);
    } catch (error) {
      toast.error(getSanitizedErrorMessage(error, "Failed to disconnect"))
      reportClientError({ source: "IntegrationsSettingsContent", message: getErrorMessage(error, "Failed to disconnect") });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const activeProvider = stripeStatus?.isConnected
    ? "stripe"
    : saligPayStatus?.isConnected
      ? "saligpay"
      : null;

  const isAnyConnected = !!activeProvider;

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          Payment Providers
        </h2>
        <p className="text-muted-foreground">
          Connect a payment provider to automatically track conversions and attribute commissions.
          Leads are provider-agnostic — switching providers won&apos;t affect existing referral data.
        </p>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <p>
            <strong>How it works:</strong> When a customer signs up, call <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded text-xs">Affilio.referral(&#123;email&#125;)</code> on your form.
            When a payment arrives via your connected provider, we automatically match the customer&apos;s email to the affiliate who referred them.
          </p>
          <p>
            No need to pass metadata in checkout — the referral snippet handles everything.
          </p>
        </div>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stripe Card */}
        <Card className={stripeStatus?.isConnected ? "border-green-200 dark:border-green-800" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Stripe</CardTitle>
                  <CardDescription>Connect your Stripe account</CardDescription>
                </div>
              </div>
              {stripeStatus?.isConnected ? (
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">Not connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {stripeStatus?.isConnected ? (
              <>
                <div className="text-sm space-y-1">
                  {stripeStatus.stripeAccountId && (
                    <p className="text-muted-foreground">
                      Account: <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {stripeStatus.stripeAccountId.slice(-4).padStart(stripeStatus.stripeAccountId.length, "•")}
                      </code>
                    </p>
                  )}
                  {stripeStatus.connectedAt && (
                    <p className="text-muted-foreground">
                      Connected: {new Date(stripeStatus.connectedAt).toLocaleDateString()}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-xs">
                      {stripeStatus.livemode === false ? "Test Mode" : "Live"}
                    </Badge>
                    {stripeStatus.connectedVia === "oauth" && (
                      <Badge variant="outline" className="text-xs">
                        OAuth
                      </Badge>
                    )}
                    {stripeStatus.hasWebhook ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Webhooks Active
                      </Badge>
                    ) : stripeStatus.connectedVia === "oauth" && typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") ? (
                      <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                        <Info className="w-3 h-3 mr-1" />
                        Local Dev Mode
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Webhooks Not Configured
                      </Badge>
                    )}
                  </div>
                  {!stripeStatus.hasWebhook && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {stripeStatus.connectedVia === "oauth" && typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
                        ? <>Use <code className="bg-muted px-1 rounded">stripe listen --forward-to localhost:3000/api/webhooks/stripe</code> to test webhooks locally.</>
                        : <>Webhook events won&apos;t be received until you reconnect Stripe or manually configure webhooks in your Stripe Dashboard.</>
                      }
                    </p>
                  )}
                </div>
                {!saligPayStatus?.isConnected && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisconnectDialogOpen(true)}
                  >
                    <Unplug className="w-3 h-3 mr-1" />
                    Disconnect
                  </Button>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {useOAuth
                    ? "Connect your Stripe account with one click. Affilio will receive webhook events automatically — no manual setup needed."
                    : "Connect via webhook signing secret. Stripe events are verified using signature validation."}
                </p>
                {useOAuth ? (
                  <Button size="sm" onClick={handleConnectStripe}>
                    <Plug className="w-3 h-3 mr-1" />
                    Connect Stripe
                    <ExternalLink className="w-3 h-3 ml-1.5 opacity-50" />
                  </Button>
                ) : (
                  <Dialog open={stripeDialogOpen} onOpenChange={setStripeDialogOpen}>
                    <Button size="sm" onClick={() => setStripeDialogOpen(true)}>
                      <Plug className="w-3 h-3 mr-1" />
                      Connect Stripe
                    </Button>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Connect Stripe</DialogTitle>
                        <DialogDescription>
                          Paste your webhook signing secret from the Stripe Dashboard. You can find it under
                          Developers &rarr; Webhooks &rarr; your endpoint &rarr; Signing secret.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label htmlFor="settings-signing-secret">Webhook Signing Secret</Label>
                          <Input
                            id="settings-signing-secret"
                            type="password"
                            placeholder="whsec_..."
                            value={signingSecret}
                            onChange={(e) => setSigningSecret(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="settings-stripe-account-id">Stripe Account ID (optional)</Label>
                          <Input
                            id="settings-stripe-account-id"
                            placeholder="acct_..."
                            value={stripeAccountId}
                            onChange={(e) => setStripeAccountId(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => {
                          setStripeDialogOpen(false);
                          setSigningSecret("");
                          setStripeAccountId("");
                        }}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleConnectStripeManual}
                          disabled={!signingSecret.trim() || isConnectingStripe}
                        >
                          {isConnectingStripe ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            "Connect"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SaligPay Card */}
        <Card className={saligPayStatus?.isConnected ? "border-green-200 dark:border-green-800" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-950 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <CardTitle className="text-base">SaligPay</CardTitle>
                  <CardDescription>Built-in payment processing</CardDescription>
                </div>
              </div>
              {saligPayStatus?.isConnected ? (
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">Not connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {saligPayStatus?.isConnected ? (
              <>
                <div className="text-sm space-y-1">
                  {saligPayStatus.merchantId && (
                    <p className="text-muted-foreground">
                      Merchant: <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {saligPayStatus.merchantId.slice(-8)}
                      </code>
                    </p>
                  )}
                  {saligPayStatus.connectedAt && (
                    <p className="text-muted-foreground">
                      Connected: {new Date(saligPayStatus.connectedAt).toLocaleDateString()}
                    </p>
                  )}
                  {saligPayStatus.mode && (
                    <Badge variant="outline" className="text-xs">
                      {saligPayStatus.mode === "test" || saligPayStatus.mode === "mock" ? "Test Mode" : "Live"}
                    </Badge>
                  )}
                </div>
                {!stripeStatus?.isConnected && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisconnectDialogOpen(true)}
                  >
                    <Unplug className="w-3 h-3 mr-1" />
                    Disconnect
                  </Button>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Use Affilio&apos;s built-in payment integration for commission tracking. Great for testing and PH merchants.
                </p>
                <Button size="sm" onClick={handleConnectSaligPay}>
                  <Plug className="w-3 h-3 mr-1" />
                  Connect SaligPay
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {activeProvider === "stripe" ? "Stripe" : "SaligPay"}?</DialogTitle>
            <DialogDescription>
              This will remove your {activeProvider === "stripe" ? "Stripe" : "SaligPay"} connection.
              Existing referral leads are preserved and will work with any provider you connect later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Commissions will not be automatically created until a payment provider is connected.
              Make sure you connect a new provider or have another tracking method in place.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                "Disconnect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Webhook section (if connected) */}
      {isAnyConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Test Your Setup
            </CardTitle>
            <CardDescription>
              Verify your integration is working correctly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                After connecting a provider, you can test the full flow:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Visit your site via an affiliate referral link</li>
                <li>Sign up as a new customer (this fires <code className="bg-muted px-1 rounded text-xs">Affilio.referral()</code>)</li>
                <li>Make a test payment</li>
                <li>Check the Commissions page to see the attributed commission</li>
              </ol>
              {activeProvider === "stripe" && typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && (
                <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    Use the <strong>Stripe CLI</strong> to test webhooks locally:{" "}
                    <code className="text-xs bg-muted px-1 rounded">stripe listen --forward-to localhost:3000/api/webhooks/stripe</code>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
