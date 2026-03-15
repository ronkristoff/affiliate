"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { TrackingSnippetInstaller } from "@/components/onboarding/TrackingSnippetInstaller";

export default function SettingsTrackingPage() {
  const router = useRouter();

  const handleComplete = () => {
    // Stay on the page after completion
    router.refresh();
  };

  const handleSkip = () => {
    // Stay on the page
    router.refresh();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tracking Code</h1>
        <p className="text-muted-foreground mt-1">
          Configure and manage your website tracking snippet
        </p>
      </div>

      <Suspense
        fallback={<div className="animate-pulse h-16 bg-muted rounded-lg" />}
      >
        <TrackingSnippetInstaller
          onComplete={handleComplete}
          onSkip={handleSkip}
        />
      </Suspense>
    </div>
  );
}
