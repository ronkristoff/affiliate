import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Getting Started | salig-affiliate",
  description: "Set up your affiliate program in a few easy steps",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Progress indicator is handled by OnboardingWizard component */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
