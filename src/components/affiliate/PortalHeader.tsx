"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

interface PortalHeaderProps {
  logoUrl?: string;
  portalName: string;
  primaryColor: string;
  pageTitle: string;
}

export function PortalHeader({ logoUrl, portalName, primaryColor, pageTitle }: PortalHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/affiliate-auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "logout" }),
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    
    router.push("/portal/login");
    router.refresh();
  };

  return (
    <header 
      className="bg-white border-b border-gray-200 px-4 md:px-6 h-14 flex items-center justify-between"
      style={{ 
        borderBottomColor: primaryColor,
        borderBottomWidth: '2px'
      }}
    >
      <div className="flex items-center gap-2.5">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${portalName} logo`}
            className="w-8 h-8 object-contain rounded"
            style={{ backgroundColor: primaryColor }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement?.querySelector('.logo-fallback')?.classList.remove('hidden');
            }}
          />
        ) : null}
        <div
          className={`logo-fallback w-8 h-8 rounded flex items-center justify-center font-bold text-white text-sm ${logoUrl ? 'hidden' : ''}`}
          style={{ backgroundColor: primaryColor }}
        >
          {portalName.charAt(0).toUpperCase()}
        </div>
        <div className="hidden sm:block">
          <span className="text-sm font-bold text-gray-900">
            {portalName}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 hidden sm:block">
          {pageTitle}
        </span>
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