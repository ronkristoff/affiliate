import { cn } from "@/lib/utils";

interface PlanBadgeProps {
  plan: string;
  className?: string;
}

const PLAN_CONFIG: Record<string, { label: string; bg: string; text: string; border?: string }> = {
  starter: {
    label: "Starter",
    bg: "bg-[#f3f4f6]",
    text: "text-[#6b7280]",
    border: "border border-[#e5e7eb]",
  },
  growth: {
    label: "Growth",
    bg: "bg-[#ede9fe]",
    text: "text-[#6d28d9]",
  },
  scale: {
    label: "Scale",
    bg: "bg-[#fef3c7]",
    text: "text-[#92400e]",
  },
  pro: {
    label: "Pro",
    bg: "bg-[#fef3c7]",
    text: "text-[#92400e]",
  },
};

function getPlanConfig(plan: string) {
  const normalizedPlan = plan.toLowerCase();
  return PLAN_CONFIG[normalizedPlan] ?? {
    label: plan,
    bg: "bg-[#f3f4f6]",
    text: "text-[#6b7280]",
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
