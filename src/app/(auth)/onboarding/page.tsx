"use client";

import { Suspense } from "react";
import { AppContainer } from "@/components/server";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { Skeleton } from "@/components/ui/skeleton";

function OnboardingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <Skeleton className="h-7 w-48 mx-auto mb-2" />
        <Skeleton className="h-4 w-64 mx-auto" />
      </div>
      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)] p-8">
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <AppContainer>
      <Suspense fallback={<OnboardingSkeleton />}>
        <div className="max-w-4xl mx-auto space-y-8 animate-content-in">
          <div className="text-center">
            <h1 className="text-[22px] font-bold text-[var(--text-heading)]">Getting Started</h1>
            <p className="text-[13px] text-[var(--text-muted)] mt-1.5">
              Set up your affiliate program in a few easy steps
            </p>
          </div>
          <OnboardingWizard />
        </div>
      </Suspense>
    </AppContainer>
  );
}
