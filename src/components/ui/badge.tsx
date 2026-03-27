import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-lg border px-2.5 py-0.5 text-[11px] font-bold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-all duration-150 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--brand-primary)] text-white shadow-sm [a&]:hover:bg-[var(--brand-hover)]",
        secondary:
          "border-transparent bg-[var(--brand-secondary)] text-white [a&]:hover:bg-[var(--brand-secondary)]/90",
        destructive:
          "border-transparent bg-[var(--danger)] text-white shadow-sm [a&]:hover:bg-[var(--danger)]/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground border-[var(--border)] bg-transparent [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        success:
          "border-transparent bg-[var(--success-bg)] text-[var(--success-text)] shadow-sm",
        warning:
          "border-transparent bg-[var(--warning-bg)] text-[var(--warning-text)] shadow-sm",
        info:
          "border-transparent bg-[var(--info-bg)] text-[var(--info-text)] shadow-sm",
        // New bolder variants
        successBold:
          "border-transparent bg-gradient-to-r from-[var(--success)] to-[#059669] text-white shadow-lg shadow-[var(--success)]/20",
        warningBold:
          "border-transparent bg-gradient-to-r from-[var(--warning)] to-[#d97706] text-white shadow-lg shadow-[var(--warning)]/20",
        dangerBold:
          "border-transparent bg-gradient-to-r from-[var(--danger)] to-[#dc2626] text-white shadow-lg shadow-[var(--danger)]/20",
        brand:
          "border-transparent bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-secondary)] text-white shadow-lg shadow-[var(--brand-primary)]/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
