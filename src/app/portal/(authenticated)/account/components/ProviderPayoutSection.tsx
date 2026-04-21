"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2, Loader2, ShieldCheck, AlertCircle, Info, CheckCircle2, Clock } from "lucide-react";

interface ProviderPayoutSectionProps {
  payoutProviderStatus?: string;
  payoutProviderAccountId?: string;
  payoutProviderStatusDetails?: {
    currentlyDue?: string[];
    eventuallyDue?: string[];
    pastDue?: string[];
    rejectionReason?: string;
  };
  stripeAccountId?: string;
}

type SetupResult = "success" | "pending" | "error" | null;

const KYC_REQUIREMENT_LABELS: Record<string, string> = {
  "individual.id_number": "Government-issued ID number",
  "individual.dob": "Date of birth",
  "individual.verification.document": "Verification document",
  "individual.verification.additional_document": "Additional verification document",
  "external_account": "Bank account information",
  "person_tos_acceptance": "Terms of service acceptance",
  "person_address": "Residential address",
  "individual.first_name": "Legal first name",
  "individual.last_name": "Legal last name",
  "relationship.account_owner": "Account owner verification",
  "business_profile.url": "Business profile URL",
  "business_profile.mcc": "Business category code",
  "business_profile.name": "Business name",
  "business_profile.support_phone": "Support phone number",
  "business_profile.support_url": "Support website",
  "business_profile.tax_id": "Tax identification",
};

const BEFORE_YOU_START_ITEMS = [
  "A valid government-issued ID (passport, driver's license, PhilHealth UMID, or national ID)",
  "Your bank account details",
  "Your legal name and address",
];

export function ProviderPayoutSection({
  payoutProviderStatus,
  payoutProviderAccountId,
  payoutProviderStatusDetails,
  stripeAccountId,
}: ProviderPayoutSectionProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupResult, setSetupResult] = useState<SetupResult>(null);
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  const setupParam = searchParams.get("setup");
  const tokenParam = searchParams.get("token");

  const generateLink = useAction(
    api.affiliateProviderOnboardingActions.generateOnboardingLink,
  );
  const rejectedRetry = useAction(
    api.affiliateProviderOnboardingActions.handleRejectedRetry,
  );
  const handleReturn = useAction(
    api.affiliateProviderOnboardingActions.handleOnboardingReturn,
  );
  const handleRefresh = useAction(
    api.affiliateProviderOnboardingActions.handleOnboardingRefresh,
  );
  const refreshStatus = useAction(
    api.affiliateProviderOnboardingActions.refreshProviderStatus,
  );

  const isVerified = payoutProviderStatus === "verified";
  const isPending = payoutProviderStatus === "pending";
  const isRejected = payoutProviderStatus === "rejected";
  const isNotStarted = !payoutProviderStatus && !payoutProviderAccountId;
  const isProviderAvailable = true;

  const hasFetchedRef = useRef(false);
  const isRedirectingRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current || !payoutProviderAccountId || isProcessingCallback) return;
    hasFetchedRef.current = true;
    refreshStatus({});
  }, [payoutProviderAccountId, isProcessingCallback, refreshStatus]);

  const clearCallbackUrl = useCallback(() => {
    router.replace("/portal/account");
  }, [router]);

  useEffect(() => {
    if (!setupParam || !tokenParam) return;

    let cancelled = false;
    setIsProcessingCallback(true);

    const processCallback = async () => {
      try {
        if (setupParam === "return") {
          const result = await handleReturn({ token: tokenParam });
          if (cancelled) return;
          if (result && result.enabled) {
            setSetupResult("success");
          } else if (result) {
            setSetupResult("pending");
          } else {
            setSetupResult("error");
          }
        } else if (setupParam === "refresh") {
          const result = await handleRefresh({ token: tokenParam });
          if (cancelled) return;
          if (!result) {
            setSetupResult("error");
          }
        }
      } catch {
        if (!cancelled) {
          setSetupResult("error");
        }
      } finally {
        if (!cancelled) {
          setIsProcessingCallback(false);
          clearCallbackUrl();
        }
      }
    };

    processCallback();
    return () => {
      cancelled = true;
    };
  }, [setupParam, tokenParam, handleReturn, handleRefresh, clearCallbackUrl]);

  useEffect(() => {
    if (!setupResult) return;
    const timer = setTimeout(() => setSetupResult(null), 8000);
    return () => clearTimeout(timer);
  }, [setupResult]);

  const dismissResult = () => setSetupResult(null);

  const handleSetupPayouts = async () => {
    if (isRedirectingRef.current) return;
    isRedirectingRef.current = true;
    setIsRedirecting(true);
    setError(null);

    try {
      const result = await generateLink({});
      if (result?.url) {
        window.location.href = result.url;
      } else {
        setError("Failed to generate payout setup link. Please try again.");
        setIsRedirecting(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate payout setup link";
      setError(message.split("\n")[0].replace(/^Uncaught Error: /, ""));
      setIsRedirecting(false);
    }
  };

  const handleRetryRejected = async () => {
    if (isRedirectingRef.current) return;
    isRedirectingRef.current = true;
    setIsRedirecting(true);
    setError(null);

    try {
      const result = await rejectedRetry({});
      if (result?.url) {
        window.location.href = result.url;
      } else {
        setError("Failed to generate payout setup link. Please try again.");
        setIsRedirecting(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate payout setup link";
      setError(message.split("\n")[0].replace(/^Uncaught Error: /, ""));
      setIsRedirecting(false);
    }
  };

  if (!isProviderAvailable) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Provider Payout
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <Info className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm">Payouts not available</p>
              <p className="text-xs text-muted-foreground">
                Contact your account manager for payout setup.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Provider Payout
          </CardTitle>
          {isVerified && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 border border-green-200">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Connected via Stripe Connect
            </span>
          )}
          {isPending && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              In Progress via Stripe Connect
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 border border-red-200">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Rejected
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {setupResult && (
          <div
            onClick={dismissResult}
            className="mb-4"
          >
            {setupResult === "success" && (
              <div className="flex items-center gap-3 rounded-lg bg-green-50 p-3 border border-green-200 cursor-pointer">
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">Payout setup complete</p>
                  <p className="text-xs text-green-600">
                    You&apos;re ready to receive commission payouts automatically.
                  </p>
                </div>
              </div>
            )}
            {setupResult === "pending" && (
              <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-3 border border-amber-200 cursor-pointer">
                <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-800">Verification in progress</p>
                  <p className="text-xs text-amber-600">
                    You may need to provide additional information to complete setup.
                  </p>
                </div>
              </div>
            )}
            {setupResult === "error" && (
              <div className="flex items-start gap-3 rounded-lg bg-red-50 p-3 border border-red-200">
                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Setup link expired or invalid</p>
                  <p className="text-xs text-red-600">
                    This payout setup link has expired or is invalid. Please try again.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSetupResult(null);
                    }}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {isProcessingCallback && (
          <div className="flex items-center justify-center gap-2 py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Processing payout setup...
            </span>
          </div>
        )}

        {!isProcessingCallback && (isNotStarted || isPending) && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Before You Start
              </p>
              <ul className="space-y-1.5">
                {BEFORE_YOU_START_ITEMS.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-muted-foreground"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {isPending && payoutProviderStatusDetails?.currentlyDue && payoutProviderStatusDetails.currentlyDue.length > 0 && (
              <div className="rounded-lg bg-amber-50 p-3 border border-amber-200">
                <p className="text-xs font-medium text-amber-800 mb-2">
                  Action Required
                </p>
                <ul className="space-y-1.5">
                  {payoutProviderStatusDetails.currentlyDue.map((req: string, i: number) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs text-amber-700"
                    >
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span>{KYC_REQUIREMENT_LABELS[req] ?? req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isPending && (!payoutProviderStatusDetails?.currentlyDue || payoutProviderStatusDetails.currentlyDue.length === 0) && payoutProviderStatusDetails?.eventuallyDue && payoutProviderStatusDetails.eventuallyDue.length > 0 && (
              <div className="rounded-lg bg-green-50 p-3 border border-green-200">
                <p className="text-xs text-green-700">
                  All set for now — no action needed. We may contact you if additional information is required.
                </p>
              </div>
            )}

            <Button
              size="sm"
              onClick={handleSetupPayouts}
              disabled={isRedirecting}
              className="bg-[var(--portal-primary)] w-full"
            >
              {isRedirecting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Redirecting...
                </>
              ) : isPending ? (
                "Complete Verification"
              ) : (
                "Set Up Payouts"
              )}
            </Button>

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 p-2.5 border border-red-200">
                <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
          </div>
        )}

        {!isProcessingCallback && isVerified && (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-sm">Payout account connected</p>
              <p className="text-xs text-muted-foreground">
                You&apos;re ready to receive commission payouts automatically.
              </p>
            </div>
          </div>
        )}

        {!isProcessingCallback && isRejected && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="font-medium text-sm text-red-800">Payout verification failed</p>
                {payoutProviderStatusDetails?.rejectionReason ? (
                  <p className="text-xs text-red-600">
                    Reason: {payoutProviderStatusDetails.rejectionReason}
                  </p>
                ) : (
                  <p className="text-xs text-red-600">
                    Contact your account manager for details.
                  </p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleRetryRejected}
              disabled={isRedirecting}
              className="bg-[var(--portal-primary)] w-full"
            >
              {isRedirecting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Redirecting...
                </>
              ) : (
                "Try Again"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
