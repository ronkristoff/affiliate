import { cn } from "@/lib/utils";

interface TenantAvatarProps {
  name: string;
  className?: string;
}

// Deterministic color from tenant name hash
const AVATAR_COLORS = [
  "bg-[#1c2260]",
  "bg-[#1fb5a5]",
  "bg-[#6d28d9]",
  "bg-[#0e7490]",
  "bg-[#b45309]",
  "bg-[#c2410c]",
  "bg-[#047857]",
  "bg-[#4338ca]",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

export function TenantAvatar({ name, className }: TenantAvatarProps) {
  return (
    <div
      className={cn(
        "flex h-[34px] w-[34px] items-center justify-center rounded-lg text-xs font-bold text-white",
        getAvatarColor(name),
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
