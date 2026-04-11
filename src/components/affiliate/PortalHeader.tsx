"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

interface PortalHeaderProps {
  logoUrl?: string;
  portalName: string;
  primaryColor?: string;
  pageTitle: string;
  pageDescription?: string;
}

export function PortalHeader({
  logoUrl,
  portalName,
  primaryColor,
  pageTitle,
  pageDescription,
}: PortalHeaderProps) {
  // Read primary color from CSS custom property if not explicitly provided
  const color = primaryColor || "var(--portal-primary)";

  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } catch (error) {
      // authClient.signOut() may fail if the Convex site sign-out handler
      // errors out — attempt a direct fetch as fallback to clear cookies.
      console.warn("authClient.signOut() failed, attempting direct fetch:", error);
      try {
        await fetch("/api/auth/sign-out", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          credentials: "include",
        });
      } catch (fallbackError) {
        console.error("Direct sign-out fetch also failed:", fallbackError);
      }
    }
    // Hard navigation to flush Convex query caches and stale session state
    window.location.href = "/portal/login";
  };

  return (
    <header
      className="bg-white border-b px-4 md:px-6 h-14 flex items-center justify-between"
      style={{
        borderBottomColor: color,
        borderBottomWidth: "2px",
      }}
    >
      <div className="flex items-center gap-2.5">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${portalName} logo`}
            className="w-8 h-8 object-contain rounded"
            style={{ backgroundColor: color }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              target.parentElement
                ?.querySelector(".logo-fallback")
                ?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div
          className={`logo-fallback w-8 h-8 rounded flex items-center justify-center font-bold text-white text-sm ${logoUrl ? "hidden" : ""}`}
          style={{ backgroundColor: color }}
        >
          {portalName.charAt(0).toUpperCase()}
        </div>
        <div className="hidden sm:block">
          <span className="text-sm font-bold text-gray-900">{portalName}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:block text-right">
          <span className="text-sm text-gray-600 block">{pageTitle}</span>
          {pageDescription && (
            <span className="text-[11px] text-gray-400 block leading-tight">
              {pageDescription}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-gray-600 hover:text-gray-900"
        >
          <LogOut className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </div>
    </header>
  );
}
