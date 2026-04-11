import { PlatformSettingsClient } from "./_components/PlatformSettingsClient";

export default function PlatformSettingsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="px-8 py-6 max-w-3xl">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            Platform Settings
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">
            Configure platform-wide defaults. Changes apply to new tenants only.
          </p>
        </div>

        {/* Settings Form */}
        <PlatformSettingsClient />
      </div>
    </div>
  );
}
