import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[6px] border px-[10px] py-[4px] text-[12px] font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-all duration-150 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--brand-primary)] text-white shadow-sm [a&]:hover:bg-[var(--brand-hover)]",
        secondary:
          "border-transparent bg-[#1fb5a5] text-white [a&]:hover:bg-[#189e90]",
        destructive:
          "border-transparent bg-[var(--danger)] text-white shadow-sm [a&]:hover:bg-[var(--danger)]/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-[#3f4462] border-[#dfe1e9] bg-transparent [a&]:hover:bg-[#f6f7fa]",
        // DESIGN.md status variants
        success:
          "border-transparent bg-[#ecfdf5] text-[#059669]",
        warning:
          "border-transparent bg-[#fffbeb] text-[#d97706]",
        info:
          "border-transparent bg-[#eff6ff] text-[#2563eb]",
        // DESIGN.md additional variants
        premium:
          "border-transparent bg-[#fdf6e3] text-[#b8922f]",
        neutral:
          "border-transparent bg-[#f6f7fa] text-[#5a5f7a]",
        error:
          "border-transparent bg-[#fef2f2] text-[#dc2626]",
        // Bold variants
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
