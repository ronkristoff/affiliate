"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  TrendingUp,
  MousePointer,
  CreditCard,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { Doc } from "@/convex/_generated/dataModel";

interface AttributionTestResult {
  step: string;
  status: "pending" | "success" | "error";
  message: string;
}

interface AttributionVerifierProps {
  webhookSource?: "saligpay" | "stripe" | "none";
}

export function AttributionVerifier({ webhookSource = "none" }: AttributionVerifierProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<AttributionTestResult[]>([]);
  
  // Get recent conversions for display
  const recentConversions = useQuery(api.conversions.listRecentWithAttribution, { count: 10 });

  const runAttributionTest = async () => {
    setIsTesting(true);
    setTestResults([]);

    const results: AttributionTestResult[] = [];

    // Step 1: Check tracking snippet
    results.push({
      step: "Tracking Snippet",
      status: typeof window !== 'undefined' && (window as any).Affilio ? "success" : "error",
      message: typeof window !== 'undefined' && (window as any).Affilio
        ? "Tracking library loaded successfully"
        : "Tracking library not found - ensure track.js is installed",
    });

    // Step 2: Check attribution data availability
    setTestResults([...results]);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const affilio = typeof window !== 'undefined' ? (window as any).Affilio : null;
    const hasAttributionData = affilio?.getAttributionData?.() || affilio?.getAffiliateCode?.();
    
    results.push({
      step: "Attribution Data",
      status: hasAttributionData ? "success" : "pending",
      message: hasAttributionData 
        ? "Attribution data available from cookie" 
        : "No attribution data in cookie - visit an affiliate link first",
    });

    // Step 3: Check SaligPay/Stripe integration
    setTestResults([...results]);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const hasPaymentIntegration = webhookSource !== "none";
    results.push({
      step: "Payment Integration",
      status: hasPaymentIntegration ? "success" : "error",
      message: hasPaymentIntegration 
        ? `Connected to ${webhookSource === "saligpay" ? "SaligPay" : "Stripe"} - webhook processing active`
        : "No payment provider connected - configure in billing settings",
    });

    // Step 4: Summary
    setTestResults([...results]);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const allPassed = results.every(r => r.status === "success");
    results.push({
      step: "Overall Status",
      status: allPassed ? "success" : "pending",
      message: allPassed 
        ? "Attribution system ready! Test with a real referral link." 
        : "Some checks pending - complete the items above",
    });

    setTestResults(results);
    setIsTesting(false);
  };

  return (
    <div className="space-y-6">
      {/* Test Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Attribution Test Tool
          </CardTitle>
          <CardDescription>
            Verify that your attribution setup is working correctly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={runAttributionTest}
            disabled={isTesting}
            className="w-full"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Run Attribution Test
              </>
            )}
          </Button>

          {testResults.length > 0 && (
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div 
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    result.status === "success" 
                      ? "bg-green-50 dark:bg-green-950" 
                      : result.status === "error"
                      ? "bg-red-50 dark:bg-red-950"
                      : "bg-amber-50 dark:bg-amber-950"
                  }`}
                >
                  {result.status === "success" ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  ) : result.status === "error" ? (
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{result.step}</p>
                    <p className={`text-sm ${
                      result.status === "success" 
                        ? "text-green-700 dark:text-green-300" 
                        : result.status === "error"
                        ? "text-red-700 dark:text-red-300"
                        : "text-amber-700 dark:text-amber-300"
                    }`}>
                      {result.message}
                    </p>
                  </div>
                  <Badge 
                    variant={result.status === "success" ? "default" : result.status === "error" ? "destructive" : "secondary"}
                  >
                    {result.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Conversions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recent Conversions
          </CardTitle>
          <CardDescription>
            View recent conversions and their attribution status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentConversions === undefined ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : recentConversions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No conversions recorded yet</p>
              <p className="text-sm mt-1">
                Complete a test purchase to see attribution data here
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentConversions.map((conv: any) => (
                  <TableRow key={conv._id}>
                    <TableCell className="text-sm">
                      {conv._creationTime ? format(conv._creationTime, "MMM d, h:mm a") : "N/A"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {new Intl.NumberFormat("en-PH", {
                        style: "currency",
                        currency: conv.currency || "PHP",
                      }).format(conv.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {conv.attributionSource === "checkout_metadata" ? (
                          <CreditCard className="w-3 h-3 mr-1" />
                        ) : conv.attributionSource === "cookie" ? (
                          <MousePointer className="w-3 h-3 mr-1" />
                        ) : null}
                        {conv.attributionSource?.replace("_", " ") || "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {conv.affiliateId ? (
                        <Badge variant="default" className="bg-green-600">
                          Attributed
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Organic</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={conv.status === "completed" ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {conv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
