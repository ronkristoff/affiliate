"use client";

import { useState, Suspense } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Clock, Info, Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type PlatformProvider = "stripe" | "saligpay";

const PROVIDER_CONFIG: Record<PlatformProvider, { label: string; description: string; badge: string }> = {
  stripe: {
    label: "Stripe",
    description: "Accept credit/debit card payments via Stripe Checkout",
    badge: "Cards",
  },
  saligpay: {
    label: "SaligPay",
    description: "Philippine digital payments (GCash, Maya, bank transfer)",
    badge: "Coming Soon",
  },
};

function PlatformSettingsContent() {
  const settings = useQuery(api.platformSettings.getPlatformSettings);
  const updateSettings = useMutation(api.platformSettings.updatePlatformSettings);

  const [trialDays, setTrialDays] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const currentTrialDays = settings?.defaultTrialDays ?? 14;
  const currentProviders = settings?.enabledPlatformProviders ?? [];

  const [syncedProviders, setSyncedProviders] = useState<PlatformProvider[] | null>(null);

  if (settings && syncedProviders === null) {
    setSyncedProviders(currentProviders);
  }

  const enabledProviders = syncedProviders ?? currentProviders;

  const handleSaveTrial = async () => {
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
      handleSaveTrial();
    }
  };

  const handleProviderToggle = async (provider: PlatformProvider, enabled: boolean) => {
    const next = enabled
      ? [...enabledProviders, provider]
      : enabledProviders.filter((p) => p !== provider);

    setSyncedProviders(next);

    setIsSaving(true);
    try {
      await updateSettings({ defaultTrialDays: currentTrialDays, enabledPlatformProviders: next });
      toast.success(`${PROVIDER_CONFIG[provider].label} ${enabled ? "enabled" : "disabled"}`);
    } catch (err) {
      setSyncedProviders(currentProviders);
      toast.error(err instanceof Error ? err.message : "Failed to update provider");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
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
                onClick={handleSaveTrial}
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

      <Card className="border-[var(--border-light)] shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-light)] flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-[var(--brand-primary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-semibold text-[var(--text-primary)]">
                Platform Payment Providers
              </CardTitle>
              <CardDescription className="text-[13px] text-[var(--text-muted)] mt-0.5">
                Which payment methods SaaS Owners can use to pay for their subscription
              </CardDescription>
            </div>
            {enabledProviders.length > 0 && (
              <Badge variant="secondary" className="shrink-0 text-xs font-medium bg-[var(--brand-light)] text-[var(--brand-primary)] border-[var(--brand-secondary)]/20">
                {enabledProviders.length} active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {(Object.entries(PROVIDER_CONFIG) as [PlatformProvider, typeof PROVIDER_CONFIG[PlatformProvider]][]).map(
              ([key, config]) => (
                <div
                  key={key}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border transition-colors",
                    enabledProviders.includes(key)
                      ? "border-[var(--brand-primary)]/20 bg-[var(--brand-light)]/30"
                      : "border-[var(--border-light)]"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Switch
                      checked={enabledProviders.includes(key)}
                      onCheckedChange={(checked) => handleProviderToggle(key, checked)}
                      disabled={isSaving || key === "saligpay"}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {config.label}
                        </span>
                        {key === "saligpay" && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            Soon
                          </Badge>
                        )}
                      </div>
                      <p className="text-[12.5px] text-[var(--text-muted)] mt-0.5">
                        {config.description}
                      </p>
                    </div>
                  </div>
                </div>
              )
            )}

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--bg-muted)] border border-[var(--border-light)]">
              <Info className="w-4 h-4 text-[var(--text-muted)] mt-0.5 shrink-0" />
              <div className="text-[12.5px] text-[var(--text-muted)] leading-relaxed space-y-1">
                <p>
                  At least one provider must be enabled for tenants to upgrade.
                  When multiple providers are active, tenants can choose at checkout.
                </p>
                <p>
                  Stripe requires <code className="text-[11px] bg-[var(--bg-muted)] px-1 rounded">STRIPE_SECRET_KEY</code> and{" "}
                  <code className="text-[11px] bg-[var(--bg-muted)] px-1 rounded">STRIPE_WEBHOOK_SECRET</code> environment variables.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
      <Card className="border-[var(--border-light)] shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full mt-3 rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}

export function PlatformSettingsClient() {
  return (
    <Suspense fallback={<PlatformSettingsSkeleton />}>
      <PlatformSettingsContent />
    </Suspense>
  );
}
