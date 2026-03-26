"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterTabs, type FilterTabItem } from "@/components/ui/FilterTabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Code2, 
  Globe, 
  ShoppingCart, 
  CheckCircle, 
  AlertCircle,
  Copy,
  Check,
  Terminal
} from "lucide-react";

interface CodeExample {
  id: string;
  label: string;
  icon: React.ReactNode;
  code: string;
  description: string;
}

const codeExamples: CodeExample[] = [
  {
    id: "js-sdk",
    label: "JavaScript SDK",
    icon: <Code2 className="w-4 h-4" />,
    description: "Use the SaligPay JavaScript SDK for seamless integration",
    code: `// Initialize SaligPay SDK
const saligpay = new SaligPay({
  publicKey: 'your_public_key',
});

// Get attribution from cookie (provided by track.js)
const attribution = window.SaligAffiliate?.getAttributionData?.() || {};

// Create checkout with attribution metadata
const checkout = await saligpay.checkout.create({
  amount: 1000,
  currency: 'PHP',
  metadata: {
    // Required: Affiliate referral code
    _salig_aff_ref: attribution.code || '',
    // Optional: Click tracking ID
    _salig_aff_click_id: attribution.clickId || '',
    // Optional: Your tenant ID
    _salig_aff_tenant: attribution.tenantId || '',
  },
});

// Redirect to checkout
await checkout.redirect();`,
  },
  {
    id: "rest-api",
    label: "REST API",
    icon: <Globe className="w-4 h-4" />,
    description: "Server-side integration using the SaligPay REST API",
    code: `# Python example
import requests
from flask import request

# Get attribution from cookie
attribution_code = request.cookies.get('_salig_aff')
click_id = request.cookies.get('_salig_click_id')

# Create checkout session with attribution
response = requests.post(
    'https://api.saligpay.com/v1/checkout',
    headers={
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
    },
    json={
        'amount': 1000,
        'currency': 'PHP',
        'metadata': {
            '_salig_aff_ref': attribution_code or '',
            '_salig_aff_click_id': click_id or '',
        }
    }
)

checkout_session = response.json()
# Redirect customer to checkout_session['url']`,
  },
  {
    id: "checkout-overlay",
    label: "Checkout Overlay",
    icon: <ShoppingCart className="w-4 h-4" />,
    description: "Use the embedded checkout overlay for a seamless experience",
    code: `<!-- Include SaligPay SDK -->
<script src="https://js.saligpay.com/v1.js"></script>

<!-- Your tracking snippet (already installed) -->
<script src="/track.js" data-key="YOUR_PUBLIC_KEY" async></script>

<script>
function openCheckout(amount) {
  // Get attribution data from the tracking library
  const attribution = window.SaligAffiliate?.getAttributionData?.() || {};
  
  // Open checkout overlay with attribution
  SaligPay.open({
    amount: amount,
    currency: 'PHP',
    metadata: {
      _salig_aff_ref: attribution.code || '',
      _salig_aff_click_id: attribution.clickId || '',
    },
    onSuccess: function(result) {
      console.log('Payment successful:', result);
    },
    onClose: function() {
      console.log('Checkout closed');
    }
  });
}
</script>

<!-- Trigger checkout -->
<button onclick="openCheckout(1000)" class="buy-button">
  Buy Now - ₱1,000
</button>`,
  },
];

export function CheckoutAttributionGuide() {
  const [activeTab, setActiveTab] = useState("js-sdk");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          Configure Checkout Attribution
        </h2>
        <p className="text-muted-foreground">
          Pass referral attribution data through your SaligPay checkout sessions to automatically 
          track conversions and attribute commissions to affiliates.
        </p>
      </div>

      {/* How it Works */}
      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle>How Attribution Works</AlertTitle>
        <AlertDescription className="text-sm">
          When a customer clicks an affiliate link, the tracking snippet stores the affiliate code 
          in a cookie. During checkout, you pass this code through SaligPay&apos;s metadata field. 
          When the payment webhook fires, we extract the attribution data and link the conversion 
          to the correct affiliate.
        </AlertDescription>
      </Alert>

      {/* Required Metadata Fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Required Metadata Fields</CardTitle>
          <CardDescription>
            Include these fields in your SaligPay checkout metadata
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Badge variant="default" className="mt-0.5">Required</Badge>
              <div>
                <code className="text-sm font-semibold">_salig_aff_ref</code>
                <p className="text-sm text-muted-foreground mt-1">
                  The affiliate referral code from the tracking cookie
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Badge variant="secondary" className="mt-0.5">Optional</Badge>
              <div>
                <code className="text-sm font-semibold">_salig_aff_click_id</code>
                <p className="text-sm text-muted-foreground mt-1">
                  Unique click tracking ID for detailed analytics
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Badge variant="secondary" className="mt-0.5">Optional</Badge>
              <div>
                <code className="text-sm font-semibold">_salig_aff_tenant</code>
                <p className="text-sm text-muted-foreground mt-1">
                  Your tenant identifier (auto-populated by track.js)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Type Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Integration Examples
          </CardTitle>
          <CardDescription>
            Choose your integration type to see the relevant code example
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full space-y-4">
            <FilterTabs
              tabs={codeExamples.map((example) => ({
                key: example.id,
                label: example.label,
                icon: <span className="hidden sm:inline">{example.icon}</span>,
              }))}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              size="md"
              className="w-full"
            />
            
            {codeExamples
              .filter((example) => example.id === activeTab)
              .map((example) => (
                <div key={example.id} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {example.description}
                  </p>
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{example.code}</code>
                    </pre>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => handleCopy(example.code, example.id)}
                    >
                      {copiedId === example.id ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Always check if attribution data exists before passing it (handle organic traffic)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Pass empty strings rather than omitting fields to maintain consistent webhook parsing</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Test the attribution flow using the verification tool before going live</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Webhooks are the authoritative source - never rely solely on client-side attribution</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Alert variant="destructive" className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">Troubleshooting Tips</AlertTitle>
        <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
          If conversions aren&apos;t being attributed, verify that: (1) The tracking snippet is installed 
          and working, (2) You&apos;re passing metadata in the correct format, (3) The webhook endpoint 
          is receiving events, and (4) The SaligPay integration is connected in Settings.
        </AlertDescription>
      </Alert>
    </div>
  );
}
