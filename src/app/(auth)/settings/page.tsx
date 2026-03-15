"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Settings index page - redirects to Profile by default
 */
export default function SettingsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to profile by default
    router.replace("/settings/profile");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
}
