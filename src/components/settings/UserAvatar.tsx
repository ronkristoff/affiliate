"use client";

import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string | undefined;
  role: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Get user initials from name
 */
function getInitials(name: string | undefined): string {
  if (!name || name.trim().length === 0) {
    return "?";
  }
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get colors based on role
 */
function getRoleColors(role: string): { bg: string; text: string } {
  switch (role) {
    case "owner":
      return { bg: "bg-blue-100", text: "text-blue-700" };
    case "manager":
      return { bg: "bg-amber-100", text: "text-amber-700" };
    case "viewer":
    default:
      return { bg: "bg-gray-100", text: "text-gray-700" };
  }
}

/**
 * Get size classes
 */
function getSizeClasses(size: "sm" | "md" | "lg"): string {
  switch (size) {
    case "sm":
      return "h-8 w-8 text-xs";
    case "lg":
      return "h-16 w-16 text-xl";
    case "md":
    default:
      return "h-12 w-12 text-base";
  }
}

export function UserAvatar({ name, role, className, size = "md" }: UserAvatarProps) {
  const initials = getInitials(name);
  const colors = getRoleColors(role);
  const sizeClasses = getSizeClasses(size);

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-semibold",
        colors.bg,
        colors.text,
        sizeClasses,
        className
      )}
    >
      {initials}
    </div>
  );
}
