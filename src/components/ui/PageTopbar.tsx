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
 *
 * @example
 * // Standard page header
 * <PageTopbar>
 *   <div>
 *     <h1>Dashboard</h1>
 *     <p>Track your performance</p>
 *   </div>
 *   <Button>Action</Button>
 * </PageTopbar>
 *
 * @example
 * // Breadcrumb style
 * <PageTopbar>
 *   <div>
 *     <div className="flex items-center gap-2">
 *       <Link href="/campaigns">Campaigns</Link>
 *       <span>/</span>
 *       <span>Campaign Name</span>
 *     </div>
 *     <p>Manage campaign details</p>
 *   </div>
 * </PageTopbar>
 *
 * @example
 * // Skeleton/loading state
 * <PageTopbar>
 *   <div>
 *     <Skeleton className="h-5 w-32" />
 *     <Skeleton className="h-3 w-64 mt-1" />
 *   </div>
 * </PageTopbar>
 */
export function PageTopbar({ children, className }: PageTopbarProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-50",
        "bg-[var(--bg-surface)]",

        "px-6 lg:px-8",
        "py-3.5",
        className
      )}
    >
      <div className="flex items-center justify-between w-full">
        {children}
      </div>
    </div>
  );
}
