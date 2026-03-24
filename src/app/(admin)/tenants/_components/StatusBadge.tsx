import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "active" | "trial" | "suspended" | "flagged";
  className?: string;
}

const STATUS_CONFIG = {
  active: {
    label: "Active",
    dotColor: "bg-[var(--success)]",
    bg: "bg-[var(--success-bg)]",
    text: "text-[var(--success-text)]",
  },
  trial: {
    label: "Trial",
    dotColor: "bg-[var(--info)]",
    bg: "bg-[var(--info-bg)]",
    text: "text-[var(--info-text)]",
  },
  suspended: {
    label: "Suspended",
    dotColor: "bg-[var(--danger)]",
    bg: "bg-[var(--danger-bg)]",
    text: "text-[var(--danger-text)]",
  },
  flagged: {
    label: "Flagged",
    dotColor: "bg-[var(--warning)]",
    bg: "bg-[var(--warning-bg)]",
    text: "text-[var(--warning-text)]",
  },
} as const;

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotColor)} />
      {config.label}
    </span>
  );
}
