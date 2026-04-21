"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Copy,
  Check,
  RefreshCw,
  Send,
  Globe,
  Code2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Users,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function TestTrackingPage() {
  const [pingStatus, setPingStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [pingResponse, setPingResponse] = useState<any>(null);
  const [referralEmail, setReferralEmail] = useState("test@example.com");
  const [referralStatus, setReferralStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [referralResponse, setReferralResponse] = useState<any>(null);
  const [selectedAffiliateCode, setSelectedAffiliateCode] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [paymentResponse, setPaymentResponse] = useState<any>(null);
  const [snippetLoaded, setSnippetLoaded] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Auth guard — ensure user is authenticated before calling protected mutations
  const { data: session, isPending: authLoading } = authClient.useSession();

  // Get tracking config
  const getConfig = useMutation(api.tracking.getTrackingSnippetConfig);
  const [snippetConfig, setSnippetConfig] = useState<{ publicKey: string; tenantId: string; cdnUrl: string } | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // Verification status
  const verificationStatus = useQuery(api.tracking.checkSnippetInstallation);

  // Active affiliates for attribution selection
  const affiliates = useQuery(api.affiliates.getAffiliatesByTenant);
  const activeAffiliates = affiliates?.filter((a) => a.status === "active") ?? [];

  // Load config only after auth is ready
  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      setConfigLoading(false);
      return;
    }

    getConfig({})
      .then((config) => {
        setSnippetConfig(config);
        setConfigLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load tracking config:", err);
        setConfigLoading(false);
      });
  }, [getConfig, session, authLoading]);

  // Inject the tracking snippet dynamically
  useEffect(() => {
    if (!snippetConfig || snippetLoaded) return;

    // Remove any existing Affilio script
    const existing = document.querySelector('script[data-test-tracking="true"]');
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.src = `${snippetConfig.cdnUrl}?v=2`;
    script.setAttribute("data-key", snippetConfig.publicKey);
    script.setAttribute("data-tenant", snippetConfig.tenantId);
    script.setAttribute("data-debug", "true");
    script.setAttribute("data-test-tracking", "true");
    script.async = true;
    script.onload = () => {
      setSnippetLoaded(true);
      toast.success("Tracking snippet loaded!");
    };
    script.onerror = () => {
      toast.error("Failed to load tracking snippet");
    };
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [snippetConfig, snippetLoaded]);

  // Send manual ping
  const handleSendPing = useCallback(async () => {
    if (!snippetConfig) return;
    setPingStatus("sending");
    setPingResponse(null);

    try {
      const res = await fetch("/api/tracking/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: snippetConfig.publicKey,
          domain: window.location.hostname,
          url: window.location.href,
          referrer: document.referrer,
          userAgent: navigator.userAgent,
        }),
      });
      const data = await res.json();
      setPingResponse(data);
      setPingStatus(data.success ? "success" : "error");
      if (data.success) {
        toast.success("Ping sent successfully!");
      } else {
        toast.error(data.message || "Ping failed");
      }
    } catch (err) {
      setPingStatus("error");
      toast.error("Failed to send ping");
    }
  }, [snippetConfig]);

  // Simulate referral
  const handleSimulateReferral = useCallback(async () => {
    if (!snippetConfig || !referralEmail) return;
    setReferralStatus("sending");
    setReferralResponse(null);

    try {
      // 1. Create the referral lead (with affiliate code if selected)
      const res = await fetch("/track/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: referralEmail,
          publicKey: snippetConfig.publicKey,
          tenantId: snippetConfig.tenantId,
          affiliateCode: selectedAffiliateCode || undefined,
        }),
      });
      const data = await res.json();
      setReferralResponse(data);

      // 2. Also send a referral health ping so the dashboard shows "referral tracking active"
      await fetch("/api/tracking/referral-ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: snippetConfig.publicKey,
          domain: window.location.hostname,
          userAgent: navigator.userAgent,
          email: referralEmail,
        }),
      });

      setReferralStatus(data.success ? "success" : "error");
      if (data.success) {
        if (data.leadId) {
          toast.success(`Lead created! ID: ${data.leadId.slice(0, 8)}...`);
        } else {
          toast.success(data.message || "Referral recorded (no affiliate attribution)");
        }
      } else {
        toast.error(data.error || "Referral simulation failed");
      }
    } catch (err) {
      setReferralStatus("error");
      toast.error("Failed to simulate referral");
    }
  }, [snippetConfig, referralEmail, selectedAffiliateCode]);

  // Trigger mock payment to create a conversion
  const handleTriggerPayment = useCallback(async () => {
    if (!snippetConfig || !referralEmail) return;
    setPaymentStatus("sending");
    setPaymentResponse(null);

    try {
      // Default to stripe-webhook mock. Works even if Stripe isn't "connected" — it's a dev endpoint.
      const res = await fetch("/api/mock/stripe-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: snippetConfig.tenantId,
          eventType: "payment_intent.succeeded",
          amount: 9900, // $99.00 in cents
          customerEmail: referralEmail,
          currency: "usd",
        }),
      });
      const data = await res.json();
      setPaymentResponse(data);
      setPaymentStatus(data.success ? "success" : "error");
      if (data.success) {
        toast.success("Mock payment triggered! Check Conversions and Commissions pages.");
      } else {
        toast.error(data.error || "Mock payment failed");
      }
    } catch (err) {
      setPaymentStatus("error");
      toast.error("Failed to trigger mock payment");
    }
  }, [snippetConfig, referralEmail]);

  // Copy snippet
  const handleCopySnippet = async () => {
    if (!snippetCode) return;
    try {
      await navigator.clipboard.writeText(snippetCode);
      setCopiedSnippet(true);
      toast.success("Snippet copied!");
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const snippetCode = authLoading || configLoading
    ? "Loading..."
    : snippetConfig
      ? `<!-- Affilio tracking -->
<script src="${snippetConfig.cdnUrl}?v=2" data-key="${snippetConfig.publicKey}" data-tenant="${snippetConfig.tenantId}" async></script>`
      : "Error loading configuration";

  const isVerified = verificationStatus?.isVerified ?? false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <Link href="/settings/tracking" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Tracking Settings
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Tracking Snippet Test Lab</h1>
          <p className="text-muted-foreground">
            Test your tracking snippet locally before deploying it to your live website.
          </p>
        </div>

        {/* Status Banner */}
        <Card className={isVerified ? "border-green-200 dark:border-green-800" : "border-amber-200 dark:border-amber-800"}>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              {isVerified ? (
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-600" />
              )}
              <div>
                <h3 className="font-semibold">
                  {isVerified ? "Tracking Verified" : "Tracking Not Yet Verified"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isVerified
                    ? "Your snippet is working. Pings are being received from this page."
                    : "Install the snippet on this test page and send a ping to verify it works."}
                </p>
              </div>
              <Badge variant={isVerified ? "default" : "secondary"} className="ml-auto">
                {isVerified ? "Verified" : "Pending"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Snippet Loaded */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
              <CardTitle>Tracking Snippet</CardTitle>
            </div>
            <CardDescription>
              The snippet is automatically loaded on this page. Here is the code being used:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                <code>{snippetCode}</code>
              </pre>
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2"
                onClick={handleCopySnippet}
              >
                {copiedSnippet ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Snippet status:{" "}
                {snippetLoaded ? (
                  <span className="text-green-600 font-medium">Loaded and active</span>
                ) : authLoading || configLoading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  <span className="text-amber-600 font-medium">Not loaded</span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Send Test Ping */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
              <CardTitle>Send Test Ping</CardTitle>
            </div>
            <CardDescription>
              Manually trigger a tracking ping to verify the backend receives it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleSendPing}
              disabled={pingStatus === "sending" || !snippetConfig}
              className="w-full sm:w-auto"
            >
              {pingStatus === "sending" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Test Ping
                </>
              )}
            </Button>

            {pingResponse && (
              <div className={`p-4 rounded-lg border ${pingResponse.success ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {pingResponse.success ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`font-medium ${pingResponse.success ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100"}`}>
                    {pingResponse.success ? "Ping Successful" : "Ping Failed"}
                  </span>
                </div>
                <pre className="text-xs overflow-x-auto bg-black/5 dark:bg-white/5 p-2 rounded">
                  {JSON.stringify(pingResponse, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Simulate Referral */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
              <CardTitle>Simulate Referral</CardTitle>
            </div>
            <CardDescription>
              Test the <code>Affilio.referral()</code> call as if a customer just signed up on your site. Pick an affiliate to attribute this signup to.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3">
              {/* Affiliate Selector */}
              <div className="space-y-2">
                <Label htmlFor="affiliate-select" className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  Attribute to Affiliate
                </Label>
                <Select
                  value={selectedAffiliateCode}
                  onValueChange={setSelectedAffiliateCode}
                >
                  <SelectTrigger id="affiliate-select" className="w-full sm:w-[320px]">
                    <SelectValue placeholder="Select an active affiliate..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAffiliates.length === 0 && (
                      <SelectItem value="_none" disabled>
                        No active affiliates found
                      </SelectItem>
                    )}
                    {activeAffiliates.map((affiliate) => (
                      <SelectItem key={affiliate._id} value={affiliate.uniqueCode}>
                        {affiliate.name} ({affiliate.uniqueCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {selectedAffiliateCode
                    ? `This signup will be attributed to affiliate code: ${selectedAffiliateCode}`
                    : "Leave empty to test organic signup (no affiliate attribution)."}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="test-email">Customer Email</Label>
                  <Input
                    id="test-email"
                    type="email"
                    value={referralEmail}
                    onChange={(e) => setReferralEmail(e.target.value)}
                    placeholder="customer@example.com"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleSimulateReferral}
                    disabled={referralStatus === "sending" || !snippetConfig || !referralEmail}
                  >
                    {referralStatus === "sending" ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Code2 className="w-4 h-4 mr-2" />
                        Simulate Signup
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Response details */}
            {referralResponse && (
              <div className={`p-4 rounded-lg border ${referralResponse.success && referralResponse.leadId ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" : referralResponse.success ? "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800" : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {referralResponse.success && referralResponse.leadId ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : referralResponse.success ? (
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`font-medium ${referralResponse.success && referralResponse.leadId ? "text-green-900 dark:text-green-100" : referralResponse.success ? "text-blue-900 dark:text-blue-100" : "text-red-900 dark:text-red-100"}`}>
                    {referralResponse.success && referralResponse.leadId
                      ? "Lead Created Successfully"
                      : referralResponse.success
                        ? referralResponse.message || "Referral Recorded"
                        : "Referral Failed"}
                  </span>
                </div>

                {referralResponse.leadId && (
                  <div className="text-sm space-y-1 mb-2">
                    <p><strong>Lead ID:</strong> <code className="bg-black/5 dark:bg-white/5 px-1 rounded">{referralResponse.leadId}</code></p>
                    <p><strong>New Lead:</strong> {referralResponse.isNew ? "Yes" : "No (updated existing)"}</p>
                  </div>
                )}

                <pre className="text-xs overflow-x-auto bg-black/5 dark:bg-white/5 p-2 rounded">
                  {JSON.stringify(referralResponse, null, 2)}
                </pre>
              </div>
            )}

            {/* Data updated explainer */}
            {referralStatus === "success" && referralResponse?.leadId && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm space-y-1">
                <p className="font-medium text-slate-900 dark:text-slate-100">What was updated:</p>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-0.5">
                  <li><code>referralLeads</code> table — new lead linked to affiliate <strong>{selectedAffiliateCode}</strong></li>
                  <li><code>referralPings</code> table — health ping recorded</li>
                  <li>Dashboard banner — &quot;Referral tracking not configured&quot; is now hidden</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-1">
                  A commission will be created when a payment webhook arrives for this email.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 4: Trigger Mock Payment */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</div>
              <CardTitle>Trigger Mock Payment</CardTitle>
            </div>
            <CardDescription>
              Simulate a $99.00 purchase from the same customer email to test the full conversion → commission flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 space-y-2 w-full">
                <Label htmlFor="payment-email">Customer Email (must match lead)</Label>
                <Input
                  id="payment-email"
                  type="email"
                  value={referralEmail}
                  onChange={(e) => setReferralEmail(e.target.value)}
                  placeholder="customer@example.com"
                />
              </div>
              <Button
                onClick={handleTriggerPayment}
                disabled={paymentStatus === "sending" || !snippetConfig || !referralEmail}
                variant="outline"
                className="border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950"
              >
                {paymentStatus === "sending" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Triggering...
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4 mr-2" />
                    Trigger $99 Payment
                  </>
                )}
              </Button>
            </div>

            {paymentResponse && (
              <div className={`p-4 rounded-lg border ${paymentResponse.success ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {paymentResponse.success ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`font-medium ${paymentResponse.success ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100"}`}>
                    {paymentResponse.success ? "Mock Payment Triggered" : "Payment Trigger Failed"}
                  </span>
                </div>
                <pre className="text-xs overflow-x-auto bg-black/5 dark:bg-white/5 p-2 rounded">
                  {JSON.stringify(paymentResponse, null, 2)}
                </pre>
              </div>
            )}

            {paymentStatus === "success" && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm space-y-1">
                <p className="font-medium text-slate-900 dark:text-slate-100">What was updated:</p>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-0.5">
                  <li><code>conversions</code> table — new purchase record for <strong>${referralEmail}</strong></li>
                  <li><code>referralLeads</code> table — lead status updated to &quot;converted&quot;</li>
                  <li><code>commissions</code> table — commission created for the affiliate</li>
                </ul>
                <div className="flex gap-2 mt-2">
                  <Link href="/conversions">
                    <Button variant="link" size="sm" className="h-auto p-0">View Conversions →</Button>
                  </Link>
                  <Link href="/commissions">
                    <Button variant="link" size="sm" className="h-auto p-0">View Commissions →</Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 5: Browser Console */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">5</div>
              <CardTitle>Browser Console</CardTitle>
            </div>
            <CardDescription>
              Open your browser&apos;s developer console to see Affilio debug logs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 font-mono text-sm p-4 rounded-lg space-y-1">
              <p>{`> Affilio is initialized with key: ${snippetConfig?.publicKey?.slice(0, 16)}...`}</p>
              <p>{`> Ping sent successfully`}</p>
              <p>{`> Attribution data set from referral path`}</p>
              <p className="text-muted-foreground">{`// Look for messages prefixed with [Affilio]`}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              The snippet logs debug messages when <code>data-debug=&quot;true&quot;</code> is set. On production, remove this attribute.
            </p>
          </CardContent>
        </Card>

        {/* Refresh Verification */}
        <div className="flex items-center justify-between pt-4">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reload Page
          </Button>
          <Link href="/settings/tracking">
            <Button className="bg-[#1c2260] hover:bg-[#1fb5a5]">
              Go to Tracking Settings
              <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
