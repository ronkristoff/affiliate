import { cn } from "@/lib/utils";

interface PageTopbarProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Reusable sticky page top bar used across all authenticated pages.
 *
 * Provides consistent styling: sticky positioning, surface background,
 * bottom border, and horizontal padding. Each page provides its own
 * content (title, breadcrumb, actions) via `children`.
 */
export function PageTopbar({ children, className }: PageTopbarProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-50",
        "bg-[var(--bg-surface)]",
        "border-b border-[var(--border)]",
        "h-[60px] flex items-center",
        "px-8",
        className
      )}
    >
      <div className="flex items-center justify-between w-full">
        {children}
      </div>
    </div>
  );
}
