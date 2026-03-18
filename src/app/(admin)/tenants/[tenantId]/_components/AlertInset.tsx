"use client";

import { AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertInsetProps {
  variant: "danger" | "warning";
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

const variantConfig = {
  danger: {
    container: "bg-[#fef2f2] border-[#fecaca]",
    title: "text-[#991b1b]",
    description: "text-[#b91c1c]",
    action: "text-[#991b1b] hover:text-[#7f1d1d]",
    icon: AlertTriangle,
  },
  warning: {
    container: "bg-[#fffbeb] border-[#fde68a]",
    title: "text-[#92400e]",
    description: "text-[#b45309]",
    action: "text-[#92400e] hover:text-[#78350f]",
    icon: AlertCircle,
  },
} as const;

export function AlertInset({
  variant,
  title,
  description,
  actionText,
  onAction,
}: AlertInsetProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-[10px] border p-4",
        config.container
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", config.title)} />
        <div className="flex-1 space-y-1">
          <p className={cn("text-sm font-semibold", config.title)}>{title}</p>
          <p className={cn("text-sm", config.description)}>{description}</p>
          {actionText && onAction && (
            <button
              type="button"
              onClick={onAction}
              className={cn(
                "mt-2 text-sm font-medium underline underline-offset-2 transition-colors",
                config.action
              )}
            >
              {actionText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
