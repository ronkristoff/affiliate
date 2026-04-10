import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { TopbarNotificationBell } from "@/components/notifications/TopbarNotificationBell";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageTopbarProps {
  children: React.ReactNode;
  className?: string;
  description?: string;
  /** Optional breadcrumb trail shown above the page title */
  breadcrumbs?: BreadcrumbItem[];
  /**
   * Optional actions rendered between the page title (left) and the
   * notification bell (far right). Use this for primary / secondary
   * action buttons that need to sit at the right side of the topbar.
   */
  actions?: React.ReactNode;
}

/**
 * Reusable sticky page top bar used across all authenticated pages.
 *
 * Provides consistent styling: sticky positioning, surface background,
 * bottom border, and horizontal padding. Each page provides its own
 * content (title, breadcrumb) via `children` and action buttons via
 * the optional `actions` prop.
 *
 * Layout: [title / breadcrumb ……… actions | 🔔]
 *
 * An optional `description` renders a subtle line under the heading area.
 * Optional `breadcrumbs` renders a navigation trail above the title.
 *
 * A notification bell (Radix Popover) is always rendered on the far
 * right of the top bar, automatically showing unread count and panel
 * for the authenticated user.
 */
export function PageTopbar({ children, className, description, breadcrumbs, actions }: PageTopbarProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-50",
        "bg-[var(--bg-surface)] border-b border-[var(--border-light)]",
        description ? "px-8 py-3 flex flex-col justify-center" : "h-[60px] flex items-center px-8",
        className
      )}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 mb-1.5" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.label} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight className="w-3 h-3 text-[var(--text-muted)]/50" />
              )}
              {crumb.href && i < breadcrumbs.length - 1 ? (
                <Link
                  href={crumb.href}
                  className="text-[11.5px] text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[11.5px] text-[var(--text-muted)] font-medium">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex items-center justify-between w-full gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">{children}</div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        <TopbarNotificationBell />
      </div>
      {description && (
        <p className="text-[11.5px] text-[var(--text-muted)] mt-[-2px] leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
