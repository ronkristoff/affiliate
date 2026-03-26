"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { TrackingSnippetInstaller } from "@/components/onboarding/TrackingSnippetInstaller";
import { PageTopbar } from "@/components/ui/PageTopbar";

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
    <div className="animate-fade-in">
      <PageTopbar description="Configure and manage your website tracking snippet">
        <h1 className="text-lg font-semibold text-heading">Tracking Code</h1>
      </PageTopbar>
      <div className="px-8 py-6">
        <div className="max-w-4xl">
          <Suspense
            fallback={<div className="animate-pulse h-16 bg-muted rounded-lg" />}
          >
            <TrackingSnippetInstaller
              onComplete={handleComplete}
              onSkip={handleSkip}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
