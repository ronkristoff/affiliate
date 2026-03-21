import { cn } from "@/lib/utils";

interface PageTopbarProps {
  children: React.ReactNode;
  className?: string;
  description?: string;
}

/**
 * Reusable sticky page top bar used across all authenticated pages.
 *
 * Provides consistent styling: sticky positioning, surface background,
 * bottom border, and horizontal padding. Each page provides its own
 * content (title, breadcrumb, actions) via `children`.
 *
 * An optional `description` renders a subtle line under the heading area.
 */
export function PageTopbar({ children, className, description }: PageTopbarProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-50",
        "bg-[var(--bg-surface)]",
        description
          ? "px-8 py-3"
          : "h-[60px] flex items-center px-8",
        className
      )}
    >
      <div className="flex items-center justify-between w-full">
        {children}
      </div>
      {description && (
        <p className="text-[12px] text-[var(--text-muted)] mt-[-4px]">
          {description}
        </p>
      )}
    </div>
  );
}
