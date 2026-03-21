import { SettingsNav } from "@/components/settings/SettingsNav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Settings Navigation Sidebar */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="sticky top-8">
            <h2 className="text-lg font-semibold mb-1 px-2">Settings</h2>
            <p className="text-[12px] text-[var(--text-muted)] mb-4 px-2">Manage your account, branding, and program configuration</p>
            <SettingsNav />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
