import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-semibold tracking-[0.01em] transition-all duration-150 ease disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive btn-motion",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_3px_rgba(28,34,96,0.12),0_1px_2px_rgba(28,34,96,0.08)] hover:bg-[#161c50] hover:shadow-[0_4px_12px_rgba(28,34,96,0.20)] active:bg-[#0e1333] active:shadow-[0_1px_2px_rgba(28,34,96,0.08)] active:translate-y-[1px]",
        destructive:
          "bg-destructive text-white shadow-[0_1px_3px_rgba(28,34,96,0.12),0_1px_2px_rgba(28,34,96,0.08)] hover:bg-[#dc2626] hover:shadow-[0_4px_12px_rgba(239,68,68,0.25)] focus-visible:ring-destructive/30",
        outline:
          "border border-[#dfe1e9] bg-transparent shadow-none hover:bg-[#eff6ff] hover:border-[#c4c7d4] active:bg-[#dfe1e9]",
        secondary:
          "bg-[#1fb5a5] text-white shadow-[0_1px_3px_rgba(31,181,165,0.12),0_1px_2px_rgba(31,181,165,0.08)] hover:bg-[#189e90] hover:shadow-[0_4px_12px_rgba(31,181,165,0.25)] active:bg-[#14877b] active:translate-y-[1px]",
        ghost:
          "hover:bg-[#f6f7fa] hover:text-[#1a1d2e] dark:hover:bg-[#2d3148]",
        link: "text-[#1fb5a5] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 py-3 has-[>svg]:px-[22px]",
        sm: "h-9 rounded-[8px] gap-1.5 px-4 has-[>svg]:px-3 text-[13px]",
        lg: "h-12 rounded-[12px] px-8 has-[>svg]:px-5 text-[15px]",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
