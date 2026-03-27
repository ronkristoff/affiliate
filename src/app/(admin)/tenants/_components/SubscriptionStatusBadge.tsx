import { cn } from "@/lib/utils";

interface SubscriptionStatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  trial: {
    label: "Trial",
    bg: "bg-blue-100",
    text: "text-blue-800",
  },
  active: {
    label: "Active",
    bg: "bg-green-100",
    text: "text-green-800",
  },
  cancelled: {
    label: "Cancelled",
    bg: "bg-red-100",
    text: "text-red-800",
  },
  past_due: {
    label: "Past Due",
    bg: "bg-yellow-100",
    text: "text-yellow-800",
  },
};

function getStatusConfig(status: string | null | undefined) {
  if (!status) {
    return { label: "None", bg: "bg-[var(--bg-page)]", text: "text-[var(--text-muted)]" };
  }
  return STATUS_CONFIG[status] ?? { label: status, bg: "bg-[var(--bg-page)]", text: "text-[var(--text-muted)]" };
}

export function SubscriptionStatusBadge({ status, className }: SubscriptionStatusBadgeProps) {
  const config = getStatusConfig(status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
        config.bg,
        config.text,
        className
      )}
    >
      {config.label}
    </span>
  );
}
