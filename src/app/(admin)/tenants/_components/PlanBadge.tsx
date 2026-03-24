import { cn } from "@/lib/utils";

interface PlanBadgeProps {
  plan: string;
  className?: string;
}

const PLAN_CONFIG: Record<string, { label: string; bg: string; text: string; border?: string }> = {
  starter: {
    label: "Starter",
    bg: "bg-[var(--bg-page)]",
    text: "text-[var(--text-muted)]",
    border: "border border-[var(--border)]",
  },
  growth: {
    label: "Growth",
    bg: "bg-[#ede9fe]",
    text: "text-[#6d28d9]",
  },
  scale: {
    label: "Scale",
    bg: "bg-[var(--warning-bg)]",
    text: "text-[var(--warning-text)]",
  },
  pro: {
    label: "Pro",
    bg: "bg-[var(--warning-bg)]",
    text: "text-[var(--warning-text)]",
  },
};

function getPlanConfig(plan: string) {
  const normalizedPlan = plan.toLowerCase();
  return PLAN_CONFIG[normalizedPlan] ?? {
    label: plan,
    bg: "bg-[var(--bg-page)]",
    text: "text-[var(--text-muted)]",
  };
}

export function PlanBadge({ plan, className }: PlanBadgeProps) {
  const config = getPlanConfig(plan);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      {config.label}
    </span>
  );
}
