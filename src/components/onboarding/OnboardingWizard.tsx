"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, CreditCard, Users, Code, ArrowRight, SkipForward, Loader2, TrendingUp } from "lucide-react";
import { TeamInvitationForm } from "@/components/settings/TeamInvitationForm";

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
    title: "Connect SaligPay",
    description: "Set up your payment integration",
    icon: <CreditCard className="w-5 h-5" />,
    href: "/onboarding/saligpay",
    skippable: true,
  },
  {
    id: 3,
    title: "Invite Team",
    description: "Add team members to help manage your program",
    icon: <Users className="w-5 h-5" />,
    href: "/onboarding/team",
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
    title: "Checkout Attribution",
    description: "Configure conversion attribution through checkout",
    icon: <TrendingUp className="w-5 h-5" />,
    href: "/onboarding/checkout-attribution",
    skippable: true,
  },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep]);
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding
      router.push("/dashboard");
    }
  };

  // Task 4.4: Helper to mark team step (step 2) as complete
  const markTeamStepComplete = () => {
    if (!completedSteps.includes(2)) {
      setCompletedSteps([...completedSteps, 2]);
    }
  };

  const handleSkip = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      router.push("/dashboard");
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
          {/* Step-specific content */}
          {currentStep === 0 && (
            <WelcomeStepContent />
          )}
          {currentStep === 1 && (
            <SaligPayStepContent />
          )}
          {currentStep === 2 && (
            <TeamStepContent onComplete={markTeamStepComplete} />
          )}
          {currentStep === 3 && (
            <SnippetStepContent />
          )}
          {currentStep === 4 && (
            <AttributionStepContent />
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            {steps[currentStep].skippable && (
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-muted-foreground"
              >
                <SkipForward className="w-4 h-4 mr-2" />
                Skip for now
              </Button>
            )}
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
    "Pay affiliates via SaligPay",
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

// SaligPay Step Content
function SaligPayStepContent() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Get current user with tenant context
  const currentUser = useQuery(api.auth.getCurrentUser);
  
  // Get connection status for the user's tenant
  const connectionStatus = useQuery(
    api.tenants.getSaligPayConnectionStatus,
    currentUser?.tenantId ? { tenantId: currentUser.tenantId as Id<"tenants"> } : "skip"
  );

  // Mutations for connect/disconnect
  const connectMockSaligPay = useMutation(api.tenants.connectMockSaligPay);
  const disconnectSaligPay = useMutation(api.tenants.disconnectSaligPay);

  const isConnected = connectionStatus?.isConnected ?? false;

  const handleConnect = async () => {
    if (!currentUser?.tenantId) {
      setConnectionError("Unable to get tenant information. Please refresh the page.");
      return;
    }
    
    try {
      setIsConnecting(true);
      setConnectionError(null);
      
      await connectMockSaligPay({ tenantId: currentUser.tenantId as Id<"tenants"> });
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentUser?.tenantId) {
      setConnectionError("Unable to get tenant information. Please refresh the page.");
      return;
    }
    
    try {
      setIsConnecting(true);
      setConnectionError(null);
      
      await disconnectSaligPay({ tenantId: currentUser.tenantId as Id<"tenants"> });
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Failed to disconnect");
    } finally {
      setIsConnecting(false);
    }
  };

  if (isConnected) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h4 className="font-medium text-green-900 dark:text-green-100">
                Connected (Mock Mode)
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300">
                Your SaligPay account is connected for testing
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDisconnect}
            disabled={isConnecting}
            className="flex-1"
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              "Disconnect"
            )}
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground text-center">
          You can now proceed to the next step or configure more settings in Settings &gt; SaligPay
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Connect your SaligPay account to receive payments from your affiliate program.
        For testing purposes, you can use the mock integration.
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
        <div className="space-y-3">
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full bg-[#1c2260] hover:bg-[#1fb5a5]"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Connect SaligPay (Mock)
              </>
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            Using mock integration for development/testing
          </p>
        </div>
      )}
    </div>
  );
}

// Team Step Content - Task 4.2: Integrated invitation form into onboarding flow
// Task 4.4: Mark step complete when invitation sent
function TeamStepContent({ onComplete }: { onComplete?: () => void }) {
  const handleInvitationSent = () => {
    // Mark step complete when invitation is sent successfully
    onComplete?.();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Invite team members to help manage your affiliate program.
      </p>
      
      {/* Task 4.2: Integrate invitation form into onboarding flow */}
      <TeamInvitationForm onInvitationSent={handleInvitationSent} />
      
      <p className="text-xs text-muted-foreground text-center">
        You can skip this step for now and invite team members later from the Settings page.
      </p>
    </div>
  );
}

// Snippet Step Content - Redirect to dedicated snippet page
function SnippetStepContent() {
  const router = useRouter();
  
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Add tracking code to your website to track affiliate referrals.
      </p>
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Step 3: Install Tracking Snippet
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

// Attribution Step Content - Redirect to checkout attribution page
function AttributionStepContent() {
  const router = useRouter();
  
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Configure how referral data flows through your SaligPay checkout sessions.
      </p>
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Step 4: Checkout Attribution Setup
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
          Pass attribution metadata through checkout to track conversions and attribute commissions automatically.
        </p>
        <Button
          onClick={() => router.push("/onboarding/checkout-attribution")}
          className="w-full bg-[#1c2260] hover:bg-[#1fb5a5]"
        >
          Configure Attribution
        </Button>
      </div>
    </div>
  );
}
