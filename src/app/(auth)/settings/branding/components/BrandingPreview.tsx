"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { User, DollarSign, Link as LinkIcon, CreditCard } from "lucide-react";

interface BrandingPreviewProps {
  logoUrl?: string;
  primaryColor: string;
  portalName: string;
}

/**
 * Compute a lighter version of the brand color for backgrounds
 */
function lightenColor(hex: string, amount: number = 0.8): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  
  const r = Math.min(255, Math.round(parseInt(result[1], 16) * amount + 255 * (1 - amount)));
  const g = Math.min(255, Math.round(parseInt(result[2], 16) * amount + 255 * (1 - amount)));
  const b = Math.min(255, Math.round(parseInt(result[3], 16) * amount + 255 * (1 - amount)));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Compute a darker version of the brand color
 */
function darkenColor(hex: string, amount: number = 0.2): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  
  const r = Math.round(parseInt(result[1], 16) * (1 - amount));
  const g = Math.round(parseInt(result[2], 16) * (1 - amount));
  const b = Math.round(parseInt(result[3], 16) * (1 - amount));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function BrandingPreview({ logoUrl, primaryColor, portalName }: BrandingPreviewProps) {
  // Compute color variants
  const colors = useMemo(() => ({
    primary: primaryColor,
    primaryLight: lightenColor(primaryColor, 0.9),
    primaryDark: darkenColor(primaryColor),
  }), [primaryColor]);
  
  // Determine if we need light or dark text based on background
  const textColor = useMemo(() => {
    // Simple check: if primary color is dark, use white text
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(primaryColor);
    if (!result) return "white";
    
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    return brightness > 128 ? "#1a1a2e" : "white";
  }, [primaryColor]);

  return (
    <div className="space-y-4">
      {/* Mock Portal Header */}
      <div 
        className="rounded-t-lg border-b-2 p-4 flex items-center justify-between"
        style={{ 
          backgroundColor: "white",
          borderBottomColor: primaryColor,
        }}
      >
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt="Logo" 
              className="w-8 h-8 object-contain rounded"
              style={{ backgroundColor: primaryColor }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
              }}
            />
          ) : (
            <div 
              className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: primaryColor }}
            >
              {portalName?.charAt(0)?.toUpperCase() || "P"}
            </div>
          )}
          <span className="font-semibold text-gray-900">{portalName || "Portal"}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User className="h-4 w-4" />
          <span>Affiliate</span>
        </div>
      </div>
      
      {/* Mock Portal Content */}
      <div className="bg-gray-50 p-4 space-y-4 rounded-b-lg">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white p-3 rounded-lg shadow-sm">
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <DollarSign className="h-3 w-3" />
              Earnings
            </div>
            <div className="font-semibold text-lg" style={{ color: primaryColor }}>$1,250</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm">
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <LinkIcon className="h-3 w-3" />
              Clicks
            </div>
            <div className="font-semibold text-lg" style={{ color: primaryColor }}>342</div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm">
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <User className="h-3 w-3" />
              Referrals
            </div>
            <div className="font-semibold text-lg" style={{ color: primaryColor }}>28</div>
          </div>
        </div>
        
        {/* Sample Button */}
        <div className="flex gap-2">
          <button
            className="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors"
            style={{ 
              backgroundColor: primaryColor,
              color: textColor,
            }}
          >
            View Details
          </button>
          <button
            className="flex-1 py-2 px-4 rounded-md text-sm font-medium border-2 transition-colors"
            style={{ 
              borderColor: primaryColor,
              color: primaryColor,
              backgroundColor: "white",
            }}
          >
            Get Link
          </button>
        </div>
        
        {/* Sample List */}
        <div className="bg-white rounded-lg shadow-sm p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Recent Commission</span>
            <span className="font-medium" style={{ color: primaryColor }}>+$75.00</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Pending Commission</span>
            <span className="font-medium text-gray-900">+$45.00</span>
          </div>
        </div>
      </div>
      
      <p className="text-xs text-center text-muted-foreground">
        This is a preview. Actual appearance may vary.
      </p>
    </div>
  );
}
