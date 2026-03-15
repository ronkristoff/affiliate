"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { AppContainer } from "@/components/server";
import { TrackingSnippetInstaller } from "@/components/onboarding/TrackingSnippetInstaller";

export default function OnboardingSnippetPage() {
  const router = useRouter();

  const handleComplete = () => {
    router.push("/dashboard");
  };

  const handleSkip = () => {
    router.push("/dashboard");
  };

  return (
    <AppContainer>
      <Suspense
        fallback={<div className="animate-pulse h-16 bg-muted rounded-lg" />}
      >
        <div className="max-w-4xl mx-auto space-y-8 py-8">
          <TrackingSnippetInstaller
            onComplete={handleComplete}
            onSkip={handleSkip}
          />
        </div>
      </Suspense>
    </AppContainer>
  );
}
