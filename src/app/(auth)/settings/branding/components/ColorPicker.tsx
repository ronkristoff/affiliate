"use client";

import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Calculate the relative luminance of a color per WCAG 2.1
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return rs * 0.2126 + gs * 0.7152 + bs * 0.0722;
}

/**
 * Calculate contrast ratio between two colors
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
function contrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  
  if (!rgb1 || !rgb2) return 1;
  
  const l1 = luminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = luminance(rgb2.r, rgb2.g, rgb2.b);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

/**
 * Get WCAG compliance level based on contrast ratio
 */
function getComplianceLevel(ratio: number): {
  level: "AAA" | "AA" | "Fail";
  badge: "default" | "secondary" | "destructive";
  message: string;
} {
  if (ratio >= 7) {
    return { level: "AAA", badge: "default", message: "Excellent contrast (AAA)" };
  } else if (ratio >= 4.5) {
    return { level: "AA", badge: "default", message: "Good contrast (AA)" };
  } else if (ratio >= 3) {
    return { level: "AA", badge: "secondary", message: "Acceptable for large text only" };
  } else {
    return { level: "Fail", badge: "destructive", message: "Poor contrast - not readable" };
  }
}

/**
 * Suggest a more accessible color
 */
function suggestAccessibleColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#10409a";
  
  // Simple algorithm: if too light, darken; if too dark, lighten
  const lum = luminance(rgb.r, rgb.g, rgb.b);
  
  if (lum > 0.5) {
    // Too light - darken
    const factor = 0.7;
    return `#${Math.round(rgb.r * factor).toString(16).padStart(2, '0')}${Math.round(rgb.g * factor).toString(16).padStart(2, '0')}${Math.round(rgb.b * factor).toString(16).padStart(2, '0')}`;
  } else {
    // Too dark or OK - but let's try to get to AA
    const factor = 1.3;
    return `#${Math.min(255, Math.round(rgb.r * factor)).toString(16).padStart(2, '0')}${Math.min(255, Math.round(rgb.g * factor)).toString(16).padStart(2, '0')}${Math.min(255, Math.round(rgb.b * factor)).toString(16).padStart(2, '0')}`;
  }
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [isValidHex, setIsValidHex] = useState(true);
  
  // Validate hex format
  useEffect(() => {
    const isValid = /^#[0-9A-Fa-f]{6}$/.test(value);
    setIsValidHex(isValid);
  }, [value]);
  
  // Calculate contrast with white text
  const contrastInfo = useMemo(() => {
    if (!isValidHex) return null;
    const ratio = contrastRatio(value, "#ffffff");
    return {
      ratio,
      ...getComplianceLevel(ratio),
    };
  }, [value, isValidHex]);
  
  const handleColorInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };
  
  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let hex = e.target.value;
    // Add # if not present
    if (hex && !hex.startsWith("#")) {
      hex = "#" + hex;
    }
    onChange(hex.toUpperCase());
  };
  
  const handleSuggestion = () => {
    const suggested = suggestAccessibleColor(value);
    onChange(suggested);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-start">
        {/* Color Picker Input */}
        <div className="flex-shrink-0">
          <Input
            type="color"
            value={value}
            onChange={handleColorInput}
            className="h-12 w-20 p-1 cursor-pointer"
          />
        </div>
        
        {/* Hex Input */}
        <div className="flex-1 space-y-2">
          <Label htmlFor="primary-color-hex">Hex Color Code</Label>
          <Input
            id="primary-color-hex"
            type="text"
            value={value}
            onChange={handleHexInput}
            placeholder="#10409A"
            className="font-mono"
            maxLength={7}
          />
        </div>
      </div>
      
      {/* Validation and Contrast Info */}
      {!isValidHex && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>Invalid color format. Use #RRGGBB</span>
        </div>
      )}
      
      {isValidHex && contrastInfo && (
        <div className="space-y-3">
          {/* Contrast Ratio Display */}
          <div className="flex items-center gap-3">
            <div 
              className="px-3 py-1 rounded text-white font-medium text-sm"
              style={{ backgroundColor: value }}
            >
              Aa
            </div>
            <span className="text-sm text-muted-foreground">on white</span>
            <span className="font-mono font-medium">{contrastInfo.ratio.toFixed(2)}:1</span>
            <Badge variant={contrastInfo.badge}>{contrastInfo.level}</Badge>
          </div>
          
          {/* Warning for low contrast */}
          {contrastInfo.level === "Fail" && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Low Contrast Warning</p>
                <p className="text-xs text-destructive/80">
                  This color does not meet WCAG AA standards (4.5:1). Text may be difficult to read.
                </p>
                <button
                  type="button"
                  onClick={handleSuggestion}
                  className="text-xs text-primary hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded px-1 -ml-1"
                  aria-label="Get a color suggestion with better contrast"
                >
                  Suggest an accessible color
                </button>
              </div>
            </div>
          )}
          
          {/* Success for good contrast */}
          {contrastInfo.level !== "Fail" && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>{contrastInfo.message}</span>
            </div>
          )}
          
          {/* Info for AA Large Text only */}
          {contrastInfo.level === "AA" && contrastInfo.ratio < 4.5 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
              <Info className="h-4 w-4 text-amber-600 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                This color passes for large text (18pt+ or 14pt bold) but not for normal text. Consider using a darker shade for better readability.
              </p>
            </div>
          )}
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        WCAG 2.1 requires a minimum contrast ratio of 4.5:1 for normal text (AA standard).
      </p>
    </div>
  );
}
