"use client";

import { Suspense } from "react";
import { AppContainer } from "@/components/server";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default function OnboardingPage() {
  return (
    <AppContainer>
      <Suspense
        fallback={<div className="animate-pulse h-16 bg-muted rounded-lg" />}
      >
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-semibold">Getting Started</h1>
            <p className="text-muted-foreground mt-1">
              Set up your affiliate program in a few easy steps
            </p>
          </div>
          <OnboardingWizard />
        </div>
      </Suspense>
    </AppContainer>
  );
}
