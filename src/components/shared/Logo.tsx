"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface LogoProps {
  href?: string;
  className?: string;
  /**
   * Controls both shape and color variant:
   * - "full"       → full logo, dark text (for light backgrounds)
   * - "icon"       → icon only, dark (for light backgrounds)
   * - "light"      → full logo, light text (for dark backgrounds)
   * - "dark"       → full logo, dark text (alias for "full")
   */
  variant?: "full" | "icon" | "light" | "dark";
  size?: "sm" | "md" | "lg" | "xl";
  /** @deprecated Use variant="icon" instead */
  collapsed?: boolean;
}

const sizeMap = {
  sm: { height: 24, iconHeight: 24 },
  md: { height: 32, iconHeight: 32 },
  lg: { height: 48, iconHeight: 40 },
  xl: { height: 64, iconHeight: 52 },
} as const;

export function Logo({ href = "/dashboard", className, variant = "full", size = "md", collapsed }: LogoProps) {
  const [imgError, setImgError] = useState(false);
  const { height, iconHeight } = sizeMap[size];

  // Resolve effective variant
  const isIcon = variant === "icon" || collapsed;
  const isLight = variant === "light"; // light-colored logo for dark backgrounds

  // Pick the correct image source based on shape and color variant
  const src = isIcon
    ? "/logo-icon.png" // icon uses same file for both backgrounds
    : isLight
      ? "/logo-light.png" // light logo for dark backgrounds
      : "/logo.png";      // dark logo for light backgrounds

  const imgHeight = isIcon ? iconHeight : height;
  const imgWidth = isIcon ? Math.round(iconHeight * 1.2) : Math.round(height * 2.2);

  // Fallback: text-based logo when image fails to load
  if (imgError) {
    const fallback = (
      <div className={cn("flex items-center", isIcon ? "justify-center" : "gap-2", className)}>
        <span
          className={cn("font-black", isLight ? "text-white" : "text-brand-primary")}
          style={{
            fontSize: iconHeight * 0.6,
            fontFamily: "var(--font-passion), 'Poppins', sans-serif",
            lineHeight: 1,
          }}
        >
          affilio
        </span>
      </div>
    );

    if (href) {
      return <Link href={href}>{fallback}</Link>;
    }
    return fallback;
  }

  const inner = (
    <div className={cn("flex items-center", isIcon ? "justify-center" : "gap-2", className)}>
      <Image
        src={src}
        alt="affilio"
        height={imgHeight}
        width={imgWidth}
        style={{
          height: imgHeight,
          width: "auto",
          objectFit: "contain",
        }}
        onError={() => setImgError(true)}
        draggable={false}
        priority={false}
      />
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }

  return inner;
}
