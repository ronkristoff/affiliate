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
          {/* Settings Sidebar */}
          <aside className="w-full md:w-60 flex-shrink-0">
            <div className="sticky top-[calc(var(--topbar-height)+24px)]">
              <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-light)] p-4">
                <h2 className="text-[14px] font-bold text-[var(--text-heading)] px-2 mb-0.5">Settings</h2>
                <p className="text-[11.5px] text-[var(--text-muted)] mb-4 px-2 leading-relaxed">
                  Manage your account, branding, and program configuration
                </p>
                <div className="divider mb-3" />
                <SettingsNav />
              </div>
            </div>
          </aside>

          {/* Settings Content */}
          <main className="flex-1 min-w-0 animate-content-in">{children}</main>
        </div>
      </div>
    </div>
  );
}
