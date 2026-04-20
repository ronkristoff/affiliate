import { PlatformSettingsClient } from "./_components/PlatformSettingsClient";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, ArrowRight } from "lucide-react";

export default function PlatformSettingsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="px-8 py-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            Platform Settings
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">
            Configure platform-wide defaults. Changes apply to new tenants only.
          </p>
        </div>

        <PlatformSettingsClient />

        <div className="mt-6">
          <Card className="border-[var(--border-light)] shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--brand-light)] flex items-center justify-center">
                    <Mail className="w-5 h-5 text-[var(--brand-primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold text-[var(--text-primary)]">
                      Platform Email Templates
                    </CardTitle>
                    <CardDescription className="text-[13px] text-[var(--text-muted)] mt-0.5">
                      Customize emails sent to SaaS owners for billing events (payment confirmation, trial expiry, etc.)
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Link href="/admin-settings/email-templates">
                <div className="flex items-center gap-2 p-3 rounded-lg border border-[var(--border-light)] hover:bg-[var(--bg-muted)] transition-colors group cursor-pointer">
                  <span className="text-sm text-[var(--text-primary)]">Manage 6 platform billing email templates</span>
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors ml-auto" />
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
