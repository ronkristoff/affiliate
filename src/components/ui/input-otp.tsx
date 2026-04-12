"use client"

import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"
import { MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput>) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "flex items-center gap-2 has-[:disabled]:opacity-50",
        containerClassName,
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  )
}

function InputOTPGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center", className)}
      {...props}
    />
  )
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & { index: number }) {
  const inputOTPContext = React.useContext(OTPInputContext)
  const slot = inputOTPContext.slots[index]
  const hasValue = Boolean(slot?.char)

  return (
    <div
      data-slot="input-otp-slot"
      className={cn(
        "relative flex h-14 w-12 items-center justify-center border-y border-r border-input text-2xl shadow-xs transition-all first:rounded-l-lg first:border-l last:rounded-r-lg",
        "focus-within:border-[#1c2260] focus-within:ring-[3px] focus-within:ring-[#1c2260]/10",
        hasValue && "border-[#1c2260]",
        className,
      )}
      {...props}
    >
      {slot?.char && (
        <div className="animate-fade-in">
          {slot.char}
        </div>
      )}
    </div>
  )
}

function InputOTPSeparator({
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-separator"
      role="separator"
      {...props}
    >
      <MinusIcon />
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
