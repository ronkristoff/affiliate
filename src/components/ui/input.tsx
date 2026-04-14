import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base styles
        "file:text-foreground placeholder:text-[#9da1b4] selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-11 w-full min-w-0 rounded-[10px] border-[1.5px] border-[#dfe1e9] bg-white px-4 py-3 text-[14px] text-[#1a1d2e] shadow-xs transition-[color,box-shadow] duration-150 ease outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        // Focus state
        "focus:border-[#1fb5a5] focus:shadow-[0_0_0_3px_rgba(31,181,165,0.15)]",
        // Error state
        className,
        "aria-invalid:border-[#ef4444] aria-invalid:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]"
      )}
      {...props}
    />
  )
}

export { Input }
