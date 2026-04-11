"use client";

import { useState, Suspense } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Clock, Info, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// =============================================================================
// Content component (hooks inside, wrapped by Suspense)
// =============================================================================

function PlatformSettingsContent() {
  const settings = useQuery(api.platformSettings.getPlatformSettings);
  const updateSettings = useMutation(api.platformSettings.updatePlatformSettings);

  const [trialDays, setTrialDays] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Sync input when settings load
  const currentTrialDays = settings?.defaultTrialDays ?? 14;

  const handleSave = async () => {
    const parsed = parseInt(trialDays, 10);

    if (isNaN(parsed) || parsed < 1 || parsed > 365) {
      toast.error("Trial days must be a whole number between 1 and 365");
      return;
    }

    if (parsed === currentTrialDays) {
      toast.info("No changes to save");
      return;
    }

    setIsSaving(true);
    try {
      await updateSettings({ defaultTrialDays: parsed });
      toast.success(`Default trial duration updated to ${parsed} days`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    }
  };

  return (
    <div className="space-y-6">
      {/* Trial Duration Card */}
      <Card className="border-[var(--border-light)] shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-light)] flex items-center justify-center">
              <Clock className="w-5 h-5 text-[var(--brand-primary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-semibold text-[var(--text-primary)]">
                Free Trial Duration
              </CardTitle>
              <CardDescription className="text-[13px] text-[var(--text-muted)] mt-0.5">
                Number of days new tenants get on the free trial
              </CardDescription>
            </div>
            <Badge variant="secondary" className="shrink-0 text-xs font-medium bg-[var(--brand-light)] text-[var(--brand-primary)] border-[var(--brand-secondary)]/20">
              Currently: {currentTrialDays} days
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Input row */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-[200px]">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  placeholder={String(currentTrialDays)}
                  value={trialDays}
                  onChange={(e) => setTrialDays(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-10 text-sm pr-12"
                  disabled={isSaving}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] pointer-events-none">
                  days
                </span>
              </div>

              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || trialDays === "" || parseInt(trialDays, 10) === currentTrialDays}
                className="h-10"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Saving...
                  </>
                ) : showSuccess ? (
                  <>
                    <Check className="w-4 h-4 mr-1.5" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1.5" />
                    Save
                  </>
                )}
              </Button>
            </div>

            {/* Info box */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--bg-muted)] border border-[var(--border-light)]">
              <Info className="w-4 h-4 text-[var(--text-muted)] mt-0.5 shrink-0" />
              <div className="text-[12.5px] text-[var(--text-muted)] leading-relaxed space-y-1">
                <p>
                  This setting applies to <strong>newly created tenants only</strong>.
                  Existing tenants keep their current trial end date.
                </p>
                <p>
                  Accepted range: <strong>1–365 days</strong>.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Future Settings Placeholder */}
      <Card className="border-[var(--border-light)] shadow-sm opacity-60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-[var(--text-muted)]">
            More Settings Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Default grace period (days)",
              "Max trial extension (days)",
              "Auto-cancellation threshold",
            ].map((label) => (
              <div
                key={label}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-dashed border-[var(--border-light)]"
              >
                <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]/30" />
                <span className="text-[13px] text-[var(--text-muted)]">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// Skeleton fallback
// =============================================================================

function PlatformSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="border-[var(--border-light)] shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-[200px]" />
            <Skeleton className="h-10 w-24" />
          </div>
          <Skeleton className="h-16 w-full mt-4 rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// Exported wrapper with Suspense
// =============================================================================

export function PlatformSettingsClient() {
  return (
    <Suspense fallback={<PlatformSettingsSkeleton />}>
      <PlatformSettingsContent />
    </Suspense>
  );
}
