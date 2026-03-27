import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  href?: string;
  className?: string;
  variant?: "default" | "light" | "dark";
  collapsed?: boolean;
}

export function Logo({ href = "/dashboard", className, variant = "default", collapsed = false }: LogoProps) {
  const isLight = variant === "light";
  const isDark = variant === "dark";

  const textColor = isLight ? "text-white" : "text-[#022232]";
  const accentColor = "text-[#7dd3fc]";

  const inner = (
    <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3", className)}>
      {/* More dramatic logo icon with gradient and shadow */}
      <div className="relative flex-shrink-0">
        <div 
          className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white relative z-10"
          style={{ 
            background: 'linear-gradient(135deg, #1659d6 0%, #10409a 100%)',
            boxShadow: '0 4px 12px rgba(22, 89, 214, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
          }}
        >
          <span style={{ fontFamily: 'var(--font-passion)' }}>S</span>
        </div>
        {/* Decorative glow */}
        <div 
          className="absolute inset-0 rounded-xl blur-md opacity-40 -z-0"
          style={{ background: 'linear-gradient(135deg, #1659d6 0%, #10409a 100%)' }}
        />
      </div>
      {!collapsed && (
        <div className={cn("text-[16px] font-black tracking-[-0.5px]", textColor)} style={{ fontFamily: 'var(--font-passion)' }}>
          salig<span className={accentColor}>affiliate</span>
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }

  return inner;
}
