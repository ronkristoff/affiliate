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
        "bg-white border-b border-[#eeeef3]",
        "px-8 py-3",
        className
      )}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 mb-1.5" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.label} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight className="w-3 h-3 text-[#9da1b4]/50" />
              )}
              {crumb.href && i < breadcrumbs.length - 1 ? (
                <Link
                  href={crumb.href}
                  className="text-[11.5px] text-[#5a5f7a] hover:text-[#1c2260] transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[11.5px] text-[#5a5f7a] font-medium">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex items-start justify-between w-full gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 min-w-0">{children}</div>
          {description && (
            <p className="text-[11.5px] text-[#5a5f7a] mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          <TopbarNotificationBell />
        </div>
      </div>
    </div>
  );
}
