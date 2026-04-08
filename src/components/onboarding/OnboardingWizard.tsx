"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, CreditCard, Users, Code, ArrowRight, SkipForward, Loader2, TrendingUp, Zap, CheckCircle2, Info } from "lucide-react";
import { TeamInvitationForm } from "@/components/settings/TeamInvitationForm";
import { FilterTabs, type FilterTabItem } from "@/components/ui/FilterTabs";

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  skippable: boolean;
}

const steps: OnboardingStep[] = [
  {
    id: 1,
    title: "Welcome",
    description: "Get started with your new affiliate program",
    icon: <Check className="w-5 h-5" />,
    skippable: false,
  },
  {
    id: 2,
    title: "Connect Payment Provider",
    description: "Choose your payment provider for automatic commission tracking",
    icon: <CreditCard className="w-5 h-5" />,
    skippable: true,
  },
  {
    id: 3,
    title: "Invite Team",
    description: "Add team members to help manage your program",
    icon: <Users className="w-5 h-5" />,
    skippable: true,
  },
  {
    id: 4,
    title: "Tracking Snippet",
    description: "Install the tracking code on your website",
    icon: <Code className="w-5 h-5" />,
    href: "/onboarding/snippet",
    skippable: true,
  },
  {
    id: 5,
    title: "Referral Tracking",
    description: "Add one line of code to your signup form",
    icon: <TrendingUp className="w-5 h-5" />,
    skippable: false, // Dynamic: will be conditionally set
  },
  {
    id: 6,
    title: "Complete Setup",
    description: "Review and launch your affiliate program",
    icon: <CheckCircle2 className="w-5 h-5" />,
    skippable: false,
  },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [connectedProvider, setConnectedProvider] = useState<"saligpay" | "stripe" | null>(null);

  const progress = ((currentStep + 1) / steps.length) * 100;

  // Determine if Step 5 (Referral Tracking) is skippable
  const isStep5Skippable = !connectedProvider;

  const handleNext = () => {
    // Block navigation from Step 5 if provider connected and not completed
    if (currentStep === 4 && connectedProvider && !completedSteps.includes(4)) {
      return; // User must complete Step 5
    }

    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep]);
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      router.push("/dashboard");
    }
  };

  const markTeamStepComplete = () => {
    if (!completedSteps.includes(2)) {
      setCompletedSteps([...completedSteps, 2]);
    }
  };

  const handleSkip = () => {
    const step = steps[currentStep];
    // Step 5 is not skippable when provider is connected
    if (currentStep === 4 && connectedProvider) {
      return;
    }
    if (step.skippable || (currentStep === 4 && !connectedProvider)) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        router.push("/dashboard");
      }
    }
  };

  const handleStepClick = (index: number) => {
    if (index <= currentStep || completedSteps.includes(index - 1)) {
      setCurrentStep(index);
    }
  };

  const goToDashboard = () => {
    router.push("/dashboard");
  };

  const canSkipStep = (stepIndex: number) => {
    if (stepIndex === 4 && connectedProvider) return false; // Step 5 not skippable when provider connected
    return steps[stepIndex].skippable;
  };

  return (
    <div className="space-y-8">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Step {currentStep + 1} of {steps.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => handleStepClick(index)}
            disabled={index > currentStep && !completedSteps.includes(index - 1)}
            className={`
              flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium transition-all
              ${index === currentStep 
                ? "bg-[#1c2260] text-white" 
                : completedSteps.includes(index) 
                  ? "bg-green-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }
              ${index > currentStep && !completedSteps.includes(index - 1) 
                ? "opacity-50 cursor-not-allowed" 
                : "cursor-pointer"
              }
            `}
          >
            {completedSteps.includes(index) ? (
              <Check className="w-5 h-5" />
            ) : (
              step.id
            )}
          </button>
        ))}
      </div>

      {/* Current Step Content */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            {steps[currentStep].icon}
          </div>
          <CardTitle className="text-xl">{steps[currentStep].title}</CardTitle>
          <CardDescription>{steps[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStep === 0 && (
            <WelcomeStepContent />
          )}
          {currentStep === 1 && (
            <ProviderChoiceStepContent
              onConnected={(provider) => {
                setConnectedProvider(provider);
                if (!completedSteps.includes(1)) {
                  setCompletedSteps([...completedSteps, 1]);
                }
              }}
              onSkip={() => {
                if (!completedSteps.includes(1)) {
                  setCompletedSteps([...completedSteps, 1]);
                }
                setCurrentStep(2);
              }}
            />
          )}
          {currentStep === 2 && (
            <TeamStepContent onComplete={markTeamStepComplete} />
          )}
          {currentStep === 3 && (
            <SnippetStepContent />
          )}
          {currentStep === 4 && (
            <ReferralTrackingStepContent
              connectedProvider={connectedProvider}
              onCompleted={() => {
                if (!completedSteps.includes(4)) {
                  setCompletedSteps([...completedSteps, 4]);
                }
              }}
            />
          )}
          {currentStep === 5 && (
            <CompletionStepContent connectedProvider={connectedProvider} completedSteps={completedSteps} />
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            {canSkipStep(currentStep) && (
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-muted-foreground"
              >
                <SkipForward className="w-4 h-4 mr-2" />
                Skip for now
              </Button>
            )}
            {!canSkipStep(currentStep) && <div />}
            <div className="flex items-center gap-2 ml-auto">
              {currentStep === 0 && (
                <Button
                  variant="outline"
                  onClick={goToDashboard}
                >
                  Skip onboarding
                </Button>
              )}
              <Button
                onClick={handleNext}
                className="bg-[#1c2260] hover:bg-[#1fb5a5]"
              >
                {currentStep === steps.length - 1 ? (
                  <>
                    Complete Setup
                    <Check className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress indicator text */}
      <div className="text-center text-sm text-muted-foreground">
        {completedSteps.length} of {steps.length - 1} optional steps completed
      </div>
    </div>
  );
}

// Welcome Step Content
function WelcomeStepContent() {
  const features = [
    "Track affiliate commissions automatically",
    "Connect Stripe, SaligPay, or any payment provider",
    "Invite team members to help manage",
    "Monitor performance with real-time analytics",
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Welcome to Affilio! Let&apos;s set up your affiliate program in just a few minutes.
      </p>
      <ul className="space-y-3">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mt-0.5">
              <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Provider Choice Step — Two equal cards for Stripe and SaligPay
function ProviderChoiceStepContent({ onConnected, onSkip }: { onConnected: (provider: "saligpay" | "stripe") => void; onSkip?: () => void }) {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const currentUser = useQuery(api.auth.getCurrentUser);
  
  const connectionStatus = useQuery(
    api.tenants.getSaligPayConnectionStatus,
    currentUser?.tenantId ? { tenantId: currentUser.tenantId as Id<"tenants"> } : "skip"
  );

  const stripeStatus = useQuery(
    api.tenants.getStripeConnectionStatus,
    currentUser?.tenantId ? { tenantId: currentUser?.tenantId as Id<"tenants"> } : "skip"
  );

  const connectMockSaligPay = useMutation(api.tenants.connectMockSaligPay);
  const disconnectSaligPay = useMutation(api.tenants.disconnectSaligPay);
  const connectStripe = useMutation(api.tenants.connectStripe);
  const disconnectStripe = useMutation(api.tenants.disconnectStripe);

  const isSaligPayConnected = connectionStatus?.isConnected ?? false;
  const isStripeConnected = stripeStatus?.isConnected ?? false;

  // Notify parent of existing connection on mount
  if (connectionStatus !== undefined && connectionStatus?.isConnected) {
    // Connection already exists — no action needed in render
  }

  const handleConnectSaligPay = async () => {
    if (!currentUser?.tenantId) return;
    try {
      setIsConnecting("saligpay");
      setConnectionError(null);
      await connectMockSaligPay({ tenantId: currentUser.tenantId as Id<"tenants"> });
      onConnected("saligpay");
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Failed to connect SaligPay");
    } finally {
      setIsConnecting(null);
    }
  };

  const handleConnectStripe = async () => {
    if (!currentUser?.tenantId) return;
    try {
      setIsConnecting("stripe");
      setConnectionError(null);
      await connectStripe({
        tenantId: currentUser.tenantId as Id<"tenants">,
        signingSecret: "whsec_placeholder",
      });
      onConnected("stripe");
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Failed to connect Stripe");
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDisconnect = async (provider: "saligpay" | "stripe") => {
    if (!currentUser?.tenantId) return;
    try {
      setIsConnecting(provider);
      setConnectionError(null);
      if (provider === "saligpay") {
        await disconnectSaligPay({ tenantId: currentUser.tenantId as Id<"tenants"> });
      } else {
        await disconnectStripe({ tenantId: currentUser.tenantId as Id<"tenants"> });
      }
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Failed to disconnect");
    } finally {
      setIsConnecting(null);
    }
  };

  const isConnected = isSaligPayConnected || isStripeConnected;

  if (isConnected) {
    const providerName = isSaligPayConnected ? "SaligPay" : "Stripe";
    const modeLabel = isSaligPayConnected
      ? (connectionStatus?.mode === "real" ? "Live Mode" : "Mock Mode")
      : (stripeStatus?.mode || "Live Mode");

    return (
      <div className="space-y-4">
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h4 className="font-medium text-green-900 dark:text-green-100">
                Connected ({modeLabel})
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300">
                {providerName} is connected for commission tracking
              </p>
            </div>
          </div>
        </div>
        
        <Button
          variant="outline"
          onClick={() => handleDisconnect(isSaligPayConnected ? "saligpay" : "stripe")}
          disabled={isConnecting !== null}
        >
          {isConnecting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            `Disconnect ${providerName}`
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Connect your payment provider to enable automatic commission tracking when customers pay.
      </p>

      {connectionError && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{connectionError}</p>
        </div>
      )}

      {!currentUser ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Stripe Card */}
          <div
            className="border rounded-xl p-4 space-y-3 hover:border-[#1fb5a5] transition-colors cursor-pointer"
            onClick={handleConnectStripe}
          >
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
                <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="font-medium">Stripe</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Accept payments from customers worldwide via Stripe.
            </p>
            {isConnecting === "stripe" && (
              <div className="flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
          </div>

          {/* SaligPay Card */}
          <div
            className="border rounded-xl p-4 space-y-3 hover:border-[#1fb5a5] transition-colors cursor-pointer"
            onClick={handleConnectSaligPay}
          >
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-950 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <span className="font-medium">SaligPay</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Local payment integration for PH/SEA markets.
            </p>
            {isConnecting === "saligpay" && (
              <div className="flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-center pt-2">
        <Button variant="link" onClick={() => onSkip?.()} className="text-muted-foreground">
          I&apos;ll set this up later
        </Button>
        <p className="text-xs text-muted-foreground mt-1">
          You can still track clicks and use the API. Connect a provider anytime from Settings.
        </p>
      </div>
    </div>
  );
}

// Team Step Content
function TeamStepContent({ onComplete }: { onComplete?: () => void }) {
  const handleInvitationSent = () => {
    onComplete?.();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Invite team members to help manage your affiliate program.
      </p>
      <TeamInvitationForm onInvitationSent={handleInvitationSent} />
      <p className="text-xs text-muted-foreground text-center">
        You can skip this step for now and invite team members later from the Settings page.
      </p>
    </div>
  );
}

// Snippet Step Content
function SnippetStepContent() {
  const router = useRouter();
  
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Add the Affilio tracking snippet to your website to track referral clicks.
      </p>
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Install Tracking Snippet
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
          Configure and install your tracking snippet to enable click and conversion attribution.
        </p>
        <Button
          onClick={() => router.push("/onboarding/snippet")}
          className="w-full bg-[#1c2260] hover:bg-[#1fb5a5]"
        >
          Continue to Snippet Setup
        </Button>
      </div>
    </div>
  );
}

// Referral Tracking Step — Code snippet with framework examples + best practices
function ReferralTrackingStepContent({
  connectedProvider,
  onCompleted,
}: {
  connectedProvider: "saligpay" | "stripe" | null;
  onCompleted?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<"react" | "javascript" | "jquery">("javascript");

  const snippet = `// Add to your signup form's submit handler:
if (window.Affilio) {
  Affilio.referral({ email: customerEmail });
}`;

  const frameworkExamples: Record<string, { label: string; code: string }> = {
    javascript: {
      label: "Vanilla JS",
      code: `// Add this inside your form submit handler
document.getElementById("signup-form").addEventListener("submit", function(e) {
  const email = document.getElementById("email").value;
  if (window.Affilio) {
    Affilio.referral({ email });
  }
});`,
    },
    react: {
      label: "React",
      code: `// Add this inside your form's onSubmit handler
function SignupForm({ onSubmit }) {
  const [email, setEmail] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (window.Affilio) {
      Affilio.referral({ email });
    }
    onSubmit(email);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit">Sign Up</button>
    </form>
  );
}`,
    },
    jquery: {
      label: "jQuery",
      code: `// Add this inside your document ready block
$("#signup-form").on("submit", function(e) {
  const email = $("#email").val();
  if (window.Affilio) {
    Affilio.referral({ email });
  }
});`,
    },
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    onCompleted?.();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyFramework = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    onCompleted?.();
    setTimeout(() => setCopied(false), 2000);
  };

  const frameworkTabs: FilterTabItem[] = Object.entries(frameworkExamples).map(([key, example]) => ({
    key,
    label: example.label,
  }));

  return (
    <div className="space-y-4">
      {/* Context — connects to Step 4 */}
      <div className="flex items-start gap-2 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
        <p>
          Remember the tracking snippet you installed in the previous step? That snippet captures
          <strong> referral clicks</strong>. This step captures <strong>signups</strong> &mdash; so when
          a customer who clicked an affiliate link signs up, we can credit the affiliate.
        </p>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Add this line to your signup form&apos;s submit handler. When a customer signs up,
        Affilio captures their email and matches it to the affiliate who referred them.
      </p>

      {/* One-liner Snippet */}
      <div className="relative rounded-lg bg-gray-900 p-4">
        <code className="text-sm text-green-400 block whitespace-pre">
          {snippet}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="absolute top-2 right-2 bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300"
        >
          {copied ? (
            <Check className="w-4 h-4" />
          ) : (
            "Copy"
          )}
        </Button>
      </div>

      {/* Framework Examples */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">
          Need a full example? Choose your framework:
        </p>
        <div className="space-y-3">
          <FilterTabs
            tabs={frameworkTabs}
            activeTab={selectedFramework}
            onTabChange={(v) => setSelectedFramework(v as "react" | "javascript" | "jquery")}
            size="sm"
            className="justify-start"
          />
          <div className="relative rounded-lg bg-gray-900 p-4 max-h-64 overflow-y-auto">
            <pre className="text-xs text-green-400 whitespace-pre">
              {frameworkExamples[selectedFramework].code}
            </pre>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopyFramework(frameworkExamples[selectedFramework].code)}
              className="absolute top-2 right-2 bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300"
            >
              Copy
            </Button>
          </div>
        </div>
      </div>

      {/* Best Practices */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Best practices:</p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-green-500">+</span>
            Add this to every signup form on your site, not just one
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500">+</span>
            Call after email verification for best results
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500">+</span>
            The <code className="bg-muted px-1 rounded">if (window.Affilio)</code> guard ensures it won&apos;t break your form if the tracking snippet hasn&apos;t loaded yet
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500">+</span>
            The customer&apos;s email links them to the affiliate who referred them
          </li>
        </ul>
      </div>

      {/* Provider-Specific Advanced (collapsible) */}
      {connectedProvider === "saligpay" && (
        <div className="space-y-2">
          <details className="text-sm">
            <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
              Advanced: Metadata Enhancement
            </summary>
            <div className="mt-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-2">
              <p>
                For click-level precision, you can optionally pass attribution metadata
                through your payment provider checkout:
              </p>
              <div className="rounded bg-gray-900 p-2">
                <code className="text-xs text-green-400 block break-all">
                  {`if (window.Affilio) {\n  Affilio.referral({ email: customerEmail });\n}`}
                </code>
              </div>
              <p className="text-xs">
                Most merchants will never need this. The simple approach above works for all providers.
              </p>
            </div>
          </details>
        </div>
      )}

      {!connectedProvider && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Connecting a payment provider enables automatic commission tracking via webhooks.
            The referral snippet still works without one &mdash; you&apos;ll just track signups manually.
          </p>
        </div>
      )}
    </div>
  );
}

// Completion Step — Summary of setup
function CompletionStepContent({
  connectedProvider,
  completedSteps,
}: {
  connectedProvider: "saligpay" | "stripe" | null;
  completedSteps: number[];
}) {
  return (
    <div className="space-y-4 text-center">
      <div className="flex items-center justify-center space-x-1 mb-2">
        <Check className="w-6 h-6 text-green-500" />
        <span className="text-lg font-medium text-green-700 dark:text-green-300">
          Setup Complete
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        Your affiliate program is ready to go! Here&apos;s what&apos;s configured:
      </p>

      <div className="space-y-2 text-left max-w-sm mx-auto">
        <div className="flex items-center gap-2 text-sm">
          <Check className={`w-4 h-4 ${completedSteps.includes(1) ? "text-green-500" : "text-muted-foreground"}`} />
          <span>Payment Provider: {connectedProvider ? connectedProvider.charAt(0).toUpperCase() + connectedProvider.slice(1) : "Not connected"}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Check className={`w-4 h-4 ${completedSteps.includes(2) ? "text-green-500" : "text-muted-foreground"}`} />
          <span>Team Invitations</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Check className={`w-4 h-4 ${completedSteps.includes(3) ? "text-green-500" : "text-muted-foreground"}`} />
          <span>Tracking Snippet</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Check className={`w-4 h-4 ${completedSteps.includes(4) ? "text-green-500" : "text-muted-foreground"}`} />
          <span>Referral Tracking</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        You can configure additional settings from the Dashboard or Settings page at any time.
      </p>
    </div>
  );
}
