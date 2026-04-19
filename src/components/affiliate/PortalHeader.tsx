"use client";

import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
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
  const color = primaryColor || "var(--portal-primary)";

  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } catch (error) {
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
    window.location.href = "/portal/login";
  };

  return (
    <header
      className="bg-white border-b border-slate-200 px-4 md:px-6 h-14 flex items-center justify-between shadow-sm"
    >
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${portalName} logo`}
            className="h-7 w-auto object-contain"
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
          className={`logo-fallback h-7 px-2.5 rounded flex items-center justify-center font-bold text-white text-xs ${
            logoUrl ? "hidden" : ""
          }`}
          style={{ backgroundColor: color }}
        >
          {portalName.charAt(0).toUpperCase()}
        </div>
        <div className="h-5 w-px bg-slate-200 hidden sm:block" />
        <span className="hidden sm:block text-sm font-medium text-slate-700">
          {portalName}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:block text-right">
          <span className="text-sm font-medium text-slate-800 block">
            {pageTitle}
          </span>
          {pageDescription && (
            <span className="text-[11px] text-slate-500 block leading-tight">
              {pageDescription}
            </span>
          )}
        </div>
        <div className="h-5 w-px bg-slate-200 hidden md:block" />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline ml-1.5">Sign Out</span>
        </Button>
      </div>
    </header>
  );
}
