import { SettingsNav } from "@/components/settings/SettingsNav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-var(--topbar-height))] bg-[var(--bg-page)]">
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row gap-8">
          <aside className="w-full md:w-60 flex-shrink-0">
            <div className="sticky top-[calc(var(--topbar-height)+24px)]">
              <h2 className="text-sm font-semibold text-heading px-3 mb-1">Settings</h2>
              <p className="text-[12px] text-[var(--text-muted)] mb-4 px-3">
                Manage your account, branding, and program configuration
              </p>
              <SettingsNav />
            </div>
          </aside>
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
