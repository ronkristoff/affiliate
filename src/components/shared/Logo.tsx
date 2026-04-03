"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface LogoProps {
  href?: string;
  className?: string;
  /** "full" = full logo, "icon" = icon only. Legacy "light"/"dark" accepted for backward compat. */
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

  // Resolve effective variant — legacy props map to new system
  const isIcon = variant === "icon" || collapsed;
  const src = isIcon ? "/logo-icon.png" : "/logo.png";
  const imgHeight = isIcon ? iconHeight : height;
  const imgWidth = isIcon ? Math.round(iconHeight * 1.2) : Math.round(height * 2.2);

  // Fallback: text-based logo when image fails to load
  if (imgError) {
    const fallback = (
      <div className={cn("flex items-center", isIcon ? "justify-center" : "gap-2", className)}>
        <span
          className="font-black text-brand-primary"
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
