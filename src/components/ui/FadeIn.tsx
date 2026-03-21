"use client";

import { cn } from "@/lib/utils";

interface FadeInProps {
  children: React.ReactNode;
  /** Delay in ms — default 0. Use for stagger effects. */
  delay?: number;
  /** Extra classes */
  className?: string;
  /** Disable animation entirely (e.g. during loading) */
  disabled?: boolean;
}

/**
 * Lightweight CSS-only fade-slide-up entrance animation.
 * Uses the `animate-fade-slide-up` utility from globals.css
 * with a `--stagger-delay` custom property for timing.
 */
export function FadeIn({
  children,
  delay = 0,
  className,
  disabled = false,
}: FadeInProps) {
  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={cn("animate-fade-slide-up", className)}
      style={{ "--stagger-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
