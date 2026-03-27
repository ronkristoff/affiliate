import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  href?: string;
  className?: string;
  variant?: "default" | "light" | "dark";
}

export function Logo({ href = "/dashboard", className, variant = "default" }: LogoProps) {
  const isLight = variant === "light";
  const isDark = variant === "dark";

  const textColor = isLight ? "text-white" : "text-[#022232]";
  const accentColor = "text-[#7dd3fc]";

  const inner = (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="w-8 h-8 bg-[#1659d6] rounded-lg flex items-center justify-center font-black text-sm text-white flex-shrink-0">
        S
      </div>
      <div className={cn("text-[15px] font-bold tracking-[-0.3px]", textColor)}>
        salig<span className={accentColor}>affiliate</span>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }

  return inner;
}
