import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "active" | "trial" | "suspended" | "flagged";
  className?: string;
}

const STATUS_CONFIG = {
  active: {
    label: "Active",
    dotColor: "bg-emerald-500",
    bg: "bg-[#d1fae5]",
    text: "text-[#065f46]",
  },
  trial: {
    label: "Trial",
    dotColor: "bg-blue-500",
    bg: "bg-[#dbeafe]",
    text: "text-[#1e40af]",
  },
  suspended: {
    label: "Suspended",
    dotColor: "bg-red-500",
    bg: "bg-[#fee2e2]",
    text: "text-[#991b1b]",
  },
  flagged: {
    label: "Flagged",
    dotColor: "bg-amber-500",
    bg: "bg-[#fef3c7]",
    text: "text-[#92400e]",
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
