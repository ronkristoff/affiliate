"use client";

import { useState } from "react";
import { AttributionVerifier } from "@/components/onboarding/AttributionVerifier";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Info, 
  CheckCircle,
  AlertCircle,
  XCircle,
  Code2,
  Webhook,
  ChevronDown,
  ChevronUp,
  Loader2
} from "lucide-react";
import { format } from "date-fns";

export default function AttributionSettingsPage() {
  const [showWebhookLogs, setShowWebhookLogs] = useState(false);
  
  // Get recent webhooks
  const webhooks = useQuery(api.webhooks.listRecentWebhooks, { count: 5 });
  
  // Get attribution config (dynamic)
  const attributionConfig = useQuery(api.tenants.getAttributionConfig);
  
  return (
    <div className="animate-fade-in">
      <PageTopbar description="Configure and monitor how referral conversions are tracked and attributed">
        <h1 className="text-lg font-semibold text-heading">Attribution Settings</h1>
      </PageTopbar>
      <div className="px-8 py-6">
        <div className="max-w-4xl space-y-6">

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Attribution Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attributionConfig === undefined ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : attributionConfig.isActive ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-semibold">Active</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tracking snippet verified
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span className="font-semibold">Inactive</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Install tracking snippet to activate
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tracking Method
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attributionConfig === undefined ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold">{attributionConfig.trackingMethod}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Attribution method
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Webhook Source
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attributionConfig === undefined ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : attributionConfig.webhookSource === "none" ? (
                <>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span className="font-semibold">Not Connected</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Connect a payment provider
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Webhook className="w-5 h-5 text-purple-600" />
                    <Badge variant="outline">
                      {attributionConfig.webhookSource === "saligpay" ? "SaligPay" : "Stripe"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Connected and receiving events
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>About Attribution</AlertTitle>
          <AlertDescription>
            Attribution connects affiliate referrals to actual conversions. When a customer clicks 
            an affiliate link, we store their code in a cookie. During checkout, this code is passed 
            to your payment provider through metadata. When the payment completes, our webhook extracts the 
            attribution data and creates a conversion record linked to the affiliate.
          </AlertDescription>
        </Alert>

        {/* Quick Reference */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Reference</CardTitle>
            <CardDescription>
              Metadata fields required in your payment provider checkout
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <code className="text-sm font-semibold">_affilio_ref</code>
                <div className="flex items-center gap-2">
                  <Badge>Required</Badge>
                  <span className="text-sm text-muted-foreground">Affiliate referral code</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <code className="text-sm font-semibold">_affilio_click_id</code>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Optional</Badge>
                  <span className="text-sm text-muted-foreground">Click tracking ID</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <code className="text-sm font-semibold">_affilio_tenant</code>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Optional</Badge>
                  <span className="text-sm text-muted-foreground">Tenant identifier</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Troubleshooting */}
        <Alert variant="destructive" className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">Common Issues</AlertTitle>
          <AlertDescription className="text-sm text-amber-700 dark:text-amber-300 space-y-2">
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Conversions not attributed:</strong> Verify metadata fields match exactly (case-sensitive)</li>
              <li><strong>Missing affiliate code:</strong> Ensure tracking snippet is installed and working</li>
              <li><strong>Webhook not firing:</strong> Check your payment provider connection status in settings</li>
              <li><strong>Organic traffic showing:</strong> Normal for direct customers without affiliate referral</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Webhook Logs Section - NEW */}
        <Card>
          <CardHeader>
            <Button
              variant="ghost"
              className="flex items-center justify-between w-full text-left h-auto p-0"
              onClick={() => setShowWebhookLogs(!showWebhookLogs)}
            >
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="w-5 h-5" />
                  Webhook Logs
                </CardTitle>
                <CardDescription>
                  View recent webhook events for debugging attribution issues
                </CardDescription>
              </div>
              {showWebhookLogs ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </Button>
          </CardHeader>
          {showWebhookLogs && (
            <CardContent>
              {webhooks === undefined ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : webhooks.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No webhooks received yet
                </div>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((webhook) => (
                    <WebhookLogItem key={webhook._id} webhook={webhook} />
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Attribution Verifier */}
        <AttributionVerifier webhookSource={attributionConfig?.webhookSource} />
        </div>
      </div>
    </div>
  );
}

// Webhook log item component
function WebhookLogItem({ webhook }: { webhook: any }) {
  const [expanded, setExpanded] = useState(false);
  const fullPayload = useQuery(api.webhooks.getWebhookPayload, { webhookId: webhook._id });
  
  const parsePayload = (raw: string) => {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  };

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant={webhook.status === "processed" ? "default" : "secondary"}>
            {webhook.eventType}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {format(webhook._creationTime, "MMM d, h:mm:ss a")}
          </span>
          <Badge variant="outline">{webhook.source}</Badge>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>
      
      {expanded && fullPayload && (
        <div className="mt-3 p-3 bg-muted rounded-lg">
          <p className="text-xs font-semibold mb-2">Event ID: {fullPayload.eventId}</p>
          <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
            {parsePayload(fullPayload.rawPayload)}
          </pre>
          {fullPayload.errorMessage && (
            <p className="text-xs text-red-500 mt-2">Error: {fullPayload.errorMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}
