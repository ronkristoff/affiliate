"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, Check, CreditCard, Users, Code, ArrowRight, SkipForward } from "lucide-react";

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
                ? "bg-[#10409a] text-white" 
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
            <TeamStepContent />
          )}
          {currentStep === 3 && (
            <SnippetStepContent />
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
                className="bg-[#10409a] hover:bg-[#1659d6]"
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
        Welcome to salig-affiliate! Let&apos;s set up your affiliate program in just a few minutes.
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
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Connect your SaligPay account to receive payments from your affiliate program.
      </p>
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Coming Soon
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          SaligPay integration is being developed in Story 2.3. You can skip this step for now.
        </p>
      </div>
    </div>
  );
}

// Team Step Content
function TeamStepContent() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Invite team members to help manage your affiliate program.
      </p>
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Coming Soon
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Team member invitation is being developed in Story 2.4. You can skip this step for now.
        </p>
      </div>
    </div>
  );
}

// Snippet Step Content
function SnippetStepContent() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        Add tracking code to your website to track affiliate referrals.
      </p>
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Coming Soon
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Tracking snippet setup is being developed in Story 2.8. You can skip this step for now.
        </p>
      </div>
    </div>
  );
}
